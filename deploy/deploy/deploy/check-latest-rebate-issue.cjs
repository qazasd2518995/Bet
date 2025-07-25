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

async function checkLatestRebateIssue() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('✅ 連接到 Render PostgreSQL 成功');
        
        // 查詢最新下注記錄
        const betsResult = await client.query(`
            SELECT * FROM bet_history 
            WHERE username = 'justin' 
            ORDER BY created_at DESC LIMIT 5
        `);
        
        console.log('\n=== 最新下注記錄 ===');
        betsResult.rows.forEach(bet => {
            console.log(`下注ID: ${bet.id}`);
            console.log(`  期號: ${bet.period}`);
            console.log(`  金額: ${bet.amount}`);
            console.log(`  狀態: ${bet.status}`);
            console.log(`  創建時間: ${bet.created_at}`);
            console.log('---');
        });
        
        // 查詢退水分配記錄
        if (betsResult.rows.length > 0) {
            const latestBetId = betsResult.rows[0].id;
            
            const rebateResult = await client.query(`
                SELECT * FROM transactions 
                WHERE username IN ('justin2025A', 'ti2025A') 
                AND type = 'rebate'
                AND created_at > NOW() - INTERVAL '1 hour'
                ORDER BY created_at DESC
            `);
            
            console.log(`\n=== 最近1小時的退水分配記錄 ===`);
            let totalRebate = 0;
            rebateResult.rows.forEach(rebate => {
                console.log(`代理: ${rebate.username}`);
                console.log(`  退水金額: ${rebate.amount}`);
                console.log(`  描述: ${rebate.description}`);
                console.log(`  創建時間: ${rebate.created_at}`);
                totalRebate += parseFloat(rebate.amount);
                console.log('---');
            });
            
            console.log(`總退水金額: ${totalRebate}元`);
            
            const betAmount = parseFloat(betsResult.rows[0].amount);
            const expectedRebate = betAmount * 0.011; // 1.1%
            console.log(`預期總退水（1.1%）: ${expectedRebate}元`);
            console.log(`差額: ${expectedRebate - totalRebate}元`);
        }
        
        // 查詢代理設定
        const agentSettingsResult = await client.query(`
            SELECT username, rebate_percentage FROM agents 
            WHERE username IN ('justin2025A', 'ti2025A')
            ORDER BY username
        `);
        
        console.log('\n=== 代理退水設定 ===');
        agentSettingsResult.rows.forEach(agent => {
            console.log(`${agent.username}: ${agent.rebate_percentage}%`);
        });
        
        // 查詢代理關係
        const relationResult = await client.query(`
            SELECT 
                m.username,
                m.agent_username,
                a.agent_username as parent_agent
            FROM members m
            LEFT JOIN agents a ON m.agent_username = a.username
            WHERE m.username = 'justin'
        `);
        
        console.log('\n=== 代理關係 ===');
        if (relationResult.rows.length > 0) {
            const relation = relationResult.rows[0];
            console.log(`會員: ${relation.username}`);
            console.log(`直屬代理: ${relation.agent_username}`);
            console.log(`上級代理: ${relation.parent_agent || '無'}`);
        }
        
    } catch (error) {
        console.error('檢查時發生錯誤:', error.message);
    } finally {
        await client.end();
    }
}

checkLatestRebateIssue();
