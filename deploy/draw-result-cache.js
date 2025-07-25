// draw-result-cache.js - 开奖结果缓存管理

// 缓存最近的开奖结果，确保每期对应正确的结果
const resultCache = new Map();
const MAX_CACHE_SIZE = 20;

/**
 * 设置期号的开奖结果
 */
export function setDrawResult(period, result) {
    const periodStr = String(period);
    resultCache.set(periodStr, {
        result: result,
        timestamp: Date.now()
    });
    
    // 限制缓存大小
    if (resultCache.size > MAX_CACHE_SIZE) {
        const oldestKey = resultCache.keys().next().value;
        resultCache.delete(oldestKey);
    }
    
    console.log(`📦 [结果缓存] 期号 ${periodStr} 的结果已缓存`);
}

/**
 * 获取期号的开奖结果
 */
export function getDrawResult(period) {
    const periodStr = String(period);
    const cached = resultCache.get(periodStr);
    
    if (cached) {
        console.log(`📦 [结果缓存] 从缓存获取期号 ${periodStr} 的结果`);
        return cached.result;
    }
    
    return null;
}

/**
 * 获取最新的开奖结果（不管期号）
 */
export function getLatestResult() {
    if (resultCache.size === 0) return null;
    
    // 获取最新的结果
    let latest = null;
    let latestTime = 0;
    
    for (const [period, data] of resultCache.entries()) {
        if (data.timestamp > latestTime) {
            latestTime = data.timestamp;
            latest = { period, ...data };
        }
    }
    
    return latest;
}

/**
 * 清理过期的缓存
 */
export function cleanExpiredCache() {
    const now = Date.now();
    const EXPIRE_TIME = 10 * 60 * 1000; // 10分钟
    
    for (const [period, data] of resultCache.entries()) {
        if (now - data.timestamp > EXPIRE_TIME) {
            resultCache.delete(period);
            console.log(`🗑️ [结果缓存] 清理过期缓存: 期号 ${period}`);
        }
    }
}

export default {
    setDrawResult,
    getDrawResult,
    getLatestResult,
    cleanExpiredCache
};
