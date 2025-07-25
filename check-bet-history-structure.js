import db from './db/config.js';

async function checkBetHistoryStructure() {
  try {
    console.log('=== 检查 bet_history 表结构 ===\n');

    // 1. 检查 bet_history 表结构
    const columns = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bet_history'
      ORDER BY ordinal_position;
    `);
    
    console.log('bet_history 表栏位：');
    columns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });

    // 2. 检查 justin2025A 的投注记录
    console.log('\n检查 justin2025A 的投注记录：');
    const bets = await db.query(`
      SELECT *
      FROM bet_history
      WHERE username = 'justin2025A'
      ORDER BY created_at DESC
      LIMIT 3;
    `);
    
    if (bets.length > 0) {
      console.log(`\n找到 ${bets.length} 笔投注记录`);
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
      console.log('未找到 justin2025A 的投注记录');
    }

  } catch (error) {
    console.error('检查失败:', error.message);
  } finally {
    process.exit();
  }
}

checkBetHistoryStructure();