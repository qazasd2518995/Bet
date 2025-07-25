import db from './db/config.js';

async function fixPeriod546() {
  try {
    console.log('🔧 修復期號 20250717546 的錯誤結算...\n');
    
    // 1. 確認開獎結果
    const result = await db.oneOrNone(`
      SELECT * FROM result_history 
      WHERE period = '20250717546'
    `);
    
    console.log('正確的開獎結果：');
    console.log(`第2名: ${result.position_2} 號`);
    
    // 2. 修正錯誤的中獎記錄
    // ID 3372: 投注7號，錯誤中獎
    console.log('\n修正錯誤中獎記錄 (ID 3372: 投注7號)...');
    await db.none(`
      UPDATE bet_history 
      SET win = false, win_amount = 0.00
      WHERE id = 3372
    `);
    console.log('✅ 已修正');
    
    // 3. 修正錯誤的未中記錄
    // ID 3373: 投注8號，應該中獎
    console.log('\n修正錯誤未中記錄 (ID 3373: 投注8號)...');
    await db.none(`
      UPDATE bet_history 
      SET win = true, win_amount = 9.89
      WHERE id = 3373
    `);
    console.log('✅ 已修正');
    
    // 4. 調整用戶餘額
    const member = await db.oneOrNone(`
      SELECT balance FROM members WHERE username = 'justin111'
    `);
    
    if (member) {
      const currentBalance = parseFloat(member.balance);
      // 扣回錯誤派彩 9.89，加上正確派彩 9.89 = 餘額不變
      console.log(`\n當前餘額: $${currentBalance} (不需調整)`);
    }
    
    // 5. 驗證修復結果
    console.log('\n驗證修復結果：');
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
      console.log(`ID ${bet.id}: 投注${bet.bet_value}號 → ${bet.win ? '中獎' : '未中'} ${correct ? '✅' : '❌'}`);
    });
    
    console.log('\n修復完成！');
    
  } catch (error) {
    console.error('修復失敗:', error);
  } finally {
    process.exit(0);
  }
}

fixPeriod546();