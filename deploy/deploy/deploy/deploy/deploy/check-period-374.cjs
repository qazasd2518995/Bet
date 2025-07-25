const { Client } = require('pg');

// Database configuration - Using the correct database from config.js
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

async function checkPeriod374() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('Connected to database\n');
        
        // 1. Check the actual result
        console.log('=== Checking Period 20250714374 ===\n');
        
        const resultQuery = await client.query(
            'SELECT period, result FROM result_history WHERE period = $1',
            ['20250714374']
        );
        
        if (resultQuery.rows.length > 0) {
            const result = resultQuery.rows[0];
            console.log('Result found:');
            console.log('Period:', result.period);
            console.log('Result array:', result.result);
            console.log('Champion (position 1):', result.result[0]);
            console.log('Runner-up (position 2):', result.result[1]);
            console.log('Third place (position 3):', result.result[2]);
            console.log('\n');
        } else {
            console.log('No result found for period 20250714374\n');
        }
        
        // 2. Check all bets for this period
        const betsQuery = await client.query(`
            SELECT 
                id,
                username,
                period,
                bet_type,
                bet_value,
                amount,
                status,
                win_amount,
                rebate_amount,
                created_at
            FROM bet_history 
            WHERE period = $1
            ORDER BY created_at DESC
        `, ['20250714374']);
        
        console.log(`Found ${betsQuery.rows.length} bets for period 20250714374:\n`);
        
        betsQuery.rows.forEach((bet, index) => {
            console.log(`Bet #${index + 1}:`);
            console.log('  ID:', bet.id);
            console.log('  Username:', bet.username);
            console.log('  Bet Type:', bet.bet_type);
            console.log('  Bet Value:', bet.bet_value);
            console.log('  Amount:', bet.amount);
            console.log('  Status:', bet.status);
            console.log('  Win Amount:', bet.win_amount);
            console.log('  Rebate Amount:', bet.rebate_amount);
            console.log('  Created At:', bet.created_at);
            console.log('');
        });
        
        // 3. Check for champion bets specifically
        const championBetsQuery = await client.query(`
            SELECT 
                id,
                username,
                bet_type,
                bet_value,
                amount,
                status,
                win_amount
            FROM bet_history 
            WHERE period = $1 AND bet_type = 'champion'
        `, ['20250714374']);
        
        console.log(`\n=== Champion Bets (${championBetsQuery.rows.length} found) ===\n`);
        
        championBetsQuery.rows.forEach(bet => {
            console.log(`Champion bet on #${bet.bet_value}:`);
            console.log('  Bet ID:', bet.id);
            console.log('  Username:', bet.username);
            console.log('  Amount:', bet.amount);
            console.log('  Status:', bet.status);
            console.log('  Win Amount:', bet.win_amount);
            console.log('');
        });
        
        // 4. Check settlement logs
        const settlementQuery = await client.query(`
            SELECT 
                sl.id,
                sl.period,
                sl.bet_id,
                sl.username,
                sl.bet_type,
                sl.bet_value,
                sl.amount,
                sl.win_amount,
                sl.status,
                sl.settled_at,
                sl.error_message
            FROM settlement_logs sl
            WHERE sl.period = $1
            ORDER BY sl.settled_at DESC
        `, ['20250714374']);
        
        console.log(`\n=== Settlement Logs (${settlementQuery.rows.length} found) ===\n`);
        
        settlementQuery.rows.forEach(log => {
            console.log(`Settlement for bet ${log.bet_id}:`);
            console.log('  Username:', log.username);
            console.log('  Bet Type:', log.bet_type);
            console.log('  Bet Value:', log.bet_value);
            console.log('  Amount:', log.amount);
            console.log('  Win Amount:', log.win_amount);
            console.log('  Status:', log.status);
            console.log('  Settled At:', log.settled_at);
            if (log.error_message) {
                console.log('  Error:', log.error_message);
            }
            console.log('');
        });
        
    } catch (error) {
        console.error('Error checking period 374:', error);
    } finally {
        await client.end();
    }
}

checkPeriod374();