import db from './db/config.js';

async function checkPeriod537() {
  try {
    console.log('查詢期號 20250717537 的開獎結果...\n');
    
    // 1. 查詢 result_history 表
    const result = await db.oneOrNone(`
      SELECT period, result, position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10, created_at
      FROM result_history 
      WHERE period = '20250717537'
    `);
    
    if (result) {
      console.log('=== result_history 表中的開獎結果 ===');
      console.log('期號:', result.period);
      console.log('JSON結果:', result.result);
      console.log('各名次:');
      for (let i = 1; i <= 10; i++) {
        console.log(`  第${i}名: ${result[`position_${i}`]}`);
      }
      console.log('創建時間:', result.created_at);
    } else {
      console.log('❌ result_history 表中找不到期號 20250717537 的記錄');
    }
    
    // 2. 查詢 game_state 表的 last_result
    const gameState = await db.oneOrNone(`
      SELECT current_period, last_result, status, updated_at
      FROM game_state
      WHERE id = 1
    `);
    
    console.log('\n=== game_state 表的最後開獎結果 ===');
    console.log('當前期號:', gameState.current_period);
    console.log('最後結果:', gameState.last_result);
    console.log('狀態:', gameState.status);
    console.log('更新時間:', gameState.updated_at);
    
    // 3. 查詢該期號的所有投注記錄
    const bets = await db.manyOrNone(`
      SELECT id, username, bet_type, bet_value, position, amount, odds, 
             win, win_amount, settled, created_at
      FROM bet_history
      WHERE period = '20250717537'
      ORDER BY created_at DESC
    `);
    
    console.log(`\n=== 期號 20250717537 的投注記錄 (共 ${bets.length} 筆) ===`);
    
    if (bets.length > 0) {
      // 統計中獎情況
      const winBets = bets.filter(b => b.win === true);
      const settledBets = bets.filter(b => b.settled === true);
      
      console.log(`已結算: ${settledBets.length} 筆`);
      console.log(`中獎: ${winBets.length} 筆`);
      
      // 顯示前幾筆詳細記錄
      console.log('\n前5筆投注詳情:');
      bets.slice(0, 5).forEach((bet, index) => {
        console.log(`\n[${index + 1}] ID: ${bet.id}`);
        console.log(`  用戶: ${bet.username}`);
        console.log(`  類型: ${bet.bet_type}`);
        console.log(`  投注值: ${bet.bet_value}`);
        console.log(`  位置: ${bet.position}`);
        console.log(`  金額: $${bet.amount}`);
        console.log(`  賠率: ${bet.odds}`);
        console.log(`  是否中獎: ${bet.win ? '✅ 贏' : '❌ 輸'}`);
        console.log(`  派彩金額: ${bet.win_amount || 0}`);
        console.log(`  已結算: ${bet.settled ? '是' : '否'}`);
      });
    }
    
    // 4. 查詢實際開獎時的日誌（如果有的話）
    console.log('\n=== 檢查結算記錄 ===');
    const settlementLog = await db.oneOrNone(`
      SELECT * FROM settlement_logs
      WHERE period = '20250717537'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (settlementLog) {
      console.log('結算日誌:', settlementLog);
    }
    
  } catch (error) {
    console.error('查詢失敗:', error);
  } finally {
    process.exit(0);
  }
}

checkPeriod537();