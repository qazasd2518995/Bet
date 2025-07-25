import db from './db/config.js';
import enhancedSettlementModule from './enhanced-settlement-system.js';
const { enhancedSettlement, normalizeDrawResult } = enhancedSettlementModule;

async function analyzeEnhancedSettlementFailure() {
  try {
    console.log('=== 分析 enhancedSettlement 失敗原因 ===\n');
    
    // 測試期號
    const testPeriods = ['20250716013', '20250716031'];
    
    for (const period of testPeriods) {
      console.log(`\n測試期號 ${period}:`);
      
      // 1. 獲取開獎結果
      const drawResult = await db.oneOrNone(`
        SELECT * FROM result_history
        WHERE period = $1
      `, [period]);
      
      if (!drawResult) {
        console.log('  ❌ 沒有找到開獎結果');
        continue;
      }
      
      console.log('  開獎記錄存在');
      
      // 2. 檢查開獎結果格式
      console.log('\n  檢查開獎結果格式:');
      console.log(`  - result: ${drawResult.result}`);
      console.log(`  - position_1: ${drawResult.position_1}`);
      console.log(`  - positions: ${drawResult.positions}`);
      
      // 3. 嘗試標準化開獎結果
      try {
        const normalized = normalizeDrawResult(drawResult);
        console.log('  ✅ 標準化成功:', normalized);
      } catch (normalizeError) {
        console.log('  ❌ 標準化失敗:', normalizeError.message);
      }
      
      // 4. 檢查是否有未結算的投注
      const unsettledBets = await db.any(`
        SELECT COUNT(*) as count
        FROM bet_history
        WHERE period = $1 AND settled = false
      `, [period]);
      
      console.log(`\n  未結算投注數: ${unsettledBets[0].count}`);
      
      // 5. 手動構建開獎結果測試
      console.log('\n  嘗試手動結算:');
      
      // 構建正確格式的開獎結果
      let testDrawResult;
      if (drawResult.result && typeof drawResult.result === 'string') {
        // 如果 result 是逗號分隔的字符串
        const positions = drawResult.result.split(',').map(n => parseInt(n.trim()));
        testDrawResult = { positions };
      } else {
        // 嘗試從 position_1 到 position_10 構建
        const positions = [];
        for (let i = 1; i <= 10; i++) {
          const pos = drawResult[`position_${i}`];
          if (pos !== undefined && pos !== null) {
            positions.push(parseInt(pos));
          }
        }
        if (positions.length === 10) {
          testDrawResult = { positions };
        }
      }
      
      if (testDrawResult) {
        console.log('  構建的開獎結果:', testDrawResult);
        
        // 嘗試調用 enhancedSettlement
        try {
          console.log('\n  調用 enhancedSettlement...');
          const result = await enhancedSettlement(period, testDrawResult);
          console.log('  結果:', result);
        } catch (settlementError) {
          console.log('  ❌ 結算失敗:', settlementError.message);
          console.log('  錯誤堆疊:', settlementError.stack);
        }
      } else {
        console.log('  ❌ 無法構建有效的開獎結果');
      }
    }
    
    // 6. 檢查資料庫表結構
    console.log('\n\n檢查資料庫表結構:');
    
    // 檢查 members 表是否有 market_type 欄位
    const memberColumns = await db.any(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'members'
        AND column_name IN ('id', 'balance', 'market_type')
      ORDER BY column_name
    `);
    
    console.log('  members 表欄位:');
    memberColumns.forEach(col => {
      console.log(`    - ${col.column_name}: ${col.data_type}`);
    });
    
    // 檢查 settlement_logs 表是否存在
    const hasSettlementLogs = await db.oneOrNone(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'settlement_logs'
      ) as exists
    `);
    
    console.log(`\n  settlement_logs 表: ${hasSettlementLogs.exists ? '存在' : '不存在'}`);
    
    // 7. 總結可能的問題
    console.log('\n\n=== 可能的失敗原因總結 ===');
    console.log('1. 開獎結果格式問題 - result_history 表的數據格式可能不一致');
    console.log('2. 資料庫欄位缺失 - members 表可能缺少 market_type 欄位');
    console.log('3. 表結構問題 - settlement_logs 表可能不存在');
    console.log('4. 事務鎖定問題 - FOR UPDATE 語句可能造成死鎖或超時');
    console.log('5. 所有投注已結算 - 沒有未結算的投注導致跳過處理');
    
    process.exit(0);
    
  } catch (error) {
    console.error('分析過程中發生錯誤:', error);
    process.exit(1);
  }
}

analyzeEnhancedSettlementFailure();