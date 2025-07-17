import db from './db/config.js';

async function checkRecentRebates() {
  try {
    console.log('=== 檢查最近的退水記錄 ===');
    
    // 檢查最近的交易記錄
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
    
    console.log(`找到 ${recentRebates.length} 筆最近24小時的退水記錄`);
    
    // 按期號分組顯示
    const rebatesByPeriod = {};
    for (const rebate of recentRebates) {
      const period = rebate.period || '未知期號';
      if (!rebatesByPeriod[period]) {
        rebatesByPeriod[period] = [];
      }
      rebatesByPeriod[period].push(rebate);
    }
    
    // 顯示每期的退水記錄
    for (const [period, rebates] of Object.entries(rebatesByPeriod)) {
      console.log(`\n期號 ${period}:`);
      
      // 計算該期退水總額
      const periodTotal = rebates.reduce((sum, r) => sum + parseFloat(r.amount), 0);
      
      for (const rebate of rebates) {
        console.log(`  ${rebate.created_at.toISOString()}: ${rebate.username} 獲得退水 ${rebate.amount} 元 - ${rebate.description}`);
      }
      
      console.log(`  該期退水總額: ${periodTotal.toFixed(2)} 元`);
    }
    
    // 檢查是否有重複退水
    console.log('\n=== 檢查重複退水 ===');
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
      console.log('發現重複退水記錄:');
      for (const dup of duplicates) {
        const user = await db.oneOrNone(
          dup.user_type === 'agent' 
            ? 'SELECT username FROM agents WHERE id = $1'
            : 'SELECT username FROM members WHERE id = $1',
          [dup.user_id]
        );
        console.log(`期號 ${dup.period}: ${user?.username || '未知'} 收到 ${dup.count} 次退水，總額 ${dup.total_amount} 元`);
        console.log(`  描述: ${dup.descriptions}`);
      }
    } else {
      console.log('沒有發現重複退水記錄');
    }
    
    // 檢查特定用戶的退水詳情
    console.log('\n=== ti2025A 最近的退水詳情 ===');
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
      console.log(`${rebate.created_at.toISOString()}: 期號${rebate.period || '未知'}, 金額=${rebate.amount}, 描述=${rebate.description}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkRecentRebates();