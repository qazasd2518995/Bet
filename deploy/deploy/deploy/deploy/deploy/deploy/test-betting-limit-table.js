import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// 檢查環境變量
console.log('DATABASE_URL 是否設置:', !!process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testBettingLimitTable() {
  try {
    console.log('🔍 測試限紅配置表...');
    
    // 1. 檢查表是否存在
    const tableExists = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'betting_limit_configs'
    `);
    
    console.log('📋 表存在性檢查:', tableExists.rows.length > 0 ? '✅ 存在' : '❌ 不存在');
    
    if (tableExists.rows.length === 0) {
      console.log('❌ betting_limit_configs 表不存在，請先運行資料庫初始化');
      return;
    }
    
    // 2. 檢查表結構
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'betting_limit_configs' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 表結構:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // 3. 檢查數據
    const configs = await pool.query(`
      SELECT level_name, level_display_name, description 
      FROM betting_limit_configs 
      ORDER BY 
        CASE level_name 
          WHEN 'level1' THEN 1
          WHEN 'level2' THEN 2
          WHEN 'level3' THEN 3
          WHEN 'level4' THEN 4
          WHEN 'level5' THEN 5
          WHEN 'level6' THEN 6
          ELSE 999
        END
    `);
    
    console.log('📈 限紅配置數據:');
    console.log(`總計: ${configs.rows.length} 個配置`);
    
    configs.rows.forEach(config => {
      console.log(`  - ${config.level_name}: ${config.level_display_name} - ${config.description}`);
    });
    
    // 4. 測試具體的配置
    if (configs.rows.length > 0) {
      const level1Config = await pool.query(`
        SELECT config FROM betting_limit_configs WHERE level_name = 'level1'
      `);
      
      if (level1Config.rows.length > 0) {
        console.log('🎯 Level1 配置詳情:');
        console.log(JSON.stringify(level1Config.rows[0].config, null, 2));
      }
    }
    
    console.log('✅ 限紅配置表測試完成');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    console.error('錯誤詳情:', error);
  } finally {
    await pool.end();
  }
}

testBettingLimitTable(); 