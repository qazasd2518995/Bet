const { Pool } = require('pg');

// 直接使用數據庫配置
const pool = new Pool({
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
  ssl: { rejectUnauthorized: false }
});

const db = {
    any: (query, params) => pool.query(query, params).then(result => result.rows),
    oneOrNone: (query, params) => pool.query(query, params).then(result => result.rows[0] || null),
    $pool: pool
};

async function checkAgentRebateCalculation() {
    console.log('=== 檢查代理退水計算問題 ===\n');
    
    try {
        // 查詢可能的代理
        const agents = await db.any(`
            SELECT id, username, rebate_percentage, max_rebate_percentage, market_type, level, parent_id
            FROM agents 
            WHERE username IN ('justin2025A', 'ti2025A', 'A01agent', 'L1代理')
            ORDER BY level DESC
        `);
        
        console.log('相關代理資料:');
        for (const agent of agents) {
            console.log(`- ${agent.username} (ID: ${agent.id})`);
            console.log(`  Level: ${agent.level}`);
            console.log(`  Parent ID: ${agent.parent_id}`);
            console.log(`  Market Type: ${agent.market_type}`);
            console.log(`  Rebate %: ${agent.rebate_percentage} (${(agent.rebate_percentage * 100).toFixed(1)}%)`);
            console.log(`  Max Rebate %: ${agent.max_rebate_percentage} (${(agent.max_rebate_percentage * 100).toFixed(1)}%)`);
            
            // 如果有上級，查詢上級的退水
            if (agent.parent_id) {
                const parent = await db.oneOrNone(`
                    SELECT username, rebate_percentage 
                    FROM agents 
                    WHERE id = $1
                `, [agent.parent_id]);
                
                if (parent) {
                    console.log(`  Parent: ${parent.username} (退水: ${(parent.rebate_percentage * 100).toFixed(1)}%)`);
                }
            }
            console.log('');
        }
        
        // 測試計算
        const testAmount = 286789;
        console.log(`\n測試計算 (下注金額: $${testAmount.toLocaleString()}):`);
        console.log('期望: $1,433.95 (0.5%)');
        console.log('實際顯示: $1,720.69');
        console.log(`\n可能的計算:`);
        console.log(`- 0.5% = $${(testAmount * 0.005).toFixed(2)}`);
        console.log(`- 0.6% = $${(testAmount * 0.006).toFixed(2)}`);
        console.log(`- 1.0% = $${(testAmount * 0.010).toFixed(2)}`);
        console.log(`- 1.1% = $${(testAmount * 0.011).toFixed(2)}`);
        
        // 反推實際使用的百分比
        const actualPercentage = 1720.69 / testAmount;
        console.log(`\n反推實際使用的百分比: ${(actualPercentage * 100).toFixed(3)}%`);
        
    } catch (error) {
        console.error('查詢失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

checkAgentRebateCalculation();