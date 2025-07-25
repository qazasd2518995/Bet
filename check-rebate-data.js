import db from './db/config.js';

async function checkRebateData() {
  try {
    console.log('=== 检查代理设定 ===');
    
    // 检查代理设定 - 修正：justin111 是会员，不是代理
    const agents = await db.any(`
      SELECT id, username, level, rebate_percentage, max_rebate_percentage, market_type, parent_id 
      FROM agents 
      WHERE username IN ($1, $2) 
      ORDER BY level DESC
    `, ['ti2025A', 'justin2025A']);
    
    console.log('代理设定:');
    for (const agent of agents) {
      console.log(`${agent.username} (L${agent.level}): 退水=${(agent.rebate_percentage*100).toFixed(1)}%, 最大=${(agent.max_rebate_percentage*100).toFixed(1)}%, 盘口=${agent.market_type}, 上级=${agent.parent_id}`);
    }
    
    // 检查会员设定
    const member = await db.oneOrNone('SELECT username, agent_id FROM members WHERE username = $1', ['justin111']);
    if (member) {
      console.log('\n会员设定:');
      console.log(`${member.username} 的直属代理ID: ${member.agent_id}`);
      
      // 找出直属代理是谁
      const directAgent = await db.oneOrNone('SELECT username FROM agents WHERE id = $1', [member.agent_id]);
      if (directAgent) {
        console.log(`直属代理: ${directAgent.username}`);
      }
    }
    
    // 检查交易记录中的退水
    console.log('\n=== 交易记录中的退水 ===');
    const transactions = await db.any(`
      SELECT * FROM transaction_records 
      WHERE description LIKE '%退水%' OR description LIKE '%rebate%'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    for (const tx of transactions) {
      console.log(`${tx.created_at}: ${tx.username}, 金额=${tx.amount}, 描述=${tx.description}`);
    }
    
    // 检查点数转移记录
    console.log('\n=== 点数转移记录 ===');
    const transfers = await db.any(`
      SELECT * FROM point_transfers 
      WHERE description LIKE '%退水%' OR description LIKE '%rebate%'
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    for (const transfer of transfers) {
      console.log(`${transfer.created_at}: ${transfer.from_username} -> ${transfer.to_username}, 金额=${transfer.amount}, 描述=${transfer.description}`);
    }
    
    // 检查代理余额变化
    console.log('\n=== 代理当前余额 ===');
    const agentBalances = await db.any(`
      SELECT username, balance 
      FROM agents 
      WHERE username IN ($1, $2) 
      ORDER BY level DESC
    `, ['ti2025A', 'justin2025A']);
    
    for (const agent of agentBalances) {
      console.log(`${agent.username} 当前余额: ${agent.balance}`);
    }
    
    await db.$pool.end();
    
  } catch (error) {
    console.error('错误:', error);
    await db.$pool.end();
    process.exit(1);
  }
}

checkRebateData();
