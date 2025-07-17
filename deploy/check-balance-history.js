import db from './db/config.js';

async function checkBalanceHistory() {
  try {
    console.log('=== 檢查餘額歷史記錄 ===\n');
    
    // 檢查用戶報告的餘額變化
    console.log('1. 用戶報告的餘額變化:');
    console.log('  justin2025A: 769.05 → 779.05 (增加10，應該增加5)');
    console.log('  ti2025A: 9,001,276.64 → 9,001,288.64 (增加12，應該增加6)');
    console.log('  用戶期望是基於單筆1000元下注的退水，但系統是基於2000元總下注計算');
    
    // 查詢餘額變動歷史
    console.log('\n2. 查詢 2025-07-16 前後的所有餘額變動:');
    
    const agents = ['justin2025A', 'ti2025A'];
    
    for (const agentName of agents) {
      console.log(`\n=== ${agentName} 的餘額變動歷史 ===`);
      
      const transactions = await db.any(`
        SELECT 
          tr.*,
          a.username
        FROM transaction_records tr
        JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
        WHERE a.username = $1
          AND tr.created_at >= '2025-07-15'::date
          AND tr.created_at <= '2025-07-17'::date
        ORDER BY tr.created_at
      `, [agentName]);
      
      console.log(`找到 ${transactions.length} 筆交易記錄:`);
      
      let runningBalance = null;
      transactions.forEach((tr, idx) => {
        console.log(`\n  ${idx + 1}. ${tr.created_at}`);
        console.log(`     類型: ${tr.transaction_type}`);
        console.log(`     金額: $${tr.amount}`);
        console.log(`     餘額: $${parseFloat(tr.balance_before).toFixed(2)} → $${parseFloat(tr.balance_after).toFixed(2)}`);
        console.log(`     描述: ${tr.description}`);
        console.log(`     期號: ${tr.period || 'N/A'}`);
        
        // 檢查餘額連續性
        if (runningBalance !== null && Math.abs(runningBalance - parseFloat(tr.balance_before)) > 0.01) {
          console.log(`     ⚠️ 餘額不連續！預期: $${runningBalance.toFixed(2)}, 實際: $${parseFloat(tr.balance_before).toFixed(2)}`);
        }
        runningBalance = parseFloat(tr.balance_after);
      });
      
      // 查詢當前餘額
      const currentBalance = await db.oneOrNone(`
        SELECT balance FROM agents WHERE username = $1
      `, [agentName]);
      
      console.log(`\n  當前餘額: $${currentBalance ? currentBalance.balance : 'N/A'}`);
      if (runningBalance !== null && currentBalance && Math.abs(runningBalance - parseFloat(currentBalance.balance)) > 0.01) {
        console.log(`  ⚠️ 最後交易餘額與當前餘額不符！`);
      }
    }
    
    // 3. 查詢是否有隱藏或被刪除的交易記錄
    console.log('\n\n3. 檢查是否有異常的退水記錄:');
    const suspiciousRebates = await db.any(`
      SELECT 
        tr.id,
        tr.period,
        tr.amount,
        tr.created_at,
        tr.balance_before,
        tr.balance_after,
        a.username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
      WHERE tr.transaction_type = 'rebate'
        AND tr.created_at >= '2025-07-15'::date
        AND a.username IN ('justin2025A', 'ti2025A')
      ORDER BY tr.created_at
    `);
    
    console.log(`找到 ${suspiciousRebates.length} 筆退水記錄:`);
    suspiciousRebates.forEach(r => {
      const balanceChange = parseFloat(r.balance_after) - parseFloat(r.balance_before);
      console.log(`  ID=${r.id} 期號=${r.period} ${r.username}: $${r.amount} (餘額變化: ${balanceChange > 0 ? '+' : ''}${balanceChange.toFixed(2)}) at ${r.created_at}`);
      
      if (Math.abs(balanceChange - parseFloat(r.amount)) > 0.01) {
        console.log(`    ⚠️ 餘額變化與退水金額不符！`);
      }
    });
    
    // 4. 檢查是否有重複的退水但被合併顯示
    console.log('\n4. 檢查可能的問題原因:');
    console.log('  - 用戶可能看到的是之前某次未記錄的退水累積效果');
    console.log('  - 或者系統在某個時間點有手動調整餘額的操作');
    console.log('  - 需要檢查更早期的交易記錄來確認');
    
    process.exit(0);
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
    process.exit(1);
  }
}

checkBalanceHistory();