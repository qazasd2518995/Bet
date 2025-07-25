// ensure-database-constraints.js - 确保数据库约束正确设置
import db from './db/config.js';

async function ensureDatabaseConstraints() {
  try {
    console.log('🔧 检查并修复数据库约束...');
    
    // 检查 result_history 表的 unique_period 约束是否存在
    const constraintExists = await db.oneOrNone(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'result_history' 
        AND constraint_type = 'UNIQUE' 
        AND constraint_name = 'unique_period'
    `);
    
    if (!constraintExists) {
      console.log('⚠️ unique_period 约束不存在，开始创建...');
      
      // 首先清理重复数据
      console.log('🧹 清理重复的 period 记录...');
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
      
      console.log(`✅ 已删除 ${deletedCount} 条重复记录`);
      
      // 添加唯一约束
      await db.none(`
        ALTER TABLE result_history 
        ADD CONSTRAINT unique_period UNIQUE (period)
      `);
      
      console.log('✅ unique_period 约束创建成功');
    } else {
      console.log('✅ unique_period 约束已存在');
    }
    
    // 检查统计信息
    const stats = await db.one(`
      SELECT 
        COUNT(*) as total_records, 
        COUNT(DISTINCT period) as unique_periods 
      FROM result_history
    `);
    
    console.log(`📊 数据库统计: 总记录数 ${stats.total_records}, 唯一期号数 ${stats.unique_periods}`);
    
    if (stats.total_records !== stats.unique_periods) {
      console.log('⚠️ 警告: 仍有重复期号数据，需要进一步清理');
    }
    
    console.log('✅ 数据库约束检查完成');
    
  } catch (error) {
    console.error('❌ 确保数据库约束时出错:', error);
    throw error;
  }
}

// 如果直接执行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
  ensureDatabaseConstraints()
    .then(() => {
      console.log('🎉 数据库约束脚本执行完毕');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 执行数据库约束脚本时出错:', error);
      process.exit(1);
    });
}

export default ensureDatabaseConstraints; 