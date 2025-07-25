// draw-result-cache.js - 開獎結果緩存管理

// 緩存最近的開獎結果，確保每期對應正確的結果
const resultCache = new Map();
const MAX_CACHE_SIZE = 20;

/**
 * 設置期號的開獎結果
 */
export function setDrawResult(period, result) {
    const periodStr = String(period);
    resultCache.set(periodStr, {
        result: result,
        timestamp: Date.now()
    });
    
    // 限制緩存大小
    if (resultCache.size > MAX_CACHE_SIZE) {
        const oldestKey = resultCache.keys().next().value;
        resultCache.delete(oldestKey);
    }
    
    console.log(`📦 [結果緩存] 期號 ${periodStr} 的結果已緩存`);
}

/**
 * 獲取期號的開獎結果
 */
export function getDrawResult(period) {
    const periodStr = String(period);
    const cached = resultCache.get(periodStr);
    
    if (cached) {
        console.log(`📦 [結果緩存] 從緩存獲取期號 ${periodStr} 的結果`);
        return cached.result;
    }
    
    return null;
}

/**
 * 獲取最新的開獎結果（不管期號）
 */
export function getLatestResult() {
    if (resultCache.size === 0) return null;
    
    // 獲取最新的結果
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
 * 清理過期的緩存
 */
export function cleanExpiredCache() {
    const now = Date.now();
    const EXPIRE_TIME = 10 * 60 * 1000; // 10分鐘
    
    for (const [period, data] of resultCache.entries()) {
        if (now - data.timestamp > EXPIRE_TIME) {
            resultCache.delete(period);
            console.log(`🗑️ [結果緩存] 清理過期緩存: 期號 ${period}`);
        }
    }
}

export default {
    setDrawResult,
    getDrawResult,
    getLatestResult,
    cleanExpiredCache
};
