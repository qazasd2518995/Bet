import db from './db/config.js';
import { generateBlockchainData } from './utils/blockchain.js';

async function populateBlockData() {
  try {
    console.log('开始为现有记录补充区块资料...');
    
    // 1. 更新 draw_records 表
    console.log('\n更新 draw_records 表...');
    const drawRecords = await db.any(`
      SELECT period, result 
      FROM draw_records 
      WHERE block_height IS NULL
      ORDER BY period DESC
      LIMIT 100
    `);
    
    for (const record of drawRecords) {
      const blockData = generateBlockchainData(record.period, record.result);
      await db.none(`
        UPDATE draw_records 
        SET block_height = $1, block_hash = $2
        WHERE period = $3
      `, [blockData.blockHeight, blockData.blockHash, record.period]);
      console.log(`✅ 更新 draw_records: ${record.period} -> 区块高度: ${blockData.blockHeight}`);
    }
    
    // 2. 更新 result_history 表
    console.log('\n更新 result_history 表...');
    const resultHistory = await db.any(`
      SELECT period, result 
      FROM result_history 
      WHERE block_height IS NULL
      ORDER BY period DESC
      LIMIT 100
    `);
    
    for (const record of resultHistory) {
      const result = Array.isArray(record.result) ? record.result : JSON.parse(record.result);
      const blockData = generateBlockchainData(record.period, result);
      await db.none(`
        UPDATE result_history 
        SET block_height = $1, block_hash = $2
        WHERE period = $3
      `, [blockData.blockHeight, blockData.blockHash, record.period]);
      console.log(`✅ 更新 result_history: ${record.period} -> 区块高度: ${blockData.blockHeight}`);
    }
    
    // 3. 更新当前 game_state
    console.log('\n更新 game_state 表...');
    const gameState = await db.oneOrNone(`
      SELECT current_period, last_result 
      FROM game_state 
      WHERE id = 1
    `);
    
    if (gameState && gameState.last_result) {
      const result = Array.isArray(gameState.last_result) ? gameState.last_result : JSON.parse(gameState.last_result);
      const blockData = generateBlockchainData(gameState.current_period, result);
      await db.none(`
        UPDATE game_state 
        SET current_block_height = $1, current_block_hash = $2
        WHERE id = 1
      `, [blockData.blockHeight, blockData.blockHash]);
      console.log(`✅ 更新 game_state: 当前区块高度: ${blockData.blockHeight}`);
    }
    
    console.log('\n✅ 区块资料补充完成！');
    
  } catch (error) {
    console.error('❌ 补充区块资料失败:', error);
  } finally {
    process.exit(0);
  }
}

populateBlockData();