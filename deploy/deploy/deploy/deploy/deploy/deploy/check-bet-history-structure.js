import db from './db/config.js';

async function checkBetHistoryStructure() {
  try {
    console.log('=== 檢查 bet_history 表結構 ===\n');

    // 1. 檢查 bet_history 表結構
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bet_history'
      ORDER BY ordinal_position;
    `);
    
    console.log('bet_history 表欄位：');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // 2. 檢查 justin2025A 的投注記錄
    console.log('\n檢查 justin2025A 的投注記錄：');
    const bets = await db.query(`
      SELECT *
      FROM bet_history
      WHERE username = 'justin2025A'
      ORDER BY created_at DESC
      LIMIT 3;
    `);
    
    if (bets.length > 0) {
      console.log(`\n找到 ${bets.length} 筆投注記錄`);
      bets.forEach((bet, idx) => {
        console.log(`\n投注 ${idx + 1}:`);
        Object.keys(bet).forEach(key => {
          if (bet[key] !== null && key !== 'agent_chain') {
            console.log(`  ${key}: ${bet[key]}`);
          }
        });
        if (bet.agent_chain) {
          console.log(`  agent_chain: ${bet.agent_chain}`);
        }
      });
    } else {
      console.log('未找到 justin2025A 的投注記錄');
    }

  } catch (error) {
    console.error('檢查失敗:', error.message);
  } finally {
    process.exit();
  }
}

checkBetHistoryStructure();