import db from './db/config.js';

async function checkSettlementFlow() {
  try {
    console.log('=== 检查结算流程和退水检查机制 ===\n');
    
    // 检查两个期号的差异
    const periods = ['20250716001', '20250716013'];
    
    for (const period of periods) {
      console.log(`\n期号 ${period}:`);
      
      // 1. 检查结算时间
      const settlementInfo = await db.oneOrNone(`
        SELECT 
          MIN(settled_at) as first_settle,
          MAX(settled_at) as last_settle,
          COUNT(*) as bet_count,
          SUM(amount) as total_amount
        FROM bet_history
        WHERE period = $1 AND settled = true
      `, [period]);
      
      console.log(`  结算时间: ${settlementInfo.first_settle}`);
      console.log(`  下注数量: ${settlementInfo.bet_count} 笔`);
      console.log(`  下注总额: $${settlementInfo.total_amount}`);
      
      // 2. 检查是否有结算日志（enhancedSettlement会记录）
      const hasLog = await db.oneOrNone(`
        SELECT * FROM settlement_logs
        WHERE period = $1
      `, [period]);
      
      if (hasLog) {
        console.log(`  ✅ 有结算日志 (enhancedSettlement): ${hasLog.created_at}`);
      } else {
        console.log(`  ❌ 无结算日志 (可能使用其他结算系统)`);
      }
      
      // 3. 检查退水记录
      const rebateCount = await db.oneOrNone(`
        SELECT COUNT(*) as count, MIN(created_at) as first_rebate
        FROM transaction_records
        WHERE period = $1 AND transaction_type = 'rebate'
      `, [period]);
      
      if (rebateCount && parseInt(rebateCount.count) > 0) {
        console.log(`  ✅ 有退水记录: ${rebateCount.count} 笔，时间: ${rebateCount.first_rebate}`);
      } else {
        console.log(`  ❌ 无退水记录`);
      }
      
      // 4. 检查中奖记录（可以判断使用哪个系统）
      const winRecords = await db.oneOrNone(`
        SELECT COUNT(*) as count
        FROM transaction_records
        WHERE period = $1 AND transaction_type = 'win'
      `, [period]);
      
      console.log(`  中奖记录: ${winRecords.count} 笔`);
    }
    
    // 分析可能的原因
    console.log('\n\n=== 分析结果 ===');
    console.log('\n根据代码分析，settleBets 函数的执行流程:');
    console.log('1. 首先尝试 enhancedSettlement (会处理退水)');
    console.log('2. 如果失败，尝试 optimizedSettlement (有退水函数但之前是空的)');
    console.log('3. 最后尝试 improvedSettleBets (没有退水逻辑)');
    console.log('4. 结算完成后有独立的退水检查机制');
    
    console.log('\n可能的失败原因:');
    console.log('- 如果 enhancedSettlement 失败，会降级到没有退水的系统');
    console.log('- 独立的退水检查可能因为错误被 catch 而没有执行');
    console.log('- 或者在执行退水检查之前程序就已经结束');
    
    // 检查是否有错误记录
    console.log('\n建议检查服务器日志中是否有以下错误讯息:');
    console.log('- "增强版结算系统发生错误"');
    console.log('- "尝试使用优化版结算系统"');
    console.log('- "退水检查失败"');
    
    process.exit(0);
    
  } catch (error) {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  }
}

checkSettlementFlow();