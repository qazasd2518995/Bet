// auto-sync-blocks.js - 自動同步區塊資料的背景服務
import db from './db/config.js';
import { generateBlockchainData } from './utils/blockchain.js';

const SYNC_INTERVAL = 10000; // 每10秒同步一次

async function syncBlockData() {
  try {
    // 查詢沒有區塊高度的記錄
    const missingBlockRecords = await db.any(`
      SELECT period, result 
      FROM draw_records 
      WHERE block_height IS NULL
      LIMIT 50
    `);
    
    if (missingBlockRecords.length > 0) {
      console.log(`[${new Date().toLocaleTimeString()}] 發現 ${missingBlockRecords.length} 筆需要同步的記錄`);
      
      for (const record of missingBlockRecords) {
        const blockData = generateBlockchainData(record.period, record.result);
        
        // 更新 draw_records
        await db.none(`
          UPDATE draw_records 
          SET block_height = $1, block_hash = $2
          WHERE period = $3
        `, [blockData.blockHeight, blockData.blockHash, record.period]);
        
        // 同時更新 result_history
        await db.none(`
          UPDATE result_history 
          SET block_height = $1, block_hash = $2
          WHERE period = $3
        `, [blockData.blockHeight, blockData.blockHash, record.period]);
        
        console.log(`✅ 同步期號 ${record.period} 區塊高度: ${blockData.blockHeight}`);
      }
    }
    
    // 更新當前遊戲狀態的區塊資料
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
      
      console.log(`✅ 更新 game_state 區塊高度: ${blockData.blockHeight}`);
    }
    
  } catch (error) {
    console.error('❌ 同步區塊資料失敗:', error);
  }
}

// 主循環
async function startAutoSync() {
  console.log('🚀 區塊資料自動同步服務已啟動');
  console.log(`⏰ 同步間隔: ${SYNC_INTERVAL / 1000} 秒`);
  
  // 立即執行一次
  await syncBlockData();
  
  // 設定定時器
  setInterval(async () => {
    await syncBlockData();
  }, SYNC_INTERVAL);
}

// 啟動服務
startAutoSync().catch(console.error);

// 優雅關閉
process.on('SIGINT', () => {
  console.log('\n🛑 區塊資料自動同步服務已停止');
  process.exit(0);
});