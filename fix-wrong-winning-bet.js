import db from './db/config.js';

async function fixWrongWinningBet() {
  try {
    console.log('=== 修复错误的中奖记录 ===\n');
    
    // 1. 查询期号 537 的详细情况
    const wrongBet = await db.oneOrNone(`
      SELECT * FROM bet_history 
      WHERE id = 3356
    `);
    
    console.log('错误的中奖记录:');
    console.log(`  ID: ${wrongBet.id}`);
    console.log(`  期号: ${wrongBet.period}`);
    console.log(`  用户: ${wrongBet.username}`);
    console.log(`  投注类型: ${wrongBet.bet_type}`);
    console.log(`  投注号码: ${wrongBet.bet_value}`);
    console.log(`  投注位置: ${wrongBet.position}`);
    console.log(`  中奖状态: ${wrongBet.win} (应该是 false)`);
    console.log(`  派彩金额: ${wrongBet.win_amount} (应该是 0.00)`);
    console.log(`  结算时间: ${wrongBet.settled_at}`);
    
    // 2. 查询该期号的正确开奖结果
    const drawResult = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = '20250717537'
    `);
    
    console.log('\n正确的开奖结果:');
    console.log(`  第1名: ${drawResult.position_1} (不是 1)`);
    
    // 3. 修复这笔错误的记录
    console.log('\n开始修复...');
    
    // 首先，修正投注记录
    await db.none(`
      UPDATE bet_history 
      SET win = false, 
          win_amount = 0.00
      WHERE id = 3356
    `);
    
    console.log('✅ 已修正投注记录');
    
    // 4. 检查并修正用户余额
    // 需要扣回错误的派彩金额
    const wrongWinAmount = parseFloat(wrongBet.win_amount) || 0;
    
    if (wrongWinAmount > 0) {
      console.log(`\n需要扣回错误派彩: $${wrongWinAmount}`);
      
      // 查询当前余额
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
        
        console.log(`✅ 已更新用户余额: ${currentBalance} → ${correctedBalance}`);
        
        // 记录调整交易
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
          '修正错误的中奖派彩'
        ]);
        
        console.log('✅ 已记录余额调整交易');
      }
    }
    
    // 5. 重新查询该期号所有投注，确保没有其他错误
    console.log('\n重新检查该期号所有投注...');
    
    const allBets = await db.manyOrNone(`
      SELECT id, bet_value, position, win 
      FROM bet_history 
      WHERE period = '20250717537' AND bet_type = 'number' AND position = 1
      ORDER BY id
    `);
    
    console.log(`\n期号 537 第1名投注情况 (第1名开出: ${drawResult.position_1}):`);
    allBets.forEach(bet => {
      const shouldWin = parseInt(bet.bet_value) === drawResult.position_1;
      const statusCorrect = bet.win === shouldWin;
      console.log(`  ID ${bet.id}: 投注${bet.bet_value} → ${bet.win ? '中奖' : '未中'} ${statusCorrect ? '✅' : '❌ 错误'}`);
      
      if (!statusCorrect) {
        console.log(`    ⚠️ 需要修正: 应该是 ${shouldWin ? '中奖' : '未中'}`);
      }
    });
    
    console.log('\n修复完成！');
    
  } catch (error) {
    console.error('修复失败:', error);
  } finally {
    process.exit(0);
  }
}

// 执行修复
fixWrongWinningBet();