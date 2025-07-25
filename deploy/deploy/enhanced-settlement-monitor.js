// enhanced-settlement-monitor.js - Comprehensive settlement system monitoring and debugging
import db from './db/config.js';
import fs from 'fs';

async function monitorSettlementSystem() {
    console.log('🔍 ENHANCED SETTLEMENT SYSTEM MONITORING & DEBUGGING');
    console.log('=' .repeat(80));
    console.log(`Started at: ${new Date().toISOString()}\n`);
    
    try {
        // 1. Check recent periods settlement status
        console.log('📊 RECENT PERIODS SETTLEMENT STATUS\n');
        
        const recentPeriods = await db.any(`
            SELECT DISTINCT period 
            FROM bet_history 
            WHERE period >= 20250716150 
            ORDER BY period DESC 
            LIMIT 15
        `);
        
        console.log(`Found ${recentPeriods.length} recent periods to check:`);
        console.log(recentPeriods.map(p => p.period).join(', '));
        
        const problemPeriods = [];
        const successfulPeriods = [];
        
        for (const periodRow of recentPeriods) {
            const period = periodRow.period;
            
            // Check settlement completeness
            const [bets, drawResult, settlementLog, rebates] = await Promise.all([
                db.any('SELECT COUNT(*) as count, SUM(amount) as total FROM bet_history WHERE period = $1 AND settled = true', [period]),
                db.oneOrNone('SELECT result FROM result_history WHERE period = $1', [period]),
                db.oneOrNone('SELECT id, created_at, settled_count FROM settlement_logs WHERE period = $1', [period]),
                db.any('SELECT COUNT(*) as count, SUM(amount) as total FROM transaction_records WHERE period = $1 AND transaction_type = \'rebate\'', [period])
            ]);
            
            const betCount = parseInt(bets[0].count);
            const hasDrawResult = !!drawResult;
            const hasSettlementLog = !!settlementLog;
            const rebateCount = parseInt(rebates[0].count);
            
            const status = {
                period,
                betCount,
                hasDrawResult,
                hasSettlementLog,
                rebateCount,
                isComplete: betCount > 0 && hasDrawResult && hasSettlementLog && rebateCount > 0
            };
            
            if (betCount > 0 && (!hasSettlementLog || rebateCount === 0)) {
                problemPeriods.push(status);
            } else if (betCount > 0) {
                successfulPeriods.push(status);
            }
        }
        
        console.log(`\n✅ Successful periods: ${successfulPeriods.length}`);
        console.log(`❌ Problem periods: ${problemPeriods.length}\n`);
        
        if (problemPeriods.length > 0) {
            console.log('🚨 PROBLEM PERIODS DETAILED ANALYSIS:\n');
            for (const period of problemPeriods) {
                console.log(`Period ${period.period}:`);
                console.log(`  - Settled bets: ${period.betCount}`);
                console.log(`  - Draw result: ${period.hasDrawResult ? '✅' : '❌'}`);
                console.log(`  - Settlement log: ${period.hasSettlementLog ? '✅' : '❌'}`);
                console.log(`  - Rebate records: ${period.rebateCount}`);
                console.log('');
            }
        }
        
        // 2. Backend settlement trigger analysis
        console.log('🔧 BACKEND SETTLEMENT TRIGGER ANALYSIS\n');
        
        // Read the backend.js file to analyze settlement logic
        const backendContent = fs.readFileSync('./backend.js', 'utf8');
        
        // Find settlement function calls
        const settlementMatches = backendContent.match(/async\s+function\s+settleBets[^}]+}/g);
        if (settlementMatches) {
            console.log('Found settleBets function definition ✅');
        } else {
            console.log('❌ settleBets function not found in backend.js');
        }
        
        // Check for enhancedSettlement calls
        const enhancedCalls = backendContent.match(/enhancedSettlement\([^)]+\)/g);
        if (enhancedCalls) {
            console.log(`Found ${enhancedCalls.length} enhancedSettlement calls:`);
            enhancedCalls.forEach((call, i) => {
                console.log(`  ${i + 1}. ${call}`);
            });
        } else {
            console.log('❌ No enhancedSettlement calls found');
        }
        
        // Check game loop settlement trigger
        const gameLoopMatches = backendContent.match(/settleBets\([^)]+\)/g);
        if (gameLoopMatches) {
            console.log(`\nFound ${gameLoopMatches.length} settleBets calls:`);
            gameLoopMatches.forEach((call, i) => {
                console.log(`  ${i + 1}. ${call}`);
            });
        }
        
        // 3. Check enhanced-settlement-system.js status
        console.log('\n🔧 ENHANCED SETTLEMENT SYSTEM STATUS\n');
        
        try {
            const enhancedContent = fs.readFileSync('./enhanced-settlement-system.js', 'utf8');
            
            // Check for key functions
            const processRebatesMatch = enhancedContent.match(/async\s+function\s+processRebates[^}]+}/);
            const enhancedSettlementMatch = enhancedContent.match(/export\s+default\s+enhancedSettlement/);
            
            console.log(`processRebates function: ${processRebatesMatch ? '✅ Found' : '❌ Missing'}`);
            console.log(`enhancedSettlement export: ${enhancedSettlementMatch ? '✅ Found' : '❌ Missing'}`);
            
            // Check for error handling
            const errorHandling = enhancedContent.includes('catch') && enhancedContent.includes('console.error');
            console.log(`Error handling: ${errorHandling ? '✅ Implemented' : '❌ Missing'}`);
            
        } catch (error) {
            console.log('❌ Cannot read enhanced-settlement-system.js:', error.message);
        }
        
        // 4. Database integrity checks
        console.log('\n💾 DATABASE INTEGRITY CHECKS\n');
        
        // Check table structures
        const tables = ['bet_history', 'result_history', 'settlement_logs', 'transaction_records'];
        for (const table of tables) {
            try {
                const result = await db.one(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`${table}: ${result.count} records ✅`);
            } catch (error) {
                console.log(`${table}: ❌ Error - ${error.message}`);
            }
        }
        
        // Check for orphaned data
        const orphanedBets = await db.any(`
            SELECT bh.period, COUNT(*) as bet_count
            FROM bet_history bh
            LEFT JOIN settlement_logs sl ON bh.period::text = sl.period::text
            WHERE bh.settled = true 
                AND sl.id IS NULL
                AND bh.period >= 20250716100
            GROUP BY bh.period
            ORDER BY bh.period DESC
        `);
        
        if (orphanedBets.length > 0) {
            console.log(`\n⚠️ Found ${orphanedBets.length} periods with settled bets but no settlement logs:`);
            orphanedBets.forEach(ob => {
                console.log(`  - Period ${ob.period}: ${ob.bet_count} settled bets`);
            });
        } else {
            console.log('\n✅ No orphaned settlement data found');
        }
        
        // 5. Real-time settlement health check
        console.log('\n🩺 REAL-TIME SETTLEMENT HEALTH CHECK\n');
        
        // Get the latest period with activity
        const latestPeriod = await db.oneOrNone(`
            SELECT period, MAX(created_at) as latest_activity
            FROM bet_history 
            WHERE period >= 20250716100
            GROUP BY period
            ORDER BY period DESC
            LIMIT 1
        `);
        
        if (latestPeriod) {
            console.log(`Latest period with activity: ${latestPeriod.period}`);
            console.log(`Latest activity time: ${latestPeriod.latest_activity}`);
            
            // Check if this period has been properly settled
            const latestSettlement = await db.oneOrNone(`
                SELECT * FROM settlement_logs 
                WHERE period = $1
            `, [latestPeriod.period]);
            
            if (latestSettlement) {
                console.log('✅ Latest period has settlement log');
            } else {
                console.log('❌ Latest period missing settlement log - potential ongoing issue');
                
                // Check if bets are settled
                const settledBets = await db.one(`
                    SELECT COUNT(*) as count 
                    FROM bet_history 
                    WHERE period = $1 AND settled = true
                `, [latestPeriod.period]);
                
                if (parseInt(settledBets.count) > 0) {
                    console.log(`🚨 CRITICAL: Period ${latestPeriod.period} has ${settledBets.count} settled bets but no settlement log!`);
                }
            }
        }
        
        // 6. Generate settlement system health score
        console.log('\n📋 SETTLEMENT SYSTEM HEALTH SCORE\n');
        
        const totalRecentPeriods = recentPeriods.length;
        const successfulRate = totalRecentPeriods > 0 ? (successfulPeriods.length / totalRecentPeriods) * 100 : 0;
        
        console.log(`Recent periods analyzed: ${totalRecentPeriods}`);
        console.log(`Successful settlements: ${successfulPeriods.length}`);
        console.log(`Failed settlements: ${problemPeriods.length}`);
        console.log(`Success rate: ${successfulRate.toFixed(1)}%`);
        
        let healthStatus;
        if (successfulRate >= 95) {
            healthStatus = '🟢 HEALTHY';
        } else if (successfulRate >= 80) {
            healthStatus = '🟡 DEGRADED';
        } else {
            healthStatus = '🔴 CRITICAL';
        }
        
        console.log(`Overall health: ${healthStatus}`);
        
        // 7. Recommendations
        console.log('\n💡 RECOMMENDATIONS\n');
        
        if (problemPeriods.length > 0) {
            console.log('Immediate actions needed:');
            console.log('1. Run manual settlement for problem periods');
            console.log('2. Check backend.js settlement trigger logic');
            console.log('3. Verify enhancedSettlement function is being called');
            console.log('4. Add comprehensive logging to settlement process');
            
            // Create a quick fix script
            const fixScript = problemPeriods.map(p => 
                `echo "Processing period ${p.period}..."\nnode process-single-period-rebate.js ${p.period}`
            ).join('\n');
            
            fs.writeFileSync('./fix-problem-periods.sh', `#!/bin/bash\n# Auto-generated fix script\n${fixScript}\n`);
            console.log('\n📝 Created fix-problem-periods.sh script for manual remediation');
        }
        
        if (successfulRate < 95) {
            console.log('\nMonitoring improvements needed:');
            console.log('1. Implement settlement health check alerts');
            console.log('2. Add automatic retry mechanism for failed settlements');
            console.log('3. Create settlement system status dashboard');
        }
        
        console.log('\n' + '='.repeat(80));
        console.log(`Monitoring completed at: ${new Date().toISOString()}`);
        console.log('='.repeat(80));
        
    } catch (error) {
        console.error('❌ Error during settlement monitoring:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        await db.$pool.end();
    }
}

monitorSettlementSystem();