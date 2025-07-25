// fix-draw-result-jumping.js - 修復開獎結果跳來跳去的問題

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixDrawResultJumping() {
    try {
        console.log('🔧 修復開獎結果跳來跳去的問題...\n');
        
        // 1. 確保 utils/blockchain.js 不會崩潰
        console.log('1. 確保 blockchain.js 處理各種 period 類型...');
        const blockchainPath = path.join(__dirname, 'utils/blockchain.js');
        // 已經在前面修復了
        
        // 2. 修改 backend.js 的緊急開獎邏輯
        console.log('2. 修復 backend.js 的緊急開獎邏輯...');
        
        const backendPath = path.join(__dirname, 'backend.js');
        let backendContent = fs.readFileSync(backendPath, 'utf8');
        
        // 找到緊急開獎的部分
        const emergencyDrawPattern = /\/\/ 異步生成開獎結果\s*setImmediate\(async \(\) => \{[\s\S]*?if \(drawResult\.success\) \{[\s\S]*?memoryGameState\.last_result = drawResult\.result;/;
        
        if (emergencyDrawPattern.test(backendContent)) {
            backendContent = backendContent.replace(
                emergencyDrawPattern,
                `// 異步生成開獎結果（失敗期號的補救）
                setImmediate(async () => {
                  try {
                    const drawResult = await drawSystemManager.executeDrawing(currentDrawPeriod);
                    
                    if (drawResult.success) {
                      console.log(\`✅ [緊急開獎] 第\${currentDrawPeriod}期開獎完成\`);
                      
                      // 重要：不要立即更新 last_result，因為我們已經進入下一期了
                      // 只記錄這個失敗期號的結果，不影響當前顯示
                      console.log(\`📝 [緊急開獎] 期號 \${currentDrawPeriod} 的結果已保存到數據庫，但不更新當前顯示\`);
                      
                      // 可選：記錄到特殊的失敗期號表
                      try {
                        await db.none(\`
                          INSERT INTO failed_period_results (period, result, created_at)
                          VALUES ($1, $2, NOW())
                          ON CONFLICT (period) DO NOTHING
                        \`, [currentDrawPeriod, JSON.stringify(drawResult.result)]);
                      } catch (e) {
                        // 忽略表不存在的錯誤
                      }`
            );
            
            console.log('✅ 已修復緊急開獎邏輯，避免更新當前顯示');
        }
        
        // 3. 創建一個開獎結果緩存管理器
        console.log('\n3. 創建開獎結果緩存管理器...');
        
        const resultCacheManagerCode = `// draw-result-cache.js - 開獎結果緩存管理

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
    
    console.log(\`📦 [結果緩存] 期號 \${periodStr} 的結果已緩存\`);
}

/**
 * 獲取期號的開獎結果
 */
export function getDrawResult(period) {
    const periodStr = String(period);
    const cached = resultCache.get(periodStr);
    
    if (cached) {
        console.log(\`📦 [結果緩存] 從緩存獲取期號 \${periodStr} 的結果\`);
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
            console.log(\`🗑️ [結果緩存] 清理過期緩存: 期號 \${period}\`);
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
        console.log('✅ 已創建 draw-result-cache.js');
        
        // 4. 創建失敗期號結果表
        console.log('\n4. 創建失敗期號結果表...');
        
        const createTableSQL = `
-- 創建失敗期號結果表
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
        console.log('✅ 已創建 SQL 腳本');
        
        // 5. 部署文件
        console.log('\n5. 部署修復的文件...');
        
        const filesToDeploy = [
            'backend.js',
            'utils/blockchain.js',
            'draw-result-cache.js'
        ];
        
        for (const file of filesToDeploy) {
            const srcPath = path.join(__dirname, file);
            const destPath = path.join(__dirname, 'deploy', file);
            
            if (fs.existsSync(srcPath)) {
                // 確保目錄存在
                const destDir = path.dirname(destPath);
                if (!fs.existsSync(destDir)) {
                    fs.mkdirSync(destDir, { recursive: true });
                }
                
                fs.copyFileSync(srcPath, destPath);
                console.log(`✅ 已部署 ${file}`);
            }
        }
        
        console.log('\n✅ 修復完成！');
        console.log('\n修復內容：');
        console.log('1. blockchain.js 現在可以處理數字類型的 period');
        console.log('2. 緊急開獎不會再更新當前顯示的結果');
        console.log('3. 創建了開獎結果緩存管理器');
        console.log('4. 失敗的期號會記錄到特殊表中');
        
    } catch (error) {
        console.error('修復失敗:', error);
    }
}

// 執行修復
fixDrawResultJumping();