// fix-settlement-timing-v2.js - 修復結算時機問題（移除自動結算）

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixSettlementTimingV2() {
    try {
        console.log('🔧 修復結算時機問題 V2...\n');
        
        // 1. 修改 fixed-draw-system.js，移除自動結算
        console.log('1. 修改 fixed-draw-system.js，移除自動結算邏輯...');
        
        const drawSystemPath = path.join(__dirname, 'fixed-draw-system.js');
        let drawSystemContent = fs.readFileSync(drawSystemPath, 'utf8');
        
        // 找到並註釋掉自動結算的部分
        const autoSettlementPattern = /\/\/ 4\. 異步執行後續操作（同步代理系統和結算）[\s\S]*?}, 2000\); \/\/ 延遲2秒開始執行後續操作，確保開獎狀態已結束/;
        
        if (autoSettlementPattern.test(drawSystemContent)) {
            drawSystemContent = drawSystemContent.replace(
                autoSettlementPattern,
                `// 4. 異步執行後續操作（僅同步代理系統，不自動結算）
            // 重要：結算應該由 backend.js 在適當時機調用，而不是在這裡自動執行
            setTimeout(async () => {
                try {
                    // 只同步到代理系統，不執行結算
                    const syncResult = await this.syncToAgentSystem(period, drawResult);
                    console.log(\`✅ [代理同步] 期號 \${period} 已同步到代理系統\`);
                    
                    // 移除自動結算邏輯
                    // 結算應該在開獎完全結束後由 backend.js 調用
                    console.log(\`ℹ️ [結算提示] 期號 \${period} 等待 backend.js 在適當時機調用結算\`);
                    
                } catch (error) {
                    console.error(\`❌ [後續處理] 期號 \${period} 後續處理失敗:\`, error);
                }
            }, 1000); // 延遲1秒同步到代理系統`
            );
            
            console.log('✅ 已移除 fixed-draw-system.js 中的自動結算邏輯');
        } else {
            console.log('⚠️ 未找到預期的自動結算代碼模式，嘗試其他方式...');
        }
        
        // 2. 修改 backend.js，在開獎完全結束後調用結算
        console.log('\n2. 修改 backend.js，添加適當的結算調用...');
        
        const backendPath = path.join(__dirname, 'backend.js');
        let backendContent = fs.readFileSync(backendPath, 'utf8');
        
        // 在開獎結束後添加結算調用
        const drawEndPattern = /console\.log\('🎉 \[開獎結束\] 已進入第.*期，開獎結果已更新'\);/;
        
        if (drawEndPattern.test(backendContent)) {
            backendContent = backendContent.replace(
                drawEndPattern,
                `console.log('🎉 [開獎結束] 已進入第' + memoryGameState.current_period + '期，開獎結果已更新');
                
                // 在開獎完全結束後執行結算
                // 延遲2秒確保所有狀態都已更新
                setTimeout(async () => {
                    try {
                        console.log(\`🎯 [後續結算] 開始結算期號 \${previousPeriod}\`);
                        const { safeExecuteSettlement } = await import('./safe-settlement-executor.js');
                        const settlementResult = await safeExecuteSettlement(previousPeriod);
                        
                        if (settlementResult.success) {
                            console.log(\`✅ [後續結算] 期號 \${previousPeriod} 結算成功\`);
                        } else {
                            console.error(\`❌ [後續結算] 期號 \${previousPeriod} 結算失敗:\`, settlementResult.error);
                        }
                    } catch (error) {
                        console.error(\`❌ [後續結算] 期號 \${previousPeriod} 結算異常:\`, error);
                    }
                }, 2000);`
            );
            
            console.log('✅ 已在 backend.js 中添加適當的結算調用');
        }
        
        // 3. 創建一個新的結算管理器
        console.log('\n3. 創建結算管理器，確保結算只執行一次...');
        
        const settlementManagerCode = `// settlement-manager.js - 結算管理器，確保結算只執行一次

const settledPeriods = new Set();
const pendingSettlements = new Map();

/**
 * 註冊待結算的期號
 */
export function registerPendingSettlement(period) {
    if (!settledPeriods.has(period) && !pendingSettlements.has(period)) {
        pendingSettlements.set(period, {
            registeredAt: new Date(),
            status: 'pending'
        });
        console.log(\`📝 [結算管理] 註冊待結算期號: \${period}\`);
    }
}

/**
 * 執行結算（確保只執行一次）
 */
export async function executeManagedSettlement(period) {
    // 檢查是否已結算
    if (settledPeriods.has(period)) {
        console.log(\`⏭️ [結算管理] 期號 \${period} 已結算，跳過\`);
        return { success: true, skipped: true, message: '已結算' };
    }
    
    // 標記為結算中
    if (pendingSettlements.has(period)) {
        pendingSettlements.get(period).status = 'settling';
    }
    
    try {
        // 執行結算
        const { safeExecuteSettlement } = await import('./safe-settlement-executor.js');
        const result = await safeExecuteSettlement(period);
        
        // 標記為已結算
        settledPeriods.add(period);
        pendingSettlements.delete(period);
        
        // 清理舊記錄（保留最近100期）
        if (settledPeriods.size > 100) {
            const sorted = Array.from(settledPeriods).sort();
            const toRemove = sorted.slice(0, sorted.length - 100);
            toRemove.forEach(p => settledPeriods.delete(p));
        }
        
        return result;
        
    } catch (error) {
        // 結算失敗，從待結算列表移除但不加入已結算
        pendingSettlements.delete(period);
        throw error;
    }
}

export default {
    registerPendingSettlement,
    executeManagedSettlement
};
`;
        
        fs.writeFileSync(path.join(__dirname, 'settlement-manager.js'), settlementManagerCode);
        console.log('✅ 已創建 settlement-manager.js');
        
        // 4. 部署文件
        console.log('\n4. 部署修改後的文件...');
        
        const filesToDeploy = [
            'fixed-draw-system.js',
            'backend.js',
            'settlement-manager.js'
        ];
        
        for (const file of filesToDeploy) {
            const srcPath = path.join(__dirname, file);
            const destPath = path.join(__dirname, 'deploy', file);
            
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                console.log(`✅ 已部署 ${file}`);
            }
        }
        
        console.log('\n✅ 修復完成！');
        console.log('\n主要改動：');
        console.log('1. 移除了 fixed-draw-system.js 中的自動結算邏輯');
        console.log('2. 在 backend.js 中開獎完全結束後才調用結算');
        console.log('3. 創建了結算管理器，確保每期只結算一次');
        console.log('4. 結算現在會在開獎結束後2秒執行，確保所有狀態都已更新');
        
    } catch (error) {
        console.error('修復失敗:', error);
    }
}

// 執行修復
fixSettlementTimingV2();