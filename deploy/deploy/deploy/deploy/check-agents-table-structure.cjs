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

console.log('使用 Render PostgreSQL 配置');

async function checkAgentsTableStructure() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 檢查 agents 表結構
        console.log('\n=== agents 表結構 ===');
        const structureQuery = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'agents'
            ORDER BY ordinal_position
        `;
        
        const structureResult = await client.query(structureQuery);
        
        if (structureResult.rows.length > 0) {
            console.log('欄位名稱 | 資料類型 | 可為空 | 預設值');
            console.log('--------|---------|-------|-------');
            structureResult.rows.forEach(col => {
                console.log(`${col.column_name} | ${col.data_type} | ${col.is_nullable} | ${col.column_default || 'NULL'}`);
            });
        } else {
            console.log('找不到 agents 表');
        }
        
        // 查詢 ti2025A 和 ti2025D 的所有欄位
        console.log('\n\n=== ti2025A 和 ti2025D 完整記錄 ===');
        const agentQuery = `
            SELECT *
            FROM agents 
            WHERE username IN ('ti2025A', 'ti2025D')
            ORDER BY username
        `;
        
        const agentResult = await client.query(agentQuery);
        
        if (agentResult.rows.length > 0) {
            agentResult.rows.forEach((agent, index) => {
                console.log(`\n=== 代理 ${index + 1}: ${agent.username} ===`);
                Object.keys(agent).forEach(key => {
                    console.log(`  ${key}: ${agent[key]}`);
                });
            });
        } else {
            console.log('未找到 ti2025A 或 ti2025D 的記錄');
        }
        
        // 查詢所有代理的基本信息
        console.log('\n\n=== 所有代理列表 ===');
        const allAgentsQuery = `
            SELECT username, market_type, parent_agent, agent_level, balance
            FROM agents 
            ORDER BY market_type, agent_level, username
        `;
        
        const allAgentsResult = await client.query(allAgentsQuery);
        
        if (allAgentsResult.rows.length > 0) {
            allAgentsResult.rows.forEach(agent => {
                console.log(`${agent.username} (${agent.market_type}) - 層級: ${agent.agent_level}, 上級: ${agent.parent_agent || '無'}, 餘額: ${agent.balance}`);
            });
        }
        
    } catch (error) {
        console.error('檢查表結構時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

checkAgentsTableStructure();
