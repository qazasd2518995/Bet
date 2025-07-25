import db from './db/config.js';

async function checkPeriod20250716013() {
  try {
    console.log('=== 检查期号 20250716013 退水问题 ===\n');
    
    const period = '20250716013';
    
    // 1. 检查该期是否有下注记录
    console.log('1. 检查该期的下注记录:');
    const bets = await db.any(`
      SELECT 
        username,
        COUNT(*) as bet_count,
        SUM(amount) as total_amount,
        MIN(created_at) as first_bet,
        MAX(created_at) as last_bet,
        BOOL_AND(settled) as all_settled
      FROM bet_history
      WHERE period = $1
      GROUP BY username
      ORDER BY total_amount DESC
    `, [period]);
    
    if (bets.length === 0) {
      console.log('  ❌ 该期没有任何下注记录');
    } else {
      console.log(`  找到 ${bets.length} 位会员的下注:`);
      let totalBetAmount = 0;
      
      bets.forEach(b => {
        console.log(`  - ${b.username}: ${b.bet_count} 笔，总额 $${b.total_amount}`);
        console.log(`    首注: ${b.first_bet}`);
        console.log(`    末注: ${b.last_bet}`);
        console.log(`    已结算: ${b.all_settled ? '是' : '否'}`);
        totalBetAmount += parseFloat(b.total_amount);
      });
      
      console.log(`\n  总下注金额: $${totalBetAmount.toFixed(2)}`);
      console.log(`  预期退水总额 (1.1%): $${(totalBetAmount * 0.011).toFixed(2)}`);
    }
    
    // 2. 检查该期是否已开奖
    console.log('\n2. 检查该期的开奖状态:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history
      WHERE period = $1
    `, [period]);
    
    if (!drawResult) {
      console.log('  ❌ 该期尚未开奖');
    } else {
      console.log(`  ✅ 已开奖，时间: ${drawResult.draw_time}`);
      console.log(`  开奖结果: ${drawResult.position_1}, ${drawResult.position_2}, ${drawResult.position_3}, ...`);
    }
    
    // 3. 检查是否有退水记录
    console.log('\n3. 检查退水记录:');
    const rebates = await db.any(`
      SELECT 
        tr.*,
        a.username as agent_username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at
    `, [period]);
    
    if (rebates.length === 0) {
      console.log('  ❌ 没有找到任何退水记录');
    } else {
      console.log(`  找到 ${rebates.length} 笔退水记录:`);
      rebates.forEach(r => {
        console.log(`  - ${r.agent_username || r.user_id}: $${r.amount} (${r.created_at})`);
      });
    }
    
    // 4. 检查结算日志
    console.log('\n4. 检查结算日志:');
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = $1
    `, [period]);
    
    if (!settlementLog) {
      console.log('  ❌ 没有结算日志记录');
    } else {
      console.log(`  ✅ 已结算: ${settlementLog.settled_count} 笔，总中奖 $${settlementLog.total_win_amount}`);
      console.log(`  结算时间: ${settlementLog.created_at}`);
    }
    
    // 5. 分析可能的原因
    console.log('\n5. 分析可能的原因:');
    
    if (bets.length > 0 && drawResult && rebates.length === 0) {
      console.log('  ⚠️ 有下注且已开奖，但没有退水记录');
      console.log('  可能原因:');
      console.log('  - 结算系统未触发退水处理');
      console.log('  - 退水处理过程中发生错误');
      console.log('  - 需要手动触发退水处理');
      
      // 检查是否所有下注都已结算
      const unsettledCount = await db.oneOrNone(`
        SELECT COUNT(*) as count
        FROM bet_history
        WHERE period = $1 AND settled = false
      `, [period]);
      
      if (unsettledCount && parseInt(unsettledCount.count) > 0) {
        console.log(`\n  ⚠️ 还有 ${unsettledCount.count} 笔下注未结算，这可能是退水未处理的原因`);
      }
    }
    
    // 6. 建议处理方式
    console.log('\n6. 建议处理方式:');
    if (bets.length > 0 && rebates.length === 0) {
      console.log('  可以执行以下命令手动处理退水:');
      console.log('  node process-single-period-rebate.js 20250716013');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  }
}

checkPeriod20250716013();