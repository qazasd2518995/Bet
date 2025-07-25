import db from './db/config.js';

async function checkPeriod109Logic() {
  try {
    console.log('=== 检查期号 20250716109 退水逻辑 ===\n');
    
    const period = '20250716109';
    
    // 1. 基本资讯
    console.log('1. 下注资讯:');
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
      ORDER BY created_at
    `, [period]);
    
    if (bets.length === 0) {
      console.log('  ❌ 没有找到下注记录');
      process.exit(0);
    }
    
    bets.forEach(bet => {
      console.log(`  ID ${bet.id}: ${bet.username}`);
      console.log(`    下注: $${bet.amount} on ${bet.bet_type} - ${bet.bet_value}`);
      console.log(`    时间: ${new Date(bet.created_at).toLocaleTimeString()}`);
      console.log(`    结算: ${bet.settled ? '✅' : '❌'} ${bet.settled_at ? `at ${new Date(bet.settled_at).toLocaleTimeString()}` : ''}`);
    });
    
    // 2. 检查系统时间线
    console.log('\n2. 系统时间线:');
    
    // 后端重启时间
    console.log('  后端重启时间: 9:43-9:44 AM');
    console.log('  期号 109 下注时间: 10:16 AM');
    console.log('  ✅ 此期号使用的是新版本程式码');
    
    // 3. 检查开奖和结算
    console.log('\n3. 开奖和结算状态:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history
      WHERE period = $1
    `, [period]);
    
    if (drawResult) {
      console.log(`  ✅ 已开奖: ${drawResult.result}`);
      console.log(`  开奖时间: ${new Date(drawResult.created_at).toLocaleTimeString()}`);
    } else {
      console.log('  ❌ 未找到开奖记录');
    }
    
    // 4. 检查结算日志
    console.log('\n4. 结算系统日志:');
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = $1
    `, [period]);
    
    if (settlementLog) {
      console.log('  ✅ 有结算日志 (使用了 enhancedSettlement)');
      console.log(`    时间: ${settlementLog.created_at}`);
      console.log(`    结算笔数: ${settlementLog.settled_count}`);
    } else {
      console.log('  ❌ 无结算日志');
    }
    
    // 5. 检查退水记录
    console.log('\n5. 退水记录:');
    const rebates = await db.any(`
      SELECT 
        tr.*,
        a.username as agent_username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
    `, [period]);
    
    if (rebates.length > 0) {
      console.log(`  ✅ 找到 ${rebates.length} 笔退水记录:`);
      rebates.forEach(r => {
        console.log(`    ${r.agent_username}: $${r.amount}`);
      });
    } else {
      console.log('  ❌ 没有退水记录');
    }
    
    // 6. 检查后端日志
    console.log('\n6. 检查后端日志 (backend.log):');
    console.log('  查找关键字:');
    console.log('  - "期号 20250716109"');
    console.log('  - "没有未结算的投注"');
    console.log('  - "发现已结算但未处理退水"');
    console.log('  - "退水处理失败"');
    
    // 7. 分析可能原因
    console.log('\n7. 可能的原因:');
    
    if (bets.every(b => b.settled)) {
      console.log('  ⚠️ 所有投注都已结算');
      
      if (!settlementLog) {
        console.log('  ⚠️ 没有结算日志 - 可能未使用 enhancedSettlement');
        console.log('  - 可能 enhancedSettlement 发生错误并降级到其他系统');
        console.log('  - 需要检查后端日志中的错误讯息');
      }
      
      if (!rebates.length) {
        console.log('  ❌ 没有退水记录');
        console.log('  - 修复的退水检查可能失败了');
        console.log('  - 或者有错误被捕获但未正确处理');
      }
    }
    
    // 8. 检查是否正在处理中
    console.log('\n8. 检查当前状态:');
    const currentTime = new Date();
    const betTime = bets[0] ? new Date(bets[0].created_at) : currentTime;
    const timeDiff = (currentTime - betTime) / 1000 / 60;
    
    console.log(`  下注至今: ${timeDiff.toFixed(1)} 分钟`);
    if (timeDiff < 5) {
      console.log('  ℹ️ 可能还在处理中，请稍后再检查');
    }
    
    // 9. 手动检查修复是否生效
    console.log('\n9. 验证修复程式码:');
    console.log('  执行: grep -n "发现已结算但未处理退水" enhanced-settlement-system.js');
    console.log('  应该要看到两处这个日志讯息');
    
    process.exit(0);
    
  } catch (error) {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  }
}

checkPeriod109Logic();