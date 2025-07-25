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
    console.log(\`🎯 開始可靠結算第\${period}期注單 (最多重試\${maxRetries}次)...\`);
    
    if (settlementInProgress) {
        console.log('⚠️ 結算正在進行中，跳過重複結算');
        return { success: false, reason: 'settlement_in_progress' };
    }
    
    settlementInProgress = true;
    
    try {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            console.log(\`🔄 結算嘗試 \${attempt}/\${maxRetries}\`);
            
            try {
                // 1. 使用增強結算系統
                const result = await enhancedSettlement(period, winResult);
                
                if (result && result.success) {
                    console.log(\`✅ 第\${period}期結算成功 (嘗試 \${attempt})\`);
                    
                    // 2. 驗證結算完整性
                    const verification = await verifySettlementCompleteness(period);
                    if (verification.isComplete) {
                        console.log(\`✅ 第\${period}期結算驗證通過\`);
                        return { success: true, attempt, verification };
                    } else {
                        console.log(\`⚠️ 第\${period}期結算驗證失敗: \${verification.issues.join(', ')}\`);
                        throw new Error(\`Settlement verification failed: \${verification.issues.join(', ')}\`);
                    }
                } else {
                    throw new Error(\`Enhanced settlement failed: \${result?.message || 'Unknown error'}\`);
                }
                
            } catch (attemptError) {
                console.error(\`❌ 結算嘗試 \${attempt} 失敗:\`, attemptError.message);
                
                if (attempt === maxRetries) {
                    console.error(\`💥 所有結算嘗試都失敗了，記錄問題期號 \${period}\`);
                    await recordFailedSettlement(period, attemptError);
                    throw attemptError;
                }
                
                // 等待重試延遲
                const retryDelay = attempt * 1000; // 1s, 2s, 3s
                console.log(\`⏳ 等待 \${retryDelay}ms 後重試...\`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }
        
    } finally {
        settlementInProgress = false;
    }
}

async function verifySettlementCompleteness(period) {
    console.log(\`🔍 驗證第\${period}期結算完整性...\`);
    
    try {
        const issues = [];
        
        // 1. 檢查是否有未結算的注單
        const unsettledBets = await db.any(\`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1 AND settled = false
        \`, [period]);
        
        if (parseInt(unsettledBets[0].count) > 0) {
            issues.push(\`\${unsettledBets[0].count} unsettled bets\`);
        }
        
        // 2. 檢查是否有結算日誌
        const settlementLog = await db.oneOrNone(\`
            SELECT id FROM settlement_logs 
            WHERE period = $1
        \`, [period]);
        
        if (!settlementLog) {
            issues.push('missing settlement log');
        }
        
        // 3. 檢查是否有注單但沒有退水記錄
        const [betsCount, rebatesCount] = await Promise.all([
            db.one('SELECT COUNT(*) as count FROM bet_history WHERE period = $1 AND settled = true', [period]),
            db.one('SELECT COUNT(*) as count FROM transaction_records WHERE period = $1 AND transaction_type = \\'rebate\\'', [period])
        ]);
        
        if (parseInt(betsCount.count) > 0 && parseInt(rebatesCount.count) === 0) {
            issues.push('missing rebate records');
        }
        
        const isComplete = issues.length === 0;
        
        console.log(\`驗證結果: \${isComplete ? '✅ 完整' : \`❌ 問題: \${issues.join(', ')}\`}\`);
        
        return { isComplete, issues };
        
    } catch (error) {
        console.error('結算驗證過程出錯:', error);
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
        
        console.log(\`📝 已記錄失敗結算: 期號 \${period}\`);
    } catch (dbError) {
        console.error('記錄失敗結算時出錯:', dbError);
    }
}

// 創建失敗結算記錄表（如果不存在）
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
        console.log('✅ 失敗結算記錄表已準備');
    } catch (error) {
        console.error('創建失敗結算記錄表時出錯:', error);
    }
}

// 啟動時檢查未完成的結算
async function checkPendingSettlements() {
    console.log('🔍 檢查待完成的結算...');
    
    try {
        // 查找有已結算注單但無結算日誌的期號
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
            console.log(\`⚠️ 發現 \${pendingPeriods.length} 個待完成結算的期號:\`);
            for (const period of pendingPeriods) {
                console.log(\`  - 期號 \${period.period}: \${period.bet_count} 筆已結算注單\`);
            }
            
            console.log('💡 建議運行手動結算腳本修復這些期號');
        } else {
            console.log('✅ 沒有發現待完成的結算');
        }
        
    } catch (error) {
        console.error('檢查待完成結算時出錯:', error);
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
            
            // 檢查結算是否成功，如果失敗則不進入下一期
            if (!settlementResult.success) {
                console.error(\`🚨 第\${currentDrawPeriod}期結算失敗，暫停遊戲進程\`);
                console.error(\`失敗原因: \${settlementResult.reason}\`);
                // 保持在當前狀態，不進入下一期
                memoryGameState.status = 'settlement_failed';
                memoryGameState.countdown_seconds = 30; // 給30秒時間處理
                return;
            }`
    );
    
    // Add the initialization calls
    const finalContent = updatedContent.replace(
        'FS赛车遊戲服務運行在端口 3000',
        'FS赛车遊戲服務運行在端口 3000\');\n\n// 初始化結算系統可靠性功能\nawait createFailedSettlementsTable();\nawait checkPendingSettlements();\n\nconsole.log(\'FS赛车遊戲服務運行在端口 3000'
    );
    
    // Save the improved backend.js
    const backupPath = './backend.js.backup.' + Date.now();
    fs.writeFileSync(backupPath, backendContent);
    console.log(`📦 原始文件備份到: ${backupPath}`);
    
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
    console.log('📝 已創建資料庫遷移腳本: create-failed-settlements-table.sql');
    
    console.log('\n🎉 結算系統可靠性修復完成！');
    console.log('\n下一步：');
    console.log('1. 重啟後端服務以載入修復');
    console.log('2. 運行資料庫遷移腳本');
    console.log('3. 監控結算系統運行狀況');
    
    return true;
}

createSettlementReliabilityFix();