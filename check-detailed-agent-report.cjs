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

async function checkDetailedAgentReport() {
    console.log('=== 檢查代理層級報表詳細計算 ===\n');
    
    try {
        // 查詢 justin2025A 的詳細資料
        const agent = await db.oneOrNone(`
            SELECT a.*, p.username as parent_username, p.rebate_percentage as parent_rebate
            FROM agents a
            LEFT JOIN agents p ON a.parent_id = p.id
            WHERE a.username = 'justin2025A'
        `);
        
        if (!agent) {
            console.log('找不到代理 justin2025A');
            return;
        }
        
        console.log('代理資料:');
        console.log(`- 用戶名: ${agent.username}`);
        console.log(`- ID: ${agent.id}`);
        console.log(`- 層級: ${agent.level}`);
        console.log(`- 退水百分比: ${agent.rebate_percentage} (${(agent.rebate_percentage * 100).toFixed(1)}%)`);
        console.log(`- 上級代理: ${agent.parent_username} (ID: ${agent.parent_id})`);
        console.log(`- 上級退水: ${agent.parent_rebate} (${(agent.parent_rebate * 100).toFixed(1)}%)`);
        console.log(`- 退水差額: ${((agent.parent_rebate - agent.rebate_percentage) * 100).toFixed(1)}%`);
        
        // 查詢下屬會員的下注統計
        const stats = await db.oneOrNone(`
            SELECT 
                COUNT(DISTINCT m.id) as member_count,
                COUNT(bh.id) as bet_count,
                COALESCE(SUM(bh.amount), 0) as total_bet_amount
            FROM members m
            LEFT JOIN bet_history bh ON m.username = bh.username
            WHERE m.agent_id = $1
        `, [agent.id]);
        
        console.log('\n下注統計:');
        console.log(`- 會員數: ${stats.member_count}`);
        console.log(`- 下注筆數: ${stats.bet_count}`);
        console.log(`- 總下注金額: $${parseFloat(stats.total_bet_amount).toLocaleString()}`);
        
        // 計算不同的退水金額
        const betAmount = parseFloat(stats.total_bet_amount);
        console.log('\n退水計算分析:');
        console.log(`- 使用代理退水 (${(agent.rebate_percentage * 100).toFixed(1)}%): $${(betAmount * agent.rebate_percentage).toFixed(2)}`);
        console.log(`- 使用上級退水 (${(agent.parent_rebate * 100).toFixed(1)}%): $${(betAmount * agent.parent_rebate).toFixed(2)}`);
        console.log(`- 使用差額退水 (${((agent.parent_rebate - agent.rebate_percentage) * 100).toFixed(1)}%): $${(betAmount * (agent.parent_rebate - agent.rebate_percentage)).toFixed(2)}`);
        
        // 檢查實際報表顯示的邏輯
        console.log('\n報表顯示邏輯分析:');
        console.log('根據 agentBackend.js 第 8811 行:');
        console.log('會員的 earnedRebatePercentage = queryAgentRebate (查詢代理的退水設定)');
        console.log('');
        console.log('如果查詢的是 justin2025A (0.5%), 則應該顯示:');
        console.log(`$${betAmount} × 0.5% = $${(betAmount * 0.005).toFixed(2)}`);
        console.log('');
        console.log('但實際顯示 $1,720.69, 這表示使用了 0.6%');
        console.log('');
        console.log('可能的原因:');
        console.log('1. 查詢時使用了錯誤的代理ID');
        console.log('2. 代理的退水百分比在某處被修改');
        console.log('3. 計算邏輯中存在額外的加成');
        
    } catch (error) {
        console.error('查詢失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

checkDetailedAgentReport();