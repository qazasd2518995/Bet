// check-period-154-backend-timeline.js - Check what happened during period 154 settlement
import db from './db/config.js';

async function checkPeriod154Timeline() {
    console.log('=== PERIOD 20250716154 SETTLEMENT TIMELINE ANALYSIS ===\n');
    
    try {
        // 1. Get the exact timing of period 154 events
        console.log('1. TIMELINE OF PERIOD 154 EVENTS\n');
        
        // Get bet timing
        const bet = await db.oneOrNone(`
            SELECT 
                id, username, amount, created_at, settled_at, settled
            FROM bet_history 
            WHERE period = '20250716154'
        `);
        
        if (bet) {
            console.log('Bet Events:');
            console.log(`  - Bet placed: ${bet.created_at}`);
            console.log(`  - Bet settled: ${bet.settled_at} (Status: ${bet.settled})`);
        }
        
        // Get draw result timing
        const drawResult = await db.oneOrNone(`
            SELECT 
                period, result, created_at
            FROM result_history 
            WHERE period = '20250716154'
        `);
        
        if (drawResult) {
            console.log('\nDraw Events:');
            console.log(`  - Draw result recorded: ${drawResult.created_at}`);
            console.log(`  - Draw result: ${JSON.stringify(drawResult.result)}`);
        }
        
        // Check if there are any settlement logs around that time
        console.log('\n2. SETTLEMENT LOGS AROUND THAT TIME\n');
        
        const timeRange = '2025-07-16 03:10:00';
        const timeRangeEnd = '2025-07-16 03:20:00';
        
        const settlementLogs = await db.any(`
            SELECT 
                period, settled_count, total_win_amount, created_at,
                settlement_details
            FROM settlement_logs 
            WHERE created_at >= $1 AND created_at <= $2
            ORDER BY created_at
        `, [timeRange, timeRangeEnd]);
        
        if (settlementLogs.length > 0) {
            console.log(`Found ${settlementLogs.length} settlement logs in that timeframe:`);
            settlementLogs.forEach(log => {
                console.log(`  - Period: ${log.period}, Count: ${log.settled_count}, Time: ${log.created_at}`);
                if (log.settlement_details) {
                    console.log(`    Details: ${JSON.stringify(log.settlement_details)}`);
                }
            });
        } else {
            console.log('❌ No settlement logs found around period 154 time');
        }
        
        // 3. Check transaction records around that time
        console.log('\n3. TRANSACTION RECORDS AROUND THAT TIME\n');
        
        const transactions = await db.any(`
            SELECT 
                tr.period,
                tr.transaction_type,
                tr.amount,
                tr.created_at,
                tr.description,
                CASE 
                    WHEN tr.user_type = 'agent' THEN a.username
                    WHEN tr.user_type = 'member' THEN m.username
                    ELSE 'UNKNOWN'
                END as username
            FROM transaction_records tr
            LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
            LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
            WHERE tr.created_at >= $1 AND tr.created_at <= $2
            ORDER BY tr.created_at
        `, [timeRange, timeRangeEnd]);
        
        if (transactions.length > 0) {
            console.log(`Found ${transactions.length} transactions in that timeframe:`);
            transactions.forEach(tx => {
                console.log(`  - Period: ${tx.period}, User: ${tx.username}, Type: ${tx.transaction_type}, Amount: ${tx.amount}, Time: ${tx.created_at}`);
            });
        } else {
            console.log('❌ No transactions found around period 154 time');
        }
        
        // 4. Check the previous period for comparison
        console.log('\n4. COMPARING WITH PREVIOUS PERIOD (20250716153)\n');
        
        const prevPeriodBets = await db.any(`
            SELECT COUNT(*) as bet_count, SUM(amount) as total_amount
            FROM bet_history 
            WHERE period = '20250716153' AND settled = true
        `);
        
        const prevPeriodRebates = await db.any(`
            SELECT COUNT(*) as rebate_count, SUM(amount) as total_rebate
            FROM transaction_records 
            WHERE period = '20250716153' AND transaction_type IN ('rebate', 'parent_rebate')
        `);
        
        console.log('Previous period (20250716153):');
        console.log(`  - Settled bets: ${prevPeriodBets[0].bet_count} (Total: ${prevPeriodBets[0].total_amount || 0})`);
        console.log(`  - Rebate records: ${prevPeriodRebates[0].rebate_count} (Total: ${prevPeriodRebates[0].total_rebate || 0})`);
        
        // 5. Check the next period for comparison
        console.log('\n5. COMPARING WITH NEXT PERIOD (20250716155)\n');
        
        const nextPeriodBets = await db.any(`
            SELECT COUNT(*) as bet_count, SUM(amount) as total_amount
            FROM bet_history 
            WHERE period = '20250716155' AND settled = true
        `);
        
        const nextPeriodRebates = await db.any(`
            SELECT COUNT(*) as rebate_count, SUM(amount) as total_rebate
            FROM transaction_records 
            WHERE period = '20250716155' AND transaction_type IN ('rebate', 'parent_rebate')
        `);
        
        console.log('Next period (20250716155):');
        console.log(`  - Settled bets: ${nextPeriodBets[0].bet_count} (Total: ${nextPeriodBets[0].total_amount || 0})`);
        console.log(`  - Rebate records: ${nextPeriodRebates[0].rebate_count} (Total: ${nextPeriodRebates[0].total_rebate || 0})`);
        
        // 6. Check if settlement was called but failed
        console.log('\n6. CHECKING FOR POSSIBLE SETTLEMENT FAILURES\n');
        
        // Look for any periods around that time that have bets but no settlement logs
        const periodsAroundTime = await db.any(`
            SELECT 
                bh.period,
                COUNT(bh.id) as bet_count,
                MAX(bh.settled_at) as last_settlement,
                COUNT(sl.id) as settlement_log_count
            FROM bet_history bh
            LEFT JOIN settlement_logs sl ON bh.period::text = sl.period::text
            WHERE bh.created_at >= $1 AND bh.created_at <= $2
                AND bh.settled = true
            GROUP BY bh.period
            ORDER BY bh.period
        `, [timeRange, timeRangeEnd]);
        
        console.log('Periods with settled bets in timeframe:');
        periodsAroundTime.forEach(p => {
            const hasSettlementLog = parseInt(p.settlement_log_count) > 0;
            console.log(`  - Period: ${p.period}, Bets: ${p.bet_count}, Last settlement: ${p.last_settlement}`);
            console.log(`    Settlement log: ${hasSettlementLog ? '✅ Found' : '❌ Missing'}`);
        });
        
        // 7. Manual rebate calculation verification
        console.log('\n7. MANUAL REBATE CALCULATION FOR PERIOD 154\n');
        
        if (bet) {
            console.log('Expected rebate calculation:');
            console.log(`  - Bet amount: ${bet.amount}`);
            console.log(`  - User: ${bet.username}`);
            
            // Get agent info for this user
            const memberInfo = await db.oneOrNone(`
                SELECT 
                    m.id as member_id,
                    m.agent_id,
                    m.market_type,
                    a.username as agent_username,
                    a.rebate_percentage,
                    a.parent_id
                FROM members m
                JOIN agents a ON m.agent_id = a.id
                WHERE m.username = $1
            `, [bet.username]);
            
            if (memberInfo) {
                console.log(`  - Market type: ${memberInfo.market_type}`);
                console.log(`  - Direct agent: ${memberInfo.agent_username} (${memberInfo.rebate_percentage}%)`);
                
                const maxRebate = memberInfo.market_type === 'A' ? 0.011 : 0.041;
                const expectedTotalRebate = parseFloat(bet.amount) * maxRebate;
                
                console.log(`  - Max rebate rate: ${(maxRebate * 100).toFixed(1)}%`);
                console.log(`  - Expected total rebate pool: ${expectedTotalRebate.toFixed(2)}`);
                
                // Get full agent chain
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
                `, [memberInfo.agent_id]);
                
                console.log('\n  Expected rebate distribution:');
                let previousRebate = 0;
                for (const agent of agentChain) {
                    const rebateDiff = (agent.rebate_percentage || 0) - previousRebate;
                    if (rebateDiff > 0) {
                        const rebateAmount = (parseFloat(bet.amount) * rebateDiff / 100);
                        console.log(`    ${agent.username} (Level ${agent.level}): ${rebateDiff.toFixed(3)}% = ${rebateAmount.toFixed(2)}`);
                    }
                    previousRebate = agent.rebate_percentage || 0;
                }
            }
        }
        
    } catch (error) {
        console.error('Error analyzing period 154 timeline:', error);
    } finally {
        await db.$pool.end();
    }
}

checkPeriod154Timeline();