// check-period-154-settlement-issue.js - Specific check for period 154 settlement and rebate issue
import db from './db/config.js';

async function checkPeriod154SettlementIssue() {
    console.log('=== PERIOD 20250716154 SETTLEMENT AND REBATE ISSUE ANALYSIS ===\n');
    
    try {
        // 1. Check the specific bet that should have triggered rebates
        console.log('1. CHECKING THE SPECIFIC BET IN PERIOD 20250716154\n');
        
        const bet = await db.oneOrNone(`
            SELECT 
                bh.id,
                bh.username,
                bh.period,
                bh.amount,
                bh.bet_type,
                bh.bet_value,
                bh.position,
                bh.odds,
                bh.settled,
                bh.win,
                bh.win_amount,
                bh.created_at,
                bh.settled_at,
                m.id as member_id,
                m.agent_id,
                a.username as agent_username,
                a.rebate_percentage
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            JOIN agents a ON m.agent_id = a.id
            WHERE bh.period = '20250716154'
        `);
        
        if (bet) {
            console.log('Bet details:');
            console.log(`  - Bet ID: ${bet.id}`);
            console.log(`  - User: ${bet.username} (Member ID: ${bet.member_id})`);
            console.log(`  - Amount: ${bet.amount}`);
            console.log(`  - Bet Type: ${bet.bet_type} / Value: ${bet.bet_value} / Position: ${bet.position}`);
            console.log(`  - Odds: ${bet.odds}`);
            console.log(`  - Settled: ${bet.settled}`);
            console.log(`  - Win: ${bet.win} / Win Amount: ${bet.win_amount}`);
            console.log(`  - Created: ${bet.created_at}`);
            console.log(`  - Settled At: ${bet.settled_at}`);
            console.log(`  - Agent: ${bet.agent_username} (ID: ${bet.agent_id}, Rebate: ${bet.rebate_percentage}%)`);
            
            // 2. Check the agent chain for this bet
            console.log('\n2. CHECKING AGENT CHAIN FOR REBATE CALCULATION\n');
            
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
            
            console.log('Agent chain:');
            let previousRebate = 0;
            let totalExpectedRebate = 0;
            
            for (const agent of agentChain) {
                const rebateDiff = (agent.rebate_percentage || 0) - previousRebate;
                if (rebateDiff > 0) {
                    const rebateAmount = (bet.amount * rebateDiff / 100);
                    console.log(`  Level ${agent.level}: ${agent.username} (ID: ${agent.id})`);
                    console.log(`    Rebate %: ${agent.rebate_percentage}% (Diff: ${rebateDiff}%)`);
                    console.log(`    Expected rebate: ${bet.amount} * ${rebateDiff}% = ${rebateAmount.toFixed(2)}`);
                    totalExpectedRebate += rebateAmount;
                }
                previousRebate = agent.rebate_percentage || 0;
            }
            
            console.log(`\n  Total expected rebate: ${totalExpectedRebate.toFixed(2)}`);
            
            // 3. Check if settlement was recorded
            console.log('\n3. CHECKING SETTLEMENT RECORDS\n');
            
            const settlementRecord = await db.oneOrNone(`
                SELECT * FROM settlement_logs 
                WHERE period = $1
            `, [bet.period]);
            
            if (settlementRecord) {
                console.log('Settlement record found:');
                console.log(`  - Period: ${settlementRecord.period}`);
                console.log(`  - Settled Count: ${settlementRecord.settled_count}`);
                console.log(`  - Total Win Amount: ${settlementRecord.total_win_amount}`);
                console.log(`  - Created At: ${settlementRecord.created_at}`);
                console.log(`  - Settlement Details: ${JSON.stringify(settlementRecord.settlement_details, null, 2)}`);
            } else {
                console.log('❌ No settlement record found for this period');
            }
            
            // 4. Check transaction records specifically for this period
            console.log('\n4. CHECKING TRANSACTION RECORDS FOR THIS PERIOD\n');
            
            const transactions = await db.any(`
                SELECT 
                    tr.*,
                    CASE 
                        WHEN tr.user_type = 'agent' THEN a.username
                        WHEN tr.user_type = 'member' THEN m.username
                        ELSE 'UNKNOWN'
                    END as username
                FROM transaction_records tr
                LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
                LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
                WHERE tr.period = $1
                ORDER BY tr.created_at
            `, [bet.period]);
            
            console.log(`Found ${transactions.length} transaction records:`);
            if (transactions.length > 0) {
                transactions.forEach((tx, index) => {
                    console.log(`\n  Transaction ${index + 1}:`);
                    console.log(`    - ID: ${tx.id}`);
                    console.log(`    - User: ${tx.username} (${tx.user_type} ID: ${tx.user_id})`);
                    console.log(`    - Type: ${tx.transaction_type}`);
                    console.log(`    - Amount: ${tx.amount}`);
                    console.log(`    - Description: ${tx.description}`);
                    console.log(`    - Rebate %: ${tx.rebate_percentage}`);
                    console.log(`    - Created: ${tx.created_at}`);
                });
            } else {
                console.log('  ❌ No transaction records found - this is the problem!');
            }
            
            // 5. Check if rebate processing was called for this period
            console.log('\n5. CHECKING IF REBATE PROCESSING SHOULD HAVE BEEN TRIGGERED\n');
            
            if (bet.settled && agentChain.length > 0 && totalExpectedRebate > 0) {
                console.log('✅ This bet should have triggered rebate processing:');
                console.log(`  - Bet is settled: ${bet.settled}`);
                console.log(`  - Agent chain exists: ${agentChain.length} levels`);
                console.log(`  - Expected rebate amount: ${totalExpectedRebate.toFixed(2)}`);
                console.log(`  - But no rebate records found in transaction_records`);
                
                console.log('\n🔍 POSSIBLE CAUSES:');
                console.log('  1. Settlement system did not call rebate processing');
                console.log('  2. Rebate processing failed due to SQL error');
                console.log('  3. Period format mismatch in rebate processing');
                console.log('  4. Agent rebate settings not properly loaded');
                console.log('  5. Transaction creation failed due to constraint errors');
            } else {
                console.log('❌ Rebate processing should not be triggered because:');
                console.log(`  - Bet settled: ${bet.settled}`);
                console.log(`  - Agent chain levels: ${agentChain.length}`);
                console.log(`  - Expected rebate: ${totalExpectedRebate.toFixed(2)}`);
            }
            
            // 6. Compare with a working period
            console.log('\n6. COMPARING WITH WORKING PERIOD (20250716121)\n');
            
            const workingPeriodTransactions = await db.any(`
                SELECT 
                    tr.*,
                    CASE 
                        WHEN tr.user_type = 'agent' THEN a.username
                        WHEN tr.user_type = 'member' THEN m.username
                        ELSE 'UNKNOWN'
                    END as username
                FROM transaction_records tr
                LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
                LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
                WHERE tr.period = '20250716121'
                    AND tr.transaction_type IN ('rebate', 'parent_rebate')
                ORDER BY tr.created_at
            `, []);
            
            console.log(`Working period 20250716121 has ${workingPeriodTransactions.length} rebate records:`);
            workingPeriodTransactions.forEach((tx, index) => {
                console.log(`  ${index + 1}. ${tx.username} (${tx.user_type}): ${tx.amount} (${tx.rebate_percentage}%)`);
            });
            
        } else {
            console.log('❌ No bet found for period 20250716154');
        }
        
    } catch (error) {
        console.error('Error analyzing period 154:', error);
    } finally {
        await db.$pool.end();
    }
}

checkPeriod154SettlementIssue();