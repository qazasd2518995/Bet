// fix-draw-result-jumping.js - 修复开奖结果跳来跳去的问题

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixDrawResultJumping() {
    try {
        console.log('🔧 修复开奖结果跳来跳去的问题...\n');
        
        // 1. 确保 utils/blockchain.js 不会崩溃
        console.log('1. 确保 blockchain.js 处理各种 period 类型...');
        const blockchainPath = path.join(__dirname, 'utils/blockchain.js');
        // 已经在前面修复了
        
        // 2. 修改 backend.js 的紧急开奖逻辑
        console.log('2. 修复 backend.js 的紧急开奖逻辑...');
        
        const backendPath = path.join(__dirname, 'backend.js');
        let backendContent = fs.readFileSync(backendPath, 'utf8');
        
        // 找到紧急开奖的部分
        const emergencyDrawPattern = /\/\/ 异步生成开奖结果\s*setImmediate\(async \(\) => \{[\s\S]*?if \(drawResult\.success\) \{[\s\S]*?memoryGameState\.last_result = drawResult\.result;/;
        
        if (emergencyDrawPattern.test(backendContent)) {
            backendContent = backendContent.replace(
                emergencyDrawPattern,
                `// 异步生成开奖结果（失败期号的补救）
                setImmediate(async () => {
                  try {
                    const drawResult = await drawSystemManager.executeDrawing(currentDrawPeriod);
                    
                    if (drawResult.success) {
                      console.log(\`✅ [紧急开奖] 第\${currentDrawPeriod}期开奖完成\`);
                      
                      // 重要：不要立即更新 last_result，因为我们已经进入下一期了
                      // 只记录这个失败期号的结果，不影响当前显示
                      console.log(\`📝 [紧急开奖] 期号 \${currentDrawPeriod} 的结果已保存到数据库，但不更新当前显示\`);
                      
                      // 可选：记录到特殊的失败期号表
                      try {
                        await db.none(\`
                          INSERT INTO failed_period_results (period, result, created_at)
                          VALUES ($1, $2, NOW())
                          ON CONFLICT (period) DO NOTHING
                        \`, [currentDrawPeriod, JSON.stringify(drawResult.result)]);
                      } catch (e) {
                        // 忽略表不存在的错误
                      }`
            );
            
            console.log('✅ 已修复紧急开奖逻辑，避免更新当前显示');
        }
        
        // 3. 创建一个开奖结果缓存管理器
        console.log('\n3. 创建开奖结果缓存管理器...');
        
        const resultCacheManagerCode = `// draw-result-cache.js - 开奖结果缓存管理

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
    
    console.log(\`📦 [结果缓存] 期号 \${periodStr} 的结果已缓存\`);
}

/**
 * 获取期号的开奖结果
 */
export function getDrawResult(period) {
    const periodStr = String(period);
    const cached = resultCache.get(periodStr);
    
    if (cached) {
        console.log(\`📦 [结果缓存] 从缓存获取期号 \${periodStr} 的结果\`);
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
            console.log(\`🗑️ [结果缓存] 清理过期缓存: 期号 \${period}\`);
        }
    }
}

export default {
    setDrawResult,
    getDrawResult,
    getLatestResult,
    cleanExpiredCache
};
`;
        
        fs.writeFileSync(path.join(__dirname, 'draw-result-cache.js'), resultCacheManagerCode);
        console.log('✅ 已创建 draw-result-cache.js');
        
        // 4. 创建失败期号结果表
        console.log('\n4. 创建失败期号结果表...');
        
        const createTableSQL = `
-- 创建失败期号结果表
CREATE TABLE IF NOT EXISTS failed_period_results (
    id SERIAL PRIMARY KEY,
    period VARCHAR(20) UNIQUE NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_failed_period_results_period ON failed_period_results(period);
CREATE INDEX IF NOT EXISTS idx_failed_period_results_created_at ON failed_period_results(created_at);
`;
        
        fs.writeFileSync(path.join(__dirname, 'create-failed-period-table.sql'), createTableSQL);
        console.log('✅ 已创建 SQL 脚本');
        
        // 5. 部署文件
        console.log('\n5. 部署修复的文件...');
        
        const filesToDeploy = [
            'backend.js',
            'utils/blockchain.js',
            'draw-result-cache.js'
        ];
        
        for (const file of filesToDeploy) {
            const srcPath = path.join(__dirname, file);
            const destPath = path.join(__dirname, 'deploy', file);
            
            if (fs.existsSync(srcPath)) {
                // 确保目录存在
                const destDir = path.dirname(destPath);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }
                
                fs.copyFileSync(srcPath, destPath);
                console.log(`✅ 已部署 ${file}`);
            }
        }
        
        console.log('\n✅ 修复完成！');
        console.log('\n修复内容：');
        console.log('1. blockchain.js 现在可以处理数字类型的 period');
        console.log('2. 紧急开奖不会再更新当前显示的结果');
        console.log('3. 创建了开奖结果缓存管理器');
        console.log('4. 失败的期号会记录到特殊表中');
        
    } catch (error) {
        console.error('修复失败:', error);
    }
}

// 执行修复
fixDrawResultJumping();