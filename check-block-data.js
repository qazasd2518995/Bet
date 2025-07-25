import db from './db/config.js';

async function checkBlockData() {
  try {
    console.log('检查 draw_records 表的区块资料...');
    
    const records = await db.any(`
      SELECT period, result, block_height, block_hash 
      FROM draw_records 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('\n最近10笔开奖记录:');
    records.forEach(record => {
      console.log(`期号: ${record.period}, 区块高度: ${record.block_height || '无'}, 区块哈希: ${record.block_hash ? record.block_hash.substring(0, 10) + '...' : '无'}`);
    });
    
    // 检查 result_history 表
    console.log('\n检查 result_history 表的区块资料...');
    const resultHistory = await db.any(`
      SELECT period, block_height, block_hash 
      FROM result_history 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    console.log('\n最近10笔结果历史:');
    resultHistory.forEach(record => {
      console.log(`期号: ${record.period}, 区块高度: ${record.block_height || '无'}, 区块哈希: ${record.block_hash ? record.block_hash.substring(0, 10) + '...' : '无'}`);
    });
    
    // 检查 game_state 表
    console.log('\n检查 game_state 表的区块资料...');
    const gameState = await db.oneOrNone(`
      SELECT current_period, current_block_height, current_block_hash 
      FROM game_state 
      WHERE id = 1
    `);
    
    if (gameState) {
      console.log(`\n当前游戏状态:`);
      console.log(`期号: ${gameState.current_period}, 区块高度: ${gameState.current_block_height || '无'}, 区块哈希: ${gameState.current_block_hash ? gameState.current_block_hash.substring(0, 10) + '...' : '无'}`);
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    process.exit(0);
  }
}

checkBlockData();