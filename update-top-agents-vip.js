import db from './db/config.js';

async function updateTopAgentsToVIP() {
  try {
    console.log('更新总代理 ti2025A 和 ti2025D 为 VIP 等级...\n');
    
    // 检查当前等级
    const currentLevels = await db.any(`
      SELECT id, username, betting_limit_level 
      FROM agents 
      WHERE username IN ('ti2025A', 'ti2025D')
    `);
    
    console.log('当前等级:');
    currentLevels.forEach(agent => {
      console.log(`${agent.username} (ID: ${agent.id}): ${agent.betting_limit_level || '未设定'}`);
    });
    
    // 更新为 VIP 等级 (level6)
    const result = await db.result(`
      UPDATE agents 
      SET betting_limit_level = 'level6' 
      WHERE username IN ('ti2025A', 'ti2025D')
    `);
    
    console.log(`\n✅ 已更新 ${result.rowCount} 个总代理为 VIP 等级\n`);
    
    // 显示更新后的结果
    const updatedLevels = await db.any(`
      SELECT id, username, betting_limit_level 
      FROM agents 
      WHERE username IN ('ti2025A', 'ti2025D')
    `);
    
    console.log('更新后等级:');
    updatedLevels.forEach(agent => {
      console.log(`${agent.username} (ID: ${agent.id}): ${agent.betting_limit_level} (VIP限红)`);
    });
    
    // 检查 VIP 限红配置
    const vipConfig = await db.oneOrNone(`
      SELECT * FROM betting_limit_configs 
      WHERE level_name = 'level6'
    `);
    
    if (vipConfig) {
      console.log('\nVIP 限红配置:');
      console.log(`等级名称: ${vipConfig.level_display_name}`);
      console.log(`描述: ${vipConfig.description}`);
      const limits = vipConfig.config;
      console.log('限额设定:');
      console.log(`  • 1-10车号: 单注最高 $${limits.number.maxBet}, 单期限额 $${limits.number.periodLimit}`);
      console.log(`  • 两面: 单注最高 $${limits.twoSide.maxBet}, 单期限额 $${limits.twoSide.periodLimit}`);
      console.log(`  • 冠亚军和大小/单双: 单注最高 $${limits.sumValueSize.maxBet}, 单期限额 $${limits.sumValueSize.periodLimit}`);
      console.log(`  • 冠亚军和值: 单注最高 $${limits.sumValue.maxBet}, 单期限额 $${limits.sumValue.periodLimit}`);
      console.log(`  • 龙虎: 单注最高 $${limits.dragonTiger.maxBet}, 单期限额 $${limits.dragonTiger.periodLimit}`);
    }
    
    // 显示他们下级代理的限红等级
    console.log('\n下级代理的限红等级:');
    const subAgents = await db.any(`
      SELECT a.username, a.betting_limit_level, p.username as parent_username
      FROM agents a
      JOIN agents p ON a.parent_id = p.id
      WHERE p.username IN ('ti2025A', 'ti2025D')
      ORDER BY p.username, a.username
    `);
    
    if (subAgents.length > 0) {
      subAgents.forEach(agent => {
        console.log(`  ${agent.parent_username} → ${agent.username}: ${agent.betting_limit_level || '未设定'}`);
      });
    } else {
      console.log('  没有下级代理');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('更新失败:', error);
    process.exit(1);
  }
}

updateTopAgentsToVIP();