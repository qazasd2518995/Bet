import db from './db/config.js';
import { generateBlockchainData } from './utils/blockchain.js';

async function updateLatestBlocks() {
  try {
    console.log('更新最新开奖记录的区块资料...');
    
    // 查询没有区块高度的最新记录
    const records = await db.any(`
      SELECT period, result 
      FROM draw_records 
      WHERE block_height IS NULL
      ORDER BY period DESC
    `);
    
    console.log(`找到 ${records.length} 笔需要更新的记录`);
    
    for (const record of records) {
      const blockData = generateBlockchainData(record.period, record.result);
      
      // 更新 draw_records
      await db.none(`
        UPDATE draw_records 
        SET block_height = $1, block_hash = $2
        WHERE period = $3
      `, [blockData.blockHeight, blockData.blockHash, record.period]);
      
      // 同时更新 result_history（如果存在）
      await db.none(`
        UPDATE result_history 
        SET block_height = $1, block_hash = $2
        WHERE period = $3
      `, [blockData.blockHeight, blockData.blockHash, record.period]);
      
      console.log(`✅ 更新期号 ${record.period} -> 区块高度: ${blockData.blockHeight}`);
    }
    
    console.log('\n✅ 更新完成！');
    
  } catch (error) {
    console.error('❌ 更新失败:', error);
  } finally {
    process.exit(0);
  }
}

updateLatestBlocks();