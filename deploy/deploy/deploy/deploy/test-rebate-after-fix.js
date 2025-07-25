import db from './db/config.js';

async function testRebateAfterFix() {
  try {
    console.log('=== 驗證退水修復結果 ===');
    
    // 1. 檢查最新的退水記錄
    console.log('\n1. 最新的退水記錄（最近10筆）:');
    const latestRebates = await db.any(`
      SELECT 
        tr.id,
        tr.user_type,
        tr.user_id,
        tr.amount,
        tr.period,
        tr.created_at,
        CASE 
          WHEN tr.user_type = 'agent' THEN a.username
          WHEN tr.user_type = 'member' THEN m.username
        END as username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
      WHERE tr.transaction_type = 'rebate'
      ORDER BY tr.created_at DESC
      LIMIT 10
    `);
    
    for (const rebate of latestRebates) {
      console.log(`${rebate.created_at.toISOString()}: ${rebate.username} - 期號${rebate.period}, 金額=${rebate.amount}`);
    }
    
    // 2. 檢查代理餘額
    console.log('\n2. 代理當前餘額:');
    const agents = await db.any(`
      SELECT username, balance 
      FROM agents 
      WHERE username IN ($1, $2) 
      ORDER BY username
    `, ['justin2025A', 'ti2025A']);
    
    for (const agent of agents) {
      console.log(`${agent.username}: ${agent.balance} 元`);
    }
    
    // 3. 檢查會員餘額
    console.log('\n3. 會員當前餘額:');
    const member = await db.oneOrNone('SELECT username, balance FROM members WHERE username = $1', ['justin111']);
    if (member) {
      console.log(`${member.username}: ${member.balance} 元`);
    }
    
    // 4. 統計退水總額
    console.log('\n4. 最近24小時退水統計:');
    const rebateStats = await db.any(`
      SELECT 
        CASE 
          WHEN tr.user_type = 'agent' THEN a.username
          WHEN tr.user_type = 'member' THEN m.username
        END as username,
        COUNT(*) as rebate_count,
        SUM(tr.amount) as total_rebate
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
      WHERE tr.transaction_type = 'rebate'
        AND tr.created_at > NOW() - INTERVAL '24 hours'
      GROUP BY tr.user_type, tr.user_id, a.username, m.username
      ORDER BY total_rebate DESC
    `);
    
    for (const stat of rebateStats) {
      console.log(`${stat.username}: ${stat.rebate_count} 次退水，總額 ${stat.total_rebate} 元`);
    }
    
    // 5. 確認沒有新的重複退水
    console.log('\n5. 檢查是否有新的重複退水:');
    const newDuplicates = await db.any(`
      SELECT 
        period,
        user_id,
        user_type,
        COUNT(*) as count
      FROM transaction_records
      WHERE transaction_type = 'rebate'
        AND created_at > NOW() - INTERVAL '1 hour'
        AND period IS NOT NULL
      GROUP BY period, user_id, user_type
      HAVING COUNT(*) > 1
    `);
    
    if (newDuplicates.length === 0) {
      console.log('✅ 沒有發現新的重複退水記錄');
    } else {
      console.log('⚠️ 發現新的重複退水:');
      for (const dup of newDuplicates) {
        console.log(`期號 ${dup.period}: user_id=${dup.user_id}, 重複次數=${dup.count}`);
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

testRebateAfterFix();