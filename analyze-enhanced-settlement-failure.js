import db from './db/config.js';
import enhancedSettlementModule from './enhanced-settlement-system.js';
const { enhancedSettlement, normalizeDrawResult } = enhancedSettlementModule;

async function analyzeEnhancedSettlementFailure() {
  try {
    console.log('=== 分析 enhancedSettlement 失败原因 ===\n');
    
    // 测试期号
    const testPeriods = ['20250716013', '20250716031'];
    
    for (const period of testPeriods) {
      console.log(`\n测试期号 ${period}:`);
      
      // 1. 获取开奖结果
      const drawResult = await db.oneOrNone(`
        SELECT * FROM result_history
        WHERE period = $1
      `, [period]);
      
      if (!drawResult) {
        console.log('  ❌ 没有找到开奖结果');
        continue;
      }
      
      console.log('  开奖记录存在');
      
      // 2. 检查开奖结果格式
      console.log('\n  检查开奖结果格式:');
      console.log(`  - result: ${drawResult.result}`);
      console.log(`  - position_1: ${drawResult.position_1}`);
      console.log(`  - positions: ${drawResult.positions}`);
      
      // 3. 尝试标准化开奖结果
      try {
        const normalized = normalizeDrawResult(drawResult);
        console.log('  ✅ 标准化成功:', normalized);
      } catch (normalizeError) {
        console.log('  ❌ 标准化失败:', normalizeError.message);
      }
      
      // 4. 检查是否有未结算的投注
      const unsettledBets = await db.any(`
        SELECT COUNT(*) as count
        FROM bet_history
        WHERE period = $1 AND settled = false
      `, [period]);
      
      console.log(`\n  未结算投注数: ${unsettledBets[0].count}`);
      
      // 5. 手动构建开奖结果测试
      console.log('\n  尝试手动结算:');
      
      // 构建正确格式的开奖结果
      let testDrawResult;
      if (drawResult.result && typeof drawResult.result === 'string') {
        // 如果 result 是逗号分隔的字符串
        const positions = drawResult.result.split(',').map(n => parseInt(n.trim()));
        testDrawResult = { positions };
      } else {
        // 尝试从 position_1 到 position_10 构建
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
        console.log('  构建的开奖结果:', testDrawResult);
        
        // 尝试调用 enhancedSettlement
        try {
          console.log('\n  调用 enhancedSettlement...');
          const result = await enhancedSettlement(period, testDrawResult);
          console.log('  结果:', result);
        } catch (settlementError) {
          console.log('  ❌ 结算失败:', settlementError.message);
          console.log('  错误堆叠:', settlementError.stack);
        }
      } else {
        console.log('  ❌ 无法构建有效的开奖结果');
      }
    }
    
    // 6. 检查资料库表结构
    console.log('\n\n检查资料库表结构:');
    
    // 检查 members 表是否有 market_type 栏位
    const memberColumns = await db.any(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'members'
        AND column_name IN ('id', 'balance', 'market_type')
      ORDER BY column_name
    `);
    
    console.log('  members 表栏位:');
    memberColumns.forEach(col => {
      console.log(`    - ${col.column_name}: ${col.data_type}`);
    });
    
    // 检查 settlement_logs 表是否存在
    const hasSettlementLogs = await db.oneOrNone(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'settlement_logs'
      ) as exists
    `);
    
    console.log(`\n  settlement_logs 表: ${hasSettlementLogs.exists ? '存在' : '不存在'}`);
    
    // 7. 总结可能的问题
    console.log('\n\n=== 可能的失败原因总结 ===');
    console.log('1. 开奖结果格式问题 - result_history 表的数据格式可能不一致');
    console.log('2. 资料库栏位缺失 - members 表可能缺少 market_type 栏位');
    console.log('3. 表结构问题 - settlement_logs 表可能不存在');
    console.log('4. 事务锁定问题 - FOR UPDATE 语句可能造成死锁或超时');
    console.log('5. 所有投注已结算 - 没有未结算的投注导致跳过处理');
    
    process.exit(0);
    
  } catch (error) {
    console.error('分析过程中发生错误:', error);
    process.exit(1);
  }
}

analyzeEnhancedSettlementFailure();