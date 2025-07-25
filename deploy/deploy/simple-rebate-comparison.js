import db from './db/config.js';

async function simpleRebateComparison() {
  try {
    console.log('=== 比較期號 20250716109 和 20250716121 的退水金額 ===\n');
    
    const periods = ['20250716109', '20250716121'];
    const results = {};
    
    for (const period of periods) {
      console.log(`\n期號 ${period}:`);
      console.log('='.repeat(50));
      
      // 1. 檢查下注記錄
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
      
      console.log(`下注記錄: ${bets.length} 筆`);
      let totalBetAmount = 0;
      bets.forEach(bet => {
        console.log(`  - ${bet.username}: $${bet.amount} (${bet.bet_type}-${bet.bet_value}) ${bet.win ? '贏' : '輸'}`);
        totalBetAmount += parseFloat(bet.amount);
      });
      console.log(`總下注金額: $${totalBetAmount.toFixed(2)}`);
      
      // 2. 檢查退水記錄
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
      
      console.log(`\n退水記錄: ${rebates.length} 筆`);
      let totalRebateAmount = 0;
      rebates.forEach(rebate => {
        console.log(`  - ${rebate.agent_username} (層級 ${rebate.agent_level}): $${rebate.amount}`);
        totalRebateAmount += parseFloat(rebate.amount);
      });
      console.log(`總退水金額: $${totalRebateAmount.toFixed(2)}`);
      
      // 計算退水率
      const rebateRate = totalBetAmount > 0 ? (totalRebateAmount / totalBetAmount * 100).toFixed(2) : 0;
      console.log(`退水率: ${rebateRate}%`);
      
      // 保存結果
      results[period] = {
        bets: bets.length,
        totalBet: totalBetAmount,
        rebates: rebates.length,
        totalRebate: totalRebateAmount,
        rebateRate: parseFloat(rebateRate),
        rebateDetails: rebates
      };
    }
    
    // 比較分析
    console.log('\n\n=== 分析結果 ===');
    console.log('\n1. 退水金額比較:');
    periods.forEach(period => {
      const r = results[period];
      console.log(`   期號 ${period}: 退水 $${r.totalRebate.toFixed(2)} / 下注 $${r.totalBet.toFixed(2)} = ${r.rebateRate}%`);
    });
    
    console.log('\n2. 退水計算錯誤分析:');
    
    // 檢查每個代理的退水是否正確
    for (const period of periods) {
      if (results[period].rebateDetails.length > 0) {
        console.log(`\n   期號 ${period} 各代理退水明細:`);
        results[period].rebateDetails.forEach(rebate => {
          // 根據層級計算預期退水
          let expectedRate = 0;
          switch(rebate.agent_level) {
            case 0: expectedRate = 0.6; break;  // 總代理
            case 1: expectedRate = 0.5; break;  // 大股東
            case 2: expectedRate = 0.4; break;  // 股東
            case 3: expectedRate = 0.3; break;  // 總代理
            case 4: expectedRate = 0.2; break;  // 代理
          }
          
          const expectedRebate = (results[period].totalBet * expectedRate / 100).toFixed(2);
          const isCorrect = Math.abs(parseFloat(rebate.amount) - parseFloat(expectedRebate)) < 0.01;
          
          console.log(`     ${rebate.agent_username} (層級${rebate.agent_level}): `);
          console.log(`       實際退水: $${rebate.amount}`);
          console.log(`       預期退水: $${expectedRebate} (${expectedRate}%)`);
          console.log(`       ${isCorrect ? '✅ 正確' : '❌ 錯誤'}`);
        });
      }
    }
    
    console.log('\n3. 問題總結:');
    if (results['20250716109'].totalRebate > 0 && results['20250716121'].totalRebate === 0) {
      console.log('   - 期號 20250716121 沒有退水記錄，可能是退水處理失敗');
    } else if (results['20250716109'].rebateRate !== results['20250716121'].rebateRate) {
      console.log('   - 兩個期號的退水率不同，可能存在計算錯誤');
    } else {
      console.log('   - 兩個期號的退水計算看起來一致');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('查詢過程中發生錯誤:', error);
    process.exit(1);
  }
}

simpleRebateComparison();