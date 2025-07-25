import db from './db/config.js';

async function checkRebateData() {
  try {
    console.log('=== 檢查代理設定 ===');
    
    // 檢查代理設定 - 修正：justin111 是會員，不是代理
    const agents = await db.any(`
      SELECT id, username, level, rebate_percentage, max_rebate_percentage, market_type, parent_id 
      FROM agents 
      WHERE username IN ($1, $2) 
      ORDER BY level DESC
    `, ['ti2025A', 'justin2025A']);
    
    console.log('代理設定:');
    for (const agent of agents) {
      console.log(`${agent.username} (L${agent.level}): 退水=${(agent.rebate_percentage*100).toFixed(1)}%, 最大=${(agent.max_rebate_percentage*100).toFixed(1)}%, 盤口=${agent.market_type}, 上級=${agent.parent_id}`);
    }
    
    // 檢查會員設定
    const member = await db.oneOrNone('SELECT username, agent_id FROM members WHERE username = $1', ['justin111']);
    if (member) {
      console.log('\n會員設定:');
      console.log(`${member.username} 的直屬代理ID: ${member.agent_id}`);
      
      // 找出直屬代理是誰
      const directAgent = await db.oneOrNone('SELECT username FROM agents WHERE id = $1', [member.agent_id]);
      if (directAgent) {
        console.log(`直屬代理: ${directAgent.username}`);
      }
    }
    
    // 檢查交易記錄中的退水
    console.log('\n=== 交易記錄中的退水 ===');
    const transactions = await db.any(`
      SELECT * FROM transaction_records 
      WHERE description LIKE '%退水%' OR description LIKE '%rebate%'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    for (const tx of transactions) {
      console.log(`${tx.created_at}: ${tx.username}, 金額=${tx.amount}, 描述=${tx.description}`);
    }
    
    // 檢查點數轉移記錄
    console.log('\n=== 點數轉移記錄 ===');
    const transfers = await db.any(`
      SELECT * FROM point_transfers 
      WHERE description LIKE '%退水%' OR description LIKE '%rebate%'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    for (const transfer of transfers) {
      console.log(`${transfer.created_at}: ${transfer.from_username} -> ${transfer.to_username}, 金額=${transfer.amount}, 描述=${transfer.description}`);
    }
    
    // 檢查代理餘額變化
    console.log('\n=== 代理當前餘額 ===');
    const agentBalances = await db.any(`
      SELECT username, balance 
      FROM agents 
      WHERE username IN ($1, $2) 
      ORDER BY level DESC
    `, ['ti2025A', 'justin2025A']);
    
    for (const agent of agentBalances) {
      console.log(`${agent.username} 當前餘額: ${agent.balance}`);
    }
    
    await db.$pool.end();
    
  } catch (error) {
    console.error('錯誤:', error);
    await db.$pool.end();
    process.exit(1);
  }
}

checkRebateData();
