import db from './db/config.js';
import { processRebates } from './enhanced-settlement-system.js';

async function processMissingRebates() {
  try {
    console.log('=== 处理遗漏的退水 ===\n');
    
    // 查询最近24小时内已结算但没有退水的期号
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
    
    console.log(`找到 ${missingRebatePeriods.length} 个需要处理退水的期号:\n`);
    
    if (missingRebatePeriods.length === 0) {
      console.log('✅ 没有遗漏的退水需要处理');
      process.exit(0);
    }
    
    // 计算总计
    const totalAmount = missingRebatePeriods.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);
    const totalBets = missingRebatePeriods.reduce((sum, p) => sum + parseInt(p.bet_count), 0);
    
    console.log(`总计: ${totalBets} 笔下注，总金额 $${totalAmount.toFixed(2)}`);
    console.log(`预计产生退水: $${(totalAmount * 0.011).toFixed(2)} (A盘 1.1%)\n`);
    
    // 逐一处理每个期号
    let successCount = 0;
    let failCount = 0;
    
    for (const period of missingRebatePeriods) {
      console.log(`\n处理期号 ${period.period}:`);
      console.log(`  下注: ${period.bet_count} 笔，金额: $${period.total_amount}`);
      
      try {
        await processRebates(period.period);
        successCount++;
        console.log(`  ✅ 退水处理成功`);
        
        // 验证退水结果
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
        console.error(`  ❌ 处理失败: ${error.message}`);
      }
    }
    
    console.log('\n=== 处理完成 ===');
    console.log(`成功: ${successCount} 个期号`);
    console.log(`失败: ${failCount} 个期号`);
    
    // 显示最新余额
    console.log('\n代理最新余额:');
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
    console.error('处理过程中发生错误:', error);
    process.exit(1);
  }
}

processMissingRebates();