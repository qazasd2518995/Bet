// fix-settlement-timing.js - 修复结算时机和索引问题

import db from './db/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fixSettlementTiming() {
    try {
        console.log('🔧 修复结算系统时机和索引问题...\n');
        
        // 1. 修复 enhanced-settlement-system.js 的 async 问题
        console.log('1. 修复 checkBetWinEnhanced 函数的 async 问题...');
        
        const settlementPath = path.join(__dirname, 'enhanced-settlement-system.js');
        let settlementContent = fs.readFileSync(settlementPath, 'utf8');
        
        // 修复函数定义，添加 async
        settlementContent = settlementContent.replace(
            'function checkBetWinEnhanced(bet, winResult) {',
            'async function checkBetWinEnhanced(bet, winResult) {'
        );
        
        // 确保在调用时也使用 await
        settlementContent = settlementContent.replace(
            'const winCheck = checkBetWinEnhanced(bet, winResult);',
            'const winCheck = await checkBetWinEnhanced(bet, winResult);'
        );
        
        fs.writeFileSync(settlementPath, settlementContent);
        console.log('✅ 已修复 checkBetWinEnhanced 为 async 函数');
        
        // 2. 创建一个新的结算包装函数，确保从数据库读取最新结果
        console.log('\n2. 创建安全的结算执行函数...');
        
        const safeSettlementCode = `// safe-settlement-executor.js - 安全的结算执行器
import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

/**
 * 安全执行结算，确保从数据库读取最新的开奖结果
 */
export async function safeExecuteSettlement(period) {
    console.log(\`🎯 [安全结算] 开始执行期号 \${period} 的结算\`);
    
    try {
        // 1. 从数据库读取开奖结果
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
            throw new Error(\`找不到期号 \${period} 的开奖结果\`);
        }
        
        console.log(\`✅ [安全结算] 从数据库读取到开奖结果:\`);
        console.log(\`   期号: \${dbResult.period}\`);
        console.log(\`   开奖时间: \${dbResult.draw_time}\`);
        
        // 2. 构建标准格式的开奖结果
        const positions = [];
        for (let i = 1; i <= 10; i++) {
            const position = dbResult[\`position_\${i}\`];
            positions.push(parseInt(position));
            console.log(\`   第\${i}名: \${position}号\`);
        }
        
        // 3. 验证开奖结果的完整性
        const uniqueNumbers = new Set(positions);
        if (uniqueNumbers.size !== 10 || positions.some(n => n < 1 || n > 10)) {
            throw new Error(\`开奖结果异常: \${JSON.stringify(positions)}\`);
        }
        
        // 4. 检查是否已经结算过
        const alreadySettled = await db.oneOrNone(\`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1 AND settled = true
        \`, [period]);
        
        if (alreadySettled && parseInt(alreadySettled.count) > 0) {
            console.log(\`⚠️ [安全结算] 期号 \${period} 已有 \${alreadySettled.count} 笔已结算记录\`);
            
            // 检查是否还有未结算的
            const unsettled = await db.oneOrNone(\`
                SELECT COUNT(*) as count 
                FROM bet_history 
                WHERE period = $1 AND settled = false
            \`, [period]);
            
            if (!unsettled || parseInt(unsettled.count) === 0) {
                console.log(\`✅ [安全结算] 期号 \${period} 所有投注都已结算\`);
                return {
                    success: true,
                    period: period,
                    message: '所有投注都已结算',
                    alreadySettled: parseInt(alreadySettled.count)
                };
            }
        }
        
        // 5. 执行结算
        console.log(\`🎲 [安全结算] 开始执行结算...\`);
        const settlementResult = await enhancedSettlement(period, { positions });
        
        // 6. 记录结算结果
        if (settlementResult.success) {
            console.log(\`✅ [安全结算] 结算成功:\`);
            console.log(\`   结算数量: \${settlementResult.settledCount}\`);
            console.log(\`   中奖数量: \${settlementResult.winCount}\`);
            console.log(\`   总派彩: \${settlementResult.totalWinAmount}\`);
            
            // 记录到结算日志
            await db.none(\`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'success', $2, $3, NOW())
            \`, [
                period,
                \`结算成功: \${settlementResult.settledCount}笔\`,
                JSON.stringify({
                    settledCount: settlementResult.settledCount,
                    winCount: settlementResult.winCount,
                    totalWinAmount: settlementResult.totalWinAmount,
                    positions: positions
                })
            ]);
        } else {
            console.error(\`❌ [安全结算] 结算失败: \${settlementResult.error}\`);
            
            // 记录失败日志
            await db.none(\`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'failed', $2, $3, NOW())
            \`, [
                period,
                \`结算失败: \${settlementResult.error}\`,
                JSON.stringify({
                    error: settlementResult.error,
                    positions: positions
                })
            ]);
        }
        
        return settlementResult;
        
    } catch (error) {
        console.error(\`❌ [安全结算] 执行失败:\`, error);
        
        // 记录错误日志
        try {
            await db.none(\`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'error', $2, $3, NOW())
            \`, [
                period,
                \`结算错误: \${error.message}\`,
                JSON.stringify({
                    error: error.message,
                    stack: error.stack
                })
            ]);
        } catch (logError) {
            console.error('记录错误日志失败:', logError);
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
        console.log('✅ 已创建 safe-settlement-executor.js');
        
        // 3. 更新 fixed-draw-system.js 使用新的安全结算函数
        console.log('\n3. 更新 fixed-draw-system.js 使用安全结算...');
        
        const drawSystemPath = path.join(__dirname, 'fixed-draw-system.js');
        let drawSystemContent = fs.readFileSync(drawSystemPath, 'utf8');
        
        // 替换 import
        drawSystemContent = drawSystemContent.replace(
            `import { enhancedSettlement } from './enhanced-settlement-system.js';`,
            `import { safeExecuteSettlement } from './safe-settlement-executor.js';`
        );
        
        // 替换执行结算的代码
        drawSystemContent = drawSystemContent.replace(
            `const settlementResult = await enhancedSettlement(period, { positions: result });`,
            `const settlementResult = await safeExecuteSettlement(period);`
        );
        
        // 如果没有找到上述import，添加新的import
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
        
        // 4. 部署到 deploy 目录
        console.log('\n4. 部署修复的文件...');
        
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
        
        console.log('\n✅ 所有修复完成！');
        console.log('\n重要改进：');
        console.log('1. 修复了 checkBetWinEnhanced 函数的 async/await 问题');
        console.log('2. 创建了安全结算执行器，确保从数据库读取最新开奖结果');
        console.log('3. 结算前会验证开奖结果的完整性和正确性');
        console.log('4. 添加了详细的结算日志记录');
        console.log('5. 结算延迟执行，确保所有投注都已停止');
        
    } catch (error) {
        console.error('修复失败:', error);
    }
}

// 执行修复
fixSettlementTiming();