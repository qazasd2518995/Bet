import pg from 'pg';
const { Pool } = pg;

// 資料庫連接
const db = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'betting_system',
  password: '88888888',
  port: 5432
});

async function checkRebateSettings() {
  try {
    console.log('=== 檢查退水設定 ===');
    
    // 檢查代理設定
    const agents = await db.query(`
      SELECT id, username, level, rebate_percentage, max_rebate_percentage, market_type, parent_id 
      FROM agents 
      WHERE username IN ($1, $2, $3) 
      ORDER BY level DESC
    `, ['ti2025A', 'justin2025A', 'justin111']);
    
    console.log('代理設定:');
    for (const agent of agents.rows) {
      console.log(`${agent.username} (L${agent.level}): 退水=${(agent.rebate_percentage*100).toFixed(1)}%, 最大=${(agent.max_rebate_percentage*100).toFixed(1)}%, 盤口=${agent.market_type}, 上級=${agent.parent_id}`);
    }
    
    // 檢查會員設定
    const member = await db.query('SELECT username, agent_id FROM members WHERE username = $1', ['justin111']);
    if (member.rows.length > 0) {
      console.log('\n會員設定:');
      console.log(`${member.rows[0].username} 的直屬代理ID: ${member.rows[0].agent_id}`);
    }
    
    // 檢查最近的退水記錄
    console.log('\n=== 最近退水記錄 ===');
    const rebates = await db.query(`
      SELECT * FROM rebate_records 
      WHERE member_username = $1 
      ORDER BY created_at DESC 
      LIMIT 10
    `, ['justin111']);
    
    for (const rebate of rebates.rows) {
      const percentage = rebate.bet_amount > 0 ? ((rebate.rebate_amount/rebate.bet_amount)*100).toFixed(2) : '0';
      console.log(`${rebate.created_at}: 代理=${rebate.agent_username}, 退水=${rebate.rebate_amount}, 下注=${rebate.bet_amount}, 比例=${percentage}%`);
    }
    
    // 檢查代理餘額變化
    console.log('\n=== 代理餘額檢查 ===');
    const agentBalances = await db.query(`
      SELECT username, balance 
      FROM agents 
      WHERE username IN ($1, $2) 
      ORDER BY level DESC
    `, ['ti2025A', 'justin2025A']);
    
    for (const agent of agentBalances.rows) {
      console.log(`${agent.username} 當前餘額: ${agent.balance}`);
    }
    
    await db.end();
    process.exit(0);
    
  } catch (error) {
    console.error('錯誤:', error);
    await db.end();
    process.exit(1);
  }
}

checkRebateSettings();
