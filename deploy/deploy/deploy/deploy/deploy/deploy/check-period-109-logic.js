import db from './db/config.js';

async function checkPeriod109Logic() {
  try {
    console.log('=== 檢查期號 20250716109 退水邏輯 ===\n');
    
    const period = '20250716109';
    
    // 1. 基本資訊
    console.log('1. 下注資訊:');
    const bets = await db.any(`
      SELECT 
        id,
        username,
        amount,
        bet_type,
        bet_value,
        created_at,
        settled,
        settled_at,
        win,
        win_amount
      FROM bet_history
      WHERE period = $1
      ORDER BY created_at
    `, [period]);
    
    if (bets.length === 0) {
      console.log('  ❌ 沒有找到下注記錄');
      process.exit(0);
    }
    
    bets.forEach(bet => {
      console.log(`  ID ${bet.id}: ${bet.username}`);
      console.log(`    下注: $${bet.amount} on ${bet.bet_type} - ${bet.bet_value}`);
      console.log(`    時間: ${new Date(bet.created_at).toLocaleTimeString()}`);
      console.log(`    結算: ${bet.settled ? '✅' : '❌'} ${bet.settled_at ? `at ${new Date(bet.settled_at).toLocaleTimeString()}` : ''}`);
    });
    
    // 2. 檢查系統時間線
    console.log('\n2. 系統時間線:');
    
    // 後端重啟時間
    console.log('  後端重啟時間: 9:43-9:44 AM');
    console.log('  期號 109 下注時間: 10:16 AM');
    console.log('  ✅ 此期號使用的是新版本程式碼');
    
    // 3. 檢查開獎和結算
    console.log('\n3. 開獎和結算狀態:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history
      WHERE period = $1
    `, [period]);
    
    if (drawResult) {
      console.log(`  ✅ 已開獎: ${drawResult.result}`);
      console.log(`  開獎時間: ${new Date(drawResult.created_at).toLocaleTimeString()}`);
    } else {
      console.log('  ❌ 未找到開獎記錄');
    }
    
    // 4. 檢查結算日誌
    console.log('\n4. 結算系統日誌:');
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = $1
    `, [period]);
    
    if (settlementLog) {
      console.log('  ✅ 有結算日誌 (使用了 enhancedSettlement)');
      console.log(`    時間: ${settlementLog.created_at}`);
      console.log(`    結算筆數: ${settlementLog.settled_count}`);
    } else {
      console.log('  ❌ 無結算日誌');
    }
    
    // 5. 檢查退水記錄
    console.log('\n5. 退水記錄:');
    const rebates = await db.any(`
      SELECT 
        tr.*,
        a.username as agent_username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
    `, [period]);
    
    if (rebates.length > 0) {
      console.log(`  ✅ 找到 ${rebates.length} 筆退水記錄:`);
      rebates.forEach(r => {
        console.log(`    ${r.agent_username}: $${r.amount}`);
      });
    } else {
      console.log('  ❌ 沒有退水記錄');
    }
    
    // 6. 檢查後端日誌
    console.log('\n6. 檢查後端日誌 (backend.log):');
    console.log('  查找關鍵字:');
    console.log('  - "期號 20250716109"');
    console.log('  - "沒有未結算的投注"');
    console.log('  - "發現已結算但未處理退水"');
    console.log('  - "退水處理失敗"');
    
    // 7. 分析可能原因
    console.log('\n7. 可能的原因:');
    
    if (bets.every(b => b.settled)) {
      console.log('  ⚠️ 所有投注都已結算');
      
      if (!settlementLog) {
        console.log('  ⚠️ 沒有結算日誌 - 可能未使用 enhancedSettlement');
        console.log('  - 可能 enhancedSettlement 發生錯誤並降級到其他系統');
        console.log('  - 需要檢查後端日誌中的錯誤訊息');
      }
      
      if (!rebates.length) {
        console.log('  ❌ 沒有退水記錄');
        console.log('  - 修復的退水檢查可能失敗了');
        console.log('  - 或者有錯誤被捕獲但未正確處理');
      }
    }
    
    // 8. 檢查是否正在處理中
    console.log('\n8. 檢查當前狀態:');
    const currentTime = new Date();
    const betTime = bets[0] ? new Date(bets[0].created_at) : currentTime;
    const timeDiff = (currentTime - betTime) / 1000 / 60;
    
    console.log(`  下注至今: ${timeDiff.toFixed(1)} 分鐘`);
    if (timeDiff < 5) {
      console.log('  ℹ️ 可能還在處理中，請稍後再檢查');
    }
    
    // 9. 手動檢查修復是否生效
    console.log('\n9. 驗證修復程式碼:');
    console.log('  執行: grep -n "發現已結算但未處理退水" enhanced-settlement-system.js');
    console.log('  應該要看到兩處這個日誌訊息');
    
    process.exit(0);
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
    process.exit(1);
  }
}

checkPeriod109Logic();