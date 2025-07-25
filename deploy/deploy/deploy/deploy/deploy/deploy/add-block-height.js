// db/add-block-height.js - 添加區塊高度欄位到相關表格
import db from './config.js';

async function addBlockHeight() {
  try {
    console.log('開始添加區塊高度欄位...');
    
    // 1. 為 draw_records 表添加 block_height 欄位
    await db.none(`
      ALTER TABLE draw_records 
      ADD COLUMN IF NOT EXISTS block_height VARCHAR(50),
      ADD COLUMN IF NOT EXISTS block_hash VARCHAR(100)
    `);
    console.log('✅ draw_records 表已添加 block_height 和 block_hash 欄位');
    
    // 2. 為 result_history 表添加 block_height 欄位
    await db.none(`
      ALTER TABLE result_history 
      ADD COLUMN IF NOT EXISTS block_height VARCHAR(50),
      ADD COLUMN IF NOT EXISTS block_hash VARCHAR(100)
    `);
    console.log('✅ result_history 表已添加 block_height 和 block_hash 欄位');
    
    // 3. 為 game_state 表添加當前區塊資訊
    await db.none(`
      ALTER TABLE game_state 
      ADD COLUMN IF NOT EXISTS current_block_height VARCHAR(50),
      ADD COLUMN IF NOT EXISTS current_block_hash VARCHAR(100)
    `);
    console.log('✅ game_state 表已添加當前區塊資訊欄位');
    
    // 4. 創建索引以提高查詢效率
    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_draw_records_block_height 
      ON draw_records(block_height)
    `);
    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_result_history_block_height 
      ON result_history(block_height)
    `);
    console.log('✅ 已創建區塊高度索引');
    
    console.log('✅ 區塊高度欄位添加完成！');
    
  } catch (error) {
    console.error('❌ 添加區塊高度欄位時出錯:', error);
    throw error;
  }
}

// 執行遷移
if (process.argv[1] === new URL(import.meta.url).pathname) {
  addBlockHeight()
    .then(() => {
      console.log('區塊高度欄位添加腳本執行完畢');
      process.exit(0);
    })
    .catch(error => {
      console.error('執行區塊高度欄位添加腳本時出錯:', error);
      process.exit(1);
    });
}

export default addBlockHeight;