import axios from 'axios';
import db from './db/config.js';

// 配置
const AGENT_API_URL = 'http://localhost:3003/api/agent';
const GAME_API_URL = 'http://localhost:3000/api';

async function testRebateSystem() {
    console.log('=== 简化退水系统测试 ===\n');
    
    try {
        // 1. 直接从资料库找一个 A 盘总代理
        console.log('1. 寻找 A 盘总代理...');
        const topAgent = await db.oneOrNone(`
            SELECT id, username, balance, market_type 
            FROM agents 
            WHERE level = 0 AND market_type = 'A' AND status = 1 
            LIMIT 1
        `);
        
        if (!topAgent) {
            console.error('找不到 A 盘总代理');
            return;
        }
        
        console.log(`✓ 找到总代理: ${topAgent.username} (ID: ${topAgent.id}, 余额: ${topAgent.balance})\n`);
        
        // 2. 找一个该总代理下的会员
        console.log('2. 寻找该总代理下的会员...');
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
            console.log('该总代理下没有会员，尝试找任何 A 盘会员...');
            const anyMember = await db.oneOrNone(`
                SELECT m.id, m.username, m.balance, m.agent_id, a.market_type
                FROM members m
                JOIN agents a ON m.agent_id = a.id
                WHERE a.market_type = 'A' AND m.status = 1 AND m.balance >= 100
                LIMIT 1
            `);
            
            if (!anyMember) {
                console.error('找不到任何 A 盘会员');
                return;
            }
            
            console.log(`✓ 找到会员: ${anyMember.username} (余额: ${anyMember.balance})\n`);
            
            // 3. 记录初始余额
            console.log('3. 记录退水前余额...');
            const initialTopAgentBalance = parseFloat(topAgent.balance);
            console.log(`总代理初始余额: ${initialTopAgentBalance}\n`);
            
            // 4. 模拟下注
            console.log('4. 模拟会员下注 1000 元...');
            const betAmount = 1000;
            const expectedRebate = betAmount * 0.011; // A盘 1.1%
            
            // 直接在资料库插入下注记录
            const randomSuffix = Math.floor(Math.random() * 900) + 100; // 随机3位数
            const currentPeriod = new Date().toISOString().slice(0, 10).replace(/-/g, '') + randomSuffix; // 测试期号
            
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
            
            console.log(`✓ 下注记录已创建\n`);
            
            // 5. 手动触发退水处理
            console.log('5. 触发退水处理...');
            
            // 先获取会员的代理资讯
            const memberWithAgent = await db.one(`
                SELECT m.*, a.market_type as agent_market_type, a.id as agent_id
                FROM members m
                JOIN agents a ON m.agent_id = a.id
                WHERE m.username = $1
            `, [anyMember.username]);
            
            // 获取代理链找到总代理
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
            
            console.log('代理链:', agentChain.map(a => `${a.username}(L${a.level})`).join(' -> '));
            
            const chainTopAgent = agentChain[0]; // DESC排序，第一个是最顶层
            const marketType = chainTopAgent.market_type || 'D';
            const rebatePercentage = marketType === 'A' ? 0.011 : 0.041;
            const rebateAmount = Math.round(betAmount * rebatePercentage * 100) / 100;
            
            console.log(`${marketType}盘，退水 ${(rebatePercentage*100).toFixed(1)}% = ${rebateAmount} 元`);
            console.log(`退水将分配给总代理: ${chainTopAgent.username}\n`);
            
            // 手动执行退水分配
            await db.tx(async t => {
                // 获取当前余额
                const currentBalance = await t.one(`
                    SELECT balance FROM agents WHERE id = $1
                `, [chainTopAgent.id]);
                
                const balanceBefore = parseFloat(currentBalance.balance);
                const balanceAfter = balanceBefore + rebateAmount;
                
                // 更新余额
                await t.none(`
                    UPDATE agents SET balance = balance + $1 WHERE id = $2
                `, [rebateAmount, chainTopAgent.id]);
                
                // 记录交易
                await t.none(`
                    INSERT INTO transaction_records (
                        user_type, user_id, transaction_type, amount, 
                        balance_before, balance_after, description, 
                        member_username, bet_amount, rebate_percentage, period
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                `, [
                    'agent', chainTopAgent.id, 'rebate', rebateAmount,
                    balanceBefore, balanceAfter,
                    `退水 - 期号 ${currentPeriod} 会员 ${anyMember.username} 下注 ${betAmount} (${marketType}盘 ${(rebatePercentage*100).toFixed(1)}%)`,
                    anyMember.username, betAmount, rebatePercentage, currentPeriod
                ]);
            });
            
            console.log('✓ 退水已分配\n');
            
            // 6. 验证退水结果
            console.log('6. 验证退水结果...');
            const finalTopAgent = await db.one(`
                SELECT balance FROM agents WHERE id = $1
            `, [chainTopAgent.id]);
            
            const finalBalance = parseFloat(finalTopAgent.balance);
            
            // 获取该总代理的初始余额（在退水之前）
            const beforeBalance = await db.one(`
                SELECT balance_before FROM transaction_records 
                WHERE user_id = $1 AND transaction_type = 'rebate' 
                AND period = $2
                ORDER BY created_at DESC LIMIT 1
            `, [chainTopAgent.id, currentPeriod]);
            
            const actualRebate = finalBalance - parseFloat(beforeBalance.balance_before);
            
            console.log(`预期退水: ${expectedRebate.toFixed(2)} 元`);
            console.log(`实际退水: ${actualRebate.toFixed(2)} 元`);
            console.log(`总代理最终余额: ${finalBalance.toFixed(2)} 元`);
            
            if (Math.abs(actualRebate - expectedRebate) < 0.01) {
                console.log('✓ 退水分配正确！');
            } else {
                console.log('✗ 退水分配异常！');
            }
            
        } else {
            console.log(`✓ 找到会员: ${member.username} (余额: ${member.balance})`);
            // ... 继续测试逻辑
        }
        
        console.log('\n=== 测试完成 ===');
        
    } catch (error) {
        console.error('测试失败:', error);
    } finally {
        process.exit(0);
    }
}

// 执行测试
testRebateSystem();