import db from './db/config.js';
import enhancedSettlementModule from './enhanced-settlement-system.js';
const { enhancedSettlement } = enhancedSettlementModule;

async function testEnhancedSettlementFix() {
  try {
    console.log('=== 測試 enhancedSettlement 修復效果 ===\n');
    
    // 找一個已經結算但沒有退水的期號來測試
    const testPeriod = await db.oneOrNone(`
      WITH settled_periods AS (
        SELECT DISTINCT period, COUNT(*) as bet_count, SUM(amount) as total_amount
        FROM bet_history
        WHERE settled = true
          AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY period
      ),
      rebated_periods AS (
        SELECT DISTINCT period::text
        FROM transaction_records
        WHERE transaction_type = 'rebate'
          AND created_at >= NOW() - INTERVAL '24 hours'
      )
      SELECT sp.period, sp.bet_count, sp.total_amount
      FROM settled_periods sp
      LEFT JOIN rebated_periods rp ON sp.period::text = rp.period
      WHERE rp.period IS NULL
      ORDER BY sp.period DESC
      LIMIT 1
    `);
    
    if (!testPeriod) {
      console.log('沒有找到適合測試的期號（已結算但未退水）');
      console.log('\n手動測試方式:');
      console.log('1. 等待一個新期號開獎');
      console.log('2. 觀察是否自動處理退水');
      console.log('3. 或執行: node backend.js 並監控日誌');
      process.exit(0);
    }
    
    console.log(`找到測試期號: ${testPeriod.period}`);
    console.log(`  下注筆數: ${testPeriod.bet_count}`);
    console.log(`  下注總額: $${testPeriod.total_amount}`);
    console.log(`  預期退水: $${(testPeriod.total_amount * 0.011).toFixed(2)}\n`);
    
    // 獲取開獎結果
    const drawResult = await db.oneOrNone(`
      SELECT result FROM result_history
      WHERE period = $1
    `, [testPeriod.period]);
    
    if (!drawResult) {
      console.log('❌ 沒有找到開獎結果');
      process.exit(1);
    }
    
    // 構建正確格式的開獎結果
    let testDrawResult;
    if (drawResult.result && typeof drawResult.result === 'string') {
      const positions = drawResult.result.split(',').map(n => parseInt(n.trim()));
      testDrawResult = { positions };
    } else if (Array.isArray(drawResult.result)) {
      testDrawResult = { positions: drawResult.result };
    } else {
      console.log('❌ 無法解析開獎結果格式');
      process.exit(1);
    }
    
    console.log('開獎結果:', testDrawResult.positions.join(','));
    console.log('\n調用 enhancedSettlement...\n');
    
    // 測試 enhancedSettlement
    const result = await enhancedSettlement(testPeriod.period, testDrawResult);
    
    console.log('\n結果:');
    console.log(`  成功: ${result.success}`);
    console.log(`  結算筆數: ${result.settledCount}`);
    console.log(`  錯誤: ${result.error || '無'}`);
    
    // 檢查退水是否被處理
    const rebateCheck = await db.oneOrNone(`
      SELECT COUNT(*) as count, SUM(amount) as total_amount
      FROM transaction_records
      WHERE period = $1 AND transaction_type = 'rebate'
    `, [testPeriod.period]);
    
    console.log('\n退水檢查:');
    if (rebateCheck && parseInt(rebateCheck.count) > 0) {
      console.log(`  ✅ 退水已處理: ${rebateCheck.count} 筆，總額 $${rebateCheck.total_amount}`);
    } else {
      console.log(`  ❌ 退水未處理`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('測試過程中發生錯誤:', error);
    process.exit(1);
  }
}

testEnhancedSettlementFix();