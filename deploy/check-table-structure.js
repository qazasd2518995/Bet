import db from './db/config.js';

async function checkTableStructure() {
  try {
    console.log('\n=== 檢查資料表結構 ===\n');

    // 檢查 result_history 表結構
    console.log('1. result_history 表結構:');
    const resultColumns = await db.any(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'result_history'
      ORDER BY ordinal_position
    `);
    
    console.log('欄位列表:');
    resultColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // 檢查 bet_history 表結構
    console.log('\n2. bet_history 表結構:');
    const betColumns = await db.any(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'bet_history'
      ORDER BY ordinal_position
    `);
    
    console.log('欄位列表:');
    betColumns.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // 檢查最近的開獎記錄
    console.log('\n3. 最近的開獎記錄:');
    const recentResults = await db.any(`
      SELECT * FROM result_history
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (recentResults.length > 0) {
      console.log('找到 result_history 表中的記錄');
      const firstRecord = recentResults[0];
      console.log('\n第一筆記錄的欄位:');
      Object.keys(firstRecord).forEach(key => {
        console.log(`  - ${key}: ${firstRecord[key]}`);
      });
    }

  } catch (error) {
    console.error('檢查過程中發生錯誤:', error);
  } finally {
    await db.$pool.end();
  }
}

// 執行檢查
checkTableStructure();