import db from './db/config.js';
import { processRebates } from './enhanced-settlement-system.js';

async function processMissingRebates() {
  try {
    console.log('=== 處理遺漏的退水 ===\n');
    
    // 查詢最近24小時內已結算但沒有退水的期號
    const missingRebatePeriods = await db.any(`
      WITH settled_periods AS (
        SELECT DISTINCT period, COUNT(*) as bet_count, SUM(amount) as total_amount
        FROM bet_history
        WHERE settled = true
          AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY period
      ),
      rebated_periods AS (
        SELECT DISTINCT period::varchar
        FROM transaction_records
        WHERE transaction_type = 'rebate'
          AND period IS NOT NULL
          AND created_at > NOW() - INTERVAL '24 hours'
      )
      SELECT sp.period, sp.bet_count, sp.total_amount
      FROM settled_periods sp
      LEFT JOIN rebated_periods rp ON sp.period::varchar = rp.period
      WHERE rp.period IS NULL
      ORDER BY sp.period DESC
    `);
    
    console.log(`找到 ${missingRebatePeriods.length} 個需要處理退水的期號:\n`);
    
    if (missingRebatePeriods.length === 0) {
      console.log('✅ 沒有遺漏的退水需要處理');
      process.exit(0);
    }
    
    // 計算總計
    const totalAmount = missingRebatePeriods.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);
    const totalBets = missingRebatePeriods.reduce((sum, p) => sum + parseInt(p.bet_count), 0);
    
    console.log(`總計: ${totalBets} 筆下注，總金額 $${totalAmount.toFixed(2)}`);
    console.log(`預計產生退水: $${(totalAmount * 0.011).toFixed(2)} (A盤 1.1%)\n`);
    
    // 逐一處理每個期號
    let successCount = 0;
    let failCount = 0;
    
    for (const period of missingRebatePeriods) {
      console.log(`\n處理期號 ${period.period}:`);
      console.log(`  下注: ${period.bet_count} 筆，金額: $${period.total_amount}`);
      
      try {
        await processRebates(period.period);
        successCount++;
        console.log(`  ✅ 退水處理成功`);
        
        // 驗證退水結果
        const rebates = await db.any(`
          SELECT tr.amount, a.username
          FROM transaction_records tr
          JOIN agents a ON tr.user_id = a.id
          WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
          ORDER BY tr.created_at
        `, [period.period]);
        
        if (rebates.length > 0) {
          console.log(`  退水分配:`);
          rebates.forEach(r => {
            console.log(`    - ${r.username}: $${r.amount}`);
          });
        }
      } catch (error) {
        failCount++;
        console.error(`  ❌ 處理失敗: ${error.message}`);
      }
    }
    
    console.log('\n=== 處理完成 ===');
    console.log(`成功: ${successCount} 個期號`);
    console.log(`失敗: ${failCount} 個期號`);
    
    // 顯示最新餘額
    console.log('\n代理最新餘額:');
    const agents = await db.any(`
      SELECT username, balance FROM agents 
      WHERE username IN ($1, $2)
      ORDER BY username
    `, ['justin2025A', 'ti2025A']);
    
    for (const agent of agents) {
      console.log(`${agent.username}: $${agent.balance}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('處理過程中發生錯誤:', error);
    process.exit(1);
  }
}

processMissingRebates();