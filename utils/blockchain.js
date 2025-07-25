// utils/blockchain.js - 模拟区块链资料生成
import crypto from 'crypto';

// 生成模拟的区块高度（基于时间戳和期号）
export function generateBlockHeight(period) {
  // 使用期号和时间戳生成一个看起来合理的区块高度
  const baseHeight = 1000000; // 基础高度
  // 确保 period 是字串
  const periodStr = String(period);
  const periodNum = parseInt(periodStr.replace(/\D/g, '').slice(-6)) || 0;
  return (baseHeight + periodNum).toString();
}

// 生成模拟的区块哈希
export function generateBlockHash(period, result) {
  // 使用期号和结果生成一个看起来像区块哈希的字符串
  const data = `${period}-${JSON.stringify(result)}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return '0x' + hash;
}

// 生成区块链资料
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