// final-check-and-fix-20250716121.js - Final comprehensive check and fix for period 20250716121
import db from './db/config.js';

const PERIOD = '20250716121';

async function finalCheckAndFix() {
    console.log(`\n=== FINAL CHECK AND FIX FOR PERIOD ${PERIOD} ===\n`);
    
    try {
        // 1. Get complete information about the bet and member
        console.log('1. BET AND MEMBER INFORMATION:');
        const betInfo = await db.one(`
            SELECT 
                b.*,
                m.id as member_id,
                m.username as member_username,
                m.agent_id,
                m.market_type,
                m.balance as member_balance,
                a.username as agent_username,
                a.rebate_percentage,
                a.rebate_mode,
                a.max_rebate_percentage,
                a.parent_id
            FROM bet_history b
            JOIN members m ON b.username = m.username
            LEFT JOIN agents a ON m.agent_id = a.id
            WHERE b.period = $1::bigint
        `, [PERIOD]);
        
        console.log('Bet details:', {
            bet_id: betInfo.id,
            username: betInfo.username,
            amount: betInfo.amount,
            settled: betInfo.settled,
            win: betInfo.win
        });
        
        console.log('\nMember details:', {
            member_id: betInfo.member_id,
            agent: betInfo.agent_username,
            market_type: betInfo.market_type,
            rebate_percentage: betInfo.rebate_percentage
        });
        
        // 2. Check why rebate wasn't processed
        console.log('\n2. REBATE PROCESSING ISSUE:');
        console.log('Error: "operator does not exist: character varying = bigint"');
        console.log('This is because transaction_records.period is VARCHAR but bet_history.period is BIGINT');
        
        // 3. Check if rebate exists (with proper type conversion)
        console.log('\n3. CHECKING FOR EXISTING REBATE:');
        const existingRebate = await db.oneOrNone(`
            SELECT * FROM transaction_records 
            WHERE period = $1::text 
            AND user_id = $2 
            AND user_type = 'member' 
            AND transaction_type = 'rebate'
        `, [PERIOD, betInfo.member_id]);
        
        if (existingRebate) {
            console.log('Rebate already processed:', existingRebate);
            return;
        } else {
            console.log('No rebate found for this period');
        }
        
        // 4. Calculate and process rebate
        console.log('\n4. PROCESSING REBATE:');
        
        // Get agent hierarchy with rebate settings
        const agentHierarchy = await db.any(`
            WITH RECURSIVE agent_hierarchy AS (
                SELECT id, username, parent_id, level, rebate_percentage, rebate_mode, max_rebate_percentage
                FROM agents WHERE id = $1
                UNION ALL
                SELECT a.id, a.username, a.parent_id, a.level, a.rebate_percentage, a.rebate_mode, a.max_rebate_percentage
                FROM agents a
                JOIN agent_hierarchy ah ON a.id = ah.parent_id
            )
            SELECT * FROM agent_hierarchy 
            WHERE rebate_percentage > 0
            ORDER BY level ASC
        `, [betInfo.agent_id]);
        
        console.log('Agent hierarchy with rebate settings:');
        agentHierarchy.forEach(agent => {
            console.log(`- ${agent.username} (Level ${agent.level}): ${agent.rebate_percentage}%`);
        });
        
        if (agentHierarchy.length === 0) {
            console.log('No agents with rebate settings found');
            return;
        }
        
        // Process rebates
        const betAmount = parseFloat(betInfo.amount);
        console.log(`\nProcessing rebates for bet amount: ${betAmount}`);
        
        for (const agent of agentHierarchy) {
            const rebateAmount = betAmount * (agent.rebate_percentage / 100);
            
            if (rebateAmount > 0) {
                console.log(`\nProcessing rebate for agent ${agent.username}:`);
                console.log(`- Rebate percentage: ${agent.rebate_percentage}%`);
                console.log(`- Rebate amount: ${rebateAmount.toFixed(2)}`);
                
                // Get current agent balance
                const currentAgent = await db.one(`
                    SELECT balance FROM agents WHERE id = $1
                `, [agent.id]);
                
                const balanceBefore = parseFloat(currentAgent.balance);
                const balanceAfter = balanceBefore + rebateAmount;
                
                // Insert rebate transaction
                await db.none(`
                    INSERT INTO transaction_records (
                        user_type, user_id, transaction_type, amount,
                        balance_before, balance_after, description,
                        member_username, bet_amount, rebate_percentage, period
                    ) VALUES (
                        'agent', $1, 'rebate', $2,
                        $3, $4, $5,
                        $6, $7, $8, $9
                    )
                `, [
                    agent.id,
                    rebateAmount,
                    balanceBefore,
                    balanceAfter,
                    `退水 - 會員 ${betInfo.username} 期號 ${PERIOD}`,
                    betInfo.username,
                    betAmount,
                    agent.rebate_percentage,
                    PERIOD.toString()
                ]);
                
                // Update agent balance
                await db.none(`
                    UPDATE agents SET balance = balance + $1 WHERE id = $2
                `, [rebateAmount, agent.id]);
                
                console.log('✓ Rebate processed successfully');
            }
        }
        
        // 5. Verify rebate processing
        console.log('\n5. VERIFYING REBATE PROCESSING:');
        const processedRebates = await db.any(`
            SELECT * FROM transaction_records 
            WHERE period = $1::text 
            AND transaction_type = 'rebate'
            ORDER BY created_at
        `, [PERIOD]);
        
        console.log(`Total rebates processed: ${processedRebates.length}`);
        processedRebates.forEach(rebate => {
            console.log(`- ${rebate.user_type} ${rebate.description}: ${rebate.amount}`);
        });
        
        // 6. Summary
        console.log('\n6. SUMMARY:');
        console.log(`✓ Period ${PERIOD} checked and processed`);
        console.log(`✓ Bet is settled: ${betInfo.settled}`);
        console.log(`✓ Rebates processed: ${processedRebates.length}`);
        
        // 7. Recommendations for fixing the system
        console.log('\n7. SYSTEM FIX RECOMMENDATIONS:');
        console.log('1. Update the rebate processing query to handle type conversion:');
        console.log('   WHERE t.period = b.period::text');
        console.log('2. Or standardize the period data type across all tables');
        console.log('3. Ensure rebate processing runs after bet settlement');
        
    } catch (error) {
        console.error('Error in final check and fix:', error);
    } finally {
        await db.$pool.end();
    }
}

finalCheckAndFix();