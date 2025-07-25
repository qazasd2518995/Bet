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

async function findRebateTables() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 查詢所有表名
        const tablesQuery = `
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
        `;
        
        const tablesResult = await client.query(tablesQuery);
        
        console.log('\n=== 所有表名 ===');
        tablesResult.rows.forEach(table => {
            console.log(table.table_name);
        });
        
        // 查詢包含 rebate 的表
        console.log('\n=== 包含 rebate 的表 ===');
        const rebateTables = tablesResult.rows.filter(t => 
            t.table_name.toLowerCase().includes('rebate') || 
            t.table_name.toLowerCase().includes('commission')
        );
        
        rebateTables.forEach(table => {
            console.log(`✓ ${table.table_name}`);
        });
        
        if (rebateTables.length === 0) {
            console.log('未找到退水相關的表');
        }
        
    } catch (error) {
        console.error('查詢表名時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

findRebateTables();
