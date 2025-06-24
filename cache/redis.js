// cache/redis.js - Redis 緩存管理器
import Redis from 'ioredis';

class RedisCache {
  constructor() {
    // 在生產環境中使用環境變量配置 Redis
    const redisConfig = process.env.NODE_ENV === 'production' 
      ? {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD,
          db: process.env.REDIS_DB || 0,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
        }
      : {
          host: 'localhost',
          port: 6379,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
        };

    try {
      this.redis = new Redis(redisConfig);
      this.isConnected = true;
      
      this.redis.on('connect', () => {
        console.log('✅ Redis 連接成功');
        this.isConnected = true;
      });
      
      this.redis.on('error', (err) => {
        console.error('❌ Redis 連接錯誤:', err.message);
        this.isConnected = false;
      });
      
      this.redis.on('close', () => {
        console.log('⚠️  Redis 連接關閉');
        this.isConnected = false;
      });
      
    } catch (error) {
      console.error('Redis 初始化失敗:', error);
      this.redis = null;
      this.isConnected = false;
    }
  }

  // 檢查 Redis 是否可用
  isAvailable() {
    return this.redis && this.isConnected;
  }

  // 設置緩存
  async set(key, value, ttl = 3600) {
    if (!this.isAvailable()) {
      console.warn('Redis 不可用，跳過緩存設置');
      return false;
    }
    
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl > 0) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      console.error('Redis 設置緩存失敗:', error);
      return false;
    }
  }

  // 獲取緩存
  async get(key) {
    if (!this.isAvailable()) {
      return null;
    }
    
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis 獲取緩存失敗:', error);
      return null;
    }
  }

  // 刪除緩存
  async del(key) {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      console.error('Redis 刪除緩存失敗:', error);
      return false;
    }
  }

  // 檢查緩存是否存在
  async exists(key) {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis 檢查緩存存在失敗:', error);
      return false;
    }
  }

  // 原子性增加計數器
  async incr(key, ttl = 3600) {
    if (!this.isAvailable()) {
      return null;
    }
    
    try {
      const value = await this.redis.incr(key);
      if (value === 1 && ttl > 0) {
        // 如果是新鍵，設置過期時間
        await this.redis.expire(key, ttl);
      }
      return value;
    } catch (error) {
      console.error('Redis 增加計數器失敗:', error);
      return null;
    }
  }

  // 原子性增加指定數值
  async incrBy(key, increment, ttl = 3600) {
    if (!this.isAvailable()) {
      return null;
    }
    
    try {
      const value = await this.redis.incrby(key, increment);
      if (increment > 0 && ttl > 0) {
        const exists = await this.redis.ttl(key);
        if (exists === -1) {
          // 如果沒有過期時間，設置一個
          await this.redis.expire(key, ttl);
        }
      }
      return value;
    } catch (error) {
      console.error('Redis 增加指定數值失敗:', error);
      return null;
    }
  }

  // 獲取所有匹配模式的鍵
  async keys(pattern) {
    if (!this.isAvailable()) {
      return [];
    }
    
    try {
      return await this.redis.keys(pattern);
    } catch (error) {
      console.error('Redis 獲取鍵失敗:', error);
      return [];
    }
  }

  // 哈希操作 - 設置哈希字段
  async hset(key, field, value, ttl = 3600) {
    if (!this.isAvailable()) {
      return false;
    }
    
    try {
      await this.redis.hset(key, field, JSON.stringify(value));
      if (ttl > 0) {
        await this.redis.expire(key, ttl);
      }
      return true;
    } catch (error) {
      console.error('Redis 設置哈希字段失敗:', error);
      return false;
    }
  }

  // 哈希操作 - 獲取哈希字段
  async hget(key, field) {
    if (!this.isAvailable()) {
      return null;
    }
    
    try {
      const value = await this.redis.hget(key, field);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis 獲取哈希字段失敗:', error);
      return null;
    }
  }

  // 哈希操作 - 獲取所有哈希數據
  async hgetall(key) {
    if (!this.isAvailable()) {
      return {};
    }
    
    try {
      const data = await this.redis.hgetall(key);
      const result = {};
      for (const [field, value] of Object.entries(data)) {
        try {
          result[field] = JSON.parse(value);
        } catch (e) {
          result[field] = value;
        }
      }
      return result;
    } catch (error) {
      console.error('Redis 獲取所有哈希數據失敗:', error);
      return {};
    }
  }

  // 關閉連接
  async close() {
    if (this.redis) {
      await this.redis.disconnect();
      this.isConnected = false;
    }
  }
}

// 創建單例實例
const redisCache = new RedisCache();

export default redisCache;
