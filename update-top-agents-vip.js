import db from './db/config.js';

async function updateTopAgentsToVIP() {
  try {
    console.log('更新總代理 ti2025A 和 ti2025D 為 VIP 等級...\n');
    
    // 檢查當前等級
    const currentLevels = await db.any(`
      SELECT id, username, betting_limit_level 
      FROM agents 
      WHERE username IN ('ti2025A', 'ti2025D')
    `);
    
    console.log('當前等級:');
    currentLevels.forEach(agent => {
      console.log(`${agent.username} (ID: ${agent.id}): ${agent.betting_limit_level || '未設定'}`);
    });
    
    // 更新為 VIP 等級 (level6)
    const result = await db.result(`
      UPDATE agents 
      SET betting_limit_level = 'level6' 
      WHERE username IN ('ti2025A', 'ti2025D')
    `);
    
    console.log(`\n✅ 已更新 ${result.rowCount} 個總代理為 VIP 等級\n`);
    
    // 顯示更新後的結果
    const updatedLevels = await db.any(`
      SELECT id, username, betting_limit_level 
      FROM agents 
      WHERE username IN ('ti2025A', 'ti2025D')
    `);
    
    console.log('更新後等級:');
    updatedLevels.forEach(agent => {
      console.log(`${agent.username} (ID: ${agent.id}): ${agent.betting_limit_level} (VIP限紅)`);
    });
    
    // 檢查 VIP 限紅配置
    const vipConfig = await db.oneOrNone(`
      SELECT * FROM betting_limit_configs 
      WHERE level_name = 'level6'
    `);
    
    if (vipConfig) {
      console.log('\nVIP 限紅配置:');
      console.log(`等級名稱: ${vipConfig.level_display_name}`);
      console.log(`描述: ${vipConfig.description}`);
      const limits = vipConfig.config;
      console.log('限額設定:');
      console.log(`  • 1-10車號: 單注最高 $${limits.number.maxBet}, 單期限額 $${limits.number.periodLimit}`);
      console.log(`  • 兩面: 單注最高 $${limits.twoSide.maxBet}, 單期限額 $${limits.twoSide.periodLimit}`);
      console.log(`  • 冠亞軍和大小/單雙: 單注最高 $${limits.sumValueSize.maxBet}, 單期限額 $${limits.sumValueSize.periodLimit}`);
      console.log(`  • 冠亞軍和值: 單注最高 $${limits.sumValue.maxBet}, 單期限額 $${limits.sumValue.periodLimit}`);
      console.log(`  • 龍虎: 單注最高 $${limits.dragonTiger.maxBet}, 單期限額 $${limits.dragonTiger.periodLimit}`);
    }
    
    // 顯示他們下級代理的限紅等級
    console.log('\n下級代理的限紅等級:');
    const subAgents = await db.any(`
      SELECT a.username, a.betting_limit_level, p.username as parent_username
      FROM agents a
      JOIN agents p ON a.parent_id = p.id
      WHERE p.username IN ('ti2025A', 'ti2025D')
      ORDER BY p.username, a.username
    `);
    
    if (subAgents.length > 0) {
      subAgents.forEach(agent => {
        console.log(`  ${agent.parent_username} → ${agent.username}: ${agent.betting_limit_level || '未設定'}`);
      });
    } else {
      console.log('  沒有下級代理');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('更新失敗:', error);
    process.exit(1);
  }
}

updateTopAgentsToVIP();