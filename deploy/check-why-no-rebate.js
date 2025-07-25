import db from './db/config.js';

async function checkWhyNoRebate() {
  try {
    console.log('=== 检查为什么没有退水 ===');
    
    // 1. 检查所有已结算但未退水的期号
    console.log('\n1. 检查最近已结算但未退水的期号:');
    const unsettledRebates = await db.any(`
      WITH settled_periods AS (
        SELECT DISTINCT period
        FROM bet_history
        WHERE settled = true
          AND created_at > NOW() - INTERVAL '2 hours'
      ),
      rebated_periods AS (
        SELECT DISTINCT period
        FROM transaction_records
        WHERE transaction_type = 'rebate'
          AND period IS NOT NULL
          AND created_at > NOW() - INTERVAL '2 hours'
      )
      SELECT sp.period
      FROM settled_periods sp
      LEFT JOIN rebated_periods rp ON sp.period = rp.period
      WHERE rp.period IS NULL
      ORDER BY sp.period DESC
      LIMIT 10
    `);
    
    console.log(`找到 ${unsettledRebates.length} 个已结算但未退水的期号:`);
    for (const record of unsettledRebates) {
      console.log(`- 期号 ${record.period}`);
    }
    
    // 2. 手动处理期号 20250715107 的退水
    if (unsettledRebates.some(r => r.period === '20250715107')) {
      console.log('\n2. 手动处理期号 20250715107 的退水...');
      
      // 检查该期的所有下注
      const bets = await db.any(`
        SELECT username, SUM(amount) as total_amount
        FROM bet_history
        WHERE period = $1 AND settled = true
        GROUP BY username
      `, ['20250715107']);
      
      console.log(`该期共有 ${bets.length} 位会员下注:`);
      for (const bet of bets) {
        console.log(`- ${bet.username}: ${bet.total_amount} 元`);
      }
      
      // 执行退水处理
      console.log('\n执行退水处理...');
      const { processRebates } = await import('./enhanced-settlement-system.js');
      
      try {
        await processRebates('20250715107');
        console.log('✅ 退水处理完成');
      } catch (error) {
        console.error('退水处理失败:', error);
      }
    }
    
    // 3. 验证退水结果
    console.log('\n3. 验证退水结果:');
    const newRebates = await db.any(`
      SELECT 
        tr.*,
        CASE 
          WHEN tr.user_type = 'agent' THEN a.username
          WHEN tr.user_type = 'member' THEN m.username
        END as username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
      WHERE tr.transaction_type = 'rebate' 
        AND tr.period = $1
      ORDER BY tr.created_at DESC
    `, ['20250715107']);
    
    if (newRebates.length > 0) {
      console.log('退水记录:');
      for (const rebate of newRebates) {
        console.log(`- ${rebate.username}: ${rebate.amount} 元`);
      }
    } else {
      console.log('仍然没有退水记录');
    }
    
    // 4. 检查最新余额
    console.log('\n4. 最新余额:');
    const agents = await db.any(`
      SELECT username, balance FROM agents 
      WHERE username IN ($1, $2)
      ORDER BY username
    `, ['justin2025A', 'ti2025A']);
    
    for (const agent of agents) {
      console.log(`${agent.username}: ${agent.balance} 元`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

checkWhyNoRebate();