// check-period-20250716121.js - Comprehensive database check for period 20250716121
import db from './db/config.js';
import fs from 'fs';
import path from 'path';

const PERIOD = '20250716121';
const LOG_FILE = 'period-20250716121-analysis.log';

// Create log function
function log(message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
    
    if (data) {
        const dataStr = JSON.stringify(data, null, 2);
        console.log(dataStr);
        fs.appendFileSync(LOG_FILE, dataStr + '\n');
    }
}

async function checkPeriod20250716121() {
    log(`\n=== COMPREHENSIVE CHECK FOR PERIOD ${PERIOD} ===\n`);
    
    try {
        // 1. Check if there are any bets for this period
        log('\n1. CHECKING BETS FOR THIS PERIOD:');
        const bets = await db.any(`
            SELECT 
                bet_id,
                member_id,
                period,
                bet_type,
                bet_value,
                bet_amount,
                expected_win,
                status,
                result,
                actual_win,
                is_settled,
                created_at,
                updated_at,
                settled_at,
                market_type
            FROM bet_history 
            WHERE period = $1
            ORDER BY created_at ASC
        `, [PERIOD]);
        
        log(`Found ${bets.length} bets for period ${PERIOD}`);
        if (bets.length > 0) {
            log('Bet details:', bets);
            
            // Analyze bet status
            const statusCount = bets.reduce((acc, bet) => {
                acc[bet.status] = (acc[bet.status] || 0) + 1;
                return acc;
            }, {});
            log('Bet status distribution:', statusCount);
            
            // Check settlement status
            const settledCount = bets.filter(bet => bet.is_settled).length;
            const unsettledCount = bets.filter(bet => !bet.is_settled).length;
            log(`Settled bets: ${settledCount}, Unsettled bets: ${unsettledCount}`);
        }
        
        // 2. Check if the bets are settled
        log('\n2. CHECKING SETTLEMENT STATUS:');
        const unsettledBets = await db.any(`
            SELECT * FROM bet_history 
            WHERE period = $1 AND (is_settled = false OR status != 'completed')
        `, [PERIOD]);
        
        if (unsettledBets.length > 0) {
            log(`WARNING: Found ${unsettledBets.length} unsettled bets!`, unsettledBets);
        } else {
            log('All bets are properly settled.');
        }
        
        // 3. Check result history for this period
        log('\n3. CHECKING RESULT HISTORY:');
        const results = await db.any(`
            SELECT * FROM result_history 
            WHERE period = $1
        `, [PERIOD]);
        
        if (results.length > 0) {
            log(`Found ${results.length} result(s) for period ${PERIOD}:`, results);
        } else {
            log(`WARNING: No results found for period ${PERIOD}!`);
        }
        
        // 4. Check for rebate transactions for this period
        log('\n4. CHECKING REBATE TRANSACTIONS:');
        const rebateTransactions = await db.any(`
            SELECT 
                t.*,
                m.username as member_username
            FROM transaction_records t
            LEFT JOIN members m ON t.member_id = m.member_id
            WHERE t.period = $1 AND t.type = 'rebate'
            ORDER BY t.created_at ASC
        `, [PERIOD]);
        
        log(`Found ${rebateTransactions.length} rebate transactions for period ${PERIOD}`);
        if (rebateTransactions.length > 0) {
            log('Rebate transaction details:', rebateTransactions);
            
            // Calculate total rebate amount
            const totalRebate = rebateTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
            log(`Total rebate amount: ${totalRebate.toFixed(2)}`);
        }
        
        // 5. Check all transaction types for this period
        log('\n5. CHECKING ALL TRANSACTIONS FOR THIS PERIOD:');
        const allTransactions = await db.any(`
            SELECT 
                type,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM transaction_records 
            WHERE period = $1
            GROUP BY type
        `, [PERIOD]);
        
        if (allTransactions.length > 0) {
            log('Transaction summary by type:', allTransactions);
        } else {
            log('No transactions found for this period.');
        }
        
        // 6. Check for duplicate settlements
        log('\n6. CHECKING FOR DUPLICATE SETTLEMENTS:');
        const duplicateSettlements = await db.any(`
            SELECT 
                bet_id,
                COUNT(*) as settlement_count
            FROM transaction_records 
            WHERE period = $1 AND type IN ('win', 'lose')
            GROUP BY bet_id
            HAVING COUNT(*) > 1
        `, [PERIOD]);
        
        if (duplicateSettlements.length > 0) {
            log(`WARNING: Found ${duplicateSettlements.length} duplicate settlements!`, duplicateSettlements);
        } else {
            log('No duplicate settlements found.');
        }
        
        // 7. Check for orphaned transactions (no corresponding bet)
        log('\n7. CHECKING FOR ORPHANED TRANSACTIONS:');
        const orphanedTransactions = await db.any(`
            SELECT t.* 
            FROM transaction_records t
            LEFT JOIN bet_history b ON t.bet_id = b.bet_id
            WHERE t.period = $1 AND b.bet_id IS NULL AND t.bet_id IS NOT NULL
        `, [PERIOD]);
        
        if (orphanedTransactions.length > 0) {
            log(`WARNING: Found ${orphanedTransactions.length} orphaned transactions!`, orphanedTransactions);
        } else {
            log('No orphaned transactions found.');
        }
        
        // 8. Check member balances affected by this period
        log('\n8. CHECKING MEMBER BALANCES:');
        const affectedMembers = await db.any(`
            SELECT DISTINCT
                m.member_id,
                m.username,
                m.balance,
                COALESCE(SUM(CASE WHEN t.type = 'bet' THEN -t.amount ELSE 0 END), 0) as total_bets,
                COALESCE(SUM(CASE WHEN t.type = 'win' THEN t.amount ELSE 0 END), 0) as total_wins,
                COALESCE(SUM(CASE WHEN t.type = 'rebate' THEN t.amount ELSE 0 END), 0) as total_rebates
            FROM members m
            INNER JOIN transaction_records t ON m.member_id = t.member_id
            WHERE t.period = $1
            GROUP BY m.member_id, m.username, m.balance
        `, [PERIOD]);
        
        if (affectedMembers.length > 0) {
            log(`Found ${affectedMembers.length} members affected by period ${PERIOD}:`, affectedMembers);
        }
        
        // 9. Check backend logs for errors
        log('\n9. CHECKING BACKEND LOGS FOR ERRORS:');
        const logFiles = ['backend.log', 'agentBackend.log', 'agent.log'];
        
        for (const logFile of logFiles) {
            const logPath = path.join(process.cwd(), logFile);
            if (fs.existsSync(logPath)) {
                log(`\nChecking ${logFile} for period ${PERIOD} errors:`);
                try {
                    const logContent = fs.readFileSync(logPath, 'utf8');
                    const lines = logContent.split('\n');
                    const periodErrors = lines.filter(line => 
                        line.includes(PERIOD) && 
                        (line.toLowerCase().includes('error') || 
                         line.toLowerCase().includes('warning') ||
                         line.toLowerCase().includes('failed'))
                    );
                    
                    if (periodErrors.length > 0) {
                        log(`Found ${periodErrors.length} error/warning entries:`);
                        periodErrors.forEach(error => log(error));
                    } else {
                        log(`No errors found in ${logFile} for period ${PERIOD}`);
                    }
                } catch (err) {
                    log(`Error reading ${logFile}: ${err.message}`);
                }
            } else {
                log(`${logFile} not found`);
            }
        }
        
        // 10. Summary and recommendations
        log('\n10. SUMMARY AND RECOMMENDATIONS:');
        
        const summary = {
            period: PERIOD,
            totalBets: bets.length,
            settledBets: bets.filter(b => b.is_settled).length,
            unsettledBets: unsettledBets.length,
            hasResult: results.length > 0,
            rebateTransactions: rebateTransactions.length,
            duplicateSettlements: duplicateSettlements.length,
            orphanedTransactions: orphanedTransactions.length,
            affectedMembers: affectedMembers.length
        };
        
        log('Period Summary:', summary);
        
        // Generate recommendations
        const recommendations = [];
        
        if (unsettledBets.length > 0) {
            recommendations.push('- Settle remaining unsettled bets');
        }
        if (results.length === 0) {
            recommendations.push('- Add result for this period to result_history');
        }
        if (rebateTransactions.length === 0 && bets.length > 0) {
            recommendations.push('- Process rebates for this period');
        }
        if (duplicateSettlements.length > 0) {
            recommendations.push('- Fix duplicate settlement issues');
        }
        if (orphanedTransactions.length > 0) {
            recommendations.push('- Clean up orphaned transactions');
        }
        
        if (recommendations.length > 0) {
            log('\nRecommendations:');
            recommendations.forEach(rec => log(rec));
        } else {
            log('\nNo issues found - period appears to be properly processed!');
        }
        
    } catch (error) {
        log(`Error checking period ${PERIOD}:`, error);
    } finally {
        await db.$pool.end();
        log(`\n=== CHECK COMPLETED - Results saved to ${LOG_FILE} ===\n`);
    }
}

// Run the check
checkPeriod20250716121();