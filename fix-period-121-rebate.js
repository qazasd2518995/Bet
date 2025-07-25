import db from './db/config.js';

async function fixPeriod121Rebate() {
  try {
    console.log('=== 修复期号 20250716121 的退水错误 ===\n');
    
    const period = '20250716121';
    
    // 1. 检查当前的错误退水记录
    console.log('1. 检查当前错误的退水记录:');
    const currentRebates = await db.any(`
      SELECT 
        tr.id,
        tr.amount,
        tr.rebate_percentage,
        a.username as agent_username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
      WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
      ORDER BY tr.amount DESC
    `, [period]);
    
    if (currentRebates.length === 0) {
      console.log('  ❌ 没有找到退水记录');
      process.exit(0);
    }
    
    console.log('  当前错误的退水记录:');
    let totalWrongRebate = 0;
    currentRebates.forEach(r => {
      console.log(`    ${r.agent_username}: $${r.amount} (${r.rebate_percentage}%)`);
      totalWrongRebate += parseFloat(r.amount);
    });
    console.log(`  错误总额: $${totalWrongRebate.toFixed(2)}\n`);
    
    // 2. 计算正确的退水金额
    console.log('2. 计算正确的退水金额:');
    const betInfo = await db.oneOrNone(`
      SELECT username, amount 
      FROM bet_history 
      WHERE period = $1 AND settled = true
    `, [period]);
    
    if (!betInfo) {
      console.log('  ❌ 没有找到下注记录');
      process.exit(0);
    }
    
    const betAmount = parseFloat(betInfo.amount);
    console.log(`  下注会员: ${betInfo.username}`);
    console.log(`  下注金额: $${betAmount}`);
    
    // A盘 1.1% 退水
    const maxRebatePercentage = 0.011;
    const totalCorrectRebate = betAmount * maxRebatePercentage;
    console.log(`  应得总退水: $${totalCorrectRebate} (${(maxRebatePercentage*100).toFixed(1)}%)`);
    
    // 正确的分配：justin2025A: 0.5%, ti2025A: 0.6%
    const correctRebates = [
      { username: 'justin2025A', percentage: 0.005, amount: betAmount * 0.005 },
      { username: 'ti2025A', percentage: 0.006, amount: betAmount * 0.006 }
    ];
    
    console.log(`  正确的退水分配:`);
    correctRebates.forEach(r => {
      console.log(`    ${r.username}: $${r.amount.toFixed(2)} (${(r.percentage*100).toFixed(1)}%)`);
    });
    console.log(`  正确总额: $${correctRebates.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}\n`);
    
    // 3. 提供修复选项
    console.log('3. 修复选项:');
    console.log('  A) 删除错误记录并重新处理退水');
    console.log('  B) 补发差额退水');
    console.log('  C) 仅显示分析结果，不做修复\n');
    
    console.log('选择 A - 完全重新处理退水...\n');
    
    // 4. 执行修复 (选项 A)
    await db.tx(async t => {
      // 4.1 删除错误的退水记录
      console.log('4.1 删除错误的退水记录...');
      const deletedRebates = await t.any(`
        DELETE FROM transaction_records 
        WHERE period = $1 AND transaction_type = 'rebate'
        RETURNING id, user_id, amount
      `, [period]);
      
      console.log(`  ✅ 已删除 ${deletedRebates.length} 笔错误记录`);
      
      // 4.2 回退代理余额
      console.log('4.2 回退代理余额...');
      for (const deleted of deletedRebates) {
        await t.none(`
          UPDATE agents 
          SET balance = balance - $1 
          WHERE id = $2
        `, [parseFloat(deleted.amount), deleted.user_id]);
        console.log(`  ✅ 已回退代理 ID ${deleted.user_id} 的余额 $${deleted.amount}`);
      }
    });
    
    console.log('\n5. 重新处理退水...');
    
    // 5. 重新处理退水
    const { processRebates } = await import('./enhanced-settlement-system.js');
    await processRebates(period);
    
    console.log('✅ 退水修复完成！\n');
    
    // 6. 验证修复结果
    console.log('6. 验证修复结果:');
    const newRebates = await db.any(`
      SELECT 
        tr.amount,
        a.username as agent_username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
      WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
      ORDER BY tr.amount DESC
    `, [period]);
    
    console.log('  修复后的退水记录:');
    let totalNewRebate = 0;
    newRebates.forEach(r => {
      console.log(`    ${r.agent_username}: $${r.amount}`);
      totalNewRebate += parseFloat(r.amount);
    });
    console.log(`  新总额: $${totalNewRebate.toFixed(2)}`);
    
    if (Math.abs(totalNewRebate - totalCorrectRebate) < 0.01) {
      console.log('  ✅ 退水金额正确！');
    } else {
      console.log('  ⚠️ 退水金额仍不正确');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('修复过程中发生错误:', error);
    process.exit(1);
  }
}

fixPeriod121Rebate();