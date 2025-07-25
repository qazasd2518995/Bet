const pgp = require('pg-promise')();

// 配置資料庫連接
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'bet_game',
  user: 'justin'
};

const db = pgp(dbConfig);

async function debugDeleteControl() {
  console.log('🔍 開始調試刪除輸贏控制問題...\n');
  
  try {
    // 1. 檢查資料庫連接
    console.log('1. 檢查資料庫連接...');
    await db.one('SELECT NOW()');
    console.log('✅ 資料庫連接正常');
    
    // 2. 檢查表是否存在
    console.log('\n2. 檢查相關表是否存在...');
    const tables = await db.any(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name IN ('win_loss_control', 'win_loss_control_logs')
      AND table_schema = 'public'
    `);
    console.log('📋 存在的表:', tables.map(t => t.table_name));
    
    // 3. 檢查 win_loss_control 表結構
    console.log('\n3. 檢查 win_loss_control 表結構...');
    const controlColumns = await db.any(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'win_loss_control'
      ORDER BY ordinal_position
    `);
    console.log('📊 win_loss_control 欄位:');
    controlColumns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 4. 檢查 win_loss_control_logs 表結構
    console.log('\n4. 檢查 win_loss_control_logs 表結構...');
    const logColumns = await db.any(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'win_loss_control_logs'
      ORDER BY ordinal_position
    `);
    console.log('📊 win_loss_control_logs 欄位:');
    logColumns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 5. 檢查現有的控制記錄
    console.log('\n5. 檢查現有的控制記錄...');
    const controls = await db.any('SELECT * FROM win_loss_control LIMIT 5');
    console.log(`📋 找到 ${controls.length} 個控制記錄`);
    if (controls.length > 0) {
      console.log('🔍 第一個記錄範例:', controls[0]);
    }
    
    // 6. 測試創建臨時控制記錄
    console.log('\n6. 測試創建臨時控制記錄...');
    const testControl = await db.one(`
      INSERT INTO win_loss_control 
      (control_mode, control_percentage, win_control, loss_control, is_active, operator_id, operator_username)
      VALUES ('normal', 50, false, false, false, 1, 'test_user')
      RETURNING *
    `);
    console.log('✅ 臨時控制記錄創建成功:', testControl.id);
    
    // 7. 測試日誌記錄功能
    console.log('\n7. 測試日誌記錄功能...');
    try {
      await db.none(`
        INSERT INTO win_loss_control_logs (control_id, action, old_values, operator_id, operator_username)
        VALUES ($1, 'test', $2, $3, $4)
      `, [
        testControl.id,
        JSON.stringify({ test: 'data' }),
        1,
        'test_user'
      ]);
      console.log('✅ 日誌記錄成功');
    } catch (logError) {
      console.error('❌ 日誌記錄失敗:', logError.message);
    }
    
    // 8. 測試刪除功能
    console.log('\n8. 測試刪除功能...');
    try {
      // 先刪除主記錄
      await db.none('DELETE FROM win_loss_control WHERE id = $1', [testControl.id]);
      console.log('✅ 主記錄刪除成功');
      
      // 再記錄日誌
      await db.none(`
        INSERT INTO win_loss_control_logs (control_id, action, old_values, operator_id, operator_username)
        VALUES ($1, 'delete', $2, $3, $4)
      `, [
        testControl.id,
        JSON.stringify(testControl),
        1,
        'test_user'
      ]);
      console.log('✅ 刪除日誌記錄成功');
      
    } catch (deleteError) {
      console.error('❌ 刪除過程中發生錯誤:', deleteError.message);
      console.error('🔍 錯誤詳情:', deleteError);
    }
    
    // 9. 清理測試數據
    console.log('\n9. 清理測試數據...');
    await db.none('DELETE FROM win_loss_control_logs WHERE control_id = $1', [testControl.id]);
    console.log('✅ 測試數據清理完成');
    
    console.log('\n🎉 調試完成！');
    
  } catch (error) {
    console.error('❌ 調試過程中發生錯誤:', error.message);
    console.error('🔍 錯誤詳情:', error);
  } finally {
    pgp.end();
  }
}

// 執行調試
debugDeleteControl(); 