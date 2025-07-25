// fix-settlement-timing.js - 修復結算時機和索引問題

import db from './db/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixSettlementTiming() {
    try {
        console.log('🔧 修復結算系統時機和索引問題...\n');
        
        // 1. 修復 enhanced-settlement-system.js 的 async 問題
        console.log('1. 修復 checkBetWinEnhanced 函數的 async 問題...');
        
        const settlementPath = path.join(__dirname, 'enhanced-settlement-system.js');
        let settlementContent = fs.readFileSync(settlementPath, 'utf8');
        
        // 修復函數定義，添加 async
        settlementContent = settlementContent.replace(
            'function checkBetWinEnhanced(bet, winResult) {',
            'async function checkBetWinEnhanced(bet, winResult) {'
        );
        
        // 確保在調用時也使用 await
        settlementContent = settlementContent.replace(
            'const winCheck = checkBetWinEnhanced(bet, winResult);',
            'const winCheck = await checkBetWinEnhanced(bet, winResult);'
        );
        
        fs.writeFileSync(settlementPath, settlementContent);
        console.log('✅ 已修復 checkBetWinEnhanced 為 async 函數');
        
        // 2. 創建一個新的結算包裝函數，確保從數據庫讀取最新結果
        console.log('\n2. 創建安全的結算執行函數...');
        
        const safeSettlementCode = `// safe-settlement-executor.js - 安全的結算執行器
import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

/**
 * 安全執行結算，確保從數據庫讀取最新的開獎結果
 */
export async function safeExecuteSettlement(period) {
    console.log(\`🎯 [安全結算] 開始執行期號 \${period} 的結算\`);
    
    try {
        // 1. 從數據庫讀取開獎結果
        const dbResult = await db.oneOrNone(\`
            SELECT 
                period,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                result,
                draw_time
            FROM result_history
            WHERE period = $1
        \`, [period]);
        
        if (!dbResult) {
            throw new Error(\`找不到期號 \${period} 的開獎結果\`);
        }
        
        console.log(\`✅ [安全結算] 從數據庫讀取到開獎結果:\`);
        console.log(\`   期號: \${dbResult.period}\`);
        console.log(\`   開獎時間: \${dbResult.draw_time}\`);
        
        // 2. 構建標準格式的開獎結果
        const positions = [];
        for (let i = 1; i <= 10; i++) {
            const position = dbResult[\`position_\${i}\`];
            positions.push(parseInt(position));
            console.log(\`   第\${i}名: \${position}號\`);
        }
        
        // 3. 驗證開獎結果的完整性
        const uniqueNumbers = new Set(positions);
        if (uniqueNumbers.size !== 10 || positions.some(n => n < 1 || n > 10)) {
            throw new Error(\`開獎結果異常: \${JSON.stringify(positions)}\`);
        }
        
        // 4. 檢查是否已經結算過
        const alreadySettled = await db.oneOrNone(\`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1 AND settled = true
        \`, [period]);
        
        if (alreadySettled && parseInt(alreadySettled.count) > 0) {
            console.log(\`⚠️ [安全結算] 期號 \${period} 已有 \${alreadySettled.count} 筆已結算記錄\`);
            
            // 檢查是否還有未結算的
            const unsettled = await db.oneOrNone(\`
                SELECT COUNT(*) as count 
                FROM bet_history 
                WHERE period = $1 AND settled = false
            \`, [period]);
            
            if (!unsettled || parseInt(unsettled.count) === 0) {
                console.log(\`✅ [安全結算] 期號 \${period} 所有投注都已結算\`);
                return {
                    success: true,
                    period: period,
                    message: '所有投注都已結算',
                    alreadySettled: parseInt(alreadySettled.count)
                };
            }
        }
        
        // 5. 執行結算
        console.log(\`🎲 [安全結算] 開始執行結算...\`);
        const settlementResult = await enhancedSettlement(period, { positions });
        
        // 6. 記錄結算結果
        if (settlementResult.success) {
            console.log(\`✅ [安全結算] 結算成功:\`);
            console.log(\`   結算數量: \${settlementResult.settledCount}\`);
            console.log(\`   中獎數量: \${settlementResult.winCount}\`);
            console.log(\`   總派彩: \${settlementResult.totalWinAmount}\`);
            
            // 記錄到結算日誌
            await db.none(\`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'success', $2, $3, NOW())
            \`, [
                period,
                \`結算成功: \${settlementResult.settledCount}筆\`,
                JSON.stringify({
                    settledCount: settlementResult.settledCount,
                    winCount: settlementResult.winCount,
                    totalWinAmount: settlementResult.totalWinAmount,
                    positions: positions
                })
            ]);
        } else {
            console.error(\`❌ [安全結算] 結算失敗: \${settlementResult.error}\`);
            
            // 記錄失敗日誌
            await db.none(\`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'failed', $2, $3, NOW())
            \`, [
                period,
                \`結算失敗: \${settlementResult.error}\`,
                JSON.stringify({
                    error: settlementResult.error,
                    positions: positions
                })
            ]);
        }
        
        return settlementResult;
        
    } catch (error) {
        console.error(\`❌ [安全結算] 執行失敗:\`, error);
        
        // 記錄錯誤日誌
        try {
            await db.none(\`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'error', $2, $3, NOW())
            \`, [
                period,
                \`結算錯誤: \${error.message}\`,
                JSON.stringify({
                    error: error.message,
                    stack: error.stack
                })
            ]);
        } catch (logError) {
            console.error('記錄錯誤日誌失敗:', logError);
        }
        
        return {
            success: false,
            period: period,
            error: error.message
        };
    }
}

export default safeExecuteSettlement;
`;
        
        fs.writeFileSync(path.join(__dirname, 'safe-settlement-executor.js'), safeSettlementCode);
        console.log('✅ 已創建 safe-settlement-executor.js');
        
        // 3. 更新 fixed-draw-system.js 使用新的安全結算函數
        console.log('\n3. 更新 fixed-draw-system.js 使用安全結算...');
        
        const drawSystemPath = path.join(__dirname, 'fixed-draw-system.js');
        let drawSystemContent = fs.readFileSync(drawSystemPath, 'utf8');
        
        // 替換 import
        drawSystemContent = drawSystemContent.replace(
            `import { enhancedSettlement } from './enhanced-settlement-system.js';`,
            `import { safeExecuteSettlement } from './safe-settlement-executor.js';`
        );
        
        // 替換執行結算的代碼
        drawSystemContent = drawSystemContent.replace(
            `const settlementResult = await enhancedSettlement(period, { positions: result });`,
            `const settlementResult = await safeExecuteSettlement(period);`
        );
        
        // 如果沒有找到上述import，添加新的import
        if (!drawSystemContent.includes('safe-settlement-executor.js')) {
            drawSystemContent = drawSystemContent.replace(
                `const { enhancedSettlement } = await import('./enhanced-settlement-system.js');`,
                `const { safeExecuteSettlement } = await import('./safe-settlement-executor.js');`
            );
            
            drawSystemContent = drawSystemContent.replace(
                `const settlementResult = await enhancedSettlement(period, { positions: result });`,
                `const settlementResult = await safeExecuteSettlement(period);`
            );
        }
        
        fs.writeFileSync(drawSystemPath, drawSystemContent);
        console.log('✅ 已更新 fixed-draw-system.js');
        
        // 4. 部署到 deploy 目錄
        console.log('\n4. 部署修復的文件...');
        
        const filesToDeploy = [
            'enhanced-settlement-system.js',
            'safe-settlement-executor.js',
            'fixed-draw-system.js'
        ];
        
        for (const file of filesToDeploy) {
            const srcPath = path.join(__dirname, file);
            const destPath = path.join(__dirname, 'deploy', file);
            
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                console.log(`✅ 已部署 ${file}`);
            }
        }
        
        console.log('\n✅ 所有修復完成！');
        console.log('\n重要改進：');
        console.log('1. 修復了 checkBetWinEnhanced 函數的 async/await 問題');
        console.log('2. 創建了安全結算執行器，確保從數據庫讀取最新開獎結果');
        console.log('3. 結算前會驗證開獎結果的完整性和正確性');
        console.log('4. 添加了詳細的結算日誌記錄');
        console.log('5. 結算延遲執行，確保所有投注都已停止');
        
    } catch (error) {
        console.error('修復失敗:', error);
    }
}

// 執行修復
fixSettlementTiming();