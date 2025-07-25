// fix-settlement-timing-v2.js - 修复结算时机问题（移除自动结算）

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixSettlementTimingV2() {
    try {
        console.log('🔧 修复结算时机问题 V2...\n');
        
        // 1. 修改 fixed-draw-system.js，移除自动结算
        console.log('1. 修改 fixed-draw-system.js，移除自动结算逻辑...');
        
        const drawSystemPath = path.join(__dirname, 'fixed-draw-system.js');
        let drawSystemContent = fs.readFileSync(drawSystemPath, 'utf8');
        
        // 找到并注释掉自动结算的部分
        const autoSettlementPattern = /\/\/ 4\. 异步执行后续操作（同步代理系统和结算）[\s\S]*?}, 2000\); \/\/ 延迟2秒开始执行后续操作，确保开奖状态已结束/;
        
        if (autoSettlementPattern.test(drawSystemContent)) {
            drawSystemContent = drawSystemContent.replace(
                autoSettlementPattern,
                `// 4. 异步执行后续操作（仅同步代理系统，不自动结算）
            // 重要：结算应该由 backend.js 在适当时机调用，而不是在这里自动执行
            setTimeout(async () => {
                try {
                    // 只同步到代理系统，不执行结算
                    const syncResult = await this.syncToAgentSystem(period, drawResult);
                    console.log(\`✅ [代理同步] 期号 \${period} 已同步到代理系统\`);
                    
                    // 移除自动结算逻辑
                    // 结算应该在开奖完全结束后由 backend.js 调用
                    console.log(\`ℹ️ [结算提示] 期号 \${period} 等待 backend.js 在适当时机调用结算\`);
                    
                } catch (error) {
                    console.error(\`❌ [后续处理] 期号 \${period} 后续处理失败:\`, error);
                }
            }, 1000); // 延迟1秒同步到代理系统`
            );
            
            console.log('✅ 已移除 fixed-draw-system.js 中的自动结算逻辑');
        } else {
            console.log('⚠️ 未找到预期的自动结算代码模式，尝试其他方式...');
        }
        
        // 2. 修改 backend.js，在开奖完全结束后调用结算
        console.log('\n2. 修改 backend.js，添加适当的结算调用...');
        
        const backendPath = path.join(__dirname, 'backend.js');
        let backendContent = fs.readFileSync(backendPath, 'utf8');
        
        // 在开奖结束后添加结算调用
        const drawEndPattern = /console\.log\('🎉 \[开奖结束\] 已进入第.*期，开奖结果已更新'\);/;
        
        if (drawEndPattern.test(backendContent)) {
            backendContent = backendContent.replace(
                drawEndPattern,
                `console.log('🎉 [开奖结束] 已进入第' + memoryGameState.current_period + '期，开奖结果已更新');
                
                // 在开奖完全结束后执行结算
                // 延迟2秒确保所有状态都已更新
                setTimeout(async () => {
                    try {
                        console.log(\`🎯 [后续结算] 开始结算期号 \${previousPeriod}\`);
                        const { safeExecuteSettlement } = await import('./safe-settlement-executor.js');
                        const settlementResult = await safeExecuteSettlement(previousPeriod);
                        
                        if (settlementResult.success) {
                            console.log(\`✅ [后续结算] 期号 \${previousPeriod} 结算成功\`);
                        } else {
                            console.error(\`❌ [后续结算] 期号 \${previousPeriod} 结算失败:\`, settlementResult.error);
                        }
                    } catch (error) {
                        console.error(\`❌ [后续结算] 期号 \${previousPeriod} 结算异常:\`, error);
                    }
                }, 2000);`
            );
            
            console.log('✅ 已在 backend.js 中添加适当的结算调用');
        }
        
        // 3. 创建一个新的结算管理器
        console.log('\n3. 创建结算管理器，确保结算只执行一次...');
        
        const settlementManagerCode = `// settlement-manager.js - 结算管理器，确保结算只执行一次

const settledPeriods = new Set();
const pendingSettlements = new Map();

/**
 * 注册待结算的期号
 */
export function registerPendingSettlement(period) {
    if (!settledPeriods.has(period) && !pendingSettlements.has(period)) {
        pendingSettlements.set(period, {
            registeredAt: new Date(),
            status: 'pending'
        });
        console.log(\`📝 [结算管理] 注册待结算期号: \${period}\`);
    }
}

/**
 * 执行结算（确保只执行一次）
 */
export async function executeManagedSettlement(period) {
    // 检查是否已结算
    if (settledPeriods.has(period)) {
        console.log(\`⏭️ [结算管理] 期号 \${period} 已结算，跳过\`);
        return { success: true, skipped: true, message: '已结算' };
    }
    
    // 标记为结算中
    if (pendingSettlements.has(period)) {
        pendingSettlements.get(period).status = 'settling';
    }
    
    try {
        // 执行结算
        const { safeExecuteSettlement } = await import('./safe-settlement-executor.js');
        const result = await safeExecuteSettlement(period);
        
        // 标记为已结算
        settledPeriods.add(period);
        pendingSettlements.delete(period);
        
        // 清理旧记录（保留最近100期）
        if (settledPeriods.size > 100) {
            const sorted = Array.from(settledPeriods).sort();
            const toRemove = sorted.slice(0, sorted.length - 100);
            toRemove.forEach(p => settledPeriods.delete(p));
        }
        
        return result;
        
    } catch (error) {
        // 结算失败，从待结算列表移除但不加入已结算
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
        console.log('✅ 已创建 settlement-manager.js');
        
        // 4. 部署文件
        console.log('\n4. 部署修改后的文件...');
        
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
        
        console.log('\n✅ 修复完成！');
        console.log('\n主要改动：');
        console.log('1. 移除了 fixed-draw-system.js 中的自动结算逻辑');
        console.log('2. 在 backend.js 中开奖完全结束后才调用结算');
        console.log('3. 创建了结算管理器，确保每期只结算一次');
        console.log('4. 结算现在会在开奖结束后2秒执行，确保所有状态都已更新');
        
    } catch (error) {
        console.error('修复失败:', error);
    }
}

// 执行修复
fixSettlementTimingV2();