import db from './db/config.js';
import fs from 'fs';

async function restoreLimits() {
  try {
    console.log('开始恢复旧的限红配置...');
    
    const sql = fs.readFileSync('./restore-old-betting-limits.sql', 'utf8');
    
    // 执行SQL
    await db.none(sql);
    
    console.log('✅ 旧的限红配置已恢复！');
    
    // 显示恢复后的配置
    const configs = await db.any(`
      SELECT * FROM betting_limit_configs 
      ORDER BY level_order
    `);
    
    console.log('\n恢复后的限红配置:');
    configs.forEach(config => {
      console.log(`\n${config.level_display_name} (${config.level_name})`);
      console.log(`描述: ${config.description}`);
      console.log('限额设定:');
      const limits = config.config;
      console.log(`  1-10车号: 单注最高 ${limits.number.maxBet}, 单期限额 ${limits.number.periodLimit}`);
      console.log(`  两面: 单注最高 ${limits.twoSide.maxBet}, 单期限额 ${limits.twoSide.periodLimit}`);
      console.log(`  冠亚军和: 单注最高 ${limits.sumValue.maxBet}, 单期限额 ${limits.sumValue.periodLimit}`);
      console.log(`  龙虎: 单注最高 ${limits.dragonTiger.maxBet}, 单期限额 ${limits.dragonTiger.periodLimit}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

restoreLimits();
