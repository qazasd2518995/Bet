require('dotenv').config();
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

async function checkTableStructures() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 檢查 game_state 表結構
        const gameStateColumns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'game_state'
            ORDER BY ordinal_position
        `);
        
        console.log('\n=== game_state 表結構 ===');
        gameStateColumns.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });
        
        // 檢查 bet_history 表結構
        const betHistoryColumns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bet_history'
            ORDER BY ordinal_position
        `);
        
        console.log('\n=== bet_history 表結構 ===');
        betHistoryColumns.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });
        
        // 檢查 draw_records 表結構
        const drawRecordsColumns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'draw_records'
            ORDER BY ordinal_position
        `);
        
        console.log('\n=== draw_records 表結構 ===');
        drawRecordsColumns.rows.forEach(row => {
            console.log(`${row.column_name}: ${row.data_type}`);
        });
        
    } catch (error) {
        console.error('檢查表結構時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

checkTableStructures();
