const { Pool } = require('pg');

// Hardcode the database config to match db/config.js
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

const pool = new Pool(dbConfig);

async function checkPeriod385() {
    try {
        // 1. Check the actual result for period 20250714385
        console.log('=== Checking Period 20250714385 ===\n');
        
        const resultQuery = `
            SELECT * FROM result_history 
            WHERE period = $1
        `;
        const resultData = await pool.query(resultQuery, ['20250714385']);
        
        if (resultData.rows.length === 0) {
            console.log('No result found for period 20250714385');
            return;
        }
        
        const result = resultData.rows[0];
        console.log('Result for period 20250714385:');
        console.log('Raw result object:', result);
        
        // Check if positions are stored as array or individual columns
        if (result.positions) {
            console.log('Positions array:', result.positions);
            for (let i = 0; i < 10; i++) {
                console.log(`Position ${i+1}: ${result.positions[i]}`);
            }
        } else {
            console.log('No positions array found, checking individual columns...');
        }
        
        // 2. Check all bets for this period
        const betsQuery = `
            SELECT 
                bh.*,
                m.balance as current_balance
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.period = $1
            ORDER BY bh.username, bh.bet_type, bh.bet_value
        `;
        const betsData = await pool.query(betsQuery, ['20250714385']);
        
        console.log(`\n=== Found ${betsData.rows.length} bets for period 20250714385 ===\n`);
        
        // 3. Check specifically for position 10 number 4 bets
        const pos10Num4Bets = betsData.rows.filter(bet => {
            // Check different possible formats for position 10 bets
            return (bet.bet_type === '第十名' && bet.bet_value === '4') ||
                   (bet.bet_type === 'tenth' && bet.bet_value === '4') ||
                   (bet.bet_type === 'number' && bet.position === 10 && bet.bet_value === '4');
        });
        
        if (pos10Num4Bets.length > 0) {
            console.log(`\n=== Position 10 Number 4 Bets ===`);
            for (const bet of pos10Num4Bets) {
                console.log(`\nUser: ${bet.username}`);
                console.log(`Bet Type: ${bet.bet_type}`);
                console.log(`Bet Value: ${bet.bet_value}`);
                console.log(`Position: ${bet.position}`);
                console.log(`Amount: ${bet.amount}`);
                console.log(`Win: ${bet.win}`);
                console.log(`Win Amount: ${bet.win_amount}`);
                console.log(`Settled: ${bet.settled}`);
                console.log(`Current Balance: ${bet.current_balance}`);
                
                // Check if this should have won
                let position10Result;
                if (result.positions) {
                    position10Result = result.positions[9]; // array index 9 for position 10
                } else if (result.position_10) {
                    position10Result = result.position_10;
                }
                
                const shouldWin = position10Result === 4;
                console.log(`\nPosition 10 actual result: ${position10Result}`);
                console.log(`Should this bet win? ${shouldWin}`);
                console.log(`Is marked as win? ${bet.win}`);
                
                if (shouldWin !== bet.win) {
                    console.log('\n⚠️  SETTLEMENT ERROR DETECTED!');
                    console.log(`Bet is marked as ${bet.win ? 'WIN' : 'LOSS'} but should be ${shouldWin ? 'WIN' : 'LOSS'}`);
                }
            }
        } else {
            console.log('\nNo bets found for Position 10 Number 4');
        }
        
        // 4. Check all bets and their settlement status
        console.log(`\n=== All Bets Settlement Analysis ===\n`);
        
        const betsByType = {};
        for (const bet of betsData.rows) {
            const key = `${bet.bet_type}${bet.position ? '_pos' + bet.position : ''}`;
            if (!betsByType[key]) {
                betsByType[key] = [];
            }
            betsByType[key].push(bet);
        }
        
        for (const [betType, bets] of Object.entries(betsByType)) {
            console.log(`\n${betType}:`);
            for (const bet of bets) {
                const status = bet.win ? '✓ WIN' : '✗ LOSS';
                const settled = bet.settled ? 'SETTLED' : 'UNSETTLED';
                console.log(`  ${bet.username} - ${bet.bet_value} - $${bet.amount} - ${status} - ${settled} (Win: $${bet.win_amount || 0})`);
            }
        }
        
        // 5. Check transaction records for this period
        console.log(`\n=== Transaction Records for Period Settlement ===\n`);
        
        const transQuery = `
            SELECT 
                tr.*,
                m.username
            FROM transaction_records tr
            JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
            WHERE tr.description LIKE '%20250714385%'
            ORDER BY tr.created_at DESC
            LIMIT 20
        `;
        const transData = await pool.query(transQuery);
        
        console.log(`Found ${transData.rows.length} transactions related to period 20250714385`);
        
        for (const trans of transData.rows) {
            console.log(`\n${trans.username}: ${trans.transaction_type} - $${trans.amount}`);
            console.log(`  Balance: ${trans.balance_before} → ${trans.balance_after}`);
            console.log(`  Description: ${trans.description}`);
            console.log(`  Time: ${trans.created_at}`);
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

checkPeriod385();