import db from './db/config.js';

async function investigateMissingRebateCause() {
  try {
    console.log('=== 调查期号 20250716013 退水未处理的原因 ===\n');
    
    const period = '20250716013';
    
    // 1. 检查结算时间和方式
    console.log('1. 检查结算记录和时间轴:');
    
    // 查询下注时间
    const betTiming = await db.oneOrNone(`
      SELECT 
        MIN(created_at) as first_bet_time,
        MAX(created_at) as last_bet_time,
        MIN(settled_at) as first_settled_time,
        MAX(settled_at) as last_settled_time
      FROM bet_history
      WHERE period = $1
    `, [period]);
    
    console.log(`  下注时间: ${betTiming.first_bet_time} - ${betTiming.last_bet_time}`);
    console.log(`  结算时间: ${betTiming.first_settled_time} - ${betTiming.last_settled_time}`);
    
    // 2. 检查是否有结算日志
    console.log('\n2. 检查结算日志:');
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = $1
    `, [period]);
    
    if (!settlementLog) {
      console.log('  ❌ 没有找到结算日志 - 这表示可能使用了不记录日志的结算系统');
    } else {
      console.log(`  ✅ 找到结算日志: ${settlementLog.created_at}`);
    }
    
    // 3. 检查是否有错误日志
    console.log('\n3. 检查相关时间的系统日志:');
    
    // 查看该期前后的其他期号是否有退水
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
    
    console.log('  附近期号的退水状态:');
    nearbyPeriods.forEach(p => {
      const status = p.rebate_count > 0 ? '✅ 有退水' : '❌ 无退水';
      console.log(`    期号 ${p.period}: ${status} (${p.rebate_count} 笔)`);
    });
    
    // 4. 分析使用的结算系统
    console.log('\n4. 分析可能使用的结算系统:');
    
    // 检查是否有 enhancedSettlement 的特征
    const hasEnhancedFeatures = await db.oneOrNone(`
      SELECT COUNT(*) as count
      FROM transaction_records
      WHERE transaction_type = 'win'
        AND created_at >= $1::timestamp - INTERVAL '5 minutes'
        AND created_at <= $1::timestamp + INTERVAL '5 minutes'
    `, [betTiming.first_settled_time]);
    
    console.log(`  结算时间附近的中奖记录: ${hasEnhancedFeatures?.count || 0} 笔`);
    
    // 5. 检查具体的结算系统行为
    console.log('\n5. 分析结算系统行为:');
    console.log('  根据代码分析，系统有多个结算方式:');
    console.log('  - enhancedSettlement: 会自动处理退水');
    console.log('  - optimizedSettlement: 有 processRebatesAsync 但之前是空函数');
    console.log('  - improvedSettleBets: 没有退水处理逻辑');
    console.log('  - comprehensiveSettlement: 没有退水处理逻辑');
    
    // 6. 检查 backend.js 中的独立退水检查
    console.log('\n6. 检查独立退水检查机制:');
    console.log('  backend.js 中的 settleBets 函数应该有独立的退水检查');
    console.log('  但可能因为以下原因失效:');
    console.log('  - 错误被捕获但未正确处理');
    console.log('  - 模块导入问题');
    console.log('  - 并发或时序问题');
    
    // 7. 检查是否有手动结算的迹象
    console.log('\n7. 检查结算模式:');
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
      console.log(`  期号 ${s.period}:`);
      console.log(`    结算 ${s.bet_count} 笔，耗时 ${s.duration_seconds} 秒`);
      console.log(`    时间范围: ${s.min_time} - ${s.max_time}`);
    });
    
    // 8. 结论
    console.log('\n8. 可能的原因总结:');
    console.log('  🔍 最可能的原因:');
    console.log('  1. 使用了不包含退水逻辑的结算系统 (如 improvedSettleBets)');
    console.log('  2. backend.js 的独立退水检查机制失效');
    console.log('  3. 可能是手动或批次结算，跳过了正常的结算流程');
    
    console.log('\n  💡 建议:');
    console.log('  - 确保所有结算系统都包含退水处理');
    console.log('  - 加强错误日志记录');
    console.log('  - 考虑增加定时任务检查遗漏的退水');
    
    process.exit(0);
    
  } catch (error) {
    console.error('调查过程中发生错误:', error);
    process.exit(1);
  }
}

investigateMissingRebateCause();