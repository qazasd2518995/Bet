import db from './db/config.js';

async function investigateMissingRebateCause() {
  try {
    console.log('=== 調查期號 20250716013 退水未處理的原因 ===\n');
    
    const period = '20250716013';
    
    // 1. 檢查結算時間和方式
    console.log('1. 檢查結算記錄和時間軸:');
    
    // 查詢下注時間
    const betTiming = await db.oneOrNone(`
      SELECT 
        MIN(created_at) as first_bet_time,
        MAX(created_at) as last_bet_time,
        MIN(settled_at) as first_settled_time,
        MAX(settled_at) as last_settled_time
      FROM bet_history
      WHERE period = $1
    `, [period]);
    
    console.log(`  下注時間: ${betTiming.first_bet_time} - ${betTiming.last_bet_time}`);
    console.log(`  結算時間: ${betTiming.first_settled_time} - ${betTiming.last_settled_time}`);
    
    // 2. 檢查是否有結算日誌
    console.log('\n2. 檢查結算日誌:');
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = $1
    `, [period]);
    
    if (!settlementLog) {
      console.log('  ❌ 沒有找到結算日誌 - 這表示可能使用了不記錄日誌的結算系統');
    } else {
      console.log(`  ✅ 找到結算日誌: ${settlementLog.created_at}`);
    }
    
    // 3. 檢查是否有錯誤日誌
    console.log('\n3. 檢查相關時間的系統日誌:');
    
    // 查看該期前後的其他期號是否有退水
    const nearbyPeriods = await db.any(`
      WITH period_numbers AS (
        SELECT 
          period::text as period,
          CAST(SUBSTRING(period::text FROM 9) AS INTEGER) as period_num
        FROM bet_history
        WHERE period::text LIKE '20250716%'
          AND settled = true
        GROUP BY period
      ),
      rebate_status AS (
        SELECT 
          pn.period,
          pn.period_num,
          COUNT(tr.id) as rebate_count
        FROM period_numbers pn
        LEFT JOIN transaction_records tr 
          ON pn.period = tr.period::text 
          AND tr.transaction_type = 'rebate'
        GROUP BY pn.period, pn.period_num
      )
      SELECT * FROM rebate_status
      WHERE period_num BETWEEN 11 AND 15
      ORDER BY period_num
    `);
    
    console.log('  附近期號的退水狀態:');
    nearbyPeriods.forEach(p => {
      const status = p.rebate_count > 0 ? '✅ 有退水' : '❌ 無退水';
      console.log(`    期號 ${p.period}: ${status} (${p.rebate_count} 筆)`);
    });
    
    // 4. 分析使用的結算系統
    console.log('\n4. 分析可能使用的結算系統:');
    
    // 檢查是否有 enhancedSettlement 的特徵
    const hasEnhancedFeatures = await db.oneOrNone(`
      SELECT COUNT(*) as count
      FROM transaction_records
      WHERE transaction_type = 'win'
        AND created_at >= $1::timestamp - INTERVAL '5 minutes'
        AND created_at <= $1::timestamp + INTERVAL '5 minutes'
    `, [betTiming.first_settled_time]);
    
    console.log(`  結算時間附近的中獎記錄: ${hasEnhancedFeatures?.count || 0} 筆`);
    
    // 5. 檢查具體的結算系統行為
    console.log('\n5. 分析結算系統行為:');
    console.log('  根據代碼分析，系統有多個結算方式:');
    console.log('  - enhancedSettlement: 會自動處理退水');
    console.log('  - optimizedSettlement: 有 processRebatesAsync 但之前是空函數');
    console.log('  - improvedSettleBets: 沒有退水處理邏輯');
    console.log('  - comprehensiveSettlement: 沒有退水處理邏輯');
    
    // 6. 檢查 backend.js 中的獨立退水檢查
    console.log('\n6. 檢查獨立退水檢查機制:');
    console.log('  backend.js 中的 settleBets 函數應該有獨立的退水檢查');
    console.log('  但可能因為以下原因失效:');
    console.log('  - 錯誤被捕獲但未正確處理');
    console.log('  - 模塊導入問題');
    console.log('  - 併發或時序問題');
    
    // 7. 檢查是否有手動結算的跡象
    console.log('\n7. 檢查結算模式:');
    const settlementPattern = await db.any(`
      SELECT 
        period,
        COUNT(*) as bet_count,
        MIN(settled_at) as min_time,
        MAX(settled_at) as max_time,
        EXTRACT(EPOCH FROM (MAX(settled_at) - MIN(settled_at))) as duration_seconds
      FROM bet_history
      WHERE period IN ('20250716001', '20250716013')
        AND settled = true
      GROUP BY period
    `);
    
    settlementPattern.forEach(s => {
      console.log(`  期號 ${s.period}:`);
      console.log(`    結算 ${s.bet_count} 筆，耗時 ${s.duration_seconds} 秒`);
      console.log(`    時間範圍: ${s.min_time} - ${s.max_time}`);
    });
    
    // 8. 結論
    console.log('\n8. 可能的原因總結:');
    console.log('  🔍 最可能的原因:');
    console.log('  1. 使用了不包含退水邏輯的結算系統 (如 improvedSettleBets)');
    console.log('  2. backend.js 的獨立退水檢查機制失效');
    console.log('  3. 可能是手動或批次結算，跳過了正常的結算流程');
    
    console.log('\n  💡 建議:');
    console.log('  - 確保所有結算系統都包含退水處理');
    console.log('  - 加強錯誤日誌記錄');
    console.log('  - 考慮增加定時任務檢查遺漏的退水');
    
    process.exit(0);
    
  } catch (error) {
    console.error('調查過程中發生錯誤:', error);
    process.exit(1);
  }
}

investigateMissingRebateCause();