import db from './db/config.js';

async function checkPeriod041Detailed() {
  try {
    console.log('=== 详细检查期号 20250716041 退水问题 ===\n');
    
    const period = '20250716041';
    
    // 1. 检查下注记录
    console.log('1. 下注记录详情:');
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
      process.exit(0);
    }
    
    let totalAmount = 0;
    bets.forEach(bet => {
      console.log(`  ID ${bet.id}: ${bet.username} 下注 $${bet.amount}`);
      console.log(`    类型: ${bet.bet_type} - ${bet.bet_value}`);
      console.log(`    时间: ${bet.created_at}`);
      console.log(`    结算: ${bet.settled ? '是' : '否'}`);
      if (bet.settled) {
        console.log(`    结算时间: ${bet.settled_at}`);
        console.log(`    结果: ${bet.win ? `赢 $${bet.win_amount}` : '输'}`);
      }
      totalAmount += parseFloat(bet.amount);
    });
    
    console.log(`\n  总下注金额: $${totalAmount.toFixed(2)}`);
    console.log(`  预期退水: $${(totalAmount * 0.011).toFixed(2)} (A盘 1.1%)`);
    
    // 2. 检查开奖结果
    console.log('\n2. 开奖结果:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history
      WHERE period = $1
    `, [period]);
    
    if (!drawResult) {
      console.log('  ❌ 没有找到开奖记录');
    } else {
      console.log(`  ✅ 已开奖`);
      console.log(`  开奖时间: ${drawResult.created_at}`);
      console.log(`  开奖结果: ${drawResult.result}`);
    }
    
    // 3. 检查退水记录
    console.log('\n3. 退水记录:');
    const rebates = await db.any(`
      SELECT 
        tr.id,
        tr.amount,
        tr.description,
        tr.created_at,
        a.username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at
    `, [period]);
    
    if (rebates.length === 0) {
      console.log('  ❌ 没有找到任何退水记录');
    } else {
      console.log(`  ✅ 找到 ${rebates.length} 笔退水记录:`);
      rebates.forEach(r => {
        console.log(`    ${r.username}: $${r.amount} (${r.created_at})`);
      });
    }
    
    // 4. 检查结算日志
    console.log('\n4. 结算日志:');
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = $1
    `, [period]);
    
    if (!settlementLog) {
      console.log('  ❌ 没有结算日志记录');
      console.log('  说明: 可能使用了不记录日志的结算系统');
    } else {
      console.log(`  ✅ 有结算日志`);
      console.log(`  结算时间: ${settlementLog.created_at}`);
      console.log(`  结算笔数: ${settlementLog.settled_count}`);
    }
    
    // 5. 检查时间轴
    console.log('\n5. 事件时间轴:');
    if (bets.length > 0) {
      const firstBetTime = new Date(bets[0].created_at);
      const lastBetTime = new Date(bets[bets.length - 1].created_at);
      console.log(`  首笔下注: ${firstBetTime.toLocaleTimeString()}`);
      console.log(`  末笔下注: ${lastBetTime.toLocaleTimeString()}`);
      
      if (bets[0].settled_at) {
        const settleTime = new Date(bets[0].settled_at);
        console.log(`  结算时间: ${settleTime.toLocaleTimeString()}`);
        const timeDiff = (settleTime - lastBetTime) / 1000;
        console.log(`  下注到结算: ${timeDiff} 秒`);
      }
      
      if (drawResult) {
        const drawTime = new Date(drawResult.created_at);
        console.log(`  开奖时间: ${drawTime.toLocaleTimeString()}`);
      }
    }
    
    // 6. 检查最近的系统活动
    console.log('\n6. 检查该时段的系统活动:');
    
    // 检查前后5分钟的其他期号
    const nearbyPeriods = await db.any(`
      SELECT 
        period,
        COUNT(*) as bet_count,
        SUM(CASE WHEN settled THEN 1 ELSE 0 END) as settled_count,
        MIN(created_at) as first_bet,
        MAX(settled_at) as last_settle
      FROM bet_history
      WHERE created_at >= $1::timestamp - INTERVAL '5 minutes'
        AND created_at <= $1::timestamp + INTERVAL '5 minutes'
      GROUP BY period
      ORDER BY period
    `, [bets[0]?.created_at || new Date()]);
    
    console.log('  附近期号的结算情况:');
    nearbyPeriods.forEach(p => {
      const status = p.settled_count === p.bet_count ? '✅ 已结算' : '⚠️ 部分结算';
      console.log(`    期号 ${p.period}: ${p.bet_count} 笔下注, ${status}`);
    });
    
    // 检查这些期号的退水情况
    const periodList = nearbyPeriods.map(p => p.period);
    if (periodList.length > 0) {
      const rebateStatus = await db.any(`
        SELECT 
          period,
          COUNT(*) as rebate_count
        FROM transaction_records
        WHERE period = ANY($1::text[])
          AND transaction_type = 'rebate'
        GROUP BY period
      `, [periodList]);
      
      console.log('\n  这些期号的退水情况:');
      periodList.forEach(p => {
        const rebate = rebateStatus.find(r => r.period === p);
        const status = rebate ? `✅ 有退水 (${rebate.rebate_count} 笔)` : '❌ 无退水';
        console.log(`    期号 ${p}: ${status}`);
      });
    }
    
    // 7. 分析可能的原因
    console.log('\n7. 分析可能的原因:');
    
    if (bets.every(b => b.settled)) {
      console.log('  ⚠️ 所有投注都已结算');
      console.log('  - 可能在 settleBets 调用时已经被结算');
      console.log('  - enhancedSettlement 应该要检查并处理退水');
    }
    
    if (!settlementLog) {
      console.log('  ⚠️ 没有结算日志');
      console.log('  - 可能使用了其他结算系统');
      console.log('  - 或者 enhancedSettlement 在没有未结算投注时跳过了日志记录');
    }
    
    if (rebates.length === 0) {
      console.log('  ❌ 没有退水记录');
      console.log('  - 退水处理可能失败了');
      console.log('  - 或者根本没有触发退水检查');
    }
    
    // 8. 检查系统是否已经更新
    console.log('\n8. 检查系统版本:');
    console.log('  请确认 enhanced-settlement-system.js 是否包含最新的修复');
    console.log('  修复应该在没有未结算投注时也检查退水');
    
    // 9. 建议
    console.log('\n9. 建议:');
    if (rebates.length === 0 && totalAmount > 0) {
      console.log('  可以手动处理退水:');
      console.log(`  node process-single-period-rebate.js ${period}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  }
}

checkPeriod041Detailed();