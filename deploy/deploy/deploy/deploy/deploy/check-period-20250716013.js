import db from './db/config.js';

async function checkPeriod20250716013() {
  try {
    console.log('=== 檢查期號 20250716013 退水問題 ===\n');
    
    const period = '20250716013';
    
    // 1. 檢查該期是否有下注記錄
    console.log('1. 檢查該期的下注記錄:');
    const bets = await db.any(`
      SELECT 
        username,
        COUNT(*) as bet_count,
        SUM(amount) as total_amount,
        MIN(created_at) as first_bet,
        MAX(created_at) as last_bet,
        BOOL_AND(settled) as all_settled
      FROM bet_history
      WHERE period = $1
      GROUP BY username
      ORDER BY total_amount DESC
    `, [period]);
    
    if (bets.length === 0) {
      console.log('  ❌ 該期沒有任何下注記錄');
    } else {
      console.log(`  找到 ${bets.length} 位會員的下注:`);
      let totalBetAmount = 0;
      
      bets.forEach(b => {
        console.log(`  - ${b.username}: ${b.bet_count} 筆，總額 $${b.total_amount}`);
        console.log(`    首注: ${b.first_bet}`);
        console.log(`    末注: ${b.last_bet}`);
        console.log(`    已結算: ${b.all_settled ? '是' : '否'}`);
        totalBetAmount += parseFloat(b.total_amount);
      });
      
      console.log(`\n  總下注金額: $${totalBetAmount.toFixed(2)}`);
      console.log(`  預期退水總額 (1.1%): $${(totalBetAmount * 0.011).toFixed(2)}`);
    }
    
    // 2. 檢查該期是否已開獎
    console.log('\n2. 檢查該期的開獎狀態:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history
      WHERE period = $1
    `, [period]);
    
    if (!drawResult) {
      console.log('  ❌ 該期尚未開獎');
    } else {
      console.log(`  ✅ 已開獎，時間: ${drawResult.draw_time}`);
      console.log(`  開獎結果: ${drawResult.position_1}, ${drawResult.position_2}, ${drawResult.position_3}, ...`);
    }
    
    // 3. 檢查是否有退水記錄
    console.log('\n3. 檢查退水記錄:');
    const rebates = await db.any(`
      SELECT 
        tr.*,
        a.username as agent_username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at
    `, [period]);
    
    if (rebates.length === 0) {
      console.log('  ❌ 沒有找到任何退水記錄');
    } else {
      console.log(`  找到 ${rebates.length} 筆退水記錄:`);
      rebates.forEach(r => {
        console.log(`  - ${r.agent_username || r.user_id}: $${r.amount} (${r.created_at})`);
      });
    }
    
    // 4. 檢查結算日誌
    console.log('\n4. 檢查結算日誌:');
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = $1
    `, [period]);
    
    if (!settlementLog) {
      console.log('  ❌ 沒有結算日誌記錄');
    } else {
      console.log(`  ✅ 已結算: ${settlementLog.settled_count} 筆，總中獎 $${settlementLog.total_win_amount}`);
      console.log(`  結算時間: ${settlementLog.created_at}`);
    }
    
    // 5. 分析可能的原因
    console.log('\n5. 分析可能的原因:');
    
    if (bets.length > 0 && drawResult && rebates.length === 0) {
      console.log('  ⚠️ 有下注且已開獎，但沒有退水記錄');
      console.log('  可能原因:');
      console.log('  - 結算系統未觸發退水處理');
      console.log('  - 退水處理過程中發生錯誤');
      console.log('  - 需要手動觸發退水處理');
      
      // 檢查是否所有下注都已結算
      const unsettledCount = await db.oneOrNone(`
        SELECT COUNT(*) as count
        FROM bet_history
        WHERE period = $1 AND settled = false
      `, [period]);
      
      if (unsettledCount && parseInt(unsettledCount.count) > 0) {
        console.log(`\n  ⚠️ 還有 ${unsettledCount.count} 筆下注未結算，這可能是退水未處理的原因`);
      }
    }
    
    // 6. 建議處理方式
    console.log('\n6. 建議處理方式:');
    if (bets.length > 0 && rebates.length === 0) {
      console.log('  可以執行以下命令手動處理退水:');
      console.log('  node process-single-period-rebate.js 20250716013');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
    process.exit(1);
  }
}

checkPeriod20250716013();