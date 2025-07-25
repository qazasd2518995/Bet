import db from './db/config.js';

async function checkWhyNoRebate() {
  try {
    console.log('=== 檢查為什麼沒有退水 ===');
    
    // 1. 檢查所有已結算但未退水的期號
    console.log('\n1. 檢查最近已結算但未退水的期號:');
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
    
    console.log(`找到 ${unsettledRebates.length} 個已結算但未退水的期號:`);
    for (const record of unsettledRebates) {
      console.log(`- 期號 ${record.period}`);
    }
    
    // 2. 手動處理期號 20250715107 的退水
    if (unsettledRebates.some(r => r.period === '20250715107')) {
      console.log('\n2. 手動處理期號 20250715107 的退水...');
      
      // 檢查該期的所有下注
      const bets = await db.any(`
        SELECT username, SUM(amount) as total_amount
        FROM bet_history
        WHERE period = $1 AND settled = true
        GROUP BY username
      `, ['20250715107']);
      
      console.log(`該期共有 ${bets.length} 位會員下注:`);
      for (const bet of bets) {
        console.log(`- ${bet.username}: ${bet.total_amount} 元`);
      }
      
      // 執行退水處理
      console.log('\n執行退水處理...');
      const { processRebates } = await import('./enhanced-settlement-system.js');
      
      try {
        await processRebates('20250715107');
        console.log('✅ 退水處理完成');
      } catch (error) {
        console.error('退水處理失敗:', error);
      }
    }
    
    // 3. 驗證退水結果
    console.log('\n3. 驗證退水結果:');
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
      console.log('退水記錄:');
      for (const rebate of newRebates) {
        console.log(`- ${rebate.username}: ${rebate.amount} 元`);
      }
    } else {
      console.log('仍然沒有退水記錄');
    }
    
    // 4. 檢查最新餘額
    console.log('\n4. 最新餘額:');
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
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkWhyNoRebate();