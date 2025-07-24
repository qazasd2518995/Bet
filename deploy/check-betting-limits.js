import db from './db/config.js';

async function checkBettingLimits() {
  try {
    console.log('查詢限紅配置...');
    const configs = await db.any(`
      SELECT * FROM betting_limit_configs 
      ORDER BY level_order ASC
    `);
    
    console.log('\n當前限紅配置:');
    configs.forEach(config => {
      console.log(`\nLevel: ${config.level_name} (${config.level_display_name})`);
      console.log(`描述: ${config.description}`);
      console.log(`順序: ${config.level_order}`);
      console.log(`配置:`, JSON.stringify(config.config, null, 2));
    });
    
    process.exit(0);
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

checkBettingLimits();
