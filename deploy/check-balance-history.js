import db from './db/config.js';

async function checkBalanceHistory() {
  try {
    console.log('=== 检查余额历史记录 ===\n');
    
    // 检查用户报告的余额变化
    console.log('1. 用户报告的余额变化:');
    console.log('  justin2025A: 769.05 → 779.05 (增加10，应该增加5)');
    console.log('  ti2025A: 9,001,276.64 → 9,001,288.64 (增加12，应该增加6)');
    console.log('  用户期望是基於单笔1000元下注的退水，但系统是基于2000元总下注计算');
    
    // 查询余额变动历史
    console.log('\n2. 查询 2025-07-16 前后的所有余额变动:');
    
    const agents = ['justin2025A', 'ti2025A'];
    
    for (const agentName of agents) {
      console.log(`\n=== ${agentName} 的余额变动历史 ===`);
      
      const transactions = await db.any(`
        SELECT 
          tr.*,
          a.username
        FROM transaction_records tr
        JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
        WHERE a.username = $1
          AND tr.created_at >= '2025-07-15'::date
          AND tr.created_at <= '2025-07-17'::date
        ORDER BY tr.created_at
      `, [agentName]);
      
      console.log(`找到 ${transactions.length} 笔交易记录:`);
      
      let runningBalance = null;
      transactions.forEach((tr, idx) => {
        console.log(`\n  ${idx + 1}. ${tr.created_at}`);
        console.log(`     类型: ${tr.transaction_type}`);
        console.log(`     金额: $${tr.amount}`);
        console.log(`     余额: $${parseFloat(tr.balance_before).toFixed(2)} → $${parseFloat(tr.balance_after).toFixed(2)}`);
        console.log(`     描述: ${tr.description}`);
        console.log(`     期号: ${tr.period || 'N/A'}`);
        
        // 检查余额连续性
        if (runningBalance !== null && Math.abs(runningBalance - parseFloat(tr.balance_before)) > 0.01) {
          console.log(`     ⚠️ 余额不连续！预期: $${runningBalance.toFixed(2)}, 实际: $${parseFloat(tr.balance_before).toFixed(2)}`);
        }
        runningBalance = parseFloat(tr.balance_after);
      });
      
      // 查询当前余额
      const currentBalance = await db.oneOrNone(`
        SELECT balance FROM agents WHERE username = $1
      `, [agentName]);
      
      console.log(`\n  当前余额: $${currentBalance ? currentBalance.balance : 'N/A'}`);
      if (runningBalance !== null && currentBalance && Math.abs(runningBalance - parseFloat(currentBalance.balance)) > 0.01) {
        console.log(`  ⚠️ 最后交易余额与当前余额不符！`);
      }
    }
    
    // 3. 查询是否有隐藏或被删除的交易记录
    console.log('\n\n3. 检查是否有异常的退水记录:');
    const suspiciousRebates = await db.any(`
      SELECT 
        tr.id,
        tr.period,
        tr.amount,
        tr.created_at,
        tr.balance_before,
        tr.balance_after,
        a.username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
      WHERE tr.transaction_type = 'rebate'
        AND tr.created_at >= '2025-07-15'::date
        AND a.username IN ('justin2025A', 'ti2025A')
      ORDER BY tr.created_at
    `);
    
    console.log(`找到 ${suspiciousRebates.length} 笔退水记录:`);
    suspiciousRebates.forEach(r => {
      const balanceChange = parseFloat(r.balance_after) - parseFloat(r.balance_before);
      console.log(`  ID=${r.id} 期号=${r.period} ${r.username}: $${r.amount} (余额变化: ${balanceChange > 0 ? '+' : ''}${balanceChange.toFixed(2)}) at ${r.created_at}`);
      
      if (Math.abs(balanceChange - parseFloat(r.amount)) > 0.01) {
        console.log(`    ⚠️ 余额变化与退水金额不符！`);
      }
    });
    
    // 4. 检查是否有重复的退水但被合并显示
    console.log('\n4. 检查可能的问题原因:');
    console.log('  - 用户可能看到的是之前某次未记录的退水累积效果');
    console.log('  - 或者系统在某个时间点有手动调整余额的操作');
    console.log('  - 需要检查更早期的交易记录来确认');
    
    process.exit(0);
    
  } catch (error) {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  }
}

checkBalanceHistory();