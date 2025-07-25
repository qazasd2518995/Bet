import db from './db/config.js';

async function fixPeriod546() {
  try {
    console.log('🔧 修复期号 20250717546 的错误结算...\n');
    
    // 1. 确认开奖结果
    const result = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = '20250717546'
    `);
    
    console.log('正确的开奖结果：');
    console.log(`第2名: ${result.position_2} 号`);
    
    // 2. 修正错误的中奖记录
    // ID 3372: 投注7号，错误中奖
    console.log('\n修正错误中奖记录 (ID 3372: 投注7号)...');
    await db.none(`
      UPDATE bet_history 
      SET win = false, win_amount = 0.00
      WHERE id = 3372
    `);
    console.log('✅ 已修正');
    
    // 3. 修正错误的未中记录
    // ID 3373: 投注8号，应该中奖
    console.log('\n修正错误未中记录 (ID 3373: 投注8号)...');
    await db.none(`
      UPDATE bet_history 
      SET win = true, win_amount = 9.89
      WHERE id = 3373
    `);
    console.log('✅ 已修正');
    
    // 4. 调整用户余额
    const member = await db.oneOrNone(`
      SELECT balance FROM members WHERE username = 'justin111'
    `);
    
    if (member) {
      const currentBalance = parseFloat(member.balance);
      // 扣回错误派彩 9.89，加上正确派彩 9.89 = 余额不变
      console.log(`\n当前余额: $${currentBalance} (不需调整)`);
    }
    
    // 5. 验证修复结果
    console.log('\n验证修复结果：');
    const bets = await db.manyOrNone(`
      SELECT id, bet_value, win, win_amount
      FROM bet_history
      WHERE period = '20250717546' 
        AND bet_type = 'number' 
        AND position = 2
        AND bet_value IN ('7', '8')
      ORDER BY id
    `);
    
    bets.forEach(bet => {
      const correct = (bet.bet_value === '8' && bet.win) || (bet.bet_value === '7' && !bet.win);
      console.log(`ID ${bet.id}: 投注${bet.bet_value}号 → ${bet.win ? '中奖' : '未中'} ${correct ? '✅' : '❌'}`);
    });
    
    console.log('\n修复完成！');
    
  } catch (error) {
    console.error('修复失败:', error);
  } finally {
    process.exit(0);
  }
}

fixPeriod546();