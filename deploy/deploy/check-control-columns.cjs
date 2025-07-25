const { Client } = require('pg');

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

async function checkColumns() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('Connected to database');
        
        // Check column names in win_loss_control table
        const columnsQuery = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'win_loss_control'
            ORDER BY ordinal_position;
        `;
        
        const result = await client.query(columnsQuery);
        
        console.log('\nColumns in win_loss_control table:');
        result.rows.forEach(col => {
            console.log(`  ${col.column_name} (${col.data_type})`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

checkColumns();