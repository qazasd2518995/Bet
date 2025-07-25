// fix-period-154-rebates-manual.js - Manually process missing rebates for period 154
import db from './db/config.js';

async function fixPeriod154Rebates() {
    console.log('=== MANUAL REBATE PROCESSING FOR PERIOD 20250716154 ===\n');
    
    try {
        const period = '20250716154';
        
        // 1. Verify the bet exists and is settled
        const bet = await db.oneOrNone(`
            SELECT 
                bh.id,
                bh.username,
                bh.amount,
                bh.settled,
                m.id as member_id,
                m.agent_id,
                m.market_type
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.period = $1
        `, [period]);
        
        if (!bet) {
            console.log('❌ No bet found for period 154');
            return;
        }
        
        if (!bet.settled) {
            console.log('❌ Bet is not settled, cannot process rebates');
            return;
        }
        
        console.log('✅ Found settled bet:');
        console.log(`  - User: ${bet.username}`);
        console.log(`  - Amount: ${bet.amount}`);
        console.log(`  - Market Type: ${bet.market_type}`);
        
        // 2. Check if rebates already exist
        const existingRebates = await db.any(`
            SELECT COUNT(*) as count
            FROM transaction_records
            WHERE period = $1 AND transaction_type IN ('rebate', 'parent_rebate')
        `, [period]);
        
        if (parseInt(existingRebates[0].count) > 0) {
            console.log('⚠️ Rebates already exist for this period, skipping');
            return;
        }
        
        // 3. Get agent chain
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
            console.log('❌ No agent chain found, cannot process rebates');
            return;
        }
        
        console.log('\n✅ Agent chain found:');
        agentChain.forEach(agent => {
            console.log(`  Level ${agent.level}: ${agent.username} (${agent.rebate_percentage}%)`);
        });
        
        // 4. Calculate and create rebate transactions
        await db.tx(async t => {
            console.log('\n🔄 Processing rebates in transaction...');
            
            let previousRebate = 0;
            let totalRebatesCreated = 0;
            
            for (const agent of agentChain) {
                const rebateDiff = (agent.rebate_percentage || 0) - previousRebate;
                
                if (rebateDiff > 0) {
                    const rebateAmount = (parseFloat(bet.amount) * rebateDiff / 100);
                    
                    if (rebateAmount >= 0.01) { // Only process if rebate is at least 0.01
                        console.log(`\n  Processing rebate for ${agent.username}:`);
                        console.log(`    Rebate %: ${rebateDiff.toFixed(3)}%`);
                        console.log(`    Amount: ${bet.amount} * ${rebateDiff.toFixed(3)}% = ${rebateAmount.toFixed(2)}`);
                        
                        // Get current agent balance
                        const currentBalance = await t.oneOrNone(`
                            SELECT balance FROM agents WHERE id = $1
                        `, [agent.id]);
                        
                        if (!currentBalance) {
                            console.log(`    ❌ Agent ${agent.username} not found`);
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
                            `退水 - 期號 ${period} 會員 ${bet.username} 下注 ${bet.amount}`,
                            bet.username,
                            parseFloat(bet.amount),
                            rebateDiff,
                            period
                        ]);
                        
                        console.log(`    ✅ Created rebate transaction: ${rebateAmount.toFixed(2)}`);
                        console.log(`    ✅ Updated balance: ${balanceBefore} → ${balanceAfter.toFixed(2)}`);
                        
                        totalRebatesCreated++;
                    } else {
                        console.log(`\n  Skipping ${agent.username}: rebate amount too small (${rebateAmount.toFixed(4)})`);
                    }
                }
                
                previousRebate = agent.rebate_percentage || 0;
            }
            
            console.log(`\n✅ Transaction completed. Created ${totalRebatesCreated} rebate records.`);
        });
        
        // 5. Verify the rebates were created
        console.log('\n🔍 Verifying rebate creation...');
        
        const createdRebates = await db.any(`
            SELECT 
                tr.*,
                a.username
            FROM transaction_records tr
            JOIN agents a ON tr.user_id = a.id
            WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
            ORDER BY tr.created_at
        `, [period]);
        
        console.log(`✅ Verification: Found ${createdRebates.length} rebate records:`);
        createdRebates.forEach(rebate => {
            console.log(`  - ${rebate.username}: ${rebate.amount} (${rebate.rebate_percentage}%)`);
        });
        
        // 6. Create settlement log entry for completeness
        console.log('\n📝 Creating settlement log entry...');
        
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
                manualFix: true,
                fixedAt: new Date().toISOString()
            }])
        ]);
        
        console.log('✅ Settlement log entry created');
        
        console.log('\n🎉 PERIOD 154 REBATE PROCESSING COMPLETED SUCCESSFULLY');
        console.log('Next steps:');
        console.log('1. Monitor backend logs for settlement trigger issues');
        console.log('2. Implement settlement system fixes');
        console.log('3. Add monitoring for missing settlement logs');
        
    } catch (error) {
        console.error('❌ Error processing rebates:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        await db.$pool.end();
    }
}

fixPeriod154Rebates();