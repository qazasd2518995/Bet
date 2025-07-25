import db from './db/config.js';

async function checkPeriod031() {
  try {
    console.log('=== 檢查期號 20250716031 的詳細狀況 ===\n');
    
    const period = '20250716031';
    
    // 1. 檢查下注記錄
    console.log('1. 下注記錄:');
    const bets = await db.any(`
      SELECT 
        id,
        username,
        amount,
        bet_type,
        bet_value,
        created_at,
        settled,
        settled_at,
        win,
        win_amount
      FROM bet_history
      WHERE period = $1
      ORDER BY id
    `, [period]);
    
    if (bets.length === 0) {
      console.log('  ❌ 沒有找到任何下注記錄');
    } else {
      let totalAmount = 0;
      bets.forEach(bet => {
        console.log(`  ID ${bet.id}: ${bet.username} 下注 $${bet.amount}`);
        console.log(`    類型: ${bet.bet_type} - ${bet.bet_value}`);
        console.log(`    時間: ${bet.created_at}`);
        console.log(`    結算: ${bet.settled ? '是' : '否'} ${bet.settled_at ? `(${bet.settled_at})` : ''}`);
        console.log(`    結果: ${bet.win ? `贏 $${bet.win_amount}` : '輸'}`);
        totalAmount += parseFloat(bet.amount);
      });
      console.log(`\n  總下注金額: $${totalAmount.toFixed(2)}`);
      console.log(`  預期退水: $${(totalAmount * 0.011).toFixed(2)} (A盤 1.1%)`);
    }
    
    // 2. 檢查退水記錄
    console.log('\n2. 退水記錄:');
    const rebates = await db.any(`
      SELECT 
        tr.id,
        tr.amount,
        tr.description,
        tr.created_at,
        tr.balance_before,
        tr.balance_after,
        a.username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at, tr.id
    `, [period]);
    
    if (rebates.length === 0) {
      console.log('  ❌ 沒有找到任何退水記錄');
    } else {
      let totalRebate = 0;
      console.log(`  找到 ${rebates.length} 筆退水記錄:`);
      rebates.forEach(r => {
        console.log(`  ID ${r.id}: ${r.username} 收到 $${r.amount}`);
        console.log(`    餘額: $${r.balance_before} → $${r.balance_after}`);
        console.log(`    描述: ${r.description}`);
        console.log(`    時間: ${r.created_at}`);
        totalRebate += parseFloat(r.amount);
      });
      console.log(`\n  總退水金額: $${totalRebate.toFixed(2)}`);
    }
    
    // 3. 檢查開獎結果
    console.log('\n3. 開獎結果:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history
      WHERE period = $1
    `, [period]);
    
    if (!drawResult) {
      console.log('  ❌ 沒有找到開獎記錄');
    } else {
      console.log(`  ✅ 已開獎`);
      console.log(`  開獎時間: ${drawResult.draw_time || drawResult.created_at}`);
      console.log(`  開獎結果: ${drawResult.result || `${drawResult.position_1}, ${drawResult.position_2}, ${drawResult.position_3}...`}`);
    }
    
    // 4. 檢查其他相關資訊
    console.log('\n4. 其他相關資訊:');
    
    // 檢查是否有settlement_logs
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = $1
    `, [period]);
    
    console.log(`  結算日誌: ${settlementLog ? '有' : '無'}`);
    
    // 檢查期號前後的退水情況
    const nearbyPeriods = await db.any(`
      SELECT 
        period,
        COUNT(*) as rebate_count
      FROM transaction_records
      WHERE transaction_type = 'rebate'
        AND period::text LIKE '20250716%'
        AND CAST(SUBSTRING(period::text FROM 9) AS INTEGER) BETWEEN 29 AND 33
      GROUP BY period
      ORDER BY period
    `);
    
    console.log('\n  附近期號的退水情況:');
    nearbyPeriods.forEach(p => {
      console.log(`    期號 ${p.period}: ${p.rebate_count} 筆退水`);
    });
    
    // 5. 總結
    console.log('\n5. 總結:');
    if (bets.length > 0 && rebates.length > 0) {
      console.log('  ✅ 該期已經有退水記錄，無需再次處理');
    } else if (bets.length > 0 && rebates.length === 0) {
      console.log('  ⚠️ 該期有下注但沒有退水，需要處理');
      console.log('  執行: node process-single-period-rebate.js 20250716031');
    } else {
      console.log('  ℹ️ 該期沒有下注記錄');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
    process.exit(1);
  }
}

checkPeriod031();