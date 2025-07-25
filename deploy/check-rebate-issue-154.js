import db from './db/config.js';

async function checkRebateIssue154() {
    try {
        console.log('=== 检查期号 20250716154 的退水问题 ===\n');
        
        // 1. 检查该期的所有投注
        console.log('1. 检查期号 20250716154 的所有投注...');
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
        
        console.log(`找到 ${allBets.length} 笔投注：`);
        allBets.forEach(bet => {
            console.log(`ID: ${bet.id}, 用户: ${bet.username}, 金额: ${bet.amount}, 已结算: ${bet.settled}, 代理: ${bet.agent_username}`);
        });
        
        // 2. 检查该期的开奖结果
        console.log('\n2. 检查开奖结果...');
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250716154'
        `);
        
        if (drawResult) {
            console.log(`开奖结果: ${drawResult.result}`);
            console.log(`开奖时间: ${drawResult.created_at}`);
        } else {
            console.log('⚠️ 没有找到开奖结果');
        }
        
        // 3. 检查交易记录
        console.log('\n3. 检查交易记录...');
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
            console.log(`找到 ${transactions.length} 笔交易记录：`);
            transactions.forEach(tx => {
                console.log(`用户: ${tx.username}, 类型: ${tx.transaction_type}, 金额: ${tx.amount}, 时间: ${tx.created_at}`);
            });
        } else {
            console.log('⚠️ 没有找到任何交易记录！');
        }
        
        // 4. 检查是否有结算相关的记录
        console.log('\n4. 检查结算记录...');
        const settlementRecords = await db.any(`
            SELECT * FROM settlement_logs 
            WHERE period = '20250716154'
            ORDER BY created_at
        `);
        
        if (settlementRecords.length > 0) {
            console.log(`找到 ${settlementRecords.length} 笔结算记录：`);
            settlementRecords.forEach(log => {
                console.log(`状态: ${log.status}, 讯息: ${log.message}, 时间: ${log.created_at}`);
            });
        } else {
            console.log('⚠️ 没有找到结算记录');
        }
        
        // 5. 手动检查退水计算
        console.log('\n5. 手动计算退水...');
        if (allBets.length > 0) {
            for (const bet of allBets.filter(b => b.settled)) {
                console.log(`\n投注 ${bet.id} (${bet.username}):`);
                
                // 获取代理链
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
                
                console.log('代理链:');
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
        
        // 6. 检查最近期数的退水处理情况作为对比
        console.log('\n6. 检查最近期数的退水处理情况作为对比...');
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
        
        console.log('最近期数的退水情况：');
        recentPeriodsWithRebates.forEach(r => {
            console.log(`期号: ${r.period}, 退水笔数: ${r.rebate_count}, 总退水: ${r.total_rebate}`);
        });
        
    } catch (error) {
        console.error('错误:', error);
    } finally {
        process.exit(0);
    }
}

checkRebateIssue154();