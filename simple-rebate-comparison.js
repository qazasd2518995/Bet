import db from './db/config.js';

async function simpleRebateComparison() {
  try {
    console.log('=== 比较期号 20250716109 和 20250716121 的退水金额 ===\n');
    
    const periods = ['20250716109', '20250716121'];
    const results = {};
    
    for (const period of periods) {
      console.log(`\n期号 ${period}:`);
      console.log('='.repeat(50));
      
      // 1. 检查下注记录
      const bets = await db.any(`
        SELECT 
          id,
          username,
          amount,
          bet_type,
          bet_value,
          win,
          win_amount,
          settled
        FROM bet_history
        WHERE period = $1
      `, [period]);
      
      console.log(`下注记录: ${bets.length} 笔`);
      let totalBetAmount = 0;
      bets.forEach(bet => {
        console.log(`  - ${bet.username}: $${bet.amount} (${bet.bet_type}-${bet.bet_value}) ${bet.win ? '赢' : '输'}`);
        totalBetAmount += parseFloat(bet.amount);
      });
      console.log(`总下注金额: $${totalBetAmount.toFixed(2)}`);
      
      // 2. 检查退水记录
      const rebates = await db.any(`
        SELECT 
          tr.user_id,
          tr.amount,
          tr.created_at,
          a.username as agent_username,
          a.level as agent_level
        FROM transaction_records tr
        LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
        WHERE tr.period = $1 
          AND tr.transaction_type = 'rebate'
        ORDER BY tr.amount DESC
      `, [period]);
      
      console.log(`\n退水记录: ${rebates.length} 笔`);
      let totalRebateAmount = 0;
      rebates.forEach(rebate => {
        console.log(`  - ${rebate.agent_username} (层级 ${rebate.agent_level}): $${rebate.amount}`);
        totalRebateAmount += parseFloat(rebate.amount);
      });
      console.log(`总退水金额: $${totalRebateAmount.toFixed(2)}`);
      
      // 计算退水率
      const rebateRate = totalBetAmount > 0 ? (totalRebateAmount / totalBetAmount * 100).toFixed(2) : 0;
      console.log(`退水率: ${rebateRate}%`);
      
      // 保存结果
      results[period] = {
        bets: bets.length,
        totalBet: totalBetAmount,
        rebates: rebates.length,
        totalRebate: totalRebateAmount,
        rebateRate: parseFloat(rebateRate),
        rebateDetails: rebates
      };
    }
    
    // 比较分析
    console.log('\n\n=== 分析结果 ===');
    console.log('\n1. 退水金额比较:');
    periods.forEach(period => {
      const r = results[period];
      console.log(`   期号 ${period}: 退水 $${r.totalRebate.toFixed(2)} / 下注 $${r.totalBet.toFixed(2)} = ${r.rebateRate}%`);
    });
    
    console.log('\n2. 退水计算错误分析:');
    
    // 检查每个代理的退水是否正确
    for (const period of periods) {
      if (results[period].rebateDetails.length > 0) {
        console.log(`\n   期号 ${period} 各代理退水明细:`);
        results[period].rebateDetails.forEach(rebate => {
          // 根据层级计算预期退水
          let expectedRate = 0;
          switch(rebate.agent_level) {
            case 0: expectedRate = 0.6; break;  // 总代理
            case 1: expectedRate = 0.5; break;  // 大股东
            case 2: expectedRate = 0.4; break;  // 股东
            case 3: expectedRate = 0.3; break;  // 总代理
            case 4: expectedRate = 0.2; break;  // 代理
          }
          
          const expectedRebate = (results[period].totalBet * expectedRate / 100).toFixed(2);
          const isCorrect = Math.abs(parseFloat(rebate.amount) - parseFloat(expectedRebate)) < 0.01;
          
          console.log(`     ${rebate.agent_username} (层级${rebate.agent_level}): `);
          console.log(`       实际退水: $${rebate.amount}`);
          console.log(`       预期退水: $${expectedRebate} (${expectedRate}%)`);
          console.log(`       ${isCorrect ? '✅ 正确' : '❌ 错误'}`);
        });
      }
    }
    
    console.log('\n3. 问题总结:');
    if (results['20250716109'].totalRebate > 0 && results['20250716121'].totalRebate === 0) {
      console.log('   - 期号 20250716121 没有退水记录，可能是退水处理失败');
    } else if (results['20250716109'].rebateRate !== results['20250716121'].rebateRate) {
      console.log('   - 两个期号的退水率不同，可能存在计算错误');
    } else {
      console.log('   - 两个期号的退水计算看起来一致');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('查询过程中发生错误:', error);
    process.exit(1);
  }
}

simpleRebateComparison();