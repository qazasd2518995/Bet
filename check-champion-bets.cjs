const { Client } = require('pg');

// Database configuration
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

async function checkChampionBets() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('Connected to database\n');
        
        // Check specifically for champion bets in period 374
        const query = await client.query(`
            SELECT 
                id,
                username,
                bet_type,
                bet_value,
                position,
                amount,
                odds,
                win,
                win_amount,
                settled,
                created_at,
                settled_at
            FROM bet_history 
            WHERE period = '20250714374'
            AND (bet_type = 'champion' OR (bet_type = 'number' AND position = 1))
            ORDER BY id
        `);
        
        console.log(`=== Champion/Position 1 bets for period 20250714374 ===`);
        console.log(`Found ${query.rows.length} bets\n`);
        
        query.rows.forEach(bet => {
            console.log(`Bet ID: ${bet.id}`);
            console.log(`  Username: ${bet.username}`);
            console.log(`  Bet Type: '${bet.bet_type}'`);
            console.log(`  Bet Value: '${bet.bet_value}'`);
            console.log(`  Position: ${bet.position}`);
            console.log(`  Amount: ${bet.amount}`);
            console.log(`  Win: ${bet.win}`);
            console.log(`  Win Amount: ${bet.win_amount}`);
            console.log(`  Settled: ${bet.settled}`);
            console.log(`  Created: ${bet.created_at}`);
            console.log(`  Settled: ${bet.settled_at}`);
            console.log('');
        });
        
        // Also check the exact bet that should have won
        console.log(`\n=== Checking bet on number 5 for position 1 ===`);
        const betOn5 = await client.query(`
            SELECT * FROM bet_history 
            WHERE period = '20250714374'
            AND bet_value = '5'
            AND (bet_type = 'champion' OR (bet_type = 'number' AND position = 1))
        `);
        
        if (betOn5.rows.length > 0) {
            console.log('Found bet(s) on number 5:');
            console.log(JSON.stringify(betOn5.rows, null, 2));
        } else {
            console.log('No bets found on number 5 for champion/position 1');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

checkChampionBets();