import db from './db/config.js';

async function updateMasterAgentsBettingLimit() {
  try {
    console.log('更新总代理 ti2025A 和 ti2025D 的限红等级为 VIP (level6)...');
    
    // 更新 ti2025A
    const resultA = await db.result(`
      UPDATE agents 
      SET betting_limit_level = 'level6'
      WHERE username = 'ti2025A'
    `);
    
    console.log(`✅ ti2025A 更新结果: ${resultA.rowCount} 笔`);
    
    // 更新 ti2025D
    const resultD = await db.result(`
      UPDATE agents 
      SET betting_limit_level = 'level6'
      WHERE username = 'ti2025D'
    `);
    
    console.log(`✅ ti2025D 更新结果: ${resultD.rowCount} 笔`);
    
    // 确认更新结果
    const agents = await db.any(`
      SELECT id, username, level, betting_limit_level
      FROM agents
      WHERE username IN ('ti2025A', 'ti2025D')
    `);
    
    console.log('\n更新后的总代理资料:');
    agents.forEach(agent => {
      console.log(`- ${agent.username} (ID: ${agent.id}): 限红等级 = ${agent.betting_limit_level}`);
    });
    
    console.log('\n✅ 总代理限红等级更新完成！');
    
  } catch (error) {
    console.error('❌ 更新总代理限红等级失败:', error);
  } finally {
    await db.$pool.end();
  }
}

updateMasterAgentsBettingLimit();