import db from './db/config.js';

async function fixPeriod121Rebate() {
  try {
    console.log('=== 修復期號 20250716121 的退水錯誤 ===\n');
    
    const period = '20250716121';
    
    // 1. 檢查當前的錯誤退水記錄
    console.log('1. 檢查當前錯誤的退水記錄:');
    const currentRebates = await db.any(`
      SELECT 
        tr.id,
        tr.amount,
        tr.rebate_percentage,
        a.username as agent_username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
      WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
      ORDER BY tr.amount DESC
    `, [period]);
    
    if (currentRebates.length === 0) {
      console.log('  ❌ 沒有找到退水記錄');
      process.exit(0);
    }
    
    console.log('  當前錯誤的退水記錄:');
    let totalWrongRebate = 0;
    currentRebates.forEach(r => {
      console.log(`    ${r.agent_username}: $${r.amount} (${r.rebate_percentage}%)`);
      totalWrongRebate += parseFloat(r.amount);
    });
    console.log(`  錯誤總額: $${totalWrongRebate.toFixed(2)}\n`);
    
    // 2. 計算正確的退水金額
    console.log('2. 計算正確的退水金額:');
    const betInfo = await db.oneOrNone(`
      SELECT username, amount 
      FROM bet_history 
      WHERE period = $1 AND settled = true
    `, [period]);
    
    if (!betInfo) {
      console.log('  ❌ 沒有找到下注記錄');
      process.exit(0);
    }
    
    const betAmount = parseFloat(betInfo.amount);
    console.log(`  下注會員: ${betInfo.username}`);
    console.log(`  下注金額: $${betAmount}`);
    
    // A盤 1.1% 退水
    const maxRebatePercentage = 0.011;
    const totalCorrectRebate = betAmount * maxRebatePercentage;
    console.log(`  應得總退水: $${totalCorrectRebate} (${(maxRebatePercentage*100).toFixed(1)}%)`);
    
    // 正確的分配：justin2025A: 0.5%, ti2025A: 0.6%
    const correctRebates = [
      { username: 'justin2025A', percentage: 0.005, amount: betAmount * 0.005 },
      { username: 'ti2025A', percentage: 0.006, amount: betAmount * 0.006 }
    ];
    
    console.log(`  正確的退水分配:`);
    correctRebates.forEach(r => {
      console.log(`    ${r.username}: $${r.amount.toFixed(2)} (${(r.percentage*100).toFixed(1)}%)`);
    });
    console.log(`  正確總額: $${correctRebates.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}\n`);
    
    // 3. 提供修復選項
    console.log('3. 修復選項:');
    console.log('  A) 刪除錯誤記錄並重新處理退水');
    console.log('  B) 補發差額退水');
    console.log('  C) 僅顯示分析結果，不做修復\n');
    
    console.log('選擇 A - 完全重新處理退水...\n');
    
    // 4. 執行修復 (選項 A)
    await db.tx(async t => {
      // 4.1 刪除錯誤的退水記錄
      console.log('4.1 刪除錯誤的退水記錄...');
      const deletedRebates = await t.any(`
        DELETE FROM transaction_records 
        WHERE period = $1 AND transaction_type = 'rebate'
        RETURNING id, user_id, amount
      `, [period]);
      
      console.log(`  ✅ 已刪除 ${deletedRebates.length} 筆錯誤記錄`);
      
      // 4.2 回退代理餘額
      console.log('4.2 回退代理餘額...');
      for (const deleted of deletedRebates) {
        await t.none(`
          UPDATE agents 
          SET balance = balance - $1 
          WHERE id = $2
        `, [parseFloat(deleted.amount), deleted.user_id]);
        console.log(`  ✅ 已回退代理 ID ${deleted.user_id} 的餘額 $${deleted.amount}`);
      }
    });
    
    console.log('\n5. 重新處理退水...');
    
    // 5. 重新處理退水
    const { processRebates } = await import('./enhanced-settlement-system.js');
    await processRebates(period);
    
    console.log('✅ 退水修復完成！\n');
    
    // 6. 驗證修復結果
    console.log('6. 驗證修復結果:');
    const newRebates = await db.any(`
      SELECT 
        tr.amount,
        a.username as agent_username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
      WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
      ORDER BY tr.amount DESC
    `, [period]);
    
    console.log('  修復後的退水記錄:');
    let totalNewRebate = 0;
    newRebates.forEach(r => {
      console.log(`    ${r.agent_username}: $${r.amount}`);
      totalNewRebate += parseFloat(r.amount);
    });
    console.log(`  新總額: $${totalNewRebate.toFixed(2)}`);
    
    if (Math.abs(totalNewRebate - totalCorrectRebate) < 0.01) {
      console.log('  ✅ 退水金額正確！');
    } else {
      console.log('  ⚠️ 退水金額仍不正確');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('修復過程中發生錯誤:', error);
    process.exit(1);
  }
}

fixPeriod121Rebate();