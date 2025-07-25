import db from './db/config.js';

async function checkTableStructure() {
  try {
    console.log('🔍 检查 result_history 表结构...\n');
    
    const columns = await db.any(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'result_history' 
      ORDER BY ordinal_position
    `);
    
    console.log('result_history 表的所有列:');
    console.log('列名'.padEnd(20) + '类型'.padEnd(20) + '可空'.padEnd(10) + '默认值');
    console.log('-'.repeat(60));
    
    columns.forEach(col => {
      console.log(
        col.column_name.padEnd(20) + 
        col.data_type.padEnd(20) + 
        col.is_nullable.padEnd(10) + 
        (col.column_default || 'NULL')
      );
    });
    
    // 检查是否有 position 列
    const positionColumns = columns.filter(col => col.column_name.startsWith('position_'));
    console.log(`\n找到 ${positionColumns.length} 个 position 列`);
    
    // 检查是否有 draw_time 列
    const hasDrawTime = columns.some(col => col.column_name === 'draw_time');
    console.log(`draw_time 列: ${hasDrawTime ? '存在' : '不存在'}`);
    
    // 检查最新的记录
    console.log('\n最新5笔记录:');
    const records = await db.any('SELECT period, created_at FROM result_history ORDER BY period DESC LIMIT 5');
    records.forEach(rec => {
      console.log(`期数: ${rec.period}, 创建时间: ${rec.created_at}`);
    });
    
  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    db.$pool.end();
  }
}

checkTableStructure();