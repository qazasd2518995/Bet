import db from './db/config.js';
import { processRebates } from './enhanced-settlement-system.js';

async function processSinglePeriodRebate() {
  const period = process.argv[2];
  
  if (!period) {
    console.error('請提供期號作為參數');
    console.error('用法: node process-single-period-rebate.js <期號>');
    process.exit(1);
  }
  
  try {
    console.log(`=== 手動處理期號 ${period} 的退水 ===\n`);
    
    // 1. 檢查該期是否已有退水
    const existingRebates = await db.oneOrNone(`
      SELECT COUNT(*) as count
      FROM transaction_records
      WHERE period = $1 AND transaction_type = 'rebate'
    `, [period]);
    
    if (existingRebates && parseInt(existingRebates.count) > 0) {
      console.log(`⚠️ 期號 ${period} 已經有 ${existingRebates.count} 筆退水記錄`);
      console.log('為避免重複退水，程序終止');
      process.exit(0);
    }
    
    // 2. 檢查該期的下注情況
    const betSummary = await db.oneOrNone(`
      SELECT 
        COUNT(*) as bet_count,
        SUM(amount) as total_amount,
        COUNT(DISTINCT username) as user_count
      FROM bet_history
      WHERE period = $1 AND settled = true
    `, [period]);
    
    if (!betSummary || parseInt(betSummary.bet_count) === 0) {
      console.log(`❌ 期號 ${period} 沒有已結算的下注記錄`);
      process.exit(0);
    }
    
    console.log(`期號 ${period} 下注統計:`);
    console.log(`  下注筆數: ${betSummary.bet_count}`);
    console.log(`  下注總額: $${betSummary.total_amount}`);
    console.log(`  下注人數: ${betSummary.user_count}`);
    console.log(`  預期退水: $${(parseFloat(betSummary.total_amount) * 0.011).toFixed(2)} (A盤 1.1%)`);
    
    // 3. 執行退水處理
    console.log('\n開始處理退水...');
    
    try {
      await processRebates(period);
      console.log('✅ 退水處理完成');
      
      // 4. 驗證退水結果
      const rebateResults = await db.any(`
        SELECT 
          tr.amount,
          tr.description,
          a.username
        FROM transaction_records tr
        JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
        WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
        ORDER BY tr.amount DESC
      `, [period]);
      
      if (rebateResults.length > 0) {
        console.log('\n退水分配結果:');
        let totalRebate = 0;
        rebateResults.forEach(r => {
          console.log(`  ${r.username}: $${r.amount} - ${r.description}`);
          totalRebate += parseFloat(r.amount);
        });
        console.log(`  總計: $${totalRebate.toFixed(2)}`);
      }
      
    } catch (error) {
      console.error('❌ 退水處理失敗:', error.message);
      if (error.stack) {
        console.error('錯誤堆疊:', error.stack);
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('處理過程中發生錯誤:', error);
    process.exit(1);
  }
}

processSinglePeriodRebate();