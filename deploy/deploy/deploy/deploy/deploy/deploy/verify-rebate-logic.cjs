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

async function verifyRebateLogic() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 1. 檢查總代理退水設定
        const totalAgentsResult = await client.query(`
            SELECT username, rebate_percentage, parent_agent 
            FROM agents 
            WHERE username IN ('ti2025A', 'ti2025D')
            ORDER BY username
        `);
        
        console.log('\n=== 總代理退水設定 ===');
        totalAgentsResult.rows.forEach(agent => {
            const percentage = (parseFloat(agent.rebate_percentage) * 100).toFixed(2);
            console.log(`${agent.username}: ${percentage}%（上級：${agent.parent_agent || '無'}）`);
        });
        
        // 2. 檢查 A 盤代理鏈
        console.log('\n=== A 盤代理鏈分析 ===');
        const aChainResult = await client.query(`
            WITH RECURSIVE agent_chain AS (
                -- 找到 ti2025A 作為起點
                SELECT username, rebate_percentage, parent_agent, 0 as level
                FROM agents
                WHERE username = 'ti2025A'
                
                UNION ALL
                
                -- 遞歸找下級代理
                SELECT a.username, a.rebate_percentage, a.parent_agent, ac.level + 1
                FROM agents a
                INNER JOIN agent_chain ac ON a.parent_agent = ac.username
                WHERE ac.level < 10  -- 防止無限遞歸
            )
            SELECT * FROM agent_chain ORDER BY level, username
        `);
        
        console.log('A 盤代理階層：');
        aChainResult.rows.forEach(agent => {
            const indent = '  '.repeat(agent.level);
            const percentage = (parseFloat(agent.rebate_percentage) * 100).toFixed(2);
            console.log(`${indent}${agent.username}: ${percentage}%（層級：${agent.level}）`);
        });
        
        // 3. 檢查 justin 的代理關係
        const justinAgentResult = await client.query(`
            SELECT username, current_agent as agent_username FROM members 
            WHERE username = 'justin'
        `);
        
        if (justinAgentResult.rows.length > 0) {
            const justinAgent = justinAgentResult.rows[0].agent_username;
            console.log(`\n=== justin 的代理關係 ===`);
            console.log(`justin 的直屬代理：${justinAgent}`);
            
            // 找出 justin 的完整代理鏈
            const chainResult = await client.query(`
                WITH RECURSIVE agent_chain AS (
                    -- 從 justin 的直屬代理開始
                    SELECT username, rebate_percentage, parent_agent, 0 as level
                    FROM agents
                    WHERE username = $1
                    
                    UNION ALL
                    
                    -- 向上找上級代理
                    SELECT a.username, a.rebate_percentage, a.parent_agent, ac.level + 1
                    FROM agents a
                    INNER JOIN agent_chain ac ON a.username = ac.parent_agent
                    WHERE ac.level < 10  -- 防止無限遞歸
                )
                SELECT * FROM agent_chain ORDER BY level DESC
            `, [justinAgent]);
            
            console.log('\njustin 的代理鏈（從總代理到直屬代理）：');
            let previousPercentage = 0;
            chainResult.rows.forEach((agent, index) => {
                const percentage = parseFloat(agent.rebate_percentage) * 100;
                const actualGet = index === 0 ? percentage : percentage - previousPercentage;
                console.log(`${agent.username}: 設定${percentage.toFixed(2)}%, 實際拿${actualGet.toFixed(2)}%`);
                previousPercentage = percentage;
            });
            
            // 4. 計算 500 元下注的理論退水分配
            console.log('\n=== 500元下注的理論退水分配 ===');
            const betAmount = 500;
            let totalRebate = 0;
            let prevPercentage = 0;
            
            chainResult.rows.forEach((agent, index) => {
                const percentage = parseFloat(agent.rebate_percentage) * 100;
                const actualPercentage = index === 0 ? percentage : percentage - prevPercentage;
                const rebateAmount = betAmount * (actualPercentage / 100);
                totalRebate += rebateAmount;
                
                console.log(`${agent.username}: ${rebateAmount.toFixed(2)}元（${actualPercentage.toFixed(2)}%）`);
                prevPercentage = percentage;
            });
            
            console.log(`總退水：${totalRebate.toFixed(2)}元（${(totalRebate/betAmount*100).toFixed(2)}%）`);
        }
        
        // 5. 檢查最近的實際退水記錄
        const recentRebateResult = await client.query(`
            SELECT username, amount, description, created_at 
            FROM transactions 
            WHERE type = 'rebate' 
            AND username IN ('justin2025A', 'ti2025A')
            AND created_at > NOW() - INTERVAL '2 hours'
            ORDER BY created_at DESC
        `);
        
        console.log('\n=== 最近2小時的實際退水記錄 ===');
        if (recentRebateResult.rows.length > 0) {
            recentRebateResult.rows.forEach(record => {
                console.log(`${record.username}: ${record.amount}元`);
                console.log(`  描述：${record.description}`);
                console.log(`  時間：${record.created_at}`);
                console.log('---');
            });
        } else {
            console.log('未找到最近的退水記錄');
        }
        
    } catch (error) {
        console.error('驗證時發生錯誤:', error.message);
        console.error('詳細錯誤:', error);
    } finally {
        await client.end();
    }
}

verifyRebateLogic();
