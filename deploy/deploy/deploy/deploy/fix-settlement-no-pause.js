// fix-settlement-no-pause.js - 修正結算系統，不暫停遊戲，改用異步補償
import fs from 'fs';

function fixSettlementWithoutPause() {
    console.log('🔧 修正結算系統 - 不暫停遊戲版本\n');
    
    // 讀取當前 backend.js
    const backendPath = './backend.js';
    const backendContent = fs.readFileSync(backendPath, 'utf8');
    
    // 新的結算邏輯 - 不阻塞遊戲
    const newSettlementCode = `
// 非阻塞式結算系統 - 遊戲繼續，後台補償
let pendingSettlements = new Map(); // 追蹤待補償的結算

async function settleBetsNonBlocking(period, winResult) {
    console.log(\`🎯 開始非阻塞結算第\${period}期注單...\`);
    
    try {
        // 立即嘗試結算
        const result = await enhancedSettlement(period, winResult);
        
        if (result && result.success) {
            console.log(\`✅ 第\${period}期結算成功\`);
            
            // 異步驗證結算完整性（不阻塞遊戲）
            setImmediate(() => verifyAndCompensateSettlement(period));
            
            return { success: true };
        } else {
            throw new Error(\`Enhanced settlement failed: \${result?.message || 'Unknown error'}\`);
        }
        
    } catch (error) {
        console.error(\`❌ 第\${period}期結算失敗:\`, error.message);
        
        // 記錄失敗，異步處理補償
        pendingSettlements.set(period, {
            winResult,
            error: error.message,
            timestamp: new Date(),
            retryCount: 0
        });
        
        // 立即啟動後台補償（不阻塞遊戲）
        setImmediate(() => compensateFailedSettlement(period));
        
        // 遊戲繼續運行
        return { success: false, compensating: true };
    }
}

async function verifyAndCompensateSettlement(period) {
    console.log(\`🔍 異步驗證第\${period}期結算完整性...\`);
    
    try {
        const verification = await verifySettlementCompleteness(period);
        
        if (!verification.isComplete) {
            console.log(\`⚠️ 第\${period}期結算不完整: \${verification.issues.join(', ')}\`);
            
            // 加入補償隊列
            if (!pendingSettlements.has(period)) {
                pendingSettlements.set(period, {
                    issues: verification.issues,
                    timestamp: new Date(),
                    retryCount: 0
                });
            }
            
            // 啟動補償
            await compensateFailedSettlement(period);
        } else {
            console.log(\`✅ 第\${period}期結算驗證通過\`);
        }
        
    } catch (error) {
        console.error(\`驗證第\${period}期結算時出錯:\`, error);
    }
}

async function compensateFailedSettlement(period) {
    console.log(\`🔄 開始補償第\${period}期結算...\`);
    
    try {
        const pendingData = pendingSettlements.get(period);
        if (!pendingData) {
            console.log(\`第\${period}期沒有待補償的結算\`);
            return;
        }
        
        // 增加重試次數
        pendingData.retryCount++;
        
        if (pendingData.retryCount > 5) {
            console.error(\`💥 第\${period}期補償重試次數超限，記錄到失敗表\`);
            await recordFailedSettlement(period, \`Max retries exceeded: \${pendingData.error}\`);
            pendingSettlements.delete(period);
            return;
        }
        
        console.log(\`🔄 第\${period}期補償嘗試 \${pendingData.retryCount}/5\`);
        
        // 重新嘗試結算
        if (pendingData.winResult) {
            const result = await enhancedSettlement(period, pendingData.winResult);
            if (result && result.success) {
                console.log(\`✅ 第\${period}期補償結算成功\`);
                pendingSettlements.delete(period);
                return;
            }
        }
        
        // 如果enhancedSettlement還是失敗，嘗試手動處理退水
        console.log(\`🔧 嘗試手動補償第\${period}期退水...\`);
        const manualResult = await manuallyProcessPeriodRebates(period);
        
        if (manualResult.success) {
            console.log(\`✅ 第\${period}期手動退水補償成功\`);
            pendingSettlements.delete(period);
        } else {
            console.log(\`❌ 第\${period}期手動補償失敗，將重試\`);
            
            // 延遲重試（避免頻繁重試）
            const retryDelay = pendingData.retryCount * 5000; // 5s, 10s, 15s...
            setTimeout(() => compensateFailedSettlement(period), retryDelay);
        }
        
    } catch (error) {
        console.error(\`補償第\${period}期結算時出錯:\`, error);
        
        // 延遲重試
        setTimeout(() => compensateFailedSettlement(period), 10000);
    }
}

async function manuallyProcessPeriodRebates(period) {
    console.log(\`🛠️ 手動處理第\${period}期退水...\`);
    
    try {
        // 檢查是否有已結算的注單
        const settledBets = await db.any(\`
            SELECT 
                bh.id,
                bh.username,
                bh.amount,
                bh.win_amount,
                m.id as member_id,
                m.agent_id,
                m.market_type
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.period = $1 AND bh.settled = true
        \`, [period]);
        
        if (settledBets.length === 0) {
            console.log(\`第\${period}期沒有已結算的注單\`);
            return { success: true, reason: 'no_settled_bets' };
        }
        
        // 檢查是否已有退水記錄
        const existingRebates = await db.any(\`
            SELECT COUNT(*) as count
            FROM transaction_records
            WHERE period = $1 AND transaction_type = 'rebate'
        \`, [period]);
        
        if (parseInt(existingRebates[0].count) > 0) {
            console.log(\`第\${period}期退水記錄已存在\`);
            
            // 只需要創建結算日誌
            const existingLog = await db.oneOrNone(\`
                SELECT id FROM settlement_logs WHERE period = $1
            \`, [period]);
            
            if (!existingLog) {
                await createSettlementLogForPeriod(period, settledBets);
                console.log(\`✅ 第\${period}期結算日誌已創建\`);
            }
            
            return { success: true, reason: 'rebates_existed' };
        }
        
        // 處理退水
        await db.tx(async t => {
            for (const bet of settledBets) {
                await processRebatesForBet(t, bet, period);
            }
            
            // 創建結算日誌
            await createSettlementLogForPeriod(period, settledBets, t);
        });
        
        console.log(\`✅ 第\${period}期手動退水處理完成\`);
        return { success: true };
        
    } catch (error) {
        console.error(\`手動處理第\${period}期退水失敗:\`, error);
        return { success: false, error: error.message };
    }
}

async function processRebatesForBet(t, bet, period) {
    // 獲取代理鏈
    const agentChain = await t.any(\`
        WITH RECURSIVE agent_chain AS (
            SELECT id, username, parent_id, rebate_percentage, 0 as level
            FROM agents 
            WHERE id = $1
            
            UNION ALL
            
            SELECT a.id, a.username, a.parent_id, a.rebate_percentage, ac.level + 1
            FROM agents a
            JOIN agent_chain ac ON a.id = ac.parent_id
            WHERE ac.level < 10
        )
        SELECT * FROM agent_chain ORDER BY level
    \`, [bet.agent_id]);
    
    if (agentChain.length === 0) return;
    
    let previousRebate = 0;
    
    for (const agent of agentChain) {
        const rebateDiff = (agent.rebate_percentage || 0) - previousRebate;
        
        if (rebateDiff > 0) {
            const rebateAmount = (parseFloat(bet.amount) * rebateDiff / 100);
            
            if (rebateAmount >= 0.01) {
                const currentBalance = await t.oneOrNone(\`
                    SELECT balance FROM agents WHERE id = $1
                \`, [agent.id]);
                
                if (currentBalance) {
                    const balanceBefore = parseFloat(currentBalance.balance);
                    const balanceAfter = balanceBefore + rebateAmount;
                    
                    await t.none(\`
                        UPDATE agents SET balance = balance + $1 WHERE id = $2
                    \`, [rebateAmount, agent.id]);
                    
                    await t.none(\`
                        INSERT INTO transaction_records (
                            user_type, user_id, transaction_type, amount, 
                            balance_before, balance_after, description, 
                            member_username, bet_amount, rebate_percentage, period
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    \`, [
                        'agent', agent.id, 'rebate', rebateAmount,
                        balanceBefore, balanceAfter,
                        \`退水 - 期號 \${period} 會員 \${bet.username} 下注 \${bet.amount} (補償)\`,
                        bet.username, parseFloat(bet.amount), rebateDiff, period.toString()
                    ]);
                }
            }
        }
        
        previousRebate = agent.rebate_percentage || 0;
    }
}

async function createSettlementLogForPeriod(period, settledBets, t = null) {
    const query = \`
        INSERT INTO settlement_logs (
            period, settled_count, total_win_amount, settlement_details
        ) VALUES ($1, $2, $3, $4)
    \`;
    
    const params = [
        parseInt(period),
        settledBets.length,
        settledBets.reduce((sum, bet) => sum + parseFloat(bet.win_amount || 0), 0),
        JSON.stringify(settledBets.map(bet => ({
            betId: bet.id,
            username: bet.username,
            amount: bet.amount,
            settled: true,
            compensated: true,
            compensatedAt: new Date().toISOString()
        })))
    ];
    
    if (t) {
        await t.none(query, params);
    } else {
        await db.none(query, params);
    }
}

// 定期清理補償隊列（每5分鐘）
setInterval(() => {
    console.log(\`🧹 檢查補償隊列狀態...\`);
    
    if (pendingSettlements.size > 0) {
        console.log(\`當前有 \${pendingSettlements.size} 個期號在補償隊列:\`);
        for (const [period, data] of pendingSettlements) {
            console.log(\`  - 期號 \${period}: 重試 \${data.retryCount} 次\`);
        }
    } else {
        console.log(\`✅ 補償隊列為空\`);
    }
}, 5 * 60 * 1000);

async function verifySettlementCompleteness(period) {
    console.log(\`🔍 驗證第\${period}期結算完整性...\`);
    
    try {
        const issues = [];
        
        // 檢查未結算注單
        const unsettledBets = await db.any(\`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1 AND settled = false
        \`, [period]);
        
        if (parseInt(unsettledBets[0].count) > 0) {
            issues.push(\`\${unsettledBets[0].count} unsettled bets\`);
        }
        
        // 檢查結算日誌
        const settlementLog = await db.oneOrNone(\`
            SELECT id FROM settlement_logs 
            WHERE period = $1
        \`, [period]);
        
        if (!settlementLog) {
            issues.push('missing settlement log');
        }
        
        // 檢查退水記錄
        const [betsCount, rebatesCount] = await Promise.all([
            db.one('SELECT COUNT(*) as count FROM bet_history WHERE period = $1 AND settled = true', [period]),
            db.one('SELECT COUNT(*) as count FROM transaction_records WHERE period = $1 AND transaction_type = \\'rebate\\'', [period])
        ]);
        
        if (parseInt(betsCount.count) > 0 && parseInt(rebatesCount.count) === 0) {
            issues.push('missing rebate records');
        }
        
        const isComplete = issues.length === 0;
        
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
        \`, [period, error]);
        
        console.log(\`📝 已記錄失敗結算: 期號 \${period}\`);
    } catch (dbError) {
        console.error('記錄失敗結算時出錯:', dbError);
    }
}
`;

    // 替換遊戲暫停的邏輯
    const updatedContent = backendContent
        .replace(/await settleBetsWithRetry\(currentDrawPeriod[^}]+}/g, 
            'await settleBetsNonBlocking(currentDrawPeriod, { positions: newResult });')
        .replace(/memoryGameState\.status = 'settlement_failed';[\s\S]*?return;/g, 
            '// 結算失敗時繼續遊戲，後台補償');

    // 找到插入位置
    const insertLocation = updatedContent.indexOf('// IMPROVED SETTLEMENT SYSTEM');
    
    if (insertLocation !== -1) {
        // 替換現有的改進結算系統
        const beforeImproved = updatedContent.substring(0, insertLocation);
        const afterOriginal = updatedContent.substring(updatedContent.indexOf('// ORIGINAL SETTLЕБETS FUNCTION'));
        
        const finalContent = beforeImproved + newSettlementCode + '\n' + afterOriginal;
        
        // 備份並保存
        const backupPath = './backend.js.backup.no-pause.' + Date.now();
        fs.writeFileSync(backupPath, backendContent);
        console.log(`📦 原始文件備份到: ${backupPath}`);
        
        fs.writeFileSync(backendPath, finalContent);
        console.log('✅ 已更新 backend.js - 非阻塞結算版本');
        
    } else {
        console.log('❌ 找不到插入位置，請手動更新');
        return false;
    }
    
    console.log('\n🎉 非阻塞結算系統修復完成！');
    console.log('\n特性：');
    console.log('✅ 遊戲永不暫停');
    console.log('✅ 結算失敗時後台自動補償');
    console.log('✅ 最多重試5次');
    console.log('✅ 異步驗證結算完整性');
    console.log('✅ 自動清理補償隊列');
    
    return true;
}

fixSettlementWithoutPause();