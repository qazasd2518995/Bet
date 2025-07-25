import db from './db/config.js';

async function restoreLimits() {
  try {
    console.log('開始恢復舊的限紅配置...\n');
    
    // 步驟1: 備份現有資料
    console.log('步驟1: 備份現有資料...');
    await db.none(`
      CREATE TABLE IF NOT EXISTS betting_limit_configs_backup AS 
      SELECT * FROM betting_limit_configs
    `);
    
    // 步驟2: 清空現有配置
    console.log('步驟2: 清空現有配置...');
    await db.none('TRUNCATE TABLE betting_limit_configs');
    
    // 步驟3: 插入新配置
    console.log('步驟3: 插入舊的6級限紅配置...');
    
    const configs = [
      {
        level_name: 'level1',
        level_display_name: '新手限紅',
        level_order: 1,
        description: '適合新手玩家的最低限額',
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
        level_display_name: '一般限紅',
        level_order: 2,
        description: '一般會員標準限額',
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
        level_display_name: '標準限紅',
        level_order: 3,
        description: '標準會員限額',
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
        level_display_name: '進階限紅',
        level_order: 4,
        description: '進階會員限額',
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
        level_display_name: '高級限紅',
        level_order: 5,
        description: '高級會員限額',
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
        level_display_name: 'VIP限紅',
        level_order: 6,
        description: 'VIP會員最高限額',
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
    
    // 步驟4: 更新現有會員和代理的限紅等級
    console.log('步驟4: 更新現有會員和代理的限紅等級...');
    
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
    
    console.log('\n✅ 舊的限紅配置已成功恢復！\n');
    
    // 顯示恢復後的配置
    const restoredConfigs = await db.any(`
      SELECT * FROM betting_limit_configs 
      ORDER BY level_order
    `);
    
    console.log('恢復後的限紅配置:');
    console.log('=====================================');
    restoredConfigs.forEach(config => {
      console.log(`\n${config.level_order}. ${config.level_display_name} (${config.level_name})`);
      console.log(`   描述: ${config.description}`);
      console.log('   限額設定:');
      const limits = config.config;
      console.log(`     • 1-10車號: 單注最高 $${limits.number.maxBet}, 單期限額 $${limits.number.periodLimit}`);
      console.log(`     • 兩面: 單注最高 $${limits.twoSide.maxBet}, 單期限額 $${limits.twoSide.periodLimit}`);
      console.log(`     • 冠亞軍和大小/單雙: 單注最高 $${limits.sumValueSize.maxBet}, 單期限額 $${limits.sumValueSize.periodLimit}`);
      console.log(`     • 冠亞軍和值: 單注最高 $${limits.sumValue.maxBet}, 單期限額 $${limits.sumValue.periodLimit}`);
      console.log(`     • 龍虎: 單注最高 $${limits.dragonTiger.maxBet}, 單期限額 $${limits.dragonTiger.periodLimit}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('錯誤:', error);
    process.exit(1);
  }
}

restoreLimits();
