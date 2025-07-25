// settlement-reliability-fix.js - Fix the settlement system reliability issues
import fs from 'fs';

function createSettlementReliabilityFix() {
    console.log('🔧 CREATING SETTLEMENT RELIABILITY FIX\n');
    
    // Read the current backend.js file
    const backendPath = './backend.js';
    const backendContent = fs.readFileSync(backendPath, 'utf8');
    
    // Create the improved settlement logic
    const improvedSettlementCode = `
// IMPROVED SETTLEMENT SYSTEM WITH RELIABILITY GUARANTEES
let settlementInProgress = false;

async function settleBetsWithRetry(period, winResult, maxRetries = 3) {
    console.log(\`🎯 开始可靠结算第\${period}期注单 (最多重试\${maxRetries}次)...\`);
    
    if (settlementInProgress) {
        console.log('⚠️ 结算正在进行中，跳过重复结算');
        return { success: false, reason: 'settlement_in_progress' };
    }
    
    settlementInProgress = true;
    
    try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(\`🔄 结算尝试 \${attempt}/\${maxRetries}\`);
            
            try {
                // 1. 使用增强结算系统
                const result = await enhancedSettlement(period, winResult);
                
                if (result && result.success) {
                    console.log(\`✅ 第\${period}期结算成功 (尝试 \${attempt})\`);
                    
                    // 2. 验证结算完整性
                    const verification = await verifySettlementCompleteness(period);
                    if (verification.isComplete) {
                        console.log(\`✅ 第\${period}期结算验证通过\`);
                        return { success: true, attempt, verification };
                    } else {
                        console.log(\`⚠️ 第\${period}期结算验证失败: \${verification.issues.join(', ')}\`);
                        throw new Error(\`Settlement verification failed: \${verification.issues.join(', ')}\`);
                    }
                } else {
                    throw new Error(\`Enhanced settlement failed: \${result?.message || 'Unknown error'}\`);
                }
                
            } catch (attemptError) {
                console.error(\`❌ 结算尝试 \${attempt} 失败:\`, attemptError.message);
                
                if (attempt === maxRetries) {
                    console.error(\`💥 所有结算尝试都失败了，记录问题期号 \${period}\`);
                    await recordFailedSettlement(period, attemptError);
                    throw attemptError;
                }
                
                // 等待重试延迟
                const retryDelay = attempt * 1000; // 1s, 2s, 3s
                console.log(\`⏳ 等待 \${retryDelay}ms 后重试...\`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
        
    } finally {
        settlementInProgress = false;
    }
}

async function verifySettlementCompleteness(period) {
    console.log(\`🔍 验证第\${period}期结算完整性...\`);
    
    try {
        const issues = [];
        
        // 1. 检查是否有未结算的注单
        const unsettledBets = await db.any(\`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1 AND settled = false
        \`, [period]);
        
        if (parseInt(unsettledBets[0].count) > 0) {
            issues.push(\`\${unsettledBets[0].count} unsettled bets\`);
        }
        
        // 2. 检查是否有结算日志
        const settlementLog = await db.oneOrNone(\`
            SELECT id FROM settlement_logs 
            WHERE period = $1
        \`, [period]);
        
        if (!settlementLog) {
            issues.push('missing settlement log');
        }
        
        // 3. 检查是否有注单但没有退水记录
        const [betsCount, rebatesCount] = await Promise.all([
            db.one('SELECT COUNT(*) as count FROM bet_history WHERE period = $1 AND settled = true', [period]),
            db.one('SELECT COUNT(*) as count FROM transaction_records WHERE period = $1 AND transaction_type = \\'rebate\\'', [period])
        ]);
        
        if (parseInt(betsCount.count) > 0 && parseInt(rebatesCount.count) === 0) {
            issues.push('missing rebate records');
        }
        
        const isComplete = issues.length === 0;
        
        console.log(\`验证结果: \${isComplete ? '✅ 完整' : \`❌ 问题: \${issues.join(', ')}\`}\`);
        
        return { isComplete, issues };
        
    } catch (error) {
        console.error('结算验证过程出错:', error);
        return { isComplete: false, issues: ['verification_error'] };
    }
}

async function recordFailedSettlement(period, error) {
    try {
        await db.none(\`
            INSERT INTO failed_settlements (period, error_message, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (period) DO UPDATE SET
                error_message = $2,
                retry_count = failed_settlements.retry_count + 1,
                updated_at = NOW()
        \`, [period, error.message]);
        
        console.log(\`📝 已记录失败结算: 期号 \${period}\`);
    } catch (dbError) {
        console.error('记录失败结算时出错:', dbError);
    }
}

// 创建失败结算记录表（如果不存在）
async function createFailedSettlementsTable() {
    try {
        await db.none(\`
            CREATE TABLE IF NOT EXISTS failed_settlements (
                id SERIAL PRIMARY KEY,
                period BIGINT UNIQUE NOT NULL,
                error_message TEXT,
                retry_count INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        \`);
        console.log('✅ 失败结算记录表已准备');
    } catch (error) {
        console.error('创建失败结算记录表时出错:', error);
    }
}

// 启动时检查未完成的结算
async function checkPendingSettlements() {
    console.log('🔍 检查待完成的结算...');
    
    try {
        // 查找有已结算注单但无结算日志的期号
        const pendingPeriods = await db.any(\`
            SELECT DISTINCT bh.period, COUNT(*) as bet_count
            FROM bet_history bh
            LEFT JOIN settlement_logs sl ON bh.period::text = sl.period::text
            WHERE bh.settled = true 
                AND sl.id IS NULL
                AND bh.period >= 20250716100
            GROUP BY bh.period
            ORDER BY bh.period DESC
            LIMIT 10
        \`);
        
        if (pendingPeriods.length > 0) {
            console.log(\`⚠️ 发现 \${pendingPeriods.length} 个待完成结算的期号:\`);
            for (const period of pendingPeriods) {
                console.log(\`  - 期号 \${period.period}: \${period.bet_count} 笔已结算注单\`);
            }
            
            console.log('💡 建议运行手动结算脚本修复这些期号');
        } else {
            console.log('✅ 没有发现待完成的结算');
        }
        
    } catch (error) {
        console.error('检查待完成结算时出错:', error);
    }
}
`;

    // Find the location to insert the improved settlement logic
    const insertLocation = backendContent.indexOf('async function settleBets(period, winResult)');
    
    if (insertLocation === -1) {
        console.log('❌ Cannot find settleBets function in backend.js');
        return false;
    }
    
    // Create the new backend.js content with improved settlement
    const newBackendContent = 
        backendContent.substring(0, insertLocation) + 
        improvedSettlementCode + 
        '\n// ORIGINAL SETTLЕБETS FUNCTION (KEPT FOR REFERENCE)\n' +
        backendContent.substring(insertLocation);
    
    // Also need to update the game loop to use the new settlement function
    const updatedContent = newBackendContent.replace(
        'await settleBets(currentDrawPeriod, { positions: newResult });',
        `const settlementResult = await settleBetsWithRetry(currentDrawPeriod, { positions: newResult });
            
            // 检查结算是否成功，如果失败则不进入下一期
            if (!settlementResult.success) {
                console.error(\`🚨 第\${currentDrawPeriod}期结算失败，暂停游戏进程\`);
                console.error(\`失败原因: \${settlementResult.reason}\`);
                // 保持在当前状态，不进入下一期
                memoryGameState.status = 'settlement_failed';
                memoryGameState.countdown_seconds = 30; // 给30秒时间处理
                return;
            }`
    );
    
    // Add the initialization calls
    const finalContent = updatedContent.replace(
        'FS赛车游戏服务运行在端口 3000',
        'FS赛车游戏服务运行在端口 3000\');\n\n// 初始化结算系统可靠性功能\nawait createFailedSettlementsTable();\nawait checkPendingSettlements();\n\nconsole.log(\'FS赛车游戏服务运行在端口 3000'
    );
    
    // Save the improved backend.js
    const backupPath = './backend.js.backup.' + Date.now();
    fs.writeFileSync(backupPath, backendContent);
    console.log(`📦 原始文件备份到: ${backupPath}`);
    
    fs.writeFileSync(backendPath, finalContent);
    console.log('✅ 已更新 backend.js with settlement reliability improvements');
    
    // Create a migration script for the failed_settlements table
    const migrationScript = `
-- Create failed_settlements table for tracking settlement failures
CREATE TABLE IF NOT EXISTS failed_settlements (
    id SERIAL PRIMARY KEY,
    period BIGINT UNIQUE NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_failed_settlements_period ON failed_settlements(period);
CREATE INDEX IF NOT EXISTS idx_failed_settlements_created_at ON failed_settlements(created_at);
`;
    
    fs.writeFileSync('./create-failed-settlements-table.sql', migrationScript);
    console.log('📝 已创建资料库迁移脚本: create-failed-settlements-table.sql');
    
    console.log('\n🎉 结算系统可靠性修复完成！');
    console.log('\n下一步：');
    console.log('1. 重启后端服务以载入修复');
    console.log('2. 运行资料库迁移脚本');
    console.log('3. 监控结算系统运行状况');
    
    return true;
}

createSettlementReliabilityFix();