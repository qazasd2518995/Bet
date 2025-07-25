// utils/blockchain.js - 模擬區塊鏈資料生成
import crypto from 'crypto';

// 生成模擬的區塊高度（基於時間戳和期號）
export function generateBlockHeight(period) {
  // 使用期號和時間戳生成一個看起來合理的區塊高度
  const baseHeight = 1000000; // 基礎高度
  // 確保 period 是字串
  const periodStr = String(period);
  const periodNum = parseInt(periodStr.replace(/\D/g, '').slice(-6)) || 0;
  return (baseHeight + periodNum).toString();
}

// 生成模擬的區塊哈希
export function generateBlockHash(period, result) {
  // 使用期號和結果生成一個看起來像區塊哈希的字符串
  const data = `${period}-${JSON.stringify(result)}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return '0x' + hash;
}

// 生成區塊鏈資料
export function generateBlockchainData(period, result) {
  return {
    blockHeight: generateBlockHeight(period),
    blockHash: generateBlockHash(period, result)
  };
}

export default {
  generateBlockHeight,
  generateBlockHash,
  generateBlockchainData
};