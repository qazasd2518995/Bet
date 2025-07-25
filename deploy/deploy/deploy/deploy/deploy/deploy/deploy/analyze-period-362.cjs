const { Client } = require('pg');

// Use the actual database configuration
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: {
        rejectUnauthorized: false
    }
};

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
                b.username,
                b.bet_type,
                b.bet_value,
                b.position,
                b.amount,
                b.odds,
                b.period,
                b.win,
                b.win_amount,
                b.settled,
                b.created_at,
                b.settled_at,
                CASE 
                    WHEN m.username IS NOT NULL THEN 'member'
                    WHEN a.username IS NOT NULL THEN 'agent'
                    WHEN u.username IS NOT NULL THEN 'user'
                    ELSE 'unknown'
                END as role
            FROM bet_history b
            LEFT JOIN users u ON b.username = u.username
            LEFT JOIN members m ON b.username = m.username
            LEFT JOIN agents a ON b.username = a.username
            WHERE b.period = '20250717362'
            ORDER BY b.created_at
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
            betsByUser[bet.username].totalBetAmount += parseFloat(bet.amount);
            if (bet.win === true) {
                betsByUser[bet.username].totalWinAmount += parseFloat(bet.win_amount || 0);
            }
            
            // Track coverage based on bet type and value
            if (bet.bet_type === 'two_sides' || bet.bet_type === 'specific') {
                // For two_sides bets, bet_value contains the numbers
                if (bet.bet_value) {
                    const nums = bet.bet_value.split(',');
                    nums.forEach(num => betsByUser[bet.username].coverage.add(num.trim()));
                }
            }
            
            totalBetAmount += parseFloat(bet.amount);
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
                console.log(`    - ${bet.bet_type}: ${bet.bet_value} | Position: ${bet.position || 'N/A'} | Amount: $${bet.amount} | Win: ${bet.win ? 'YES' : 'NO'} | Win Amount: $${bet.win_amount || 0}`);
            });
        });
        
        // 2. Query draw results
        console.log('\n\n=== DRAW RESULTS FOR PERIOD 20250717362 ===');
        const resultQuery = `
            SELECT 
                period,
                result,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                created_at,
                draw_time
            FROM result_history
            WHERE period = '20250717362'
        `;
        const resultData = await client.query(resultQuery);
        
        if (resultData.rows.length > 0) {
            const result = resultData.rows[0];
            console.log(`Period: ${result.period}`);
            console.log(`Result (JSON): ${JSON.stringify(result.result)}`);
            console.log(`Position 1: ${result.position_1}`);
            console.log(`Position 2: ${result.position_2}`);
            console.log(`Position 3: ${result.position_3}`);
            console.log(`Position 4: ${result.position_4}`);
            console.log(`Position 5: ${result.position_5}`);
            console.log(`Position 6: ${result.position_6}`);
            console.log(`Position 7: ${result.position_7}`);
            console.log(`Position 8: ${result.position_8}`);
            console.log(`Position 9: ${result.position_9}`);
            console.log(`Position 10: ${result.position_10}`);
            console.log(`Draw time: ${result.draw_time || result.created_at}`);
            console.log(`Created at: ${result.created_at}`);
        } else {
            console.log('No draw result found for this period!');
        }
        
        // 3. Query win/loss control settings
        console.log('\n\n=== WIN/LOSS CONTROL DURING PERIOD 362 ===');
        const controlQuery = `
            SELECT 
                wlc.*
            FROM win_loss_control wlc
            WHERE wlc.is_active = true
            ORDER BY wlc.created_at DESC
        `;
        const controlResult = await client.query(controlQuery);
        
        if (controlResult.rows.length > 0) {
            console.log('Active win/loss controls:');
            controlResult.rows.forEach(control => {
                console.log(`\nControl Mode: ${control.control_mode}`);
                console.log(`  Target Type: ${control.target_type}`);
                console.log(`  Target ID: ${control.target_id}`);
                console.log(`  Target Username: ${control.target_username}`);
                console.log(`  Control percentage: ${control.control_percentage}%`);
                console.log(`  Win control: ${control.win_control ? 'YES' : 'NO'}`);
                console.log(`  Loss control: ${control.loss_control ? 'YES' : 'NO'}`);
                console.log(`  Operator: ${control.operator_username} (ID: ${control.operator_id})`);
                console.log(`  Start period: ${control.start_period}`);
                console.log(`  Created: ${control.created_at}`);
                console.log(`  Updated: ${control.updated_at}`);
            });
        } else {
            console.log('No active win/loss controls found');
        }
        
        // 4. Check control application logs (if any)
        console.log('\n\n=== CHECKING FOR CONTROL APPLICATION ===');
        
        // Analyze betting coverage vs result
        if (resultData.rows.length > 0 && betsResult.rows.length > 0) {
            const result = resultData.rows[0];
            const winningNumber = result.position_5; // Position 5 is what justin111 was betting on
            console.log(`\nWinning number at position 5: ${winningNumber}`);
            
            // Check coverage analysis for position 5 bets
            let position5Coverage = new Set();
            let memberPosition5Coverage = new Set();
            
            betsResult.rows.forEach(bet => {
                if (bet.position === 5 && bet.bet_type === 'number') {
                    if (bet.role === 'member') {
                        memberPosition5Coverage.add(bet.bet_value);
                    }
                    position5Coverage.add(bet.bet_value);
                }
            });
            
            console.log(`\nCoverage analysis for Position 5:`);
            console.log(`  Total numbers covered: ${position5Coverage.size}/10`);
            console.log(`  Numbers covered by members: ${memberPosition5Coverage.size}/10`);
            console.log(`  Member coverage: ${Array.from(memberPosition5Coverage).sort((a,b) => parseInt(a) - parseInt(b)).join(',')}`);
            console.log(`  Was winning number ${winningNumber} covered by members? ${memberPosition5Coverage.has(winningNumber.toString()) ? 'YES' : 'NO'}`);
            
            // Calculate potential control scenarios
            const uncoveredByMembers = [];
            for (let i = 1; i <= 10; i++) {
                if (!memberPosition5Coverage.has(i.toString())) {
                    uncoveredByMembers.push(i);
                }
            }
            
            console.log(`\nNumbers NOT covered by members at position 5: ${uncoveredByMembers.join(',') || 'None (full coverage)'}`);
            
            if (uncoveredByMembers.length > 0) {
                console.log('\nControl could have selected from these uncovered numbers to ensure member losses.');
                if (memberPosition5Coverage.has(winningNumber.toString())) {
                    console.log(`BUT the winning number ${winningNumber} was covered by members, so they won!`);
                    console.log('\nPossible reasons:');
                    console.log('1. Control was not properly activated');
                    console.log('2. Control percentage threshold not met');
                    console.log('3. Bug in control implementation');
                    console.log('4. Draw happened before control could be applied');
                    console.log('5. Only one member betting (justin111) had not bet enough to trigger control');
                }
            } else {
                console.log('\nMembers had FULL COVERAGE (all 10 numbers) at position 5, making control impossible!');
            }
        }
        
        // 5. Check for any settlement issues
        console.log('\n\n=== SETTLEMENT VERIFICATION ===');
        const settlementQuery = `
            SELECT 
                COUNT(*) as total_bets,
                COUNT(CASE WHEN settled = true THEN 1 END) as settled_bets,
                COUNT(CASE WHEN settled = false THEN 1 END) as unsettled_bets,
                SUM(amount) as total_bet_amount,
                SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_win_amount
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