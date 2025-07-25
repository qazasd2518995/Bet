import db from './db/config.js';

async function checkSettlementTimeline() {
  try {
    console.log('=== 檢查結算時間線和流程 ===\n');
    
    const periods = ['20250716001', '20250716013', '20250716031'];
    
    for (const period of periods) {
      console.log(`\n期號 ${period}:`);
      
      // 1. 檢查下注和結算時間
      const betInfo = await db.any(`
        SELECT 
          id,
          username,
          amount,
          created_at,
          settled,
          settled_at,
          win,
          win_amount
        FROM bet_history
        WHERE period = $1
        ORDER BY id
      `, [period]);
      
      if (betInfo.length === 0) continue;
      
      console.log(`  下注數: ${betInfo.length} 筆`);
      const firstBetTime = betInfo[0].created_at;
      const lastBetTime = betInfo[betInfo.length - 1].created_at;
      const firstSettleTime = betInfo[0].settled_at;
      const lastSettleTime = betInfo[betInfo.length - 1].settled_at;
      
      console.log(`  下注時間: ${firstBetTime} - ${lastBetTime}`);
      console.log(`  結算時間: ${firstSettleTime} - ${lastSettleTime}`);
      
      // 計算時間差
      if (firstSettleTime) {
        const timeDiff = (new Date(firstSettleTime) - new Date(lastBetTime)) / 1000;
        console.log(`  下注到結算的時間差: ${timeDiff} 秒`);
      }
      
      // 2. 檢查開獎時間
      const drawResult = await db.oneOrNone(`
        SELECT created_at
        FROM result_history
        WHERE period = $1
      `, [period]);
      
      if (drawResult) {
        console.log(`  開獎時間: ${drawResult.created_at}`);
      }
      
      // 3. 檢查是否有中獎記錄
      const winRecords = await db.any(`
        SELECT COUNT(*) as count, MIN(created_at) as first_time
        FROM transaction_records
        WHERE period = $1 AND transaction_type = 'win'
      `, [period]);
      
      console.log(`  中獎記錄: ${winRecords[0].count} 筆`);
      if (winRecords[0].count > 0) {
        console.log(`  中獎記錄時間: ${winRecords[0].first_time}`);
      }
      
      // 4. 檢查退水記錄時間
      const rebateRecords = await db.any(`
        SELECT COUNT(*) as count, MIN(created_at) as first_time
        FROM transaction_records
        WHERE period = $1 AND transaction_type = 'rebate'
      `, [period]);
      
      if (rebateRecords[0].count > 0) {
        console.log(`  退水記錄: ${rebateRecords[0].count} 筆`);
        console.log(`  退水時間: ${rebateRecords[0].first_time}`);
      } else {
        console.log(`  退水記錄: 無`);
      }
      
      // 5. 分析結算模式
      console.log('\n  分析:');
      
      // 檢查是否所有投注的 settled_at 時間完全相同
      const uniqueSettleTimes = [...new Set(betInfo.map(b => b.settled_at?.toISOString()))];
      console.log(`  結算時間點數: ${uniqueSettleTimes.length}`);
      
      if (uniqueSettleTimes.length === 1) {
        console.log(`  ⚠️ 所有投注在同一時間點結算，可能是批量結算`);
      }
      
      // 檢查 win_amount 是否都為 0
      const hasWinAmount = betInfo.some(b => b.win_amount > 0);
      if (!hasWinAmount) {
        console.log(`  ⚠️ 沒有任何 win_amount > 0，可能使用了不更新 win_amount 的結算系統`);
      }
    }
    
    console.log('\n\n=== 結論 ===');
    console.log('問題原因:');
    console.log('1. 投注在 settleBets 被調用之前就已經被標記為 settled = true');
    console.log('2. 可能是其他結算邏輯先執行了（例如在開獎時直接更新）');
    console.log('3. enhancedSettlement 看到所有投注都已結算，所以跳過處理');
    console.log('4. 後續的退水檢查機制可能因為某些原因失敗');
    
    console.log('\n建議檢查:');
    console.log('- 在開獎邏輯中是否有直接更新 bet_history.settled = true 的代碼');
    console.log('- 是否有其他地方調用了結算邏輯');
    console.log('- backend.js 的獨立退水檢查為何失效');
    
    process.exit(0);
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
    process.exit(1);
  }
}

checkSettlementTimeline();