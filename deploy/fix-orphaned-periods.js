// fix-orphaned-periods.js - Fix periods 121 and 109 that were identified as orphaned
import db from './db/config.js';

async function fixOrphanedPeriods() {
    console.log('🔧 FIXING ORPHANED PERIODS (121 & 109)\n');
    
    try {
        // Get orphaned periods
        const orphanedPeriods = await db.any(`
            SELECT DISTINCT bh.period, COUNT(*) as bet_count
            FROM bet_history bh
            LEFT JOIN settlement_logs sl ON bh.period::text = sl.period::text
            WHERE bh.settled = true 
                AND sl.id IS NULL
                AND bh.period IN (20250716121, 20250716109)
            GROUP BY bh.period
            ORDER BY bh.period
        `);
        
        console.log(`Found ${orphanedPeriods.length} orphaned periods:`);
        orphanedPeriods.forEach(p => {
            console.log(`  - Period ${p.period}: ${p.bet_count} settled bets`);
        });
        
        for (const periodData of orphanedPeriods) {
            const period = periodData.period;
            console.log(`\n🔄 Processing period ${period}...`);
            
            // Get bet details
            const bet = await db.oneOrNone(`
                SELECT 
                    bh.id,
                    bh.username,
                    bh.amount,
                    bh.win_amount,
                    m.id as member_id,
                    m.agent_id,
                    m.market_type
                FROM bet_history bh
                JOIN members m ON bh.username = m.username
                WHERE bh.period = $1 AND bh.settled = true
            `, [period]);
            
            if (!bet) {
                console.log(`❌ No settled bet found for period ${period}`);
                continue;
            }
            
            console.log(`✅ Found bet: ${bet.username}, $${bet.amount}, Win: $${bet.win_amount || 0}`);
            
            // Check if rebates already exist
            const existingRebates = await db.any(`
                SELECT COUNT(*) as count
                FROM transaction_records
                WHERE period = $1 AND transaction_type = 'rebate'
            `, [period]);
            
            if (parseInt(existingRebates[0].count) > 0) {
                console.log(`⚠️ Rebates already exist for period ${period}, only creating settlement log`);
                
                // Just create settlement log
                await db.none(`
                    INSERT INTO settlement_logs (
                        period, 
                        settled_count, 
                        total_win_amount, 
                        settlement_details
                    ) VALUES ($1, $2, $3, $4)
                `, [
                    parseInt(period),
                    1,
                    parseFloat(bet.win_amount || 0),
                    JSON.stringify([{
                        betId: bet.id,
                        username: bet.username,
                        amount: bet.amount,
                        settled: true,
                        rebateProcessed: true,
                        retroactiveFix: true,
                        fixedAt: new Date().toISOString()
                    }])
                ]);
                
                console.log(`✅ Settlement log created for period ${period}`);
                continue;
            }
            
            // Get agent chain for rebate processing
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
            
            if (agentChain.length === 0) {
                console.log(`❌ No agent chain found for period ${period}`);
                continue;
            }
            
            console.log(`✅ Agent chain: ${agentChain.map(a => a.username).join(' → ')}`);
            
            // Process rebates and settlement in transaction
            await db.tx(async t => {
                console.log(`🔄 Processing rebates for period ${period}...`);
                
                let previousRebate = 0;
                let totalRebatesCreated = 0;
                
                for (const agent of agentChain) {
                    const rebateDiff = (agent.rebate_percentage || 0) - previousRebate;
                    
                    if (rebateDiff > 0) {
                        const rebateAmount = (parseFloat(bet.amount) * rebateDiff / 100);
                        
                        if (rebateAmount >= 0.01) {
                            // Get current agent balance
                            const currentBalance = await t.oneOrNone(`
                                SELECT balance FROM agents WHERE id = $1
                            `, [agent.id]);
                            
                            if (!currentBalance) {
                                console.log(`❌ Agent ${agent.username} not found`);
                                continue;
                            }
                            
                            const balanceBefore = parseFloat(currentBalance.balance);
                            const balanceAfter = balanceBefore + rebateAmount;
                            
                            // Update agent balance
                            await t.none(`
                                UPDATE agents 
                                SET balance = balance + $1 
                                WHERE id = $2
                            `, [rebateAmount, agent.id]);
                            
                            // Create transaction record
                            await t.none(`
                                INSERT INTO transaction_records (
                                    user_type, 
                                    user_id, 
                                    transaction_type, 
                                    amount, 
                                    balance_before, 
                                    balance_after, 
                                    description, 
                                    member_username, 
                                    bet_amount, 
                                    rebate_percentage, 
                                    period
                                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                            `, [
                                'agent',
                                agent.id,
                                'rebate',
                                rebateAmount,
                                balanceBefore,
                                balanceAfter,
                                `退水 - 期號 ${period} 會員 ${bet.username} 下注 ${bet.amount} (補償)`,
                                bet.username,
                                parseFloat(bet.amount),
                                rebateDiff,
                                period.toString()
                            ]);
                            
                            console.log(`  ✅ ${agent.username}: ${rebateAmount.toFixed(2)}`);
                            totalRebatesCreated++;
                        }
                    }
                    
                    previousRebate = agent.rebate_percentage || 0;
                }
                
                // Create settlement log
                await t.none(`
                    INSERT INTO settlement_logs (
                        period, 
                        settled_count, 
                        total_win_amount, 
                        settlement_details
                    ) VALUES ($1, $2, $3, $4)
                `, [
                    parseInt(period),
                    1,
                    parseFloat(bet.win_amount || 0),
                    JSON.stringify([{
                        betId: bet.id,
                        username: bet.username,
                        amount: bet.amount,
                        settled: true,
                        rebateProcessed: true,
                        rebatesCreated: totalRebatesCreated,
                        retroactiveFix: true,
                        fixedAt: new Date().toISOString()
                    }])
                ]);
                
                console.log(`✅ Period ${period}: Created ${totalRebatesCreated} rebates and settlement log`);
            });
        }
        
        // Final verification
        console.log(`\n🔍 FINAL VERIFICATION\n`);
        
        const remainingOrphans = await db.any(`
            SELECT DISTINCT bh.period, COUNT(*) as bet_count
            FROM bet_history bh
            LEFT JOIN settlement_logs sl ON bh.period::text = sl.period::text
            WHERE bh.settled = true 
                AND sl.id IS NULL
                AND bh.period >= 20250716100
            GROUP BY bh.period
            ORDER BY bh.period DESC
        `);
        
        if (remainingOrphans.length === 0) {
            console.log('✅ No remaining orphaned periods found');
        } else {
            console.log(`⚠️ ${remainingOrphans.length} periods still need attention:`);
            remainingOrphans.forEach(p => {
                console.log(`  - Period ${p.period}: ${p.bet_count} settled bets`);
            });
        }
        
        console.log('\n🎉 ORPHANED PERIODS FIX COMPLETED');
        
    } catch (error) {
        console.error('❌ Error fixing orphaned periods:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        await db.$pool.end();
    }
}

fixOrphanedPeriods();