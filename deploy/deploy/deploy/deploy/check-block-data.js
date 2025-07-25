import db from './db/config.js';

async function checkBlockData() {
  try {
    console.log('檢查 draw_records 表的區塊資料...');
    
    const records = await db.any(`
      SELECT period, result, block_height, block_hash 
      FROM draw_records 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('\n最近10筆開獎記錄:');
    records.forEach(record => {
      console.log(`期號: ${record.period}, 區塊高度: ${record.block_height || '無'}, 區塊哈希: ${record.block_hash ? record.block_hash.substring(0, 10) + '...' : '無'}`);
    });
    
    // 檢查 result_history 表
    console.log('\n檢查 result_history 表的區塊資料...');
    const resultHistory = await db.any(`
      SELECT period, block_height, block_hash 
      FROM result_history 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('\n最近10筆結果歷史:');
    resultHistory.forEach(record => {
      console.log(`期號: ${record.period}, 區塊高度: ${record.block_height || '無'}, 區塊哈希: ${record.block_hash ? record.block_hash.substring(0, 10) + '...' : '無'}`);
    });
    
    // 檢查 game_state 表
    console.log('\n檢查 game_state 表的區塊資料...');
    const gameState = await db.oneOrNone(`
      SELECT current_period, current_block_height, current_block_hash 
      FROM game_state 
      WHERE id = 1
    `);
    
    if (gameState) {
      console.log(`\n當前遊戲狀態:`);
      console.log(`期號: ${gameState.current_period}, 區塊高度: ${gameState.current_block_height || '無'}, 區塊哈希: ${gameState.current_block_hash ? gameState.current_block_hash.substring(0, 10) + '...' : '無'}`);
    }
    
  } catch (error) {
    console.error('檢查失敗:', error);
  } finally {
    process.exit(0);
  }
}

checkBlockData();