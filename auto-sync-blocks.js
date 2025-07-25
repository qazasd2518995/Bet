// auto-sync-blocks.js - 自动同步区块资料的背景服务
import db from './db/config.js';
import { generateBlockchainData } from './utils/blockchain.js';

const SYNC_INTERVAL = 10000; // 每10秒同步一次

async function syncBlockData() {
  try {
    // 查询没有区块高度的记录
    const missingBlockRecords = await db.any(`
      SELECT period, result 
      FROM draw_records 
      WHERE block_height IS NULL
      LIMIT 50
    `);
    
    if (missingBlockRecords.length > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] 发现 ${missingBlockRecords.length} 笔需要同步的记录`);
      
      for (const record of missingBlockRecords) {
        const blockData = generateBlockchainData(record.period, record.result);
        
        // 更新 draw_records
        await db.none(`
          UPDATE draw_records 
          SET block_height = $1, block_hash = $2
          WHERE period = $3
        `, [blockData.blockHeight, blockData.blockHash, record.period]);
        
        // 同时更新 result_history
        await db.none(`
          UPDATE result_history 
          SET block_height = $1, block_hash = $2
          WHERE period = $3
        `, [blockData.blockHeight, blockData.blockHash, record.period]);
        
        console.log(`✅ 同步期号 ${record.period} 区块高度: ${blockData.blockHeight}`);
      }
    }
    
    // 更新当前游戏状态的区块资料
    const gameState = await db.oneOrNone(`
      SELECT current_period, last_result 
      FROM game_state 
      WHERE id = 1 AND current_block_height IS NULL
    `);
    
    if (gameState && gameState.last_result) {
      const result = Array.isArray(gameState.last_result) ? gameState.last_result : JSON.parse(gameState.last_result);
      const blockData = generateBlockchainData(gameState.current_period, result);
      
      await db.none(`
        UPDATE game_state 
        SET current_block_height = $1, current_block_hash = $2
        WHERE id = 1
      `, [blockData.blockHeight, blockData.blockHash]);
      
      console.log(`✅ 更新 game_state 区块高度: ${blockData.blockHeight}`);
    }
    
  } catch (error) {
    console.error('❌ 同步区块资料失败:', error);
  }
}

// 主循环
async function startAutoSync() {
  console.log('🚀 区块资料自动同步服务已启动');
  console.log(`⏰ 同步间隔: ${SYNC_INTERVAL / 1000} 秒`);
  
  // 立即执行一次
  await syncBlockData();
  
  // 设定定时器
  setInterval(async () => {
    await syncBlockData();
  }, SYNC_INTERVAL);
}

// 启动服务
startAutoSync().catch(console.error);

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 区块资料自动同步服务已停止');
  process.exit(0);
});