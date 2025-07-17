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

async function fixRebateSettings() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 更新 ti2025A 的退水設定為 1.1%
        const updateResult = await client.query(`
            UPDATE agents 
            SET rebate_percentage = 1.1 
            WHERE username = 'ti2025A'
        `);
        
        console.log(`✅ 已更新 ti2025A 退水設定為 1.1%，影響 ${updateResult.rowCount} 筆記錄`);
        
        // 確認更新結果
        const checkResult = await client.query(`
            SELECT username, rebate_percentage 
            FROM agents 
            WHERE username IN ('ti2025A', 'ti2025D')
            ORDER BY username
        `);
        
        console.log('\n=== 總代理退水設定確認 ===');
        checkResult.rows.forEach(agent => {
            console.log(`${agent.username}: ${agent.rebate_percentage}%`);
        });
        
        // 檢查代理階層和實際分配
        console.log('\n=== 代理階層分析 ===');
        
        // A盤代理鏈
        const aChainResult = await client.query(`
            WITH RECURSIVE agent_chain AS (
                -- 從總代理開始
                SELECT username, parent_agent, rebate_percentage, market_type, 0 as level
                FROM agents 
                WHERE username = 'ti2025A'
                
                UNION ALL
                
                -- 遞歸查找下級代理
                SELECT a.username, a.parent_agent, a.rebate_percentage, a.market_type, ac.level + 1
                FROM agents a
                INNER JOIN agent_chain ac ON a.parent_agent = ac.username
                WHERE ac.level < 10  -- 防止無限遞歸
            )
            SELECT * FROM agent_chain ORDER BY level, username
        `);
        
        console.log('\nA盤代理鏈：');
        let totalAUsed = 0;
        aChainResult.rows.forEach(agent => {
            const indent = '  '.repeat(agent.level);
            console.log(`${indent}${agent.username}: ${agent.rebate_percentage}% (第${agent.level}層)`);
            
            if (agent.level === 0) {
                totalAUsed = agent.rebate_percentage;
            }
        });
        
        console.log(`A盤總可用退水: 1.1%，總代理設定: ${totalAUsed}%`);
        
    } catch (error) {
        console.error('修正設定時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

fixRebateSettings();
