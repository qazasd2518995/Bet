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

async function checkTables() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('Connected to database\n');
        
        // List all tables
        const tablesQuery = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log('=== All tables in database ===');
        tablesQuery.rows.forEach(table => {
            console.log(table.table_name);
        });
        
        // Check bet_history structure
        console.log('\n=== bet_history table structure ===');
        const columnsQuery = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bet_history'
            ORDER BY ordinal_position
        `);
        
        columnsQuery.rows.forEach(col => {
            console.log(`${col.column_name}: ${col.data_type}`);
        });
        
        // Check sample data
        console.log('\n=== Sample data from bet_history for period 374 ===');
        const sampleQuery = await client.query(`
            SELECT * FROM bet_history 
            WHERE period = '20250714374'
            LIMIT 5
        `);
        
        console.log(JSON.stringify(sampleQuery.rows, null, 2));
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

checkTables();