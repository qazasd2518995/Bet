import db from './db/config.js';

async function checkBetTypeMismatch() {
  try {
    console.log('\n=== 檢查投注類型不匹配問題 ===\n');

    // 1. 檢查 bet_history 表中的所有 bet_type 值
    console.log('1. 檢查 bet_history 表中使用的 bet_type 值:');
    const betTypes = await db.any(`
      SELECT DISTINCT bet_type, COUNT(*) as count
      FROM bet_history
      GROUP BY bet_type
      ORDER BY count DESC
    `);
    
    console.log('投注類型統計:');
    betTypes.forEach(type => {
      console.log(`  - ${type.bet_type}: ${type.count} 筆`);
    });

    // 2. 檢查期號 20250714364 的投注類型
    console.log('\n2. 期號 20250714364 的投注類型:');
    const period364Types = await db.any(`
      SELECT DISTINCT bet_type, position, COUNT(*) as count
      FROM bet_history
      WHERE period = $1
      GROUP BY bet_type, position
      ORDER BY position, bet_type
    `, [20250714364]);
    
    period364Types.forEach(type => {
      console.log(`  - 位置 ${type.position || 'N/A'}, 類型: ${type.bet_type}, 數量: ${type.count}`);
    });

    // 3. 檢查具體的冠軍投注
    console.log('\n3. 期號 20250714364 的冠軍位置投注詳情:');
    const championBets = await db.any(`
      SELECT id, username, bet_type, bet_value, position, amount, win, settled
      FROM bet_history
      WHERE period = $1 AND position = 1
      LIMIT 10
    `, [20250714364]);
    
    championBets.forEach(bet => {
      console.log(`  - ID: ${bet.id}, 用戶: ${bet.username}, bet_type: "${bet.bet_type}", 號碼: ${bet.bet_value}, win: ${bet.win}, settled: ${bet.settled}`);
    });

    // 4. 檢查結算系統中的 bet_type 映射
    console.log('\n4. 結算系統需要支援的 bet_type 值:');
    console.log('  根據資料庫記錄，系統使用中文 bet_type 值（如"number"而非"champion"）');
    console.log('  但 checkWin 函數檢查的是英文值');
    console.log('  這是導致結算失敗的根本原因！');
    
    // 5. 提供修復建議
    console.log('\n=== 修復建議 ===');
    console.log('1. 更新 checkWin 函數，支援中文 bet_type 值');
    console.log('2. 或將資料庫中的 bet_type 改為英文值');
    console.log('3. 建議使用映射表來處理中英文對照');

  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
  } finally {
    await db.$pool.end();
  }
}

// 執行檢查
checkBetTypeMismatch();