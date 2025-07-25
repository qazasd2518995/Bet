import db from './db/config.js';

async function checkProcessRebatesCalls() {
  try {
    console.log('=== 检查 processRebates 是否被重复调用 ===\n');
    
    const period = '20250716001';
    
    // 1. 检查该期的所有退水记录及其时间
    console.log('1. 该期所有退水记录的详细时间戳:');
    const allRebates = await db.any(`
      SELECT 
        tr.id,
        tr.user_type,
        tr.user_id,
        tr.amount,
        tr.description,
        tr.created_at,
        a.username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at, tr.id
    `, [period]);
    
    console.log(`找到 ${allRebates.length} 笔退水记录:`);
    allRebates.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ID=${r.id} ${r.username} $${r.amount} at ${r.created_at}`);
    });
    
    // 2. 检查是否有其他期号但描述中包含此会员的退水
    console.log('\n2. 检查是否有其他相关退水记录:');
    const relatedRebates = await db.any(`
      SELECT 
        tr.id,
        tr.period,
        tr.amount,
        tr.description,
        tr.created_at,
        a.username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.transaction_type = 'rebate'
        AND tr.description LIKE '%justin111%'
        AND tr.created_at >= '2025-07-16'::date
      ORDER BY tr.created_at
    `);
    
    console.log(`找到 ${relatedRebates.length} 笔相关退水记录:`);
    relatedRebates.forEach(r => {
      console.log(`  期号 ${r.period}: ${r.username} $${r.amount} - ${r.description} (${r.created_at})`);
    });
    
    // 3. 检查代理余额变动记录
    console.log('\n3. 代理余额变动记录 (2025-07-16):');
    const balanceChanges = await db.any(`
      SELECT 
        tr.*,
        a.username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id AND tr.user_type = 'agent'
      WHERE a.username IN ('justin2025A', 'ti2025A')
        AND tr.created_at >= '2025-07-16'::date
      ORDER BY a.username, tr.created_at
    `);
    
    let currentBalances = {
      'justin2025A': null,
      'ti2025A': null
    };
    
    balanceChanges.forEach(tr => {
      const prevBalance = currentBalances[tr.username] !== null ? currentBalances[tr.username] : parseFloat(tr.balance_before);
      const balanceChange = parseFloat(tr.balance_after) - prevBalance;
      
      console.log(`  ${tr.username}:`);
      console.log(`    时间: ${tr.created_at}`);
      console.log(`    类型: ${tr.transaction_type}`);
      console.log(`    金额: $${tr.amount}`);
      console.log(`    余额变化: $${prevBalance.toFixed(2)} → $${parseFloat(tr.balance_after).toFixed(2)} (${balanceChange > 0 ? '+' : ''}${balanceChange.toFixed(2)})`);
      console.log(`    描述: ${tr.description}`);
      console.log('');
      
      currentBalances[tr.username] = parseFloat(tr.balance_after);
    });
    
    // 4. 检查结算日志
    console.log('4. 检查结算日志:');
    const settlementLogs = await db.any(`
      SELECT *
      FROM settlement_logs
      WHERE period = $1
      ORDER BY created_at
    `, [period]);
    
    if (settlementLogs.length > 0) {
      console.log(`  找到 ${settlementLogs.length} 笔结算记录:`);
      settlementLogs.forEach(log => {
        console.log(`    ${log.created_at}: 结算 ${log.settled_count} 笔，总中奖 $${log.total_win_amount}`);
      });
    } else {
      console.log('  没有找到结算日志记录');
    }
    
    // 5. 总结分析
    console.log('\n5. 分析总结:');
    const uniquePeriods = [...new Set(allRebates.map(r => r.created_at.toISOString()))];
    if (uniquePeriods.length > 1) {
      console.log(`  ⚠️ 发现退水记录在不同时间创建，可能被多次处理:`);
      uniquePeriods.forEach(time => {
        console.log(`    - ${time}`);
      });
    } else {
      console.log(`  ✅ 所有退水记录都在同一时间创建`);
    }
    
    // 检查余额变化是否异常
    const justin2025AChanges = balanceChanges.filter(tr => tr.username === 'justin2025A' && tr.transaction_type === 'rebate');
    const ti2025AChanges = balanceChanges.filter(tr => tr.username === 'ti2025A' && tr.transaction_type === 'rebate');
    
    console.log(`\n  justin2025A 退水记录: ${justin2025AChanges.length} 笔`);
    console.log(`  ti2025A 退水记录: ${ti2025AChanges.length} 笔`);
    
    if (justin2025AChanges.length > 1 || ti2025AChanges.length > 1) {
      console.log('\n  ⚠️ 发现多笔退水记录，可能存在重复处理!');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('检查过程中发生错误:', error);
    process.exit(1);
  }
}

checkProcessRebatesCalls();