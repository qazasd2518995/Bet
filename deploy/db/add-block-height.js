// db/add-block-height.js - 添加区块高度栏位到相关表格
import db from './config.js';

async function addBlockHeight() {
  try {
    console.log('开始添加区块高度栏位...');
    
    // 1. 为 draw_records 表添加 block_height 栏位
    await db.none(`
      ALTER TABLE draw_records 
      ADD COLUMN IF NOT EXISTS block_height VARCHAR(50),
      ADD COLUMN IF NOT EXISTS block_hash VARCHAR(100)
    `);
    console.log('✅ draw_records 表已添加 block_height 和 block_hash 栏位');
    
    // 2. 为 result_history 表添加 block_height 栏位
    await db.none(`
      ALTER TABLE result_history 
      ADD COLUMN IF NOT EXISTS block_height VARCHAR(50),
      ADD COLUMN IF NOT EXISTS block_hash VARCHAR(100)
    `);
    console.log('✅ result_history 表已添加 block_height 和 block_hash 栏位');
    
    // 3. 为 game_state 表添加当前区块资讯
    await db.none(`
      ALTER TABLE game_state 
      ADD COLUMN IF NOT EXISTS current_block_height VARCHAR(50),
      ADD COLUMN IF NOT EXISTS current_block_hash VARCHAR(100)
    `);
    console.log('✅ game_state 表已添加当前区块资讯栏位');
    
    // 4. 创建索引以提高查询效率
    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_draw_records_block_height 
      ON draw_records(block_height)
    `);
    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_result_history_block_height 
      ON result_history(block_height)
    `);
    console.log('✅ 已创建区块高度索引');
    
    console.log('✅ 区块高度栏位添加完成！');
    
  } catch (error) {
    console.error('❌ 添加区块高度栏位时出错:', error);
    throw error;
  }
}

// 执行迁移
if (process.argv[1] === new URL(import.meta.url).pathname) {
  addBlockHeight()
    .then(() => {
      console.log('区块高度栏位添加脚本执行完毕');
      process.exit(0);
    })
    .catch(error => {
      console.error('执行区块高度栏位添加脚本时出错:', error);
      process.exit(1);
    });
}

export default addBlockHeight;