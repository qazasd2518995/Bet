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
        
        // Check column names in users table
        const columnsQuery = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position;
        `;
        
        const result = await client.query(columnsQuery);
        
        console.log('\nColumns in users table:');
        result.rows.forEach(col => {
            console.log(`  ${col.column_name} (${col.data_type})`);
        });
        
        // Also check if there's a members table
        const membersQuery = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'members'
            ORDER BY ordinal_position;
        `;
        
        const membersResult = await client.query(membersQuery);
        
        if (membersResult.rows.length > 0) {
            console.log('\nColumns in members table:');
            membersResult.rows.forEach(col => {
                console.log(`  ${col.column_name} (${col.data_type})`);
            });
        }
        
        // Check agents table too
        const agentsQuery = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'agents'
            ORDER BY ordinal_position;
        `;
        
        const agentsResult = await client.query(agentsQuery);
        
        if (agentsResult.rows.length > 0) {
            console.log('\nColumns in agents table:');
            agentsResult.rows.forEach(col => {
                console.log(`  ${col.column_name} (${col.data_type})`);
            });
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

checkColumns();