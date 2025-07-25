import db from './db/config.js';

async function checkDoubleRebateIssue() {
  try {
    console.log('=== 检查退水双倍计算问题 ===\n');
    
    // 1. 检查期号 20250716001 的所有退水记录
    console.log('1. 期号 20250716001 的详细退水记录:');
    const rebateDetails = await db.any(`
      SELECT 
        tr.id,
        tr.user_type,
        tr.user_id,
        tr.amount,
        tr.description,
        tr.created_at,
        CASE 
          WHEN tr.user_type = 'agent' THEN a.username
          ELSE 'unknown'
        END as username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at, tr.id
    `, ['20250716001']);
    
    console.log(`找到 ${rebateDetails.length} 笔退水记录:`);
    rebateDetails.forEach((r, idx) => {
      console.log(`\n记录 ${idx + 1}:`);
      console.log(`  ID: ${r.id}`);
      console.log(`  用户: ${r.username} (ID: ${r.user_id})`);
      console.log(`  金额: $${r.amount}`);
      console.log(`  描述: ${r.description}`);
      console.log(`  时间: ${r.created_at}`);
    });
    
    // 2. 检查该期的下注记录
    console.log('\n\n2. 期号 20250716001 的下注记录:');
    const bets = await db.any(`
      SELECT username, COUNT(*) as bet_count, SUM(amount) as total_amount
      FROM bet_history
      WHERE period = $1
      GROUP BY username
    `, ['20250716001']);
    
    bets.forEach(b => {
      console.log(`  ${b.username}: ${b.bet_count} 笔，总额 $${b.total_amount}`);
      console.log(`    应产生退水: $${(parseFloat(b.total_amount) * 0.011).toFixed(2)} (1.1%)`);
      console.log(`    - justin2025A 应得: $${(parseFloat(b.total_amount) * 0.005).toFixed(2)} (0.5%)`);
      console.log(`    - ti2025A 应得: $${(parseFloat(b.total_amount) * 0.006).toFixed(2)} (0.6%)`);
    });
    
    // 3. 分析问题
    console.log('\n\n3. 问题分析:');
    
    // 检查是否有重复的退水记录
    const duplicateCheck = await db.any(`
      SELECT 
        user_id,
        user_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM transaction_records
      WHERE period = $1 
        AND transaction_type = 'rebate'
      GROUP BY user_id, user_type
      HAVING COUNT(*) > 1
    `, ['20250716001']);
    
    if (duplicateCheck.length > 0) {
      console.log('⚠️ 发现重复退水:');
      duplicateCheck.forEach(d => {
        console.log(`  User ID ${d.user_id}: ${d.count} 笔，总额 $${d.total_amount}`);
      });
    } else {
      console.log('✅ 没有发现重复退水记录');
    }
    
    // 4. 检查退水处理的呼叫次数
    console.log('\n4. 检查可能的原因:');
    console.log('  a) processRebates 可能被调用了两次');
    console.log('  b) 检查是否有多笔相同金额的下注被误判为一笔');
    
    // 检查详细的下注记录
    console.log('\n5. 详细下注记录:');
    const detailedBets = await db.any(`
      SELECT id, username, amount, bet_type, bet_value, created_at
      FROM bet_history
      WHERE period = $1
      ORDER BY created_at
    `, ['20250716001']);
    
    detailedBets.forEach(b => {
      console.log(`  ID ${b.id}: ${b.username} 下注 $${b.amount} (${b.bet_type}: ${b.bet_value}) at ${b.created_at}`);
    });
    
    // 5. 计算实际应该的退水
    console.log('\n\n6. 正确的退水计算:');
    const totalBetAmount = bets.reduce((sum, b) => sum + parseFloat(b.total_amount), 0);
    console.log(`总下注金额: $${totalBetAmount}`);
    console.log(`总退水池 (1.1%): $${(totalBetAmount * 0.011).toFixed(2)}`);
    console.log(`justin2025A 应得 (0.5%): $${(totalBetAmount * 0.005).toFixed(2)}`);
    console.log(`ti2025A 应得 (0.6%): $${(totalBetAmount * 0.006).toFixed(2)}`);
    
    // 6. 检查实际退水总额
    const actualRebates = await db.any(`
      SELECT 
        a.username,
        SUM(tr.amount) as total_rebate
      FROM transaction_records tr
      JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 AND tr.transaction_type = 'rebate'
      GROUP BY a.username
    `, ['20250716001']);
    
    console.log('\n实际退水总额:');
    actualRebates.forEach(r => {
      console.log(`  ${r.username}: $${r.total_rebate}`);
    });
    
    process.exit(0);
    
  } catch (error) {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  }
}

checkDoubleRebateIssue();