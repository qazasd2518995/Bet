// cache/hotBetsManager.js - 基於 Redis 的熱門投注管理器
import redisCache from './redis.js';
import db from '../db/config.js';

class HotBetsManager {
  constructor() {
    this.cachePrefix = 'hotbets:';
    this.statPrefix = 'betstats:';
    this.cacheTime = 300; // 5分鐘緩存
    this.statsTime = 86400; // 24小時統計
  }

  // 獲取緩存鍵名
  getCacheKey(type) {
    return `${this.cachePrefix}${type}`;
  }

  // 獲取統計鍵名  
  getStatsKey(period, type, value, position = null) {
    const periodKey = this.getPeriodKey(period);
    if (position !== null) {
      return `${this.statPrefix}${periodKey}:${type}:${position}:${value}`;
    }
    return `${this.statPrefix}${periodKey}:${type}:${value}`;
  }

  // 獲取時間段鍵（按小時分組）
  getPeriodKey(timestamp = null) {
    const date = timestamp ? new Date(timestamp) : new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`;
  }

  // 記錄投注統計（當有新投注時調用）
  async recordBet(betData) {
    try {
      const { bet_type, bet_value, position, amount } = betData;
      
      if (!redisCache.isAvailable()) {
        console.warn('Redis 不可用，跳過投注統計記錄');
        return false;
      }

      // 構建統計鍵
      const statsKey = this.getStatsKey(null, bet_type, bet_value, position);
      const countKey = `${statsKey}:count`;
      const amountKey = `${statsKey}:amount`;

      // 原子性增加計數和金額
      await Promise.all([
        redisCache.incr(countKey, this.statsTime),
        redisCache.incrBy(amountKey, Math.floor(amount * 100), this.statsTime) // 存儲為分
      ]);

      // 清除緩存以觸發重新計算
      await this.clearCache();
      
      return true;
    } catch (error) {
      console.error('記錄投注統計失敗:', error);
      return false;
    }
  }

  // 獲取熱門投注數據
  async getHotBets(limit = 10) {
    try {
      // 先嘗試從緩存獲取
      const cacheKey = this.getCacheKey('top');
      let hotBets = await redisCache.get(cacheKey);
      
      if (hotBets && Array.isArray(hotBets)) {
        console.log(`從緩存獲取熱門投注數據: ${hotBets.length} 個`);
        return hotBets;
      }

      // 緩存不存在，重新計算
      hotBets = await this.calculateHotBets(limit);
      
      // 存入緩存
      if (hotBets.length > 0) {
        await redisCache.set(cacheKey, hotBets, this.cacheTime);
      }
      
      return hotBets;
    } catch (error) {
      console.error('獲取熱門投注數據失敗:', error);
      return [];
    }
  }

  // 計算熱門投注數據
  async calculateHotBets(limit = 10) {
    try {
      const allBets = [];

      if (redisCache.isAvailable()) {
        // 使用 Redis 統計數據
        const hotBets = await this.calculateFromRedis();
        allBets.push(...hotBets);
      } else {
        // 降級到數據庫查詢
        console.warn('Redis 不可用，使用數據庫查詢計算熱門投注');
        const hotBets = await this.calculateFromDatabase();
        allBets.push(...hotBets);
      }

      // 排序並限制數量
      const sortedBets = allBets
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      console.log(`計算熱門投注完成: ${sortedBets.length} 個`);
      return sortedBets;
    } catch (error) {
      console.error('計算熱門投注數據失敗:', error);
      return [];
    }
  }

  // 從 Redis 統計數據計算
  async calculateFromRedis() {
    try {
      const now = new Date();
      const hoursToCheck = 24; // 檢查最近24小時
      const allBets = [];

      for (let i = 0; i < hoursToCheck; i++) {
        const checkTime = new Date(now.getTime() - i * 60 * 60 * 1000);
        const periodKey = this.getPeriodKey(checkTime);
        const pattern = `${this.statPrefix}${periodKey}:*:count`;
        
        const keys = await redisCache.keys(pattern);
        
        for (const key of keys) {
          const count = await redisCache.get(key.replace(':count', ':count'));
          const amountKey = key.replace(':count', ':amount');
          const amount = await redisCache.get(amountKey) || 0;
          
          if (count > 0) {
            const bet = this.parseStatsKey(key, count, amount / 100); // 轉換回元
            if (bet) {
              allBets.push(bet);
            }
          }
        }
      }

      // 合併相同投注類型的統計
      return this.mergeBetStats(allBets);
    } catch (error) {
      console.error('從 Redis 計算熱門投注失敗:', error);
      return [];
    }
  }

  // 從數據庫查詢計算
  async calculateFromDatabase() {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24小時前

      const recentBets = await db.any(`
        SELECT 
          bet_type, 
          bet_value, 
          position,
          COUNT(*) as bet_count,
          SUM(amount) as total_amount
        FROM bet_history
        WHERE created_at > $1
        GROUP BY bet_type, bet_value, position
        HAVING COUNT(*) > 1
        ORDER BY bet_count DESC
      `, [startTime]);

      return recentBets.map(bet => this.formatBetData({
        type: bet.bet_type,
        value: bet.bet_value,
        position: bet.position,
        count: parseInt(bet.bet_count),
        amount: parseFloat(bet.total_amount)
      }));
    } catch (error) {
      console.error('從數據庫計算熱門投注失敗:', error);
      return [];
    }
  }

  // 解析統計鍵
  parseStatsKey(key, count, amount) {
    try {
      const parts = key.replace(this.statPrefix, '').split(':');
      if (parts.length < 4) return null;

      const [period, type, ...valueParts] = parts;
      let value, position = null;

      if (type === 'number' && valueParts.length >= 2) {
        position = parseInt(valueParts[0]);
        value = valueParts[1];
      } else {
        // 改進的鍵解析邏輯 - 明確處理 :count 和 :amount 後綴
        const joinedValue = valueParts.join(':');
        if (joinedValue.endsWith(':count')) {
          value = joinedValue.slice(0, -6); // 移除 ':count'
        } else if (joinedValue.endsWith(':amount')) {
          value = joinedValue.slice(0, -7); // 移除 ':amount'
        } else {
          value = joinedValue;
        }
      }

      return this.formatBetData({
        type,
        value,
        position,
        count: parseInt(count) || 0,
        amount: parseFloat(amount) || 0
      });
    } catch (error) {
      console.error('解析統計鍵失敗:', error);
      return null;
    }
  }

  // 合併相同投注的統計
  mergeBetStats(bets) {
    const merged = new Map();

    bets.forEach(bet => {
      const key = `${bet.type}:${bet.value}:${bet.position || ''}`;
      
      if (merged.has(key)) {
        const existing = merged.get(key);
        existing.count += bet.count;
        existing.amount += bet.amount;
      } else {
        merged.set(key, { ...bet });
      }
    });

    return Array.from(merged.values());
  }

  // 格式化投注數據
  formatBetData({ type, value, position, count, amount }) {
    const label = this.generateLabel(type, value, position);
    
    return {
      type,
      typeLabel: this.getTypeLabel(type),
      value,
      position,
      count,
      amount,
      label,
      isHot: true
    };
  }

  // 生成標籤
  generateLabel(type, value, position) {
    const valueMap = {
      'big': '大', 'small': '小', 'odd': '單', 'even': '雙',
      'dragon': '龍', 'tiger': '虎'
    };

    switch (type) {
      case 'number':
        return `第${position}名 ${value}號`;
      case 'sumValue':
        return valueMap[value] ? `冠亞和 ${valueMap[value]}` : `冠亞和 ${value}`;
      case 'champion':
        return valueMap[value] ? `冠軍 ${valueMap[value]}` : `冠軍 ${value}號`;
      case 'runnerup':
        return valueMap[value] ? `亞軍 ${valueMap[value]}` : `亞軍 ${value}號`;
      case 'dragonTiger':
        return `龍虎 ${valueMap[value] || value}`;
      default:
        return `${this.getTypeLabel(type)} ${valueMap[value] || value}`;
    }
  }

  // 獲取類型標籤
  getTypeLabel(type) {
    const typeMap = {
      'number': '單號',
      'sumValue': '冠亞和',
      'champion': '冠軍',
      'runnerup': '亞軍',
      'dragonTiger': '龍虎'
    };
    return typeMap[type] || type;
  }

  // 清除緩存
  async clearCache() {
    try {
      const pattern = `${this.cachePrefix}*`;
      const keys = await redisCache.keys(pattern);
      
      if (keys.length > 0) {
        await Promise.all(keys.map(key => redisCache.del(key)));
        console.log(`清除熱門投注緩存: ${keys.length} 個鍵`);
      }
    } catch (error) {
      console.error('清除緩存失敗:', error);
    }
  }

  // 清理過期統計數據
  async cleanupExpiredStats() {
    try {
      if (!redisCache.isAvailable()) {
        return;
      }

      const pattern = `${this.statPrefix}*`;
      const keys = await redisCache.keys(pattern);
      
      const now = new Date();
      const expiredKeys = [];

      for (const key of keys) {
        const ttl = await redisCache.redis.ttl(key);
        if (ttl === -1) {
          // 沒有過期時間的鍵，設置過期時間
          await redisCache.redis.expire(key, this.statsTime);
        } else if (ttl === -2) {
          // 已過期但未被清理的鍵
          expiredKeys.push(key);
        }
      }

      if (expiredKeys.length > 0) {
        await Promise.all(expiredKeys.map(key => redisCache.del(key)));
        console.log(`清理過期統計數據: ${expiredKeys.length} 個鍵`);
      }
    } catch (error) {
      console.error('清理過期統計數據失敗:', error);
    }
  }
}

// 創建單例實例
const hotBetsManager = new HotBetsManager();

export default hotBetsManager;
