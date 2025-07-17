import db from './db/config.js';

async function checkSettlementFlow() {
  try {
    console.log('=== 檢查結算流程和退水檢查機制 ===\n');
    
    // 檢查兩個期號的差異
    const periods = ['20250716001', '20250716013'];
    
    for (const period of periods) {
      console.log(`\n期號 ${period}:`);
      
      // 1. 檢查結算時間
      const settlementInfo = await db.oneOrNone(`
        SELECT 
          MIN(settled_at) as first_settle,
          MAX(settled_at) as last_settle,
          COUNT(*) as bet_count,
          SUM(amount) as total_amount
        FROM bet_history
        WHERE period = $1 AND settled = true
      `, [period]);
      
      console.log(`  結算時間: ${settlementInfo.first_settle}`);
      console.log(`  下注數量: ${settlementInfo.bet_count} 筆`);
      console.log(`  下注總額: $${settlementInfo.total_amount}`);
      
      // 2. 檢查是否有結算日誌（enhancedSettlement會記錄）
      const hasLog = await db.oneOrNone(`
        SELECT * FROM settlement_logs
        WHERE period = $1
      `, [period]);
      
      if (hasLog) {
        console.log(`  ✅ 有結算日誌 (enhancedSettlement): ${hasLog.created_at}`);
      } else {
        console.log(`  ❌ 無結算日誌 (可能使用其他結算系統)`);
      }
      
      // 3. 檢查退水記錄
      const rebateCount = await db.oneOrNone(`
        SELECT COUNT(*) as count, MIN(created_at) as first_rebate
        FROM transaction_records
        WHERE period = $1 AND transaction_type = 'rebate'
      `, [period]);
      
      if (rebateCount && parseInt(rebateCount.count) > 0) {
        console.log(`  ✅ 有退水記錄: ${rebateCount.count} 筆，時間: ${rebateCount.first_rebate}`);
      } else {
        console.log(`  ❌ 無退水記錄`);
      }
      
      // 4. 檢查中獎記錄（可以判斷使用哪個系統）
      const winRecords = await db.oneOrNone(`
        SELECT COUNT(*) as count
        FROM transaction_records
        WHERE period = $1 AND transaction_type = 'win'
      `, [period]);
      
      console.log(`  中獎記錄: ${winRecords.count} 筆`);
    }
    
    // 分析可能的原因
    console.log('\n\n=== 分析結果 ===');
    console.log('\n根據代碼分析，settleBets 函數的執行流程:');
    console.log('1. 首先嘗試 enhancedSettlement (會處理退水)');
    console.log('2. 如果失敗，嘗試 optimizedSettlement (有退水函數但之前是空的)');
    console.log('3. 最後嘗試 improvedSettleBets (沒有退水邏輯)');
    console.log('4. 結算完成後有獨立的退水檢查機制');
    
    console.log('\n可能的失敗原因:');
    console.log('- 如果 enhancedSettlement 失敗，會降級到沒有退水的系統');
    console.log('- 獨立的退水檢查可能因為錯誤被 catch 而沒有執行');
    console.log('- 或者在執行退水檢查之前程序就已經結束');
    
    // 檢查是否有錯誤記錄
    console.log('\n建議檢查服務器日誌中是否有以下錯誤訊息:');
    console.log('- "增強版結算系統發生錯誤"');
    console.log('- "嘗試使用優化版結算系統"');
    console.log('- "退水檢查失敗"');
    
    process.exit(0);
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
    process.exit(1);
  }
}

checkSettlementFlow();