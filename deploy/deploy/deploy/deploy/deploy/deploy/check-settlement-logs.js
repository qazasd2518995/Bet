import db from './db/config.js';

async function checkSettlementLogs() {
    try {
        console.log('=== 檢查結算和退水處理狀態 ===\n');

        // 1. 檢查 justin111 最近的已結算投注
        const recentSettledBets = await db.any(`
            SELECT 
                bh.id,
                bh.period,
                bh.username,
                bh.amount,
                bh.bet_type,
                bh.bet_value,
                bh.settled,
                bh.settled_at,
                bh.win,
                bh.win_amount
            FROM bet_history bh
            WHERE bh.username = 'justin111'
                AND bh.settled = true
                AND bh.amount = 1000
            ORDER BY bh.settled_at DESC
            LIMIT 5
        `);

        console.log('最近已結算的 justin111 投注：');
        for (const bet of recentSettledBets) {
            console.log(`\n期號: ${bet.period}`);
            console.log(`投注ID: ${bet.id}`);
            console.log(`金額: ${bet.amount}`);
            console.log(`結算時間: ${bet.settled_at}`);
            console.log(`是否中獎: ${bet.win ? '是' : '否'}`);
            console.log(`中獎金額: ${bet.win_amount || 0}`);
        }

        // 2. 檢查這些期號的退水交易
        if (recentSettledBets.length > 0) {
            const periods = recentSettledBets.map(b => b.period);
            console.log('\n\n=== 檢查這些期號的退水交易 ===');
            
            for (const period of periods) {
                console.log(`\n期號 ${period}:`);
                
                // 檢查該期的所有退水交易
                const rebateTransactions = await db.any(`
                    SELECT 
                        tr.*,
                        CASE 
                            WHEN tr.user_type = 'agent' THEN a.username
                            WHEN tr.user_type = 'member' THEN m.username
                        END as username
                    FROM transaction_records tr
                    LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
                    LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
                    WHERE tr.period = $1::text
                        AND tr.transaction_type IN ('rebate', 'parent_rebate')
                    ORDER BY tr.created_at
                `, [period.toString()]);

                if (rebateTransactions.length > 0) {
                    console.log(`找到 ${rebateTransactions.length} 筆退水交易`);
                    for (const tx of rebateTransactions) {
                        console.log(`  - ${tx.username}: ${tx.transaction_type} = ${tx.amount} (${tx.created_at})`);
                    }
                } else {
                    console.log('❌ 沒有找到退水交易記錄');
                }
            }
        }

        // 3. 檢查代理系統的退水調用記錄
        console.log('\n\n=== 檢查最近的退水調用 ===');
        const recentRebateTransactions = await db.any(`
            SELECT 
                tr.*,
                CASE 
                    WHEN tr.user_type = 'agent' THEN a.username
                    WHEN tr.user_type = 'member' THEN m.username
                END as username
            FROM transaction_records tr
            LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
            LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
            WHERE tr.transaction_type IN ('rebate', 'parent_rebate')
                AND tr.created_at >= NOW() - INTERVAL '1 hour'
            ORDER BY tr.created_at DESC
            LIMIT 20
        `);

        console.log(`最近1小時內的退水交易 (${recentRebateTransactions.length} 筆)：`);
        for (const tx of recentRebateTransactions) {
            console.log(`\n時間: ${tx.created_at}`);
            console.log(`期號: ${tx.period}`);
            console.log(`用戶: ${tx.username}`);
            console.log(`類型: ${tx.transaction_type}`);
            console.log(`金額: ${tx.amount}`);
            console.log(`描述: ${tx.description}`);
        }

        // 4. 檢查是否有結算系統調用記錄
        console.log('\n\n=== 檢查最近的結算狀態 ===');
        const recentPeriods = await db.any(`
            SELECT DISTINCT period, COUNT(*) as bet_count, 
                   SUM(CASE WHEN settled = true THEN 1 ELSE 0 END) as settled_count,
                   MAX(settled_at) as last_settled_at
            FROM bet_history
            WHERE created_at >= NOW() - INTERVAL '1 hour'
            GROUP BY period
            ORDER BY period DESC
            LIMIT 10
        `);

        for (const p of recentPeriods) {
            console.log(`\n期號 ${p.period}: ${p.settled_count}/${p.bet_count} 已結算`);
            if (p.last_settled_at) {
                console.log(`最後結算時間: ${p.last_settled_at}`);
            }
        }

    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkSettlementLogs();