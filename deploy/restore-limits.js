import db from './db/config.js';
import fs from 'fs';

async function restoreLimits() {
  try {
    console.log('開始恢復舊的限紅配置...');
    
    const sql = fs.readFileSync('./restore-old-betting-limits.sql', 'utf8');
    
    // 執行SQL
    await db.none(sql);
    
    console.log('✅ 舊的限紅配置已恢復！');
    
    // 顯示恢復後的配置
    const configs = await db.any(`
      SELECT * FROM betting_limit_configs 
      ORDER BY level_order
    `);
    
    console.log('\n恢復後的限紅配置:');
    configs.forEach(config => {
      console.log(`\n${config.level_display_name} (${config.level_name})`);
      console.log(`描述: ${config.description}`);
      console.log('限額設定:');
      const limits = config.config;
      console.log(`  1-10車號: 單注最高 ${limits.number.maxBet}, 單期限額 ${limits.number.periodLimit}`);
      console.log(`  兩面: 單注最高 ${limits.twoSide.maxBet}, 單期限額 ${limits.twoSide.periodLimit}`);
      console.log(`  冠亞軍和: 單注最高 ${limits.sumValue.maxBet}, 單期限額 ${limits.sumValue.periodLimit}`);
      console.log(`  龍虎: 單注最高 ${limits.dragonTiger.maxBet}, 單期限額 ${limits.dragonTiger.periodLimit}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

restoreLimits();
