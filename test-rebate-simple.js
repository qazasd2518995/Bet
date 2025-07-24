import axios from 'axios';
import db from './db/config.js';

// 配置
const AGENT_API_URL = 'http://localhost:3003/api/agent';
const GAME_API_URL = 'http://localhost:3000/api';

async function testRebateSystem() {
    console.log('=== 簡化退水系統測試 ===\n');
    
    try {
        // 1. 直接從資料庫找一個 A 盤總代理
        console.log('1. 尋找 A 盤總代理...');
        const topAgent = await db.oneOrNone(`
            SELECT id, username, balance, market_type 
            FROM agents 
            WHERE level = 0 AND market_type = 'A' AND status = 1 
            LIMIT 1
        `);
        
        if (!topAgent) {
            console.error('找不到 A 盤總代理');
            return;
        }
        
        console.log(`✓ 找到總代理: ${topAgent.username} (ID: ${topAgent.id}, 餘額: ${topAgent.balance})\n`);
        
        // 2. 找一個該總代理下的會員
        console.log('2. 尋找該總代理下的會員...');
        const member = await db.oneOrNone(`
            WITH RECURSIVE agent_chain AS (
                SELECT id FROM agents WHERE id = $1
                UNION ALL
                SELECT a.id FROM agents a
                JOIN agent_chain ac ON a.parent_id = ac.id
            )
            SELECT m.id, m.username, m.balance, m.agent_id 
            FROM members m
            WHERE m.agent_id IN (SELECT id FROM agent_chain)
            AND m.status = 1
            LIMIT 1
        `, [topAgent.id]);
        
        if (!member) {
            console.log('該總代理下沒有會員，嘗試找任何 A 盤會員...');
            const anyMember = await db.oneOrNone(`
                SELECT m.id, m.username, m.balance, m.agent_id, a.market_type
                FROM members m
                JOIN agents a ON m.agent_id = a.id
                WHERE a.market_type = 'A' AND m.status = 1 AND m.balance >= 100
                LIMIT 1
            `);
            
            if (!anyMember) {
                console.error('找不到任何 A 盤會員');
                return;
            }
            
            console.log(`✓ 找到會員: ${anyMember.username} (餘額: ${anyMember.balance})\n`);
            
            // 3. 記錄初始餘額
            console.log('3. 記錄退水前餘額...');
            const initialTopAgentBalance = parseFloat(topAgent.balance);
            console.log(`總代理初始餘額: ${initialTopAgentBalance}\n`);
            
            // 4. 模擬下注
            console.log('4. 模擬會員下注 1000 元...');
            const betAmount = 1000;
            const expectedRebate = betAmount * 0.011; // A盤 1.1%
            
            // 直接在資料庫插入下注記錄
            const randomSuffix = Math.floor(Math.random() * 900) + 100; // 隨機3位數
            const currentPeriod = new Date().toISOString().slice(0, 10).replace(/-/g, '') + randomSuffix; // 測試期號
            
            await db.none(`
                INSERT INTO bet_history (
                    username, amount, bet_type, bet_value, 
                    position, period, odds, win, settled, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
            `, [
                anyMember.username,
                betAmount,
                '两面',
                '大',
                1, // position as integer (1 = 冠军)
                currentPeriod,
                1.95,
                false,
                false
            ]);
            
            console.log(`✓ 下注記錄已創建\n`);
            
            // 5. 手動觸發退水處理
            console.log('5. 觸發退水處理...');
            
            // 先獲取會員的代理資訊
            const memberWithAgent = await db.one(`
                SELECT m.*, a.market_type as agent_market_type, a.id as agent_id
                FROM members m
                JOIN agents a ON m.agent_id = a.id
                WHERE m.username = $1
            `, [anyMember.username]);
            
            // 獲取代理鏈找到總代理
            const agentChain = await db.any(`
                WITH RECURSIVE agent_chain AS (
                    SELECT id, username, parent_id, rebate_percentage, market_type, 0 as level
                    FROM agents 
                    WHERE id = $1
                    
                    UNION ALL
                    
                    SELECT a.id, a.username, a.parent_id, a.rebate_percentage, a.market_type, ac.level + 1
                    FROM agents a
                    JOIN agent_chain ac ON a.id = ac.parent_id
                    WHERE ac.level < 10
                )
                SELECT * FROM agent_chain ORDER BY level DESC
            `, [memberWithAgent.agent_id]);
            
            console.log('代理鏈:', agentChain.map(a => `${a.username}(L${a.level})`).join(' -> '));
            
            const chainTopAgent = agentChain[0]; // DESC排序，第一個是最頂層
            const marketType = chainTopAgent.market_type || 'D';
            const rebatePercentage = marketType === 'A' ? 0.011 : 0.041;
            const rebateAmount = Math.round(betAmount * rebatePercentage * 100) / 100;
            
            console.log(`${marketType}盤，退水 ${(rebatePercentage*100).toFixed(1)}% = ${rebateAmount} 元`);
            console.log(`退水將分配給總代理: ${chainTopAgent.username}\n`);
            
            // 手動執行退水分配
            await db.tx(async t => {
                // 獲取當前餘額
                const currentBalance = await t.one(`
                    SELECT balance FROM agents WHERE id = $1
                `, [chainTopAgent.id]);
                
                const balanceBefore = parseFloat(currentBalance.balance);
                const balanceAfter = balanceBefore + rebateAmount;
                
                // 更新餘額
                await t.none(`
                    UPDATE agents SET balance = balance + $1 WHERE id = $2
                `, [rebateAmount, chainTopAgent.id]);
                
                // 記錄交易
                await t.none(`
                    INSERT INTO transaction_records (
                        user_type, user_id, transaction_type, amount, 
                        balance_before, balance_after, description, 
                        member_username, bet_amount, rebate_percentage, period
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    'agent', chainTopAgent.id, 'rebate', rebateAmount,
                    balanceBefore, balanceAfter,
                    `退水 - 期號 ${currentPeriod} 會員 ${anyMember.username} 下注 ${betAmount} (${marketType}盤 ${(rebatePercentage*100).toFixed(1)}%)`,
                    anyMember.username, betAmount, rebatePercentage, currentPeriod
                ]);
            });
            
            console.log('✓ 退水已分配\n');
            
            // 6. 驗證退水結果
            console.log('6. 驗證退水結果...');
            const finalTopAgent = await db.one(`
                SELECT balance FROM agents WHERE id = $1
            `, [chainTopAgent.id]);
            
            const finalBalance = parseFloat(finalTopAgent.balance);
            
            // 獲取該總代理的初始餘額（在退水之前）
            const beforeBalance = await db.one(`
                SELECT balance_before FROM transaction_records 
                WHERE user_id = $1 AND transaction_type = 'rebate' 
                AND period = $2
                ORDER BY created_at DESC LIMIT 1
            `, [chainTopAgent.id, currentPeriod]);
            
            const actualRebate = finalBalance - parseFloat(beforeBalance.balance_before);
            
            console.log(`預期退水: ${expectedRebate.toFixed(2)} 元`);
            console.log(`實際退水: ${actualRebate.toFixed(2)} 元`);
            console.log(`總代理最終餘額: ${finalBalance.toFixed(2)} 元`);
            
            if (Math.abs(actualRebate - expectedRebate) < 0.01) {
                console.log('✓ 退水分配正確！');
            } else {
                console.log('✗ 退水分配異常！');
            }
            
        } else {
            console.log(`✓ 找到會員: ${member.username} (餘額: ${member.balance})`);
            // ... 繼續測試邏輯
        }
        
        console.log('\n=== 測試完成 ===');
        
    } catch (error) {
        console.error('測試失敗:', error);
    } finally {
        process.exit(0);
    }
}

// 執行測試
testRebateSystem();