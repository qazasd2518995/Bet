import db from './db/config.js';
import { processRebates } from './enhanced-settlement-system.js';

async function processSinglePeriodRebate() {
  const period = process.argv[2];
  
  if (!period) {
    console.error('请提供期号作为参数');
    console.error('用法: node process-single-period-rebate.js <期号>');
    process.exit(1);
  }
  
  try {
    console.log(`=== 手动处理期号 ${period} 的退水 ===\n`);
    
    // 1. 检查该期是否已有退水
    const existingRebates = await db.oneOrNone(`
      SELECT COUNT(*) as count
      FROM transaction_records
      WHERE period = $1 AND transaction_type = 'rebate'
    `, [period]);
    
    if (existingRebates && parseInt(existingRebates.count) > 0) {
      console.log(`⚠️ 期号 ${period} 已经有 ${existingRebates.count} 笔退水记录`);
      console.log('为避免重复退水，程序终止');
      process.exit(0);
    }
    
    // 2. 检查该期的下注情况
    const betSummary = await db.oneOrNone(`
      SELECT 
        COUNT(*) as bet_count,
        SUM(amount) as total_amount,
        COUNT(DISTINCT username) as user_count
      FROM bet_history
      WHERE period = $1 AND settled = true
    `, [period]);
    
    if (!betSummary || parseInt(betSummary.bet_count) === 0) {
      console.log(`❌ 期号 ${period} 没有已结算的下注记录`);
      process.exit(0);
    }
    
    console.log(`期号 ${period} 下注统计:`);
    console.log(`  下注笔数: ${betSummary.bet_count}`);
    console.log(`  下注总额: $${betSummary.total_amount}`);
    console.log(`  下注人数: ${betSummary.user_count}`);
    console.log(`  预期退水: $${(parseFloat(betSummary.total_amount) * 0.011).toFixed(2)} (A盘 1.1%)`);
    
    // 3. 执行退水处理
    console.log('\n开始处理退水...');
    
    try {
      await processRebates(period);
      console.log('✅ 退水处理完成');
      
      // 4. 验证退水结果
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
        console.log('\n退水分配结果:');
        let totalRebate = 0;
        rebateResults.forEach(r => {
          console.log(`  ${r.username}: $${r.amount} - ${r.description}`);
          totalRebate += parseFloat(r.amount);
        });
        console.log(`  总计: $${totalRebate.toFixed(2)}`);
      }
      
    } catch (error) {
      console.error('❌ 退水处理失败:', error.message);
      if (error.stack) {
        console.error('错误堆叠:', error.stack);
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('处理过程中发生错误:', error);
    process.exit(1);
  }
}

processSinglePeriodRebate();