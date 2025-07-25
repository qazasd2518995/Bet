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

async function checkSettlementProcess() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('Connected to database\n');
        
        // 1. Check if there are any settlement logs for period 374
        const settlementLogsQuery = await client.query(`
            SELECT * FROM settlement_logs 
            WHERE period = '20250714374'
            ORDER BY created_at DESC
        `);
        
        console.log('=== Settlement Logs for period 374 ===');
        if (settlementLogsQuery.rows.length > 0) {
            console.log(JSON.stringify(settlementLogsQuery.rows, null, 2));
        } else {
            console.log('No settlement logs found for this period');
        }
        
        // 2. Check the structure of settlement_logs table
        console.log('\n=== settlement_logs table structure ===');
        const columnsQuery = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'settlement_logs'
            ORDER BY ordinal_position
        `);
        
        columnsQuery.rows.forEach(col => {
            console.log(`${col.column_name}: ${col.data_type}`);
        });
        
        // 3. Check if there are any transactions for this period
        console.log('\n=== Transactions for justin111 around period 374 ===');
        const transactionsQuery = await client.query(`
            SELECT * FROM transaction_records 
            WHERE user_type = 'member' 
            AND created_at >= '2025-07-13 23:45:00'
            AND created_at <= '2025-07-13 23:46:00'
            AND description LIKE '%20250714374%'
            ORDER BY created_at
        `);
        
        if (transactionsQuery.rows.length > 0) {
            console.log(JSON.stringify(transactionsQuery.rows, null, 2));
        } else {
            console.log('No transactions found for this period');
        }
        
        // 4. Let's manually calculate what should have happened
        console.log('\n=== Manual calculation ===');
        const bet = {
            amount: 100,
            odds: 9.89,
            shouldWin: true
        };
        
        const winAmount = bet.amount * bet.odds;
        console.log(`Bet amount: ${bet.amount}`);
        console.log(`Odds: ${bet.odds}`);
        console.log(`Expected win amount: ${winAmount}`);
        console.log(`But actual win amount in DB: 0.00`);
        
        // 5. Check for any errors in the application logs around that time
        console.log('\n=== Checking for duplicate settlement attempts ===');
        const settlementAttemptsQuery = await client.query(`
            SELECT 
                period,
                COUNT(*) as settlement_count,
                MIN(created_at) as first_attempt,
                MAX(created_at) as last_attempt
            FROM settlement_logs 
            WHERE period = '20250714374'
            GROUP BY period
        `);
        
        if (settlementAttemptsQuery.rows.length > 0) {
            console.log('Settlement attempts:');
            console.log(JSON.stringify(settlementAttemptsQuery.rows, null, 2));
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

checkSettlementProcess();