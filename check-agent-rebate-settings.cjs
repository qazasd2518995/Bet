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

async function checkAgentRebateSettings() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 查詢所有代理的退水設定
        const agentsResult = await client.query(`
            SELECT 
                username,
                role,
                rebate_percentage,
                market_type,
                parent_agent,
                created_at
            FROM agents 
            ORDER BY 
                CASE 
                    WHEN role = 'super_agent' THEN 1
                    WHEN role = 'agent' THEN 2
                    WHEN role = 'member' THEN 3
                    ELSE 4
                END,
                market_type,
                username
        `);
        
        console.log('\n=== 代理退水設定一覽 ===');
        agentsResult.rows.forEach(agent => {
            console.log(`用戶名: ${agent.username}`);
            console.log(`  角色: ${agent.role}`);
            console.log(`  退水比例: ${agent.rebate_percentage}%`);
            console.log(`  市場類型: ${agent.market_type}`);
            console.log(`  上級代理: ${agent.parent_agent || '無'}`);
            console.log(`  創建時間: ${agent.created_at}`);
            console.log('---');
        });
        
        // 特別檢查總代理設定
        console.log('\n=== 總代理退水設定檢查 ===');
        
        // 檢查 ti2025A (A盤總代理)
        const ti2025A = agentsResult.rows.find(agent => agent.username === 'ti2025A');
        if (ti2025A) {
            console.log(`ti2025A (A盤總代理):`);
            console.log(`  當前退水設定: ${ti2025A.rebate_percentage}%`);
            console.log(`  預期設定: 1.1% (A盤滿水)`);
            console.log(`  設定是否正確: ${ti2025A.rebate_percentage === 1.1 ? '✅ 正確' : '❌ 錯誤'}`);
        } else {
            console.log('❌ 找不到 ti2025A 總代理');
        }
        
        // 檢查 ti2025D (D盤總代理)
        const ti2025D = agentsResult.rows.find(agent => agent.username === 'ti2025D');
        if (ti2025D) {
            console.log(`\nti2025D (D盤總代理):`);
            console.log(`  當前退水設定: ${ti2025D.rebate_percentage}%`);
            console.log(`  預期設定: 4.1% (D盤滿水)`);
            console.log(`  設定是否正確: ${ti2025D.rebate_percentage === 4.1 ? '✅ 正確' : '❌ 錯誤'}`);
        } else {
            console.log('❌ 找不到 ti2025D 總代理');
        }
        
        // 檢查下線代理退水總和
        console.log('\n=== 下線代理退水總和檢查 ===');
        
        // A盤下線總和
        const aMarketAgents = agentsResult.rows.filter(agent => 
            agent.market_type === 'A' && 
            agent.role !== 'super_agent' && 
            agent.parent_agent
        );
        
        const aMarketRebateSum = aMarketAgents.reduce((sum, agent) => sum + parseFloat(agent.rebate_percentage || 0), 0);
        
        console.log(`A盤下線代理總退水: ${aMarketRebateSum.toFixed(1)}%`);
        console.log(`A盤總代理可分配: 1.1%`);
        console.log(`A盤下線總和是否超限: ${aMarketRebateSum > 1.1 ? '❌ 超限' : '✅ 正常'}`);
        
        if (aMarketAgents.length > 0) {
            console.log('A盤下線代理明細:');
            aMarketAgents.forEach(agent => {
                console.log(`  ${agent.username}: ${agent.rebate_percentage}% (上級: ${agent.parent_agent})`);
            });
        }
        
        // D盤下線總和
        const dMarketAgents = agentsResult.rows.filter(agent => 
            agent.market_type === 'D' && 
            agent.role !== 'super_agent' && 
            agent.parent_agent
        );
        
        const dMarketRebateSum = dMarketAgents.reduce((sum, agent) => sum + parseFloat(agent.rebate_percentage || 0), 0);
        
        console.log(`\nD盤下線代理總退水: ${dMarketRebateSum.toFixed(1)}%`);
        console.log(`D盤總代理可分配: 4.1%`);
        console.log(`D盤下線總和是否超限: ${dMarketRebateSum > 4.1 ? '❌ 超限' : '✅ 正常'}`);
        
        if (dMarketAgents.length > 0) {
            console.log('D盤下線代理明細:');
            dMarketAgents.forEach(agent => {
                console.log(`  ${agent.username}: ${agent.rebate_percentage}% (上級: ${agent.parent_agent})`);
            });
        }
        
        // 檢查是否有設定異常的代理
        console.log('\n=== 異常設定檢查 ===');
        
        const anomalies = [];
        
        agentsResult.rows.forEach(agent => {
            // 檢查總代理設定
            if (agent.role === 'super_agent') {
                if (agent.market_type === 'A' && agent.rebate_percentage !== 1.1) {
                    anomalies.push(`A盤總代理 ${agent.username} 退水設定錯誤: ${agent.rebate_percentage}% (應為 1.1%)`);
                }
                if (agent.market_type === 'D' && agent.rebate_percentage !== 4.1) {
                    anomalies.push(`D盤總代理 ${agent.username} 退水設定錯誤: ${agent.rebate_percentage}% (應為 4.1%)`);
                }
            }
            
            // 檢查退水比例範圍
            if (agent.rebate_percentage < 0 || agent.rebate_percentage > 5) {
                anomalies.push(`代理 ${agent.username} 退水比例異常: ${agent.rebate_percentage}%`);
            }
        });
        
        if (anomalies.length > 0) {
            anomalies.forEach(anomaly => console.log(`❌ ${anomaly}`));
        } else {
            console.log('✅ 未發現異常設定');
        }
        
    } catch (error) {
        console.error('檢查代理退水設定時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

checkAgentRebateSettings();
