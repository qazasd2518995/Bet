import db from './db/config.js';

async function checkDoubleRebateIssue() {
  try {
    console.log('=== 檢查退水雙倍計算問題 ===\n');
    
    // 1. 檢查期號 20250716001 的所有退水記錄
    console.log('1. 期號 20250716001 的詳細退水記錄:');
    const rebateDetails = await db.any(`
      SELECT 
        tr.id,
        tr.user_type,
        tr.user_id,
        tr.amount,
        tr.description,
        tr.created_at,
        CASE 
          WHEN tr.user_type = 'agent' THEN a.username
          ELSE 'unknown'
        END as username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at, tr.id
    `, ['20250716001']);
    
    console.log(`找到 ${rebateDetails.length} 筆退水記錄:`);
    rebateDetails.forEach((r, idx) => {
      console.log(`\n記錄 ${idx + 1}:`);
      console.log(`  ID: ${r.id}`);
      console.log(`  用戶: ${r.username} (ID: ${r.user_id})`);
      console.log(`  金額: $${r.amount}`);
      console.log(`  描述: ${r.description}`);
      console.log(`  時間: ${r.created_at}`);
    });
    
    // 2. 檢查該期的下注記錄
    console.log('\n\n2. 期號 20250716001 的下注記錄:');
    const bets = await db.any(`
      SELECT username, COUNT(*) as bet_count, SUM(amount) as total_amount
      FROM bet_history
      WHERE period = $1
      GROUP BY username
    `, ['20250716001']);
    
    bets.forEach(b => {
      console.log(`  ${b.username}: ${b.bet_count} 筆，總額 $${b.total_amount}`);
      console.log(`    應產生退水: $${(parseFloat(b.total_amount) * 0.011).toFixed(2)} (1.1%)`);
      console.log(`    - justin2025A 應得: $${(parseFloat(b.total_amount) * 0.005).toFixed(2)} (0.5%)`);
      console.log(`    - ti2025A 應得: $${(parseFloat(b.total_amount) * 0.006).toFixed(2)} (0.6%)`);
    });
    
    // 3. 分析問題
    console.log('\n\n3. 問題分析:');
    
    // 檢查是否有重複的退水記錄
    const duplicateCheck = await db.any(`
      SELECT 
        user_id,
        user_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM transaction_records
      WHERE period = $1 
        AND transaction_type = 'rebate'
      GROUP BY user_id, user_type
      HAVING COUNT(*) > 1
    `, ['20250716001']);
    
    if (duplicateCheck.length > 0) {
      console.log('⚠️ 發現重複退水:');
      duplicateCheck.forEach(d => {
        console.log(`  User ID ${d.user_id}: ${d.count} 筆，總額 $${d.total_amount}`);
      });
    } else {
      console.log('✅ 沒有發現重複退水記錄');
    }
    
    // 4. 檢查退水處理的呼叫次數
    console.log('\n4. 檢查可能的原因:');
    console.log('  a) processRebates 可能被調用了兩次');
    console.log('  b) 檢查是否有多筆相同金額的下注被誤判為一筆');
    
    // 檢查詳細的下注記錄
    console.log('\n5. 詳細下注記錄:');
    const detailedBets = await db.any(`
      SELECT id, username, amount, bet_type, bet_value, created_at
      FROM bet_history
      WHERE period = $1
      ORDER BY created_at
    `, ['20250716001']);
    
    detailedBets.forEach(b => {
      console.log(`  ID ${b.id}: ${b.username} 下注 $${b.amount} (${b.bet_type}: ${b.bet_value}) at ${b.created_at}`);
    });
    
    // 5. 計算實際應該的退水
    console.log('\n\n6. 正確的退水計算:');
    const totalBetAmount = bets.reduce((sum, b) => sum + parseFloat(b.total_amount), 0);
    console.log(`總下注金額: $${totalBetAmount}`);
    console.log(`總退水池 (1.1%): $${(totalBetAmount * 0.011).toFixed(2)}`);
    console.log(`justin2025A 應得 (0.5%): $${(totalBetAmount * 0.005).toFixed(2)}`);
    console.log(`ti2025A 應得 (0.6%): $${(totalBetAmount * 0.006).toFixed(2)}`);
    
    // 6. 檢查實際退水總額
    const actualRebates = await db.any(`
      SELECT 
        a.username,
        SUM(tr.amount) as total_rebate
      FROM transaction_records tr
      JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
      GROUP BY a.username
    `, ['20250716001']);
    
    console.log('\n實際退水總額:');
    actualRebates.forEach(r => {
      console.log(`  ${r.username}: $${r.total_rebate}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
    process.exit(1);
  }
}

checkDoubleRebateIssue();