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

async function analyzeRebateDistribution() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 查詢代理關係和設定
        const agentChainResult = await client.query(`
            SELECT 
                a.username,
                a.rebate_percentage,
                a.parent_agent,
                m.username as member_username
            FROM agents a
            LEFT JOIN members m ON m.assigned_agent = a.username
            WHERE a.username IN ('ti2025A', 'justin2025A') 
               OR m.username = 'justin'
            ORDER BY a.rebate_percentage DESC
        `);
        
        console.log('\n=== 代理鏈分析 ===');
        agentChainResult.rows.forEach(row => {
            if (row.username && row.username.includes('2025')) {
                console.log(`代理: ${row.username}`);
                console.log(`  退水設定: ${row.rebate_percentage}%`);
                console.log(`  上級代理: ${row.parent_agent || '總代理'}`);
                console.log(`  下級會員: ${row.member_username || '無直屬會員'}`);
                console.log('---');
            }
        });
        
        // 查詢 justin 的代理關係
        const justinResult = await client.query(`
            SELECT 
                username,
                assigned_agent,
                balance
            FROM members 
            WHERE username = 'justin'
        `);
        
        if (justinResult.rows.length > 0) {
            const justin = justinResult.rows[0];
            console.log('\n=== justin 會員資訊 ===');
            console.log(`會員: ${justin.username}`);
            console.log(`指派代理: ${justin.assigned_agent}`);
            console.log(`目前餘額: ${justin.balance}`);
            
            // 找出代理鏈
            let currentAgent = justin.assigned_agent;
            const agentChain = [];
            
            while (currentAgent) {
                const agentResult = await client.query(`
                    SELECT username, rebate_percentage, parent_agent
                    FROM agents 
                    WHERE username = $1
                `, [currentAgent]);
                
                if (agentResult.rows.length > 0) {
                    const agent = agentResult.rows[0];
                    agentChain.push(agent);
                    currentAgent = agent.parent_agent;
                } else {
                    break;
                }
            }
            
            console.log('\n=== 代理鏈結構 ===');
            agentChain.forEach((agent, index) => {
                console.log(`層級 ${index + 1}: ${agent.username} (${agent.rebate_percentage}%)`);
            });
            
            // 計算正確的退水分配
            console.log('\n=== 500元下注的正確退水分配 ===');
            const betAmount = 500;
            let previousRate = 0;
            let totalRebate = 0;
            
            agentChain.reverse().forEach((agent, index) => {
                const currentRate = parseFloat(agent.rebate_percentage);
                const agentRebate = (currentRate - previousRate) / 100 * betAmount;
                totalRebate += agentRebate;
                
                console.log(`${agent.username}:`);
                console.log(`  設定比例: ${currentRate}%`);
                console.log(`  實際獲得: ${currentRate}% - ${previousRate}% = ${currentRate - previousRate}%`);
                console.log(`  退水金額: ${agentRebate}元`);
                console.log('---');
                
                previousRate = currentRate;
            });
            
            console.log(`總退水: ${totalRebate}元 (${totalRebate/betAmount*100}%)`);
            console.log(`平台保留: ${betAmount * 0.011 - totalRebate}元`);
        }
        
        // 查詢最近的退水交易記錄
        const recentRebateResult = await client.query(`
            SELECT 
                username,
                amount,
                type,
                description,
                created_at
            FROM transactions 
            WHERE type = 'rebate' 
              AND created_at > NOW() - INTERVAL '2 hours'
            ORDER BY created_at DESC
        `);
        
        console.log('\n=== 最近2小時的退水記錄 ===');
        if (recentRebateResult.rows.length > 0) {
            recentRebateResult.rows.forEach(record => {
                console.log(`${record.username}: +${record.amount}元`);
                console.log(`  說明: ${record.description}`);
                console.log(`  時間: ${record.created_at}`);
                console.log('---');
            });
        } else {
            console.log('沒有找到最近的退水記錄');
        }
        
    } catch (error) {
        console.error('分析退水分配時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

analyzeRebateDistribution();
