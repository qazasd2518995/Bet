import db from './db/config.js';

async function checkRecentRebates() {
  try {
    console.log('=== 检查最近的退水记录 ===');
    
    // 检查最近的交易记录
    const recentRebates = await db.any(`
      SELECT 
        tr.id,
        tr.user_type,
        tr.user_id,
        tr.transaction_type,
        tr.amount,
        tr.description,
        tr.period,
        tr.created_at,
        CASE 
          WHEN tr.user_type = 'agent' THEN a.username
          WHEN tr.user_type = 'member' THEN m.username
        END as username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      LEFT JOIN members m ON tr.user_type = 'member' AND tr.user_id = m.id
      WHERE tr.transaction_type = 'rebate'
        AND tr.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY tr.created_at DESC
      LIMIT 20
    `);
    
    console.log(`找到 ${recentRebates.length} 笔最近24小时的退水记录`);
    
    // 按期号分组显示
    const rebatesByPeriod = {};
    for (const rebate of recentRebates) {
      const period = rebate.period || '未知期号';
      if (!rebatesByPeriod[period]) {
        rebatesByPeriod[period] = [];
      }
      rebatesByPeriod[period].push(rebate);
    }
    
    // 显示每期的退水记录
    for (const [period, rebates] of Object.entries(rebatesByPeriod)) {
      console.log(`\n期号 ${period}:`);
      
      // 计算该期退水总额
      const periodTotal = rebates.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      
      for (const rebate of rebates) {
        console.log(`  ${rebate.created_at.toISOString()}: ${rebate.username} 获得退水 ${rebate.amount} 元 - ${rebate.description}`);
      }
      
      console.log(`  该期退水总额: ${periodTotal.toFixed(2)} 元`);
    }
    
    // 检查是否有重复退水
    console.log('\n=== 检查重复退水 ===');
    const duplicates = await db.any(`
      SELECT 
        period,
        user_id,
        user_type,
        COUNT(*) as count,
        SUM(amount) as total_amount,
        STRING_AGG(description, ' | ') as descriptions
      FROM transaction_records
      WHERE transaction_type = 'rebate'
        AND created_at > NOW() - INTERVAL '24 hours'
        AND period IS NOT NULL
      GROUP BY period, user_id, user_type
      HAVING COUNT(*) > 1
      ORDER BY period DESC
    `);
    
    if (duplicates.length > 0) {
      console.log('发现重复退水记录:');
      for (const dup of duplicates) {
        const user = await db.oneOrNone(
          dup.user_type === 'agent' 
            ? 'SELECT username FROM agents WHERE id = $1'
            : 'SELECT username FROM members WHERE id = $1',
          [dup.user_id]
        );
        console.log(`期号 ${dup.period}: ${user?.username || '未知'} 收到 ${dup.count} 次退水，总额 ${dup.total_amount} 元`);
        console.log(`  描述: ${dup.descriptions}`);
      }
    } else {
      console.log('没有发现重复退水记录');
    }
    
    // 检查特定用户的退水详情
    console.log('\n=== ti2025A 最近的退水详情 ===');
    const ti2025ARebates = await db.any(`
      SELECT 
        tr.*,
        a.username
      FROM transaction_records tr
      JOIN agents a ON tr.user_id = a.id
      WHERE tr.user_type = 'agent'
        AND a.username = 'ti2025A'
        AND tr.transaction_type = 'rebate'
        AND tr.created_at > NOW() - INTERVAL '24 hours'
      ORDER BY tr.created_at DESC
      LIMIT 10
    `);
    
    for (const rebate of ti2025ARebates) {
      console.log(`${rebate.created_at.toISOString()}: 期号${rebate.period || '未知'}, 金额=${rebate.amount}, 描述=${rebate.description}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

checkRecentRebates();