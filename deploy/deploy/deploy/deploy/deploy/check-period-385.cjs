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
        console.log(`\nChampion + Runner-up sum: ${result.champion_runner_sum}`);
        console.log(`Created at: ${result.created_at}\n`);
        
        // 2. Check all bets for this period
        const betsQuery = `
            SELECT 
                bh.*,
                m.balance as current_balance
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.period = $1
            ORDER BY bh.username, bh.bet_type, bh.bet_number
        `;
        const betsData = await pool.query(betsQuery, ['20250714385']);
        
        console.log(`\n=== Found ${betsData.rows.length} bets for period 20250714385 ===\n`);
        
        // 3. Check specifically for position 10 number 4 bets
        const pos10Num4Bets = betsData.rows.filter(bet => 
            bet.bet_type === '第十名' && bet.bet_number === '4'
        );
        
        if (pos10Num4Bets.length > 0) {
            console.log(`\n=== Position 10 Number 4 Bets ===`);
            for (const bet of pos10Num4Bets) {
                console.log(`\nUser: ${bet.username}`);
                console.log(`Bet Type: ${bet.bet_type}`);
                console.log(`Bet Number: ${bet.bet_number}`);
                console.log(`Amount: ${bet.amount}`);
                console.log(`Win: ${bet.win}`);
                console.log(`Win Amount: ${bet.win_amount}`);
                console.log(`Settlement Status: ${bet.settlement_status}`);
                console.log(`Current Balance: ${bet.current_balance}`);
                
                // Check if this should have won
                const shouldWin = result.position_10 === 4;
                console.log(`\nPosition 10 actual result: ${result.position_10}`);
                console.log(`Should this bet win? ${shouldWin}`);
                console.log(`Is marked as win? ${bet.win}`);
                
                if (shouldWin !== bet.win) {
                    console.log('\n⚠️  SETTLEMENT ERROR DETECTED!');
                    console.log(`Bet is marked as ${bet.win ? 'WIN' : 'LOSS'} but should be ${shouldWin ? 'WIN' : 'LOSS'}`);
                }
            }
        }
        
        // 4. Check all bets and their settlement status
        console.log(`\n=== All Bets Settlement Analysis ===\n`);
        
        const betsByType = {};
        for (const bet of betsData.rows) {
            if (!betsByType[bet.bet_type]) {
                betsByType[bet.bet_type] = [];
            }
            betsByType[bet.bet_type].push(bet);
        }
        
        for (const [betType, bets] of Object.entries(betsByType)) {
            console.log(`\n${betType}:`);
            for (const bet of bets) {
                const status = bet.win ? '✓ WIN' : '✗ LOSS';
                console.log(`  ${bet.username} - ${bet.bet_number} - $${bet.amount} - ${status} (Win: $${bet.win_amount || 0})`);
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