require('dotenv').config();
const { Client } = require('pg');

// 確保使用 Render PostgreSQL
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

async function fixRebateDecimal() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 檢查當前設定
        const currentResult = await client.query(`
            SELECT username, rebate_percentage 
            FROM agents 
            WHERE username IN ('ti2025A', 'ti2025D')
            ORDER BY username
        `);
        
        console.log('\n=== 修正前的設定 ===');
        currentResult.rows.forEach(agent => {
            console.log(`${agent.username}: ${agent.rebate_percentage}% (小數: ${agent.rebate_percentage / 100})`);
        });
        
        // 修正 ti2025A 為 1.1%
        const updateTi2025A = await client.query(`
            UPDATE agents 
            SET rebate_percentage = 1.1 
            WHERE username = 'ti2025A'
        `);
        
        // 修正 ti2025D 為 4.1%
        const updateTi2025D = await client.query(`
            UPDATE agents 
            SET rebate_percentage = 4.1 
            WHERE username = 'ti2025D'
        `);
        
        console.log(`✅ 已更新 ti2025A 退水設定為 1.1%，影響 ${updateTi2025A.rowCount} 筆記錄`);
        console.log(`✅ 已更新 ti2025D 退水設定為 4.1%，影響 ${updateTi2025D.rowCount} 筆記錄`);
        
        // 檢查修正後的設定
        const afterResult = await client.query(`
            SELECT username, rebate_percentage 
            FROM agents 
            WHERE username IN ('ti2025A', 'ti2025D')
            ORDER BY username
        `);
        
        console.log('\n=== 修正後的設定 ===');
        afterResult.rows.forEach(agent => {
            console.log(`${agent.username}: ${agent.rebate_percentage}% (小數: ${agent.rebate_percentage / 100})`);
        });
        
        // 驗證小數值
        console.log('\n=== 小數值驗證 ===');
        console.log(`ti2025A: 1.1% = 0.011`);
        console.log(`ti2025D: 4.1% = 0.041`);
        
    } catch (error) {
        console.error('修正退水設定時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

fixRebateDecimal();
