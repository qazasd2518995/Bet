import db from './db/config.js';

async function verifyRebateFix() {
  try {
    console.log('=== 驗證退水修復結果 ===\n');
    
    // 1. 檢查期號 20250716001 的退水
    console.log('1. 檢查期號 20250716001 的退水記錄:');
    const rebates = await db.any(`
      SELECT 
        tr.amount,
        tr.description,
        tr.created_at,
        a.username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at
    `, ['20250716001']);
    
    if (rebates.length > 0) {
      console.log('✅ 找到退水記錄:');
      rebates.forEach(r => {
        console.log(`  - ${r.username}: $${r.amount} (${r.created_at})`);
      });
    } else {
      console.log('❌ 沒有找到退水記錄');
    }
    
    // 2. 檢查最新餘額
    console.log('\n2. 代理最新餘額:');
    const agents = await db.any(`
      SELECT username, balance FROM agents 
      WHERE username IN ($1, $2)
      ORDER BY username
    `, ['justin2025A', 'ti2025A']);
    
    for (const agent of agents) {
      console.log(`  ${agent.username}: $${agent.balance}`);
    }
    
    // 3. 統計最近的退水情況
    console.log('\n3. 最近1小時退水統計:');
    const stats = await db.any(`
      SELECT 
        a.username,
        COUNT(*) as rebate_count,
        SUM(tr.amount) as total_rebate
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id
      WHERE tr.transaction_type = 'rebate'
        AND tr.created_at > NOW() - INTERVAL '1 hour'
      GROUP BY a.username
      ORDER BY total_rebate DESC
    `);
    
    stats.forEach(s => {
      console.log(`  ${s.username}: ${s.rebate_count} 筆，總額 $${s.total_rebate}`);
    });
    
    // 4. 檢查是否還有遺漏
    console.log('\n4. 檢查是否還有遺漏的退水:');
    const missing = await db.any(`
      SELECT COUNT(DISTINCT period) as missing_count
      FROM bet_history bh
      WHERE bh.settled = true
        AND bh.created_at > NOW() - INTERVAL '24 hours'
        AND NOT EXISTS (
          SELECT 1 FROM transaction_records tr
          WHERE tr.period = bh.period
            AND tr.transaction_type = 'rebate'
        )
    `);
    
    if (missing[0].missing_count > 0) {
      console.log(`⚠️ 還有 ${missing[0].missing_count} 個期號未處理退水`);
    } else {
      console.log('✅ 所有期號都已處理退水');
    }
    
    console.log('\n=== 修復驗證完成 ===');
    process.exit(0);
    
  } catch (error) {
    console.error('驗證過程中發生錯誤:', error);
    process.exit(1);
  }
}

verifyRebateFix();