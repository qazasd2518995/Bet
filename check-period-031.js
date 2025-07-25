import db from './db/config.js';

async function checkPeriod031() {
  try {
    console.log('=== 检查期号 20250716031 的详细状况 ===\n');
    
    const period = '20250716031';
    
    // 1. 检查下注记录
    console.log('1. 下注记录:');
    const bets = await db.any(`
      SELECT 
        id,
        username,
        amount,
        bet_type,
        bet_value,
        created_at,
        settled,
        settled_at,
        win,
        win_amount
      FROM bet_history
      WHERE period = $1
      ORDER BY id
    `, [period]);
    
    if (bets.length === 0) {
      console.log('  ❌ 没有找到任何下注记录');
    } else {
      let totalAmount = 0;
      bets.forEach(bet => {
        console.log(`  ID ${bet.id}: ${bet.username} 下注 $${bet.amount}`);
        console.log(`    类型: ${bet.bet_type} - ${bet.bet_value}`);
        console.log(`    时间: ${bet.created_at}`);
        console.log(`    结算: ${bet.settled ? '是' : '否'} ${bet.settled_at ? `(${bet.settled_at})` : ''}`);
        console.log(`    结果: ${bet.win ? `赢 $${bet.win_amount}` : '输'}`);
        totalAmount += parseFloat(bet.amount);
      });
      console.log(`\n  总下注金额: $${totalAmount.toFixed(2)}`);
      console.log(`  预期退水: $${(totalAmount * 0.011).toFixed(2)} (A盘 1.1%)`);
    }
    
    // 2. 检查退水记录
    console.log('\n2. 退水记录:');
    const rebates = await db.any(`
      SELECT 
        tr.id,
        tr.amount,
        tr.description,
        tr.created_at,
        tr.balance_before,
        tr.balance_after,
        a.username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at, tr.id
    `, [period]);
    
    if (rebates.length === 0) {
      console.log('  ❌ 没有找到任何退水记录');
    } else {
      let totalRebate = 0;
      console.log(`  找到 ${rebates.length} 笔退水记录:`);
      rebates.forEach(r => {
        console.log(`  ID ${r.id}: ${r.username} 收到 $${r.amount}`);
        console.log(`    余额: $${r.balance_before} → $${r.balance_after}`);
        console.log(`    描述: ${r.description}`);
        console.log(`    时间: ${r.created_at}`);
        totalRebate += parseFloat(r.amount);
      });
      console.log(`\n  总退水金额: $${totalRebate.toFixed(2)}`);
    }
    
    // 3. 检查开奖结果
    console.log('\n3. 开奖结果:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history
      WHERE period = $1
    `, [period]);
    
    if (!drawResult) {
      console.log('  ❌ 没有找到开奖记录');
    } else {
      console.log(`  ✅ 已开奖`);
      console.log(`  开奖时间: ${drawResult.draw_time || drawResult.created_at}`);
      console.log(`  开奖结果: ${drawResult.result || `${drawResult.position_1}, ${drawResult.position_2}, ${drawResult.position_3}...`}`);
    }
    
    // 4. 检查其他相关资讯
    console.log('\n4. 其他相关资讯:');
    
    // 检查是否有settlement_logs
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = $1
    `, [period]);
    
    console.log(`  结算日志: ${settlementLog ? '有' : '无'}`);
    
    // 检查期号前后的退水情况
    const nearbyPeriods = await db.any(`
      SELECT 
        period,
        COUNT(*) as rebate_count
      FROM transaction_records
      WHERE transaction_type = 'rebate'
        AND period::text LIKE '20250716%'
        AND CAST(SUBSTRING(period::text FROM 9) AS INTEGER) BETWEEN 29 AND 33
      GROUP BY period
      ORDER BY period
    `);
    
    console.log('\n  附近期号的退水情况:');
    nearbyPeriods.forEach(p => {
      console.log(`    期号 ${p.period}: ${p.rebate_count} 笔退水`);
    });
    
    // 5. 总结
    console.log('\n5. 总结:');
    if (bets.length > 0 && rebates.length > 0) {
      console.log('  ✅ 该期已经有退水记录，无需再次处理');
    } else if (bets.length > 0 && rebates.length === 0) {
      console.log('  ⚠️ 该期有下注但没有退水，需要处理');
      console.log('  执行: node process-single-period-rebate.js 20250716031');
    } else {
      console.log('  ℹ️ 该期没有下注记录');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  }
}

checkPeriod031();