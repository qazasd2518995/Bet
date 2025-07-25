// ensure-database-constraints.js - 確保數據庫約束正確設置
import db from './db/config.js';

async function ensureDatabaseConstraints() {
  try {
    console.log('🔧 檢查並修復數據庫約束...');
    
    // 檢查 result_history 表的 unique_period 約束是否存在
    const constraintExists = await db.oneOrNone(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'result_history' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name = 'unique_period'
    `);
    
    if (!constraintExists) {
      console.log('⚠️ unique_period 約束不存在，開始創建...');
      
      // 首先清理重複數據
      console.log('🧹 清理重複的 period 記錄...');
      const deletedCount = await db.result(`
        WITH duplicates AS (
          SELECT id, period, 
                 ROW_NUMBER() OVER (PARTITION BY period ORDER BY created_at DESC) as rn
          FROM result_history
        )
        DELETE FROM result_history 
        WHERE id IN (
          SELECT id FROM duplicates WHERE rn > 1
        )
      `, [], r => r.rowCount);
      
      console.log(`✅ 已刪除 ${deletedCount} 條重複記錄`);
      
      // 添加唯一約束
      await db.none(`
        ALTER TABLE result_history 
        ADD CONSTRAINT unique_period UNIQUE (period)
      `);
      
      console.log('✅ unique_period 約束創建成功');
    } else {
      console.log('✅ unique_period 約束已存在');
    }
    
    // 檢查統計信息
    const stats = await db.one(`
      SELECT 
        COUNT(*) as total_records, 
        COUNT(DISTINCT period) as unique_periods 
      FROM result_history
    `);
    
    console.log(`📊 數據庫統計: 總記錄數 ${stats.total_records}, 唯一期號數 ${stats.unique_periods}`);
    
    if (stats.total_records !== stats.unique_periods) {
      console.log('⚠️ 警告: 仍有重複期號數據，需要進一步清理');
    }
    
    console.log('✅ 數據庫約束檢查完成');
    
  } catch (error) {
    console.error('❌ 確保數據庫約束時出錯:', error);
    throw error;
  }
}

// 如果直接執行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
  ensureDatabaseConstraints()
    .then(() => {
      console.log('🎉 數據庫約束腳本執行完畢');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 執行數據庫約束腳本時出錯:', error);
      process.exit(1);
    });
}

export default ensureDatabaseConstraints; 