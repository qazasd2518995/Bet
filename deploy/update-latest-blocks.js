import db from './db/config.js';
import { generateBlockchainData } from './utils/blockchain.js';

async function updateLatestBlocks() {
  try {
    console.log('更新最新開獎記錄的區塊資料...');
    
    // 查詢沒有區塊高度的最新記錄
    const records = await db.any(`
      SELECT period, result 
      FROM draw_records 
      WHERE block_height IS NULL
      ORDER BY period DESC
    `);
    
    console.log(`找到 ${records.length} 筆需要更新的記錄`);
    
    for (const record of records) {
      const blockData = generateBlockchainData(record.period, record.result);
      
      // 更新 draw_records
      await db.none(`
        UPDATE draw_records 
        SET block_height = $1, block_hash = $2
        WHERE period = $3
      `, [blockData.blockHeight, blockData.blockHash, record.period]);
      
      // 同時更新 result_history（如果存在）
      await db.none(`
        UPDATE result_history 
        SET block_height = $1, block_hash = $2
        WHERE period = $3
      `, [blockData.blockHeight, blockData.blockHash, record.period]);
      
      console.log(`✅ 更新期號 ${record.period} -> 區塊高度: ${blockData.blockHeight}`);
    }
    
    console.log('\n✅ 更新完成！');
    
  } catch (error) {
    console.error('❌ 更新失敗:', error);
  } finally {
    process.exit(0);
  }
}

updateLatestBlocks();