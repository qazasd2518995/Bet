import db from './db/config.js';

async function analyzeRebateTriggerIssue() {
  try {
    console.log('=== 分析退水机制未触发问题 ===');
    console.log('期号: 20250716001');
    console.log('用户: justin111');
    console.log('下注: 2笔 x $1000 = $2000\n');
    
    // 1. 检查下注记录
    console.log('1. 检查下注记录:');
    const bets = await db.any(`
      SELECT id, username, amount, bet_type, bet_value, position, odds, 
             settled, win, created_at, settled_at
      FROM bet_history 
      WHERE period = $1 
      ORDER BY created_at DESC
    `, ['20250716001']);
    
    console.log(`找到 ${bets.length} 笔下注记录:`);
    for (const bet of bets) {
      console.log(`\n  ID: ${bet.id}`);
      console.log(`  用户: ${bet.username}`);
      console.log(`  类型: ${bet.bet_type} - ${bet.bet_value}`);
      console.log(`  金额: ${bet.amount}`);
      console.log(`  赔率: ${bet.odds}`);
      console.log(`  已结算: ${bet.settled ? '是' : '否'}`);
      console.log(`  中奖: ${bet.win ? '是' : '否'}`);
      console.log(`  下注时间: ${bet.created_at}`);
      console.log(`  结算时间: ${bet.settled_at || '未结算'}`);
    }
    
    // 2. 检查开奖结果
    console.log('\n2. 检查开奖结果:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = $1
    `, ['20250716001']);
    
    if (drawResult) {
      console.log(`  开奖时间: ${drawResult.created_at}`);
      console.log(`  开奖结果: ${JSON.stringify(drawResult.result)}`);
    } else {
      console.log('  ⚠️ 该期号尚未开奖');
    }
    
    // 3. 检查退水记录
    console.log('\n3. 检查退水记录:');
    const rebates = await db.any(`
      SELECT * FROM transaction_records 
      WHERE transaction_type = 'rebate' 
        AND period = $1
    `, ['20250716001']);
    
    console.log(`  找到 ${rebates.length} 笔退水记录`);
    if (rebates.length === 0) {
      console.log('  ❌ 没有任何退水记录');
    }
    
    // 4. 分析结算系统调用情况
    console.log('\n4. 分析可能的原因:');
    
    // 检查是否所有注单都已结算
    const unsettledCount = bets.filter(b => !b.settled).length;
    if (unsettledCount > 0) {
      console.log(`  ⚠️ 有 ${unsettledCount} 笔注单未结算`);
    }
    
    // 检查结算时间与开奖时间的关系
    if (drawResult && bets.length > 0) {
      const firstSettledBet = bets.find(b => b.settled_at);
      if (firstSettledBet) {
        const drawTime = new Date(drawResult.created_at);
        const settleTime = new Date(firstSettledBet.settled_at);
        const timeDiff = (settleTime - drawTime) / 1000;
        console.log(`  结算延迟: ${timeDiff} 秒`);
      }
    }
    
    // 5. 检查结算系统的退水处理逻辑
    console.log('\n5. 检查退水处理逻辑调用:');
    
    // 查看最近的系统日志（如果有的话）
    console.log('  检查 enhanced-settlement-system.js 中的退水处理逻辑...');
    console.log('  - processRebates 函数应该在结算成功后被调用');
    console.log('  - 需要检查 enhancedSettlement 函数是否正确调用了 processRebates');
    
    // 6. 手动检查退水条件
    console.log('\n6. 手动检查退水条件:');
    const settledBets = bets.filter(b => b.settled);
    if (settledBets.length > 0) {
      const totalAmount = settledBets.reduce((sum, b) => sum + parseFloat(b.amount), 0);
      console.log(`  已结算金额: $${totalAmount}`);
      console.log(`  应产生退水: $${(totalAmount * 0.011).toFixed(2)} (1.1%)`);
      console.log(`  - justin2025A 应得: $${(totalAmount * 0.005).toFixed(2)} (0.5%)`);
      console.log(`  - ti2025A 应得: $${(totalAmount * 0.006).toFixed(2)} (0.6%)`);
    }
    
    // 7. 建议解决方案
    console.log('\n7. 问题分析结论:');
    console.log('  可能的原因:');
    console.log('  1. 结算系统没有正确调用退水处理函数');
    console.log('  2. 退水处理函数中的条件检查过于严格');
    console.log('  3. 结算流程可能被中断或出错');
    console.log('  4. 资料库事务可能回滚了退水操作');
    
    process.exit(0);
    
  } catch (error) {
    console.error('分析过程中发生错误:', error);
    process.exit(1);
  }
}

analyzeRebateTriggerIssue();