import pg from 'pg';
import dbConfig from './db/config.js';

const { Client } = pg;

async function analyzePeriod362() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('Connected to database');
        
        // 1. Query all bets in period 20250717362
        console.log('\n=== BETS IN PERIOD 20250717362 ===');
        const betsQuery = `
            SELECT 
                b.id,
                b.userId,
                b.betType,
                b.betAmount,
                b.betNumbers,
                b.odds,
                b.potentialWin,
                b.result,
                b.winAmount,
                b.isSettled,
                b.createdAt,
                u.username,
                u.role
            FROM bet_history b
            JOIN users u ON b.userId = u.id
            WHERE b.period = '20250717362'
            ORDER BY b.createdAt
        `;
        const betsResult = await client.query(betsQuery);
        console.log(`Total bets: ${betsResult.rows.length}`);
        
        // Group bets by user
        const betsByUser = {};
        let totalBetAmount = 0;
        
        betsResult.rows.forEach(bet => {
            if (!betsByUser[bet.username]) {
                betsByUser[bet.username] = {
                    username: bet.username,
                    role: bet.role,
                    bets: [],
                    totalBetAmount: 0,
                    totalWinAmount: 0,
                    coverage: new Set()
                };
            }
            
            betsByUser[bet.username].bets.push(bet);
            betsByUser[bet.username].totalBetAmount += parseFloat(bet.betamount);
            if (bet.result === 'win') {
                betsByUser[bet.username].totalWinAmount += parseFloat(bet.winamount || 0);
            }
            
            // Track coverage
            if (bet.bettype === 'two_sides') {
                const nums = bet.betnumbers.split(',');
                nums.forEach(num => betsByUser[bet.username].coverage.add(num));
            }
            
            totalBetAmount += parseFloat(bet.betamount);
        });
        
        console.log('\nBets by user:');
        Object.values(betsByUser).forEach(user => {
            console.log(`\n${user.username} (${user.role}):`);
            console.log(`  Total bets: ${user.bets.length}`);
            console.log(`  Total bet amount: $${user.totalBetAmount.toFixed(2)}`);
            console.log(`  Total win amount: $${user.totalWinAmount.toFixed(2)}`);
            console.log(`  Net result: $${(user.totalWinAmount - user.totalBetAmount).toFixed(2)}`);
            console.log(`  Coverage: ${user.coverage.size} numbers (${Array.from(user.coverage).sort((a,b) => a-b).join(',')})`);
            
            // Show individual bets
            console.log('  Individual bets:');
            user.bets.forEach(bet => {
                console.log(`    - ${bet.bettype}: ${bet.betnumbers} | Amount: $${bet.betamount} | Result: ${bet.result} | Win: $${bet.winamount || 0}`);
            });
        });
        
        // 2. Query draw results
        console.log('\n\n=== DRAW RESULTS FOR PERIOD 20250717362 ===');
        const resultQuery = `
            SELECT 
                period,
                result,
                createdAt,
                drawTime
            FROM result_history
            WHERE period = '20250717362'
        `;
        const resultData = await client.query(resultQuery);
        
        if (resultData.rows.length > 0) {
            const result = resultData.rows[0];
            console.log(`Period: ${result.period}`);
            console.log(`Result: ${result.result}`);
            console.log(`Draw time: ${result.drawtime || result.createdat}`);
            console.log(`Created at: ${result.createdat}`);
        } else {
            console.log('No draw result found for this period!');
        }
        
        // 3. Query win/loss control settings
        console.log('\n\n=== WIN/LOSS CONTROL DURING PERIOD 362 ===');
        const controlQuery = `
            SELECT 
                wlc.*,
                a.username as agent_username
            FROM win_loss_control wlc
            JOIN agents a ON wlc.agentId = a.id
            WHERE wlc.isActive = true
            ORDER BY wlc.createdAt DESC
        `;
        const controlResult = await client.query(controlQuery);
        
        if (controlResult.rows.length > 0) {
            console.log('Active win/loss controls:');
            controlResult.rows.forEach(control => {
                console.log(`\nAgent: ${control.agent_username}`);
                console.log(`  Control percentage: ${control.controlpercentage}%`);
                console.log(`  Min bet amount: $${control.minbetamount}`);
                console.log(`  Created: ${control.createdat}`);
                console.log(`  Updated: ${control.updatedat}`);
            });
        } else {
            console.log('No active win/loss controls found');
        }
        
        // 4. Check control application logs (if any)
        console.log('\n\n=== CHECKING FOR CONTROL APPLICATION ===');
        
        // Analyze betting coverage vs result
        if (resultData.rows.length > 0 && betsResult.rows.length > 0) {
            const winningNumber = resultData.rows[0].result;
            console.log(`\nWinning number: ${winningNumber}`);
            
            // Check coverage analysis
            let totalCoverage = new Set();
            let memberCoverage = new Set();
            
            Object.values(betsByUser).forEach(user => {
                if (user.role === 'member') {
                    user.coverage.forEach(num => memberCoverage.add(num));
                }
                user.coverage.forEach(num => totalCoverage.add(num));
            });
            
            console.log(`\nCoverage analysis:`);
            console.log(`  Total numbers covered: ${totalCoverage.size}/10`);
            console.log(`  Numbers covered by members: ${memberCoverage.size}/10`);
            console.log(`  Member coverage: ${Array.from(memberCoverage).sort((a,b) => a-b).join(',')}`);
            console.log(`  Was winning number ${winningNumber} covered by members? ${memberCoverage.has(winningNumber.toString()) ? 'YES' : 'NO'}`);
            
            // Calculate potential control scenarios
            const uncoveredByMembers = [];
            for (let i = 1; i <= 10; i++) {
                if (!memberCoverage.has(i.toString())) {
                    uncoveredByMembers.push(i);
                }
            }
            
            console.log(`\nNumbers NOT covered by members: ${uncoveredByMembers.join(',') || 'None (full coverage)'}`);
            
            if (uncoveredByMembers.length > 0) {
                console.log('\nControl could have selected from these uncovered numbers to ensure member losses.');
                if (memberCoverage.has(winningNumber.toString())) {
                    console.log(`BUT the winning number ${winningNumber} was covered by members, so they won!`);
                    console.log('\nPossible reasons:');
                    console.log('1. Control was not properly activated');
                    console.log('2. Control percentage threshold not met');
                    console.log('3. Bug in control implementation');
                    console.log('4. Draw happened before control could be applied');
                }
            } else {
                console.log('\nMembers had FULL COVERAGE (all 10 numbers), making control impossible!');
            }
        }
        
        // 5. Check for any settlement issues
        console.log('\n\n=== SETTLEMENT VERIFICATION ===');
        const settlementQuery = `
            SELECT 
                COUNT(*) as total_bets,
                COUNT(CASE WHEN isSettled = true THEN 1 END) as settled_bets,
                COUNT(CASE WHEN isSettled = false THEN 1 END) as unsettled_bets,
                SUM(betAmount) as total_bet_amount,
                SUM(CASE WHEN result = 'win' THEN winAmount ELSE 0 END) as total_win_amount
            FROM bet_history
            WHERE period = '20250717362'
        `;
        const settlementResult = await client.query(settlementQuery);
        const settlement = settlementResult.rows[0];
        
        console.log(`Total bets: ${settlement.total_bets}`);
        console.log(`Settled: ${settlement.settled_bets}`);
        console.log(`Unsettled: ${settlement.unsettled_bets}`);
        console.log(`Total wagered: $${parseFloat(settlement.total_bet_amount).toFixed(2)}`);
        console.log(`Total paid out: $${parseFloat(settlement.total_win_amount).toFixed(2)}`);
        console.log(`House edge: $${(parseFloat(settlement.total_bet_amount) - parseFloat(settlement.total_win_amount)).toFixed(2)}`);
        
    } catch (error) {
        console.error('Error analyzing period:', error);
    } finally {
        await client.end();
    }
}

analyzePeriod362();