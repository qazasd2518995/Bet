import db from './db/config.js';

async function updateMasterAgentsBettingLimit() {
  try {
    console.log('更新總代理 ti2025A 和 ti2025D 的限紅等級為 VIP (level6)...');
    
    // 更新 ti2025A
    const resultA = await db.result(`
      UPDATE agents 
      SET betting_limit_level = 'level6'
      WHERE username = 'ti2025A'
    `);
    
    console.log(`✅ ti2025A 更新結果: ${resultA.rowCount} 筆`);
    
    // 更新 ti2025D
    const resultD = await db.result(`
      UPDATE agents 
      SET betting_limit_level = 'level6'
      WHERE username = 'ti2025D'
    `);
    
    console.log(`✅ ti2025D 更新結果: ${resultD.rowCount} 筆`);
    
    // 確認更新結果
    const agents = await db.any(`
      SELECT id, username, level, betting_limit_level
      FROM agents
      WHERE username IN ('ti2025A', 'ti2025D')
    `);
    
    console.log('\n更新後的總代理資料:');
    agents.forEach(agent => {
      console.log(`- ${agent.username} (ID: ${agent.id}): 限紅等級 = ${agent.betting_limit_level}`);
    });
    
    console.log('\n✅ 總代理限紅等級更新完成！');
    
  } catch (error) {
    console.error('❌ 更新總代理限紅等級失敗:', error);
  } finally {
    await db.$pool.end();
  }
}

updateMasterAgentsBettingLimit();