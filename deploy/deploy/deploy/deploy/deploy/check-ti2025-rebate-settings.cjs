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

async function checkTi2025RebateSettings() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 查詢 ti2025A 和 ti2025D 的基本信息和退水設定
        console.log('\n=== ti2025A 和 ti2025D 代理信息 ===');
        const agentQuery = `
            SELECT 
                username,
                market_type,
                rebate_rate,
                rebate_rates,
                parent_agent,
                agent_level,
                balance,
                created_at
            FROM agents 
            WHERE username IN ('ti2025A', 'ti2025D')
            ORDER BY username, market_type
        `;
        
        const agentResult = await client.query(agentQuery);
        
        if (agentResult.rows.length > 0) {
            agentResult.rows.forEach(agent => {
                console.log(`\n代理: ${agent.username}`);
                console.log(`  市場類型: ${agent.market_type}`);
                console.log(`  退水率: ${agent.rebate_rate}%`);
                console.log(`  詳細退水設定: ${agent.rebate_rates || '無'}`);
                console.log(`  上級代理: ${agent.parent_agent || '無'}`);
                console.log(`  代理層級: ${agent.agent_level}`);
                console.log(`  餘額: ${agent.balance}`);
                console.log(`  創建時間: ${agent.created_at}`);
            });
        } else {
            console.log('未找到 ti2025A 或 ti2025D 的記錄');
        }
        
        // 查詢所有 A 盤代理的退水設定
        console.log('\n\n=== A 盤所有代理退水設定 ===');
        const aMarketQuery = `
            SELECT 
                username,
                rebate_rate,
                parent_agent,
                agent_level
            FROM agents 
            WHERE market_type = 'A'
            ORDER BY agent_level, username
        `;
        
        const aMarketResult = await client.query(aMarketQuery);
        let totalARebate = 0;
        
        if (aMarketResult.rows.length > 0) {
            aMarketResult.rows.forEach(agent => {
                console.log(`${agent.username}: ${agent.rebate_rate}% (層級: ${agent.agent_level}, 上級: ${agent.parent_agent || '無'})`);
                totalARebate += parseFloat(agent.rebate_rate || 0);
            });
            console.log(`\nA 盤總退水: ${totalARebate}%`);
        }
        
        // 查詢所有 D 盤代理的退水設定
        console.log('\n\n=== D 盤所有代理退水設定 ===');
        const dMarketQuery = `
            SELECT 
                username,
                rebate_rate,
                parent_agent,
                agent_level
            FROM agents 
            WHERE market_type = 'D'
            ORDER BY agent_level, username
        `;
        
        const dMarketResult = await client.query(dMarketQuery);
        let totalDRebate = 0;
        
        if (dMarketResult.rows.length > 0) {
            dMarketResult.rows.forEach(agent => {
                console.log(`${agent.username}: ${agent.rebate_rate}% (層級: ${agent.agent_level}, 上級: ${agent.parent_agent || '無'})`);
                totalDRebate += parseFloat(agent.rebate_rate || 0);
            });
            console.log(`\nD 盤總退水: ${totalDRebate}%`);
        }
        
        // 檢查代理階層結構
        console.log('\n\n=== 代理階層結構檢查 ===');
        
        // A 盤階層
        console.log('\nA 盤階層:');
        const aHierarchyQuery = `
            WITH RECURSIVE agent_hierarchy AS (
                -- 找到最頂層的代理 (parent_agent 是 NULL 或不存在)
                SELECT 
                    username, 
                    rebate_rate, 
                    parent_agent, 
                    agent_level,
                    0 as level,
                    username as path
                FROM agents 
                WHERE market_type = 'A' AND (parent_agent IS NULL OR parent_agent = '')
                
                UNION ALL
                
                -- 遞歸找下層代理
                SELECT 
                    a.username, 
                    a.rebate_rate, 
                    a.parent_agent, 
                    a.agent_level,
                    ah.level + 1,
                    ah.path || ' -> ' || a.username
                FROM agents a
                INNER JOIN agent_hierarchy ah ON a.parent_agent = ah.username
                WHERE a.market_type = 'A'
            )
            SELECT * FROM agent_hierarchy ORDER BY level, username
        `;
        
        const aHierarchyResult = await client.query(aHierarchyQuery);
        if (aHierarchyResult.rows.length > 0) {
            aHierarchyResult.rows.forEach(agent => {
                const indent = '  '.repeat(agent.level);
                console.log(`${indent}${agent.username}: ${agent.rebate_rate}% (路徑: ${agent.path})`);
            });
        }
        
        // D 盤階層
        console.log('\nD 盤階層:');
        const dHierarchyQuery = `
            WITH RECURSIVE agent_hierarchy AS (
                -- 找到最頂層的代理 (parent_agent 是 NULL 或不存在)
                SELECT 
                    username, 
                    rebate_rate, 
                    parent_agent, 
                    agent_level,
                    0 as level,
                    username as path
                FROM agents 
                WHERE market_type = 'D' AND (parent_agent IS NULL OR parent_agent = '')
                
                UNION ALL
                
                -- 遞歸找下層代理
                SELECT 
                    a.username, 
                    a.rebate_rate, 
                    a.parent_agent, 
                    a.agent_level,
                    ah.level + 1,
                    ah.path || ' -> ' || a.username
                FROM agents a
                INNER JOIN agent_hierarchy ah ON a.parent_agent = ah.username
                WHERE a.market_type = 'D'
            )
            SELECT * FROM agent_hierarchy ORDER BY level, username
        `;
        
        const dHierarchyResult = await client.query(dHierarchyQuery);
        if (dHierarchyResult.rows.length > 0) {
            dHierarchyResult.rows.forEach(agent => {
                const indent = '  '.repeat(agent.level);
                console.log(`${indent}${agent.username}: ${agent.rebate_rate}% (路徑: ${agent.path})`);
            });
        }
        
        // 檢查設定是否正確
        console.log('\n\n=== 設定檢查結果 ===');
        
        const ti2025ARecord = agentResult.rows.find(r => r.username === 'ti2025A');
        const ti2025DRecord = agentResult.rows.find(r => r.username === 'ti2025D');
        
        if (ti2025ARecord) {
            const expectedA = 1.1;
            const actualA = parseFloat(ti2025ARecord.rebate_rate || 0);
            console.log(`ti2025A (A盤總代理):`);
            console.log(`  預期退水: ${expectedA}%`);
            console.log(`  實際退水: ${actualA}%`);
            console.log(`  設定正確: ${actualA === expectedA ? '✅' : '❌'}`);
        } else {
            console.log('❌ 找不到 ti2025A 記錄');
        }
        
        if (ti2025DRecord) {
            const expectedD = 4.1;
            const actualD = parseFloat(ti2025DRecord.rebate_rate || 0);
            console.log(`ti2025D (D盤總代理):`);
            console.log(`  預期退水: ${expectedD}%`);
            console.log(`  實際退水: ${actualD}%`);
            console.log(`  設定正確: ${actualD === expectedD ? '✅' : '❌'}`);
        } else {
            console.log('❌ 找不到 ti2025D 記錄');
        }
        
        console.log(`\nA 盤總退水檢查: ${totalARebate}% (應該 ≤ 1.1%) ${totalARebate <= 1.1 ? '✅' : '❌'}`);
        console.log(`D 盤總退水檢查: ${totalDRebate}% (應該 ≤ 4.1%) ${totalDRebate <= 4.1 ? '✅' : '❌'}`);
        
    } catch (error) {
        console.error('檢查退水設定時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

checkTi2025RebateSettings();
