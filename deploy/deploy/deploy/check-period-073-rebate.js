import db from './db/config.js';

async function checkPeriod073Rebate() {
    try {
        console.log('=== 檢查期號 20250715073 的退水情況 ===\n');
        
        // 1. 檢查這期的下注記錄
        const bets = await db.any(`
            SELECT 
                id,
                username,
                amount,
                bet_type,
                bet_value,
                settled,
                win_loss,
                created_at
            FROM bet_history
            WHERE period = '20250715073'
            ORDER BY created_at DESC
        `);
        
        console.log(`期號 20250715073 共有 ${bets.length} 筆下注：`);
        bets.forEach(bet => {
            console.log(`- ${bet.username}: ${bet.amount}元, ${bet.bet_type}/${bet.bet_value}, ${bet.settled ? '已結算' : '未結算'}, 輸贏: ${bet.win_loss}`);
        });
        
        // 2. 檢查退水記錄
        console.log('\n檢查退水記錄：');
        const rebates = await db.any(`
            SELECT 
                tr.*,
                a.username as agent_name
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id
            WHERE tr.transaction_type = 'rebate'
            AND (tr.period = '20250715073' OR tr.period LIKE '%20250715073%')
            ORDER BY tr.created_at DESC
        `);
        
        if (rebates.length > 0) {
            console.log(`找到 ${rebates.length} 筆退水記錄：`);
            rebates.forEach(r => {
                console.log(`- ${r.agent_name}: ${r.amount}元, period: "${r.period}"`);
            });
        } else {
            console.log('❌ 沒有找到任何退水記錄');
        }
        
        // 3. 檢查結算狀態
        console.log('\n檢查結算狀態：');
        const settlementLog = await db.any(`
            SELECT * FROM settlement_log
            WHERE period = '20250715073'
            ORDER BY created_at DESC
        `);
        
        if (settlementLog.length > 0) {
            settlementLog.forEach(log => {
                console.log(`- 結算時間: ${log.created_at}, 狀態: ${log.status}`);
                if (log.details) {
                    console.log(`  詳情: ${log.details}`);
                }
            });
        } else {
            console.log('❌ 沒有找到結算日誌');
        }
        
        // 4. 檢查開獎結果
        console.log('\n檢查開獎結果：');
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history
            WHERE period = '20250715073'
        `);
        
        if (drawResult) {
            console.log('✅ 找到開獎結果：');
            const positions = [
                drawResult.position_1,
                drawResult.position_2,
                drawResult.position_3,
                drawResult.position_4,
                drawResult.position_5,
                drawResult.position_6,
                drawResult.position_7,
                drawResult.position_8,
                drawResult.position_9,
                drawResult.position_10
            ];
            console.log(`開獎號碼: ${positions.join(', ')}`);
            console.log(`亞軍 (第2名): ${drawResult.position_2}`);
        } else {
            console.log('❌ 沒有找到開獎結果');
        }
        
        // 5. 檢查代理層級
        console.log('\n檢查代理層級和退水設定：');
        const agentChain = await db.any(`
            SELECT 
                a.username,
                a.parent_id,
                a.rebate_percentage,
                a.member_count,
                a.market_type,
                p.username as parent_username
            FROM agents a
            LEFT JOIN agents p ON a.parent_id = p.id
            WHERE a.username IN ('justin111', 'justin2025A', 'ti2025A')
            OR a.id IN (
                SELECT parent_id FROM agents WHERE username = 'justin111'
            )
            ORDER BY a.username
        `);
        
        agentChain.forEach(agent => {
            console.log(`${agent.username}:`);
            console.log(`  上級: ${agent.parent_username || '無'}`);
            console.log(`  退水: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`  盤口: ${agent.market_type}`);
        });
        
    } catch (error) {
        console.error('檢查錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkPeriod073Rebate();