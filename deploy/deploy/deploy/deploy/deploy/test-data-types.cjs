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

async function testDataTypes() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('Connected to database\n');
        
        // Get a sample bet from the optimizedSettlement query
        const unsettledBets = await client.query(`
            SELECT b.*, m.id as member_id, m.balance as current_balance
            FROM bet_history b
            INNER JOIN members m ON b.username = m.username
            WHERE b.period = '20250714375' AND b.settled = false
            LIMIT 5
        `);
        
        console.log('Sample unsettled bets:');
        unsettledBets.rows.forEach(bet => {
            console.log(`\nBet ${bet.id}:`);
            console.log('  position:', bet.position, 'type:', typeof bet.position);
            console.log('  bet_type:', bet.bet_type, 'type:', typeof bet.bet_type);
            console.log('  bet_value:', bet.bet_value, 'type:', typeof bet.bet_value);
            console.log('  period:', bet.period, 'type:', typeof bet.period);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

testDataTypes();