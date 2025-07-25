import db from './db/config.js';
import fs from 'fs';

async function executeSQLFix() {
  try {
    console.log('🔧 执行 result_history 表修复...\n');
    
    // 1. 添加所有 position 列
    console.log('添加 position 列...');
    for (let i = 1; i <= 10; i++) {
      await db.none(`ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_${i} INTEGER`);
      console.log(`✅ position_${i} 列已添加`);
    }
    
    // 2. 添加 draw_time 列
    console.log('\n添加 draw_time 列...');
    await db.none(`ALTER TABLE result_history ADD COLUMN IF NOT EXISTS draw_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    console.log('✅ draw_time 列已添加');
    
    // 3. 从现有的 result JSON 栏位更新 position 值
    console.log('\n更新现有记录的 position 值...');
    const updateResult = await db.result(`
      UPDATE result_history 
      SET 
        position_1 = (result::json->0)::int,
        position_2 = (result::json->1)::int,
        position_3 = (result::json->2)::int,
        position_4 = (result::json->3)::int,
        position_5 = (result::json->4)::int,
        position_6 = (result::json->5)::int,
        position_7 = (result::json->6)::int,
        position_8 = (result::json->7)::int,
        position_9 = (result::json->8)::int,
        position_10 = (result::json->9)::int
      WHERE result IS NOT NULL 
        AND jsonb_typeof(result::jsonb) = 'array'
        AND jsonb_array_length(result::jsonb) = 10
        AND position_1 IS NULL
    `);
    console.log(`✅ 更新了 ${updateResult.rowCount} 笔记录`);
    
    // 4. 检查表结构
    console.log('\n检查表结构...');
    const columns = await db.any(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'result_history' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nresult_history 表结构:');
    columns.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n✅ 修复完成！');
    
  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    db.$pool.end();
  }
}

executeSQLFix();