import db from './db/config.js';

async function checkPeriod041Detailed() {
  try {
    console.log('=== 詳細檢查期號 20250716041 退水問題 ===\n');
    
    const period = '20250716041';
    
    // 1. 檢查下注記錄
    console.log('1. 下注記錄詳情:');
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
      process.exit(0);
    }
    
    let totalAmount = 0;
    bets.forEach(bet => {
      console.log(`  ID ${bet.id}: ${bet.username} 下注 $${bet.amount}`);
      console.log(`    類型: ${bet.bet_type} - ${bet.bet_value}`);
      console.log(`    時間: ${bet.created_at}`);
      console.log(`    結算: ${bet.settled ? '是' : '否'}`);
      if (bet.settled) {
        console.log(`    結算時間: ${bet.settled_at}`);
        console.log(`    結果: ${bet.win ? `贏 $${bet.win_amount}` : '輸'}`);
      }
      totalAmount += parseFloat(bet.amount);
    });
    
    console.log(`\n  總下注金額: $${totalAmount.toFixed(2)}`);
    console.log(`  預期退水: $${(totalAmount * 0.011).toFixed(2)} (A盤 1.1%)`);
    
    // 2. 檢查開獎結果
    console.log('\n2. 開獎結果:');
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history
      WHERE period = $1
    `, [period]);
    
    if (!drawResult) {
      console.log('  ❌ 沒有找到開獎記錄');
    } else {
      console.log(`  ✅ 已開獎`);
      console.log(`  開獎時間: ${drawResult.created_at}`);
      console.log(`  開獎結果: ${drawResult.result}`);
    }
    
    // 3. 檢查退水記錄
    console.log('\n3. 退水記錄:');
    const rebates = await db.any(`
      SELECT 
        tr.id,
        tr.amount,
        tr.description,
        tr.created_at,
        a.username
      FROM transaction_records tr
      LEFT JOIN agents a ON tr.user_type = 'agent' AND tr.user_id = a.id
      WHERE tr.period = $1 
        AND tr.transaction_type = 'rebate'
      ORDER BY tr.created_at
    `, [period]);
    
    if (rebates.length === 0) {
      console.log('  ❌ 沒有找到任何退水記錄');
    } else {
      console.log(`  ✅ 找到 ${rebates.length} 筆退水記錄:`);
      rebates.forEach(r => {
        console.log(`    ${r.username}: $${r.amount} (${r.created_at})`);
      });
    }
    
    // 4. 檢查結算日誌
    console.log('\n4. 結算日誌:');
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = $1
    `, [period]);
    
    if (!settlementLog) {
      console.log('  ❌ 沒有結算日誌記錄');
      console.log('  說明: 可能使用了不記錄日誌的結算系統');
    } else {
      console.log(`  ✅ 有結算日誌`);
      console.log(`  結算時間: ${settlementLog.created_at}`);
      console.log(`  結算筆數: ${settlementLog.settled_count}`);
    }
    
    // 5. 檢查時間軸
    console.log('\n5. 事件時間軸:');
    if (bets.length > 0) {
      const firstBetTime = new Date(bets[0].created_at);
      const lastBetTime = new Date(bets[bets.length - 1].created_at);
      console.log(`  首筆下注: ${firstBetTime.toLocaleTimeString()}`);
      console.log(`  末筆下注: ${lastBetTime.toLocaleTimeString()}`);
      
      if (bets[0].settled_at) {
        const settleTime = new Date(bets[0].settled_at);
        console.log(`  結算時間: ${settleTime.toLocaleTimeString()}`);
        const timeDiff = (settleTime - lastBetTime) / 1000;
        console.log(`  下注到結算: ${timeDiff} 秒`);
      }
      
      if (drawResult) {
        const drawTime = new Date(drawResult.created_at);
        console.log(`  開獎時間: ${drawTime.toLocaleTimeString()}`);
      }
    }
    
    // 6. 檢查最近的系統活動
    console.log('\n6. 檢查該時段的系統活動:');
    
    // 檢查前後5分鐘的其他期號
    const nearbyPeriods = await db.any(`
      SELECT 
        period,
        COUNT(*) as bet_count,
        SUM(CASE WHEN settled THEN 1 ELSE 0 END) as settled_count,
        MIN(created_at) as first_bet,
        MAX(settled_at) as last_settle
      FROM bet_history
      WHERE created_at >= $1::timestamp - INTERVAL '5 minutes'
        AND created_at <= $1::timestamp + INTERVAL '5 minutes'
      GROUP BY period
      ORDER BY period
    `, [bets[0]?.created_at || new Date()]);
    
    console.log('  附近期號的結算情況:');
    nearbyPeriods.forEach(p => {
      const status = p.settled_count === p.bet_count ? '✅ 已結算' : '⚠️ 部分結算';
      console.log(`    期號 ${p.period}: ${p.bet_count} 筆下注, ${status}`);
    });
    
    // 檢查這些期號的退水情況
    const periodList = nearbyPeriods.map(p => p.period);
    if (periodList.length > 0) {
      const rebateStatus = await db.any(`
        SELECT 
          period,
          COUNT(*) as rebate_count
        FROM transaction_records
        WHERE period = ANY($1::text[])
          AND transaction_type = 'rebate'
        GROUP BY period
      `, [periodList]);
      
      console.log('\n  這些期號的退水情況:');
      periodList.forEach(p => {
        const rebate = rebateStatus.find(r => r.period === p);
        const status = rebate ? `✅ 有退水 (${rebate.rebate_count} 筆)` : '❌ 無退水';
        console.log(`    期號 ${p}: ${status}`);
      });
    }
    
    // 7. 分析可能的原因
    console.log('\n7. 分析可能的原因:');
    
    if (bets.every(b => b.settled)) {
      console.log('  ⚠️ 所有投注都已結算');
      console.log('  - 可能在 settleBets 調用時已經被結算');
      console.log('  - enhancedSettlement 應該要檢查並處理退水');
    }
    
    if (!settlementLog) {
      console.log('  ⚠️ 沒有結算日誌');
      console.log('  - 可能使用了其他結算系統');
      console.log('  - 或者 enhancedSettlement 在沒有未結算投注時跳過了日誌記錄');
    }
    
    if (rebates.length === 0) {
      console.log('  ❌ 沒有退水記錄');
      console.log('  - 退水處理可能失敗了');
      console.log('  - 或者根本沒有觸發退水檢查');
    }
    
    // 8. 檢查系統是否已經更新
    console.log('\n8. 檢查系統版本:');
    console.log('  請確認 enhanced-settlement-system.js 是否包含最新的修復');
    console.log('  修復應該在沒有未結算投注時也檢查退水');
    
    // 9. 建議
    console.log('\n9. 建議:');
    if (rebates.length === 0 && totalAmount > 0) {
      console.log('  可以手動處理退水:');
      console.log(`  node process-single-period-rebate.js ${period}`);
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
    process.exit(1);
  }
}

checkPeriod041Detailed();