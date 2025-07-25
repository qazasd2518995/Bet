import db from './db/config.js';

async function fixWrongWinningBet() {
  try {
    console.log('=== 修復錯誤的中獎記錄 ===\n');
    
    // 1. 查詢期號 537 的詳細情況
    const wrongBet = await db.oneOrNone(`
      SELECT * FROM bet_history 
      WHERE id = 3356
    `);
    
    console.log('錯誤的中獎記錄:');
    console.log(`  ID: ${wrongBet.id}`);
    console.log(`  期號: ${wrongBet.period}`);
    console.log(`  用戶: ${wrongBet.username}`);
    console.log(`  投注類型: ${wrongBet.bet_type}`);
    console.log(`  投注號碼: ${wrongBet.bet_value}`);
    console.log(`  投注位置: ${wrongBet.position}`);
    console.log(`  中獎狀態: ${wrongBet.win} (應該是 false)`);
    console.log(`  派彩金額: ${wrongBet.win_amount} (應該是 0.00)`);
    console.log(`  結算時間: ${wrongBet.settled_at}`);
    
    // 2. 查詢該期號的正確開獎結果
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = '20250717537'
    `);
    
    console.log('\n正確的開獎結果:');
    console.log(`  第1名: ${drawResult.position_1} (不是 1)`);
    
    // 3. 修復這筆錯誤的記錄
    console.log('\n開始修復...');
    
    // 首先，修正投注記錄
    await db.none(`
      UPDATE bet_history 
      SET win = false, 
          win_amount = 0.00
      WHERE id = 3356
    `);
    
    console.log('✅ 已修正投注記錄');
    
    // 4. 檢查並修正用戶餘額
    // 需要扣回錯誤的派彩金額
    const wrongWinAmount = parseFloat(wrongBet.win_amount) || 0;
    
    if (wrongWinAmount > 0) {
      console.log(`\n需要扣回錯誤派彩: $${wrongWinAmount}`);
      
      // 查詢當前餘額
      const memberBalance = await db.oneOrNone(`
        SELECT balance FROM members WHERE username = $1
      `, [wrongBet.username]);
      
      if (memberBalance) {
        const currentBalance = parseFloat(memberBalance.balance);
        const correctedBalance = Math.max(0, currentBalance - wrongWinAmount);
        
        await db.none(`
          UPDATE members 
          SET balance = $1 
          WHERE username = $2
        `, [correctedBalance, wrongBet.username]);
        
        console.log(`✅ 已更新用戶餘額: ${currentBalance} → ${correctedBalance}`);
        
        // 記錄調整交易
        await db.none(`
          INSERT INTO transaction_records 
          (username, transaction_type, amount, balance_before, balance_after, period, description)
          VALUES ($1, 'adjustment', $2, $3, $4, $5, $6)
        `, [
          wrongBet.username,
          -wrongWinAmount,
          currentBalance,
          correctedBalance,
          wrongBet.period,
          '修正錯誤的中獎派彩'
        ]);
        
        console.log('✅ 已記錄餘額調整交易');
      }
    }
    
    // 5. 重新查詢該期號所有投注，確保沒有其他錯誤
    console.log('\n重新檢查該期號所有投注...');
    
    const allBets = await db.manyOrNone(`
      SELECT id, bet_value, position, win 
      FROM bet_history 
      WHERE period = '20250717537' AND bet_type = 'number' AND position = 1
      ORDER BY id
    `);
    
    console.log(`\n期號 537 第1名投注情況 (第1名開出: ${drawResult.position_1}):`);
    allBets.forEach(bet => {
      const shouldWin = parseInt(bet.bet_value) === drawResult.position_1;
      const statusCorrect = bet.win === shouldWin;
      console.log(`  ID ${bet.id}: 投注${bet.bet_value} → ${bet.win ? '中獎' : '未中'} ${statusCorrect ? '✅' : '❌ 錯誤'}`);
      
      if (!statusCorrect) {
        console.log(`    ⚠️ 需要修正: 應該是 ${shouldWin ? '中獎' : '未中'}`);
      }
    });
    
    console.log('\n修復完成！');
    
  } catch (error) {
    console.error('修復失敗:', error);
  } finally {
    process.exit(0);
  }
}

// 執行修復
fixWrongWinningBet();