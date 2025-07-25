// comprehensive-rebate-diagnostic.js - Detailed diagnostic for rebate processing issues
import db from './db/config.js';

async function comprehensiveRebateDiagnostic() {
    console.log('=== COMPREHENSIVE REBATE PROCESSING DIAGNOSTIC ===\n');
    console.log(`Diagnostic run at: ${new Date().toISOString()}\n`);
    
    try {
        // 1. Check periods around 20250716154-160
        console.log('1. CHECKING PERIODS 20250716154-160 FOR BETS AND SETTLEMENTS\n');
        
        const targetPeriods = ['20250716154', '20250716155', '20250716156', '20250716157', '20250716158', '20250716159', '20250716160'];
        
        for (const period of targetPeriods) {
            console.log(`--- PERIOD ${period} ---`);
            
            // Check bets for this period
            const bets = await db.any(`
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
                LEFT JOIN members m ON bh.username = m.username
                LEFT JOIN agents a ON m.agent_id = a.id
                WHERE bh.period = $1
                ORDER BY bh.created_at
            `, [period]);
            
            console.log(`Bets: ${bets.length} found`);
            
            if (bets.length > 0) {
                bets.forEach(bet => {
                    console.log(`  - ID:${bet.id} User:${bet.username} Amount:${bet.amount} Settled:${bet.settled} Agent:${bet.agent_username || 'N/A'}`);
                });
                
                // Check if period has been settled
                const drawResult = await db.oneOrNone(`
                    SELECT * FROM result_history 
                    WHERE period = $1
                `, [period]);
                
                if (drawResult) {
                    console.log(`  Draw result: ${JSON.stringify(drawResult.result)} at ${drawResult.created_at}`);
                } else {
                    console.log(`  ⚠️ No draw result found`);
                }
                
                // Check transaction_records for rebates
                const rebateRecords = await db.any(`
                    SELECT 
                        tr.*,
                        CASE 
                            WHEN tr.user_type = 'agent' THEN a.username
                            WHEN tr.user_type = 'member' THEN m.username
                            ELSE 'UNKNOWN'
                        END as username
                    FROM transaction_records tr
                    LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id::text = a.id::text
                    LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id::text = m.id::text
                    WHERE tr.period = $1
                        AND tr.transaction_type IN ('rebate', 'parent_rebate')
                    ORDER BY tr.created_at
                `, [period]);
                
                console.log(`  Rebate records: ${rebateRecords.length} found`);
                if (rebateRecords.length > 0) {
                    rebateRecords.forEach(r => {
                        console.log(`    - User:${r.username} Type:${r.transaction_type} Amount:${r.amount} Time:${r.created_at}`);
                    });
                } else {
                    console.log(`    ⚠️ No rebate records found for settled bets`);
                }
            }
            console.log('');
        }
        
        // 2. Check transaction_records table structure
        console.log('2. TRANSACTION_RECORDS TABLE STRUCTURE\n');
        
        const columns = await db.any(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'transaction_records'
            ORDER BY ordinal_position
        `);
        
        console.log('Table columns:');
        columns.forEach((col, index) => {
            console.log(`  ${index + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}, Default: ${col.column_default || 'none'}`);
        });
        
        // 3. Check recent successful rebate processing for comparison
        console.log('\n3. RECENT SUCCESSFUL REBATE PROCESSING (for comparison)\n');
        
        const recentRebates = await db.any(`
            SELECT 
                tr.period,
                COUNT(*) as rebate_count,
                SUM(tr.amount) as total_rebate_amount,
                MIN(tr.created_at) as first_rebate,
                MAX(tr.created_at) as last_rebate
            FROM transaction_records tr
            WHERE tr.transaction_type IN ('rebate', 'parent_rebate')
                AND tr.created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY tr.period
            ORDER BY tr.period DESC
            LIMIT 10
        `);
        
        console.log('Recent rebate processing:');
        if (recentRebates.length > 0) {
            recentRebates.forEach(r => {
                console.log(`  Period: ${r.period} - ${r.rebate_count} rebates, Total: ${r.total_rebate_amount}, Last: ${r.last_rebate}`);
            });
        } else {
            console.log('  ⚠️ No rebate records found in the last 24 hours');
        }
        
        // 4. Check for SQL errors in backend logs by analyzing recent error patterns
        console.log('\n4. BACKEND ERROR ANALYSIS\n');
        
        // Check settlement_logs for errors
        const settlementErrors = await db.any(`
            SELECT 
                period,
                status,
                message,
                error_details,
                created_at
            FROM settlement_logs
            WHERE status = 'error'
                AND created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        console.log('Recent settlement errors:');
        if (settlementErrors.length > 0) {
            settlementErrors.forEach(err => {
                console.log(`  Period: ${err.period} - Status: ${err.status}`);
                console.log(`    Message: ${err.message}`);
                console.log(`    Error: ${err.error_details}`);
                console.log(`    Time: ${err.created_at}\n`);
            });
        } else {
            console.log('  ✅ No settlement errors found in recent logs');
        }
        
        // 5. Check agent rebate settings
        console.log('\n5. AGENT REBATE SETTINGS VALIDATION\n');
        
        const agentSettings = await db.any(`
            SELECT 
                a.id,
                a.username,
                a.rebate_percentage,
                a.parent_id,
                p.username as parent_username,
                p.rebate_percentage as parent_rebate_percentage
            FROM agents a
            LEFT JOIN agents p ON a.parent_id = p.id
            WHERE a.rebate_percentage > 0
            ORDER BY a.rebate_percentage DESC
        `);
        
        console.log('Agent rebate settings:');
        agentSettings.forEach(agent => {
            console.log(`  ${agent.username} (ID:${agent.id}): ${agent.rebate_percentage}% (Parent: ${agent.parent_username || 'None'}: ${agent.parent_rebate_percentage || 'N/A'}%)`);
        });
        
        // 6. Check for period format issues
        console.log('\n6. PERIOD FORMAT CONSISTENCY CHECK\n');
        
        // Check for different period formats in different tables
        const periodFormats = await db.any(`
            SELECT 'bet_history' as table_name, period, COUNT(*) as count
            FROM bet_history 
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY period
            
            UNION ALL
            
            SELECT 'result_history' as table_name, period, COUNT(*) as count
            FROM result_history 
            WHERE created_at >= NOW() - INTERVAL '24 hours'
            GROUP BY period
            
            UNION ALL
            
            SELECT 'transaction_records' as table_name, period::text, COUNT(*) as count
            FROM transaction_records 
            WHERE created_at >= NOW() - INTERVAL '24 hours'
                AND period IS NOT NULL
            GROUP BY period
            
            ORDER BY table_name, period DESC
        `);
        
        console.log('Period formats across tables:');
        let currentTable = '';
        periodFormats.forEach(p => {
            if (p.table_name !== currentTable) {
                console.log(`\n  ${p.table_name.toUpperCase()}:`);
                currentTable = p.table_name;
            }
            console.log(`    ${p.period} (${p.count} records)`);
        });
        
        // 7. Test rebate calculation for a specific period
        console.log('\n7. MANUAL REBATE CALCULATION TEST\n');
        
        const testPeriod = '20250716154';
        const testBets = await db.any(`
            SELECT 
                bh.id,
                bh.username,
                bh.amount,
                bh.settled,
                m.agent_id
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.period = $1 AND bh.settled = true
            LIMIT 5
        `, [testPeriod]);
        
        if (testBets.length > 0) {
            console.log(`Testing rebate calculation for ${testBets.length} bets in period ${testPeriod}:`);
            
            for (const bet of testBets) {
                // Get agent chain
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
                
                console.log(`\n  Bet ID ${bet.id} (${bet.username}, Amount: ${bet.amount}):`);
                console.log(`    Agent chain:`);
                
                let previousRebate = 0;
                for (const agent of agentChain) {
                    const rebateDiff = (agent.rebate_percentage || 0) - previousRebate;
                    if (rebateDiff > 0) {
                        const rebateAmount = (bet.amount * rebateDiff / 100).toFixed(2);
                        console.log(`      ${agent.username} (Level ${agent.level}): ${rebateDiff}% = ${rebateAmount}`);
                    }
                    previousRebate = agent.rebate_percentage || 0;
                }
            }
        } else {
            console.log(`No settled bets found in period ${testPeriod} for testing`);
        }
        
        // 8. Summary and recommendations
        console.log('\n8. DIAGNOSTIC SUMMARY AND RECOMMENDATIONS\n');
        
        const summary = {
            periodsChecked: targetPeriods.length,
            periodsWithBets: 0,
            periodsWithDrawResults: 0,
            periodsWithRebates: 0,
            totalBetsFound: 0,
            totalRebatesFound: 0
        };
        
        // Count summary data
        for (const period of targetPeriods) {
            const bets = await db.any(`SELECT COUNT(*) as count FROM bet_history WHERE period = $1`, [period]);
            const draws = await db.any(`SELECT COUNT(*) as count FROM result_history WHERE period = $1`, [period]);
            const rebates = await db.any(`SELECT COUNT(*) as count FROM transaction_records WHERE period = $1 AND transaction_type IN ('rebate', 'parent_rebate')`, [period]);
            
            if (bets[0].count > 0) summary.periodsWithBets++;
            if (draws[0].count > 0) summary.periodsWithDrawResults++;
            if (rebates[0].count > 0) summary.periodsWithRebates++;
            
            summary.totalBetsFound += parseInt(bets[0].count);
            summary.totalRebatesFound += parseInt(rebates[0].count);
        }
        
        console.log('Summary:');
        console.log(`  - Periods checked: ${summary.periodsChecked}`);
        console.log(`  - Periods with bets: ${summary.periodsWithBets}`);
        console.log(`  - Periods with draw results: ${summary.periodsWithDrawResults}`);
        console.log(`  - Periods with rebate records: ${summary.periodsWithRebates}`);
        console.log(`  - Total bets found: ${summary.totalBetsFound}`);
        console.log(`  - Total rebates found: ${summary.totalRebatesFound}`);
        
        console.log('\nPotential Issues Identified:');
        if (summary.periodsWithBets > summary.periodsWithRebates) {
            console.log(`  ⚠️ REBATE GAP: ${summary.periodsWithBets - summary.periodsWithRebates} periods have bets but no rebates`);
        }
        if (summary.periodsWithBets > summary.periodsWithDrawResults) {
            console.log(`  ⚠️ SETTLEMENT GAP: ${summary.periodsWithBets - summary.periodsWithDrawResults} periods have bets but no draw results`);
        }
        
        console.log('\nRecommendations:');
        console.log('  1. Check backend rebate processing logic for period format handling');
        console.log('  2. Verify settlement system is properly triggering rebate processing');
        console.log('  3. Review transaction_records table constraints and data types');
        console.log('  4. Monitor settlement_logs for specific error messages');
        console.log('  5. Ensure agent rebate settings are properly configured');
        
    } catch (error) {
        console.error('Diagnostic error:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        await db.$pool.end();
    }
}

// Run the comprehensive diagnostic
comprehensiveRebateDiagnostic();