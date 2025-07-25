import db from './db/config.js';

async function analyzeRebateTriggerIssue() {
  try {
    console.log('=== 分析退水機制未觸發問題 ===');
    console.log('期號: 20250716001');
    console.log('用戶: justin111');
    console.log('下注: 2筆 x $1000 = $2000\n');
    
    // 1. 檢查下注記錄
    console.log('1. 檢查下注記錄:');
    const bets = await db.any(`
      SELECT id, username, amount, bet_type, bet_value, position, odds, 
             settled, win, created_at, settled_at
      FROM bet_history 
      WHERE period = $1 
      ORDER BY created_at DESC
    `, ['20250716001']);
    
    console.log(`找到 ${bets.length} 筆下注記錄:`);
    for (const bet of bets) {
      console.log(`\n  ID: ${bet.id}`);
      console.log(`  用戶: ${bet.username}`);
      console.log(`  類型: ${bet.bet_type} - ${bet.bet_value}`);
      console.log(`  金額: ${bet.amount}`);
      console.log(`  賠率: ${bet.odds}`);
      console.log(`  已結算: ${bet.settled ? '是' : '否'}`);
      console.log(`  中獎: ${bet.win ? '是' : '否'}`);
      console.log(`  下注時間: ${bet.created_at}`);
      console.log(`  結算時間: ${bet.settled_at || '未結算'}`);
    }
    
    // 2. 檢查開獎結果
    console.log('\n2. 檢查開獎結果:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = $1
    `, ['20250716001']);
    
    if (drawResult) {
      console.log(`  開獎時間: ${drawResult.created_at}`);
      console.log(`  開獎結果: ${JSON.stringify(drawResult.result)}`);
    } else {
      console.log('  ⚠️ 該期號尚未開獎');
    }
    
    // 3. 檢查退水記錄
    console.log('\n3. 檢查退水記錄:');
    const rebates = await db.any(`
      SELECT * FROM transaction_records 
      WHERE transaction_type = 'rebate' 
        AND period = $1
    `, ['20250716001']);
    
    console.log(`  找到 ${rebates.length} 筆退水記錄`);
    if (rebates.length === 0) {
      console.log('  ❌ 沒有任何退水記錄');
    }
    
    // 4. 分析結算系統調用情況
    console.log('\n4. 分析可能的原因:');
    
    // 檢查是否所有注單都已結算
    const unsettledCount = bets.filter(b => !b.settled).length;
    if (unsettledCount > 0) {
      console.log(`  ⚠️ 有 ${unsettledCount} 筆注單未結算`);
    }
    
    // 檢查結算時間與開獎時間的關係
    if (drawResult && bets.length > 0) {
      const firstSettledBet = bets.find(b => b.settled_at);
      if (firstSettledBet) {
        const drawTime = new Date(drawResult.created_at);
        const settleTime = new Date(firstSettledBet.settled_at);
        const timeDiff = (settleTime - drawTime) / 1000;
        console.log(`  結算延遲: ${timeDiff} 秒`);
      }
    }
    
    // 5. 檢查結算系統的退水處理邏輯
    console.log('\n5. 檢查退水處理邏輯調用:');
    
    // 查看最近的系統日誌（如果有的話）
    console.log('  檢查 enhanced-settlement-system.js 中的退水處理邏輯...');
    console.log('  - processRebates 函數應該在結算成功後被調用');
    console.log('  - 需要檢查 enhancedSettlement 函數是否正確調用了 processRebates');
    
    // 6. 手動檢查退水條件
    console.log('\n6. 手動檢查退水條件:');
    const settledBets = bets.filter(b => b.settled);
    if (settledBets.length > 0) {
      const totalAmount = settledBets.reduce((sum, b) => sum + parseFloat(b.amount), 0);
      console.log(`  已結算金額: $${totalAmount}`);
      console.log(`  應產生退水: $${(totalAmount * 0.011).toFixed(2)} (1.1%)`);
      console.log(`  - justin2025A 應得: $${(totalAmount * 0.005).toFixed(2)} (0.5%)`);
      console.log(`  - ti2025A 應得: $${(totalAmount * 0.006).toFixed(2)} (0.6%)`);
    }
    
    // 7. 建議解決方案
    console.log('\n7. 問題分析結論:');
    console.log('  可能的原因:');
    console.log('  1. 結算系統沒有正確調用退水處理函數');
    console.log('  2. 退水處理函數中的條件檢查過於嚴格');
    console.log('  3. 結算流程可能被中斷或出錯');
    console.log('  4. 資料庫事務可能回滾了退水操作');
    
    process.exit(0);
    
  } catch (error) {
    console.error('分析過程中發生錯誤:', error);
    process.exit(1);
  }
}

analyzeRebateTriggerIssue();