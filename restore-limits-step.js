import db from './db/config.js';

async function restoreLimits() {
  try {
    console.log('开始恢复旧的限红配置...\n');
    
    // 步骤1: 备份现有资料
    console.log('步骤1: 备份现有资料...');
    await db.none(`
      CREATE TABLE IF NOT EXISTS betting_limit_configs_backup AS 
      SELECT * FROM betting_limit_configs
    `);
    
    // 步骤2: 清空现有配置
    console.log('步骤2: 清空现有配置...');
    await db.none('TRUNCATE TABLE betting_limit_configs');
    
    // 步骤3: 插入新配置
    console.log('步骤3: 插入旧的6级限红配置...');
    
    const configs = [
      {
        level_name: 'level1',
        level_display_name: '新手限红',
        level_order: 1,
        description: '适合新手玩家的最低限额',
        config: {
          number: {minBet: 1, maxBet: 500, periodLimit: 1000},
          twoSide: {minBet: 1, maxBet: 1000, periodLimit: 1000},
          sumValueSize: {minBet: 1, maxBet: 1000, periodLimit: 1000},
          sumValueOddEven: {minBet: 1, maxBet: 1000, periodLimit: 1000},
          sumValue: {minBet: 1, maxBet: 200, periodLimit: 400},
          dragonTiger: {minBet: 1, maxBet: 1000, periodLimit: 1000}
        }
      },
      {
        level_name: 'level2',
        level_display_name: '一般限红',
        level_order: 2,
        description: '一般会员标准限额',
        config: {
          number: {minBet: 1, maxBet: 1000, periodLimit: 2000},
          twoSide: {minBet: 1, maxBet: 2000, periodLimit: 2000},
          sumValueSize: {minBet: 1, maxBet: 2000, periodLimit: 2000},
          sumValueOddEven: {minBet: 1, maxBet: 2000, periodLimit: 2000},
          sumValue: {minBet: 1, maxBet: 400, periodLimit: 800},
          dragonTiger: {minBet: 1, maxBet: 2000, periodLimit: 2000}
        }
      },
      {
        level_name: 'level3',
        level_display_name: '标准限红',
        level_order: 3,
        description: '标准会员限额',
        config: {
          number: {minBet: 1, maxBet: 2500, periodLimit: 5000},
          twoSide: {minBet: 1, maxBet: 5000, periodLimit: 5000},
          sumValueSize: {minBet: 1, maxBet: 5000, periodLimit: 5000},
          sumValueOddEven: {minBet: 1, maxBet: 5000, periodLimit: 5000},
          sumValue: {minBet: 1, maxBet: 1000, periodLimit: 2000},
          dragonTiger: {minBet: 1, maxBet: 5000, periodLimit: 5000}
        }
      },
      {
        level_name: 'level4',
        level_display_name: '进阶限红',
        level_order: 4,
        description: '进阶会员限额',
        config: {
          number: {minBet: 1, maxBet: 5000, periodLimit: 10000},
          twoSide: {minBet: 1, maxBet: 10000, periodLimit: 10000},
          sumValueSize: {minBet: 1, maxBet: 10000, periodLimit: 10000},
          sumValueOddEven: {minBet: 1, maxBet: 10000, periodLimit: 10000},
          sumValue: {minBet: 1, maxBet: 2000, periodLimit: 4000},
          dragonTiger: {minBet: 1, maxBet: 10000, periodLimit: 10000}
        }
      },
      {
        level_name: 'level5',
        level_display_name: '高级限红',
        level_order: 5,
        description: '高级会员限额',
        config: {
          number: {minBet: 1, maxBet: 10000, periodLimit: 20000},
          twoSide: {minBet: 1, maxBet: 20000, periodLimit: 20000},
          sumValueSize: {minBet: 1, maxBet: 20000, periodLimit: 20000},
          sumValueOddEven: {minBet: 1, maxBet: 20000, periodLimit: 20000},
          sumValue: {minBet: 1, maxBet: 4000, periodLimit: 8000},
          dragonTiger: {minBet: 1, maxBet: 20000, periodLimit: 20000}
        }
      },
      {
        level_name: 'level6',
        level_display_name: 'VIP限红',
        level_order: 6,
        description: 'VIP会员最高限额',
        config: {
          number: {minBet: 1, maxBet: 20000, periodLimit: 40000},
          twoSide: {minBet: 1, maxBet: 40000, periodLimit: 40000},
          sumValueSize: {minBet: 1, maxBet: 40000, periodLimit: 40000},
          sumValueOddEven: {minBet: 1, maxBet: 40000, periodLimit: 40000},
          sumValue: {minBet: 1, maxBet: 8000, periodLimit: 16000},
          dragonTiger: {minBet: 1, maxBet: 40000, periodLimit: 40000}
        }
      }
    ];
    
    for (const config of configs) {
      await db.none(`
        INSERT INTO betting_limit_configs (level_name, level_display_name, level_order, description, config)
        VALUES ($1, $2, $3, $4, $5)
      `, [config.level_name, config.level_display_name, config.level_order, config.description, JSON.stringify(config.config)]);
    }
    
    // 步骤4: 更新现有会员和代理的限红等级
    console.log('步骤4: 更新现有会员和代理的限红等级...');
    
    await db.none(`
      UPDATE members 
      SET betting_limit_level = CASE 
        WHEN betting_limit_level = 'mini' THEN 'level1'
        WHEN betting_limit_level = 'basic' THEN 'level2'
        WHEN betting_limit_level = 'standard' THEN 'level3'
        WHEN betting_limit_level = 'premium' THEN 'level4'
        WHEN betting_limit_level = 'vip' THEN 'level6'
        ELSE 'level3'
      END
      WHERE betting_limit_level IS NOT NULL
    `);
    
    await db.none(`
      UPDATE agents 
      SET betting_limit_level = CASE 
        WHEN betting_limit_level = 'mini' THEN 'level1'
        WHEN betting_limit_level = 'basic' THEN 'level2'
        WHEN betting_limit_level = 'standard' THEN 'level3'
        WHEN betting_limit_level = 'premium' THEN 'level4'
        WHEN betting_limit_level = 'vip' THEN 'level6'
        ELSE 'level3'
      END
      WHERE betting_limit_level IS NOT NULL
    `);
    
    console.log('\n✅ 旧的限红配置已成功恢复！\n');
    
    // 显示恢复后的配置
    const restoredConfigs = await db.any(`
      SELECT * FROM betting_limit_configs 
      ORDER BY level_order
    `);
    
    console.log('恢复后的限红配置:');
    console.log('=====================================');
    restoredConfigs.forEach(config => {
      console.log(`\n${config.level_order}. ${config.level_display_name} (${config.level_name})`);
      console.log(`   描述: ${config.description}`);
      console.log('   限额设定:');
      const limits = config.config;
      console.log(`     • 1-10车号: 单注最高 $${limits.number.maxBet}, 单期限额 $${limits.number.periodLimit}`);
      console.log(`     • 两面: 单注最高 $${limits.twoSide.maxBet}, 单期限额 $${limits.twoSide.periodLimit}`);
      console.log(`     • 冠亚军和大小/单双: 单注最高 $${limits.sumValueSize.maxBet}, 单期限额 $${limits.sumValueSize.periodLimit}`);
      console.log(`     • 冠亚军和值: 单注最高 $${limits.sumValue.maxBet}, 单期限额 $${limits.sumValue.periodLimit}`);
      console.log(`     • 龙虎: 单注最高 $${limits.dragonTiger.maxBet}, 单期限额 $${limits.dragonTiger.periodLimit}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

restoreLimits();
