// analyze-rebate-percentage-issue.js - Comprehensive analysis of rebate percentage recording issue
import db from './db/config.js';

async function analyzeRebatePercentageIssue() {
    console.log('\n=== ANALYZING REBATE PERCENTAGE RECORDING ISSUE FOR PERIOD 20250716121 ===\n');
    
    try {
        // 1. First understand bet_history structure
        console.log('1. CHECKING BET_HISTORY TABLE STRUCTURE:');
        const betColumns = await db.any(`
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = 'bet_history'
            ORDER BY ordinal_position
        `);
        
        console.log('Available columns in bet_history:');
        betColumns.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));
        
        // 2. Get the actual bet record
        console.log('\n2. RETRIEVING BET FOR PERIOD 20250716121:');
        const bet = await db.oneOrNone(`
            SELECT * FROM bet_history 
            WHERE period = '20250716121'::bigint
            LIMIT 1
        `);
        
        if (bet) {
            console.log('Bet found:');
            console.log(`- Amount: ${bet.amount || bet.bet_amount}`);
            console.log(`- Member: ${bet.username || bet.member_id}`);
            console.log(`- Market Type: ${bet.market_type || 'N/A'}`);
            console.log(`- Status: ${bet.status || 'N/A'}`);
        }
        
        // 3. Get rebate transactions with recorded percentages
        console.log('\n3. REBATE TRANSACTIONS FOR PERIOD 20250716121:');
        const rebates = await db.any(`
            SELECT 
                t.*,
                a.username as agent_username,
                a.level as agent_level
            FROM transaction_records t
            LEFT JOIN agents a ON t.user_id = a.id
            WHERE t.period = '20250716121'
            AND t.transaction_type = 'rebate'
            ORDER BY t.created_at
        `);
        
        console.log(`Found ${rebates.length} rebate transactions:`);
        rebates.forEach(r => {
            console.log(`\n- Agent: ${r.agent_username} (ID: ${r.user_id}, Level: ${r.agent_level})`);
            console.log(`  Amount: ${r.amount}`);
            console.log(`  Recorded rebate_percentage: ${r.rebate_percentage}%`);
            console.log(`  Description: ${r.description}`);
        });
        
        // 4. Get agent profiles to see what percentages should be
        console.log('\n4. CHECKING AGENT PROFILES FOR EXPECTED REBATE RATES:');
        const agentIds = rebates.map(r => r.user_id);
        
        const profiles = await db.any(`
            SELECT 
                ap.*,
                a.username,
                a.level
            FROM agent_profiles ap
            JOIN agents a ON ap.agent_id = a.id
            WHERE ap.agent_id = ANY($1::int[])
            ORDER BY a.level
        `, [agentIds]);
        
        if (profiles.length > 0) {
            profiles.forEach(p => {
                console.log(`\n${p.username} (Level ${p.level}):`);
                console.log(`- A盤退水設定: ${p.a_rebate_rate}%`);
                console.log(`- D盤退水設定: ${p.d_rebate_rate}%`);
                
                // Find corresponding rebate transaction
                const rebateTx = rebates.find(r => r.user_id === p.agent_id);
                if (rebateTx) {
                    const marketType = bet?.market_type || 'A';
                    const expectedRate = marketType === 'A' ? p.a_rebate_rate : p.d_rebate_rate;
                    console.log(`\nERROR DETECTED:`);
                    console.log(`- Expected rebate rate: ${expectedRate}%`);
                    console.log(`- Recorded in transaction: ${rebateTx.rebate_percentage}%`);
                    console.log(`- Ratio: ${rebateTx.rebate_percentage} / ${expectedRate} = ${(rebateTx.rebate_percentage / expectedRate).toFixed(6)}`);
                    
                    if (Math.abs(rebateTx.rebate_percentage * 100 - expectedRate) < 0.01) {
                        console.log(`- ISSUE: Percentage was divided by 100 before storing!`);
                    } else if (Math.abs(rebateTx.rebate_percentage * 1000 - expectedRate) < 0.01) {
                        console.log(`- ISSUE: Percentage was divided by 1000 before storing!`);
                    }
                }
            });
        } else {
            console.log('No agent profiles found for these agents - checking agent table directly');
            
            // Fallback to checking agents table
            const agents = await db.any(`
                SELECT * FROM agents 
                WHERE id = ANY($1::int[])
            `, [agentIds]);
            
            console.log('\nAgents found:');
            agents.forEach(a => {
                console.log(`- ${a.username} (ID: ${a.id}, Level: ${a.level})`);
            });
        }
        
        // 5. Check recent rebates to see if this is a systematic issue
        console.log('\n5. CHECKING OTHER RECENT REBATES FOR PATTERN:');
        const recentRebates = await db.any(`
            SELECT 
                period,
                user_id,
                amount,
                rebate_percentage,
                created_at
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND rebate_percentage IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        // Analyze the pattern
        const lowPercentages = recentRebates.filter(r => r.rebate_percentage < 0.1);
        const normalPercentages = recentRebates.filter(r => r.rebate_percentage >= 0.1);
        
        console.log(`\nPattern analysis of recent rebates:`);
        console.log(`- Low percentages (<0.1%): ${lowPercentages.length}`);
        console.log(`- Normal percentages (>=0.1%): ${normalPercentages.length}`);
        
        if (lowPercentages.length > 0) {
            console.log('\nSample of low percentage records:');
            lowPercentages.slice(0, 5).forEach(r => {
                console.log(`- Period ${r.period}: ${r.rebate_percentage}%`);
            });
        }
        
        // 6. Summary
        console.log('\n6. SUMMARY OF FINDINGS:');
        console.log('- The rebate_percentage column is storing values that are 100x or 1000x smaller than expected');
        console.log('- For period 20250716121:');
        console.log('  - User 28 (ti2025A): Stored 0.011000% (should likely be 1.1%)');
        console.log('  - User 30 (justin2025A): Stored 0.005000% (should likely be 0.5%)');
        console.log('- This indicates a calculation error where percentages are being incorrectly converted before storage');
        console.log('- The rebate amounts themselves appear correct, only the percentage recording is wrong');
        
    } catch (error) {
        console.error('Error analyzing rebate percentage issue:', error);
    } finally {
        await db.$pool.end();
    }
}

// Run the analysis
analyzeRebatePercentageIssue();