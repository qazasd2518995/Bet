import db from './db/config.js';

async function checkProcessRebatesCalls() {
  try {
    console.log('=== 檢查 processRebates 是否被重複調用 ===\n');
    
    const period = '20250716001';
    
    // 1. 檢查該期的所有退水記錄及其時間
    console.log('1. 該期所有退水記錄的詳細時間戳:');
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
    
    console.log(`找到 ${allRebates.length} 筆退水記錄:`);
    allRebates.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ID=${r.id} ${r.username} $${r.amount} at ${r.created_at}`);
    });
    
    // 2. 檢查是否有其他期號但描述中包含此會員的退水
    console.log('\n2. 檢查是否有其他相關退水記錄:');
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
    
    console.log(`找到 ${relatedRebates.length} 筆相關退水記錄:`);
    relatedRebates.forEach(r => {
      console.log(`  期號 ${r.period}: ${r.username} $${r.amount} - ${r.description} (${r.created_at})`);
    });
    
    // 3. 檢查代理餘額變動記錄
    console.log('\n3. 代理餘額變動記錄 (2025-07-16):');
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
      console.log(`    時間: ${tr.created_at}`);
      console.log(`    類型: ${tr.transaction_type}`);
      console.log(`    金額: $${tr.amount}`);
      console.log(`    餘額變化: $${prevBalance.toFixed(2)} → $${parseFloat(tr.balance_after).toFixed(2)} (${balanceChange > 0 ? '+' : ''}${balanceChange.toFixed(2)})`);
      console.log(`    描述: ${tr.description}`);
      console.log('');
      
      currentBalances[tr.username] = parseFloat(tr.balance_after);
    });
    
    // 4. 檢查結算日誌
    console.log('4. 檢查結算日誌:');
    const settlementLogs = await db.any(`
      SELECT *
      FROM settlement_logs
      WHERE period = $1
      ORDER BY created_at
    `, [period]);
    
    if (settlementLogs.length > 0) {
      console.log(`  找到 ${settlementLogs.length} 筆結算記錄:`);
      settlementLogs.forEach(log => {
        console.log(`    ${log.created_at}: 結算 ${log.settled_count} 筆，總中獎 $${log.total_win_amount}`);
      });
    } else {
      console.log('  沒有找到結算日誌記錄');
    }
    
    // 5. 總結分析
    console.log('\n5. 分析總結:');
    const uniquePeriods = [...new Set(allRebates.map(r => r.created_at.toISOString()))];
    if (uniquePeriods.length > 1) {
      console.log(`  ⚠️ 發現退水記錄在不同時間創建，可能被多次處理:`);
      uniquePeriods.forEach(time => {
        console.log(`    - ${time}`);
      });
    } else {
      console.log(`  ✅ 所有退水記錄都在同一時間創建`);
    }
    
    // 檢查餘額變化是否異常
    const justin2025AChanges = balanceChanges.filter(tr => tr.username === 'justin2025A' && tr.transaction_type === 'rebate');
    const ti2025AChanges = balanceChanges.filter(tr => tr.username === 'ti2025A' && tr.transaction_type === 'rebate');
    
    console.log(`\n  justin2025A 退水記錄: ${justin2025AChanges.length} 筆`);
    console.log(`  ti2025A 退水記錄: ${ti2025AChanges.length} 筆`);
    
    if (justin2025AChanges.length > 1 || ti2025AChanges.length > 1) {
      console.log('\n  ⚠️ 發現多筆退水記錄，可能存在重複處理!');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
    process.exit(1);
  }
}

checkProcessRebatesCalls();