import db from './db/config.js';

async function checkRebateIssue154() {
    try {
        console.log('=== 檢查期號 20250716154 的退水問題 ===\n');
        
        // 1. 檢查該期的所有投注
        console.log('1. 檢查期號 20250716154 的所有投注...');
        const allBets = await db.any(`
            SELECT 
                bh.id,
                bh.username,
                bh.amount,
                bh.bet_type,
                bh.bet_value,
                bh.settled,
                bh.win,
                bh.win_amount,
                bh.created_at,
                bh.settled_at,
                m.agent_id,
                a.username as agent_username
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            JOIN agents a ON m.agent_id = a.id
            WHERE bh.period = '20250716154'
            ORDER BY bh.created_at
        `);
        
        console.log(`找到 ${allBets.length} 筆投注：`);
        allBets.forEach(bet => {
            console.log(`ID: ${bet.id}, 用戶: ${bet.username}, 金額: ${bet.amount}, 已結算: ${bet.settled}, 代理: ${bet.agent_username}`);
        });
        
        // 2. 檢查該期的開獎結果
        console.log('\n2. 檢查開獎結果...');
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250716154'
        `);
        
        if (drawResult) {
            console.log(`開獎結果: ${drawResult.result}`);
            console.log(`開獎時間: ${drawResult.created_at}`);
        } else {
            console.log('⚠️ 沒有找到開獎結果');
        }
        
        // 3. 檢查交易記錄
        console.log('\n3. 檢查交易記錄...');
        const transactions = await db.any(`
            SELECT 
                tr.id,
                tr.user_type,
                tr.user_id,
                tr.transaction_type,
                tr.amount,
                tr.description,
                tr.created_at,
                CASE 
                    WHEN tr.user_type = 'agent' THEN a.username
                    WHEN tr.user_type = 'member' THEN m.username
                END as username
            FROM transaction_records tr
            LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
            LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
            WHERE tr.period = '20250716154'
            ORDER BY tr.created_at
        `);
        
        if (transactions.length > 0) {
            console.log(`找到 ${transactions.length} 筆交易記錄：`);
            transactions.forEach(tx => {
                console.log(`用戶: ${tx.username}, 類型: ${tx.transaction_type}, 金額: ${tx.amount}, 時間: ${tx.created_at}`);
            });
        } else {
            console.log('⚠️ 沒有找到任何交易記錄！');
        }
        
        // 4. 檢查是否有結算相關的記錄
        console.log('\n4. 檢查結算記錄...');
        const settlementRecords = await db.any(`
            SELECT * FROM settlement_logs 
            WHERE period = '20250716154'
            ORDER BY created_at
        `);
        
        if (settlementRecords.length > 0) {
            console.log(`找到 ${settlementRecords.length} 筆結算記錄：`);
            settlementRecords.forEach(log => {
                console.log(`狀態: ${log.status}, 訊息: ${log.message}, 時間: ${log.created_at}`);
            });
        } else {
            console.log('⚠️ 沒有找到結算記錄');
        }
        
        // 5. 手動檢查退水計算
        console.log('\n5. 手動計算退水...');
        if (allBets.length > 0) {
            for (const bet of allBets.filter(b => b.settled)) {
                console.log(`\n投注 ${bet.id} (${bet.username}):`);
                
                // 獲取代理鏈
                const agentChain = await db.any(`
                    WITH RECURSIVE agent_chain AS (
                        SELECT id, username, parent_id, rebate_percentage, 0 as level
                        FROM agents 
                        WHERE id = $1
                        
                        UNION ALL
                        
                        SELECT a.id, a.username, a.parent_id, a.rebate_percentage, ac.level + 1
                        FROM agents a
                        JOIN agent_chain ac ON a.id = ac.parent_id
                        WHERE ac.level < 10
                    )
                    SELECT * FROM agent_chain ORDER BY level
                `, [bet.agent_id]);
                
                console.log('代理鏈:');
                let previousRebate = 0;
                for (const agent of agentChain) {
                    const rebateDiff = (agent.rebate_percentage || 0) - previousRebate;
                    if (rebateDiff > 0) {
                        const rebateAmount = (bet.amount * rebateDiff / 100).toFixed(2);
                        console.log(`  ${agent.username}: ${rebateDiff}% = ${rebateAmount}`);
                    }
                    previousRebate = agent.rebate_percentage || 0;
                }
            }
        }
        
        // 6. 檢查最近期數的退水處理情況作為對比
        console.log('\n6. 檢查最近期數的退水處理情況作為對比...');
        const recentPeriodsWithRebates = await db.any(`
            SELECT 
                tr.period,
                COUNT(*) as rebate_count,
                SUM(tr.amount) as total_rebate
            FROM transaction_records tr
            WHERE tr.transaction_type IN ('rebate', 'parent_rebate')
                AND tr.period > '20250716121'
                AND tr.period != '20250716154'
            GROUP BY tr.period
            ORDER BY tr.period DESC
            LIMIT 5
        `);
        
        console.log('最近期數的退水情況：');
        recentPeriodsWithRebates.forEach(r => {
            console.log(`期號: ${r.period}, 退水筆數: ${r.rebate_count}, 總退水: ${r.total_rebate}`);
        });
        
    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkRebateIssue154();