// check-period-20250716121-fixed.js - Comprehensive database check for period 20250716121
import db from './db/config.js';
import fs from 'fs';
import path from 'path';

const PERIOD = '20250716121';
const LOG_FILE = 'period-20250716121-analysis.log';

// Clear previous log
if (fs.existsSync(LOG_FILE)) {
    fs.unlinkSync(LOG_FILE);
}

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
                id,
                username,
                bet_type,
                bet_value,
                position,
                amount,
                odds,
                period,
                win,
                win_amount,
                settled,
                created_at,
                settled_at
            FROM bet_history 
            WHERE period = $1
            ORDER BY created_at ASC
        `, [PERIOD]);
        
        log(`Found ${bets.length} bets for period ${PERIOD}`);
        if (bets.length > 0) {
            log('Bet details:', bets);
            
            // Analyze bet status
            const settledCount = bets.filter(bet => bet.settled).length;
            const unsettledCount = bets.filter(bet => !bet.settled).length;
            const wonCount = bets.filter(bet => bet.win === true).length;
            const lostCount = bets.filter(bet => bet.win === false).length;
            
            log('Bet status summary:', {
                total: bets.length,
                settled: settledCount,
                unsettled: unsettledCount,
                won: wonCount,
                lost: lostCount
            });
        }
        
        // 2. Check if the bets are settled
        log('\n2. CHECKING SETTLEMENT STATUS:');
        const unsettledBets = await db.any(`
            SELECT * FROM bet_history 
            WHERE period = $1 AND (settled = false OR settled IS NULL)
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
            LEFT JOIN members m ON t.user_id = m.id AND t.user_type = 'member'
            WHERE t.period = $1 AND t.transaction_type = 'rebate'
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
                transaction_type,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM transaction_records 
            WHERE period = $1
            GROUP BY transaction_type
        `, [PERIOD]);
        
        if (allTransactions.length > 0) {
            log('Transaction summary by type:', allTransactions);
        } else {
            log('No transactions found for this period.');
        }
        
        // 6. Check for duplicate settlements
        log('\n6. CHECKING FOR DUPLICATE SETTLEMENTS:');
        const duplicateSettlements = await db.any(`
            WITH bet_transactions AS (
                SELECT 
                    t.*,
                    b.id as bet_id
                FROM transaction_records t
                JOIN bet_history b ON b.username = t.member_username 
                    AND b.period::text = t.period 
                    AND ABS(b.amount - t.bet_amount) < 0.01
                WHERE t.period = $1 
                    AND t.transaction_type IN ('win', 'lose')
            )
            SELECT 
                bet_id,
                COUNT(*) as settlement_count
            FROM bet_transactions
            GROUP BY bet_id
            HAVING COUNT(*) > 1
        `, [PERIOD]);
        
        if (duplicateSettlements.length > 0) {
            log(`WARNING: Found ${duplicateSettlements.length} duplicate settlements!`, duplicateSettlements);
        } else {
            log('No duplicate settlements found.');
        }
        
        // 7. Check member balances affected by this period
        log('\n7. CHECKING MEMBER BALANCES:');
        const affectedMembers = await db.any(`
            SELECT DISTINCT
                m.id as member_id,
                m.username,
                m.balance,
                COALESCE(SUM(CASE WHEN t.transaction_type = 'bet' THEN -t.amount ELSE 0 END), 0) as total_bets,
                COALESCE(SUM(CASE WHEN t.transaction_type = 'win' THEN t.amount ELSE 0 END), 0) as total_wins,
                COALESCE(SUM(CASE WHEN t.transaction_type = 'rebate' THEN t.amount ELSE 0 END), 0) as total_rebates
            FROM members m
            INNER JOIN transaction_records t ON m.id = t.user_id AND t.user_type = 'member'
            WHERE t.period = $1
            GROUP BY m.id, m.username, m.balance
        `, [PERIOD]);
        
        if (affectedMembers.length > 0) {
            log(`Found ${affectedMembers.length} members affected by period ${PERIOD}:`, affectedMembers);
        }
        
        // 8. Check settlement logs
        log('\n8. CHECKING SETTLEMENT LOGS:');
        const settlementLogs = await db.any(`
            SELECT * FROM settlement_logs 
            WHERE period::text = $1
            ORDER BY created_at ASC
        `, [PERIOD]);
        
        if (settlementLogs.length > 0) {
            log(`Found ${settlementLogs.length} settlement log entries:`, settlementLogs);
        } else {
            log('No settlement logs found for this period.');
        }
        
        // 9. Check backend logs for errors
        log('\n9. CHECKING BACKEND LOGS FOR ERRORS:');
        const logFiles = ['backend.log', 'agentBackend.log', 'agent.log', 'enhanced-settlement-system.js'];
        
        for (const logFile of logFiles) {
            const logPath = path.join(process.cwd(), logFile);
            if (fs.existsSync(logPath)) {
                log(`\nChecking ${logFile} for period ${PERIOD} errors:`);
                try {
                    const logContent = fs.readFileSync(logPath, 'utf8');
                    const lines = logContent.split('\n');
                    const periodLines = lines.filter(line => line.includes(PERIOD));
                    
                    if (periodLines.length > 0) {
                        const errorLines = periodLines.filter(line => 
                            line.toLowerCase().includes('error') || 
                            line.toLowerCase().includes('warning') ||
                            line.toLowerCase().includes('failed')
                        );
                        
                        if (errorLines.length > 0) {
                            log(`Found ${errorLines.length} error/warning entries:`);
                            errorLines.slice(0, 10).forEach(error => log(error)); // Show first 10 errors
                        } else {
                            log(`Found ${periodLines.length} entries for period ${PERIOD}, but no errors`);
                        }
                    } else {
                        log(`No entries found in ${logFile} for period ${PERIOD}`);
                    }
                } catch (err) {
                    log(`Error reading ${logFile}: ${err.message}`);
                }
            }
        }
        
        // 10. Summary and recommendations
        log('\n10. SUMMARY AND RECOMMENDATIONS:');
        
        const summary = {
            period: PERIOD,
            totalBets: bets.length,
            settledBets: bets.filter(b => b.settled).length,
            unsettledBets: unsettledBets.length,
            hasResult: results.length > 0,
            rebateTransactions: rebateTransactions.length,
            duplicateSettlements: duplicateSettlements.length,
            affectedMembers: affectedMembers.length,
            settlementLogs: settlementLogs.length
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
        
        if (recommendations.length > 0) {
            log('\nRecommendations:');
            recommendations.forEach(rec => log(rec));
        } else {
            log('\nNo issues found - period appears to be properly processed!');
        }
        
        // Additional detailed checks
        if (bets.length > 0) {
            log('\n11. DETAILED BET ANALYSIS:');
            
            // Group bets by type
            const betsByType = {};
            bets.forEach(bet => {
                if (!betsByType[bet.bet_type]) {
                    betsByType[bet.bet_type] = [];
                }
                betsByType[bet.bet_type].push(bet);
            });
            
            log('Bets grouped by type:');
            Object.entries(betsByType).forEach(([type, typeBets]) => {
                const totalAmount = typeBets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);
                const totalWin = typeBets.reduce((sum, bet) => sum + (parseFloat(bet.win_amount) || 0), 0);
                log(`${type}: ${typeBets.length} bets, total amount: ${totalAmount.toFixed(2)}, total win: ${totalWin.toFixed(2)}`);
            });
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