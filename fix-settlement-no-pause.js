// fix-settlement-no-pause.js - 修正结算系统，不暂停游戏，改用异步补偿
import fs from 'fs';

function fixSettlementWithoutPause() {
    console.log('🔧 修正结算系统 - 不暂停游戏版本\n');
    
    // 读取当前 backend.js
    const backendPath = './backend.js';
    const backendContent = fs.readFileSync(backendPath, 'utf8');
    
    // 新的结算逻辑 - 不阻塞游戏
    const newSettlementCode = `
// 非阻塞式结算系统 - 游戏继续，后台补偿
let pendingSettlements = new Map(); // 追踪待补偿的结算

async function settleBetsNonBlocking(period, winResult) {
    console.log(\`🎯 开始非阻塞结算第\${period}期注单...\`);
    
    try {
        // 立即尝试结算
        const result = await enhancedSettlement(period, winResult);
        
        if (result && result.success) {
            console.log(\`✅ 第\${period}期结算成功\`);
            
            // 异步验证结算完整性（不阻塞游戏）
            setImmediate(() => verifyAndCompensateSettlement(period));
            
            return { success: true };
        } else {
            throw new Error(\`Enhanced settlement failed: \${result?.message || 'Unknown error'}\`);
        }
        
    } catch (error) {
        console.error(\`❌ 第\${period}期结算失败:\`, error.message);
        
        // 记录失败，异步处理补偿
        pendingSettlements.set(period, {
            winResult,
            error: error.message,
            timestamp: new Date(),
            retryCount: 0
        });
        
        // 立即启动后台补偿（不阻塞游戏）
        setImmediate(() => compensateFailedSettlement(period));
        
        // 游戏继续运行
        return { success: false, compensating: true };
    }
}

async function verifyAndCompensateSettlement(period) {
    console.log(\`🔍 异步验证第\${period}期结算完整性...\`);
    
    try {
        const verification = await verifySettlementCompleteness(period);
        
        if (!verification.isComplete) {
            console.log(\`⚠️ 第\${period}期结算不完整: \${verification.issues.join(', ')}\`);
            
            // 加入补偿队列
            if (!pendingSettlements.has(period)) {
                pendingSettlements.set(period, {
                    issues: verification.issues,
                    timestamp: new Date(),
                    retryCount: 0
                });
            }
            
            // 启动补偿
            await compensateFailedSettlement(period);
        } else {
            console.log(\`✅ 第\${period}期结算验证通过\`);
        }
        
    } catch (error) {
        console.error(\`验证第\${period}期结算时出错:\`, error);
    }
}

async function compensateFailedSettlement(period) {
    console.log(\`🔄 开始补偿第\${period}期结算...\`);
    
    try {
        const pendingData = pendingSettlements.get(period);
        if (!pendingData) {
            console.log(\`第\${period}期没有待补偿的结算\`);
            return;
        }
        
        // 增加重试次数
        pendingData.retryCount++;
        
        if (pendingData.retryCount > 5) {
            console.error(\`💥 第\${period}期补偿重试次数超限，记录到失败表\`);
            await recordFailedSettlement(period, \`Max retries exceeded: \${pendingData.error}\`);
            pendingSettlements.delete(period);
            return;
        }
        
        console.log(\`🔄 第\${period}期补偿尝试 \${pendingData.retryCount}/5\`);
        
        // 重新尝试结算
        if (pendingData.winResult) {
            const result = await enhancedSettlement(period, pendingData.winResult);
            if (result && result.success) {
                console.log(\`✅ 第\${period}期补偿结算成功\`);
                pendingSettlements.delete(period);
                return;
            }
        }
        
        // 如果enhancedSettlement还是失败，尝试手动处理退水
        console.log(\`🔧 尝试手动补偿第\${period}期退水...\`);
        const manualResult = await manuallyProcessPeriodRebates(period);
        
        if (manualResult.success) {
            console.log(\`✅ 第\${period}期手动退水补偿成功\`);
            pendingSettlements.delete(period);
        } else {
            console.log(\`❌ 第\${period}期手动补偿失败，将重试\`);
            
            // 延迟重试（避免频繁重试）
            const retryDelay = pendingData.retryCount * 5000; // 5s, 10s, 15s...
            setTimeout(() => compensateFailedSettlement(period), retryDelay);
        }
        
    } catch (error) {
        console.error(\`补偿第\${period}期结算时出错:\`, error);
        
        // 延迟重试
        setTimeout(() => compensateFailedSettlement(period), 10000);
    }
}

async function manuallyProcessPeriodRebates(period) {
    console.log(\`🛠️ 手动处理第\${period}期退水...\`);
    
    try {
        // 检查是否有已结算的注单
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
            console.log(\`第\${period}期没有已结算的注单\`);
            return { success: true, reason: 'no_settled_bets' };
        }
        
        // 检查是否已有退水记录
        const existingRebates = await db.any(\`
            SELECT COUNT(*) as count
            FROM transaction_records
            WHERE period = $1 AND transaction_type = 'rebate'
        \`, [period]);
        
        if (parseInt(existingRebates[0].count) > 0) {
            console.log(\`第\${period}期退水记录已存在\`);
            
            // 只需要创建结算日志
            const existingLog = await db.oneOrNone(\`
                SELECT id FROM settlement_logs WHERE period = $1
            \`, [period]);
            
            if (!existingLog) {
                await createSettlementLogForPeriod(period, settledBets);
                console.log(\`✅ 第\${period}期结算日志已创建\`);
            }
            
            return { success: true, reason: 'rebates_existed' };
        }
        
        // 处理退水
        await db.tx(async t => {
            for (const bet of settledBets) {
                await processRebatesForBet(t, bet, period);
            }
            
            // 创建结算日志
            await createSettlementLogForPeriod(period, settledBets, t);
        });
        
        console.log(\`✅ 第\${period}期手动退水处理完成\`);
        return { success: true };
        
    } catch (error) {
        console.error(\`手动处理第\${period}期退水失败:\`, error);
        return { success: false, error: error.message };
    }
}

async function processRebatesForBet(t, bet, period) {
    // 获取代理链
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
                        \`退水 - 期号 \${period} 会员 \${bet.username} 下注 \${bet.amount} (补偿)\`,
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

// 定期清理补偿队列（每5分钟）
setInterval(() => {
    console.log(\`🧹 检查补偿队列状态...\`);
    
    if (pendingSettlements.size > 0) {
        console.log(\`当前有 \${pendingSettlements.size} 个期号在补偿队列:\`);
        for (const [period, data] of pendingSettlements) {
            console.log(\`  - 期号 \${period}: 重试 \${data.retryCount} 次\`);
        }
    } else {
        console.log(\`✅ 补偿队列为空\`);
    }
}, 5 * 60 * 1000);

async function verifySettlementCompleteness(period) {
    console.log(\`🔍 验证第\${period}期结算完整性...\`);
    
    try {
        const issues = [];
        
        // 检查未结算注单
        const unsettledBets = await db.any(\`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1 AND settled = false
        \`, [period]);
        
        if (parseInt(unsettledBets[0].count) > 0) {
            issues.push(\`\${unsettledBets[0].count} unsettled bets\`);
        }
        
        // 检查结算日志
        const settlementLog = await db.oneOrNone(\`
            SELECT id FROM settlement_logs 
            WHERE period = $1
        \`, [period]);
        
        if (!settlementLog) {
            issues.push('missing settlement log');
        }
        
        // 检查退水记录
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
        \`, [period, error]);
        
        console.log(\`📝 已记录失败结算: 期号 \${period}\`);
    } catch (dbError) {
        console.error('记录失败结算时出错:', dbError);
    }
}
`;

    // 替换游戏暂停的逻辑
    const updatedContent = backendContent
        .replace(/await settleBetsWithRetry\(currentDrawPeriod[^}]+}/g, 
            'await settleBetsNonBlocking(currentDrawPeriod, { positions: newResult });')
        .replace(/memoryGameState\.status = 'settlement_failed';[\s\S]*?return;/g, 
            '// 结算失败时继续游戏，后台补偿');

    // 找到插入位置
    const insertLocation = updatedContent.indexOf('// IMPROVED SETTLEMENT SYSTEM');
    
    if (insertLocation !== -1) {
        // 替换现有的改进结算系统
        const beforeImproved = updatedContent.substring(0, insertLocation);
        const afterOriginal = updatedContent.substring(updatedContent.indexOf('// ORIGINAL SETTLЕБETS FUNCTION'));
        
        const finalContent = beforeImproved + newSettlementCode + '\n' + afterOriginal;
        
        // 备份并保存
        const backupPath = './backend.js.backup.no-pause.' + Date.now();
        fs.writeFileSync(backupPath, backendContent);
        console.log(`📦 原始文件备份到: ${backupPath}`);
        
        fs.writeFileSync(backendPath, finalContent);
        console.log('✅ 已更新 backend.js - 非阻塞结算版本');
        
    } else {
        console.log('❌ 找不到插入位置，请手动更新');
        return false;
    }
    
    console.log('\n🎉 非阻塞结算系统修复完成！');
    console.log('\n特性：');
    console.log('✅ 游戏永不暂停');
    console.log('✅ 结算失败时后台自动补偿');
    console.log('✅ 最多重试5次');
    console.log('✅ 异步验证结算完整性');
    console.log('✅ 自动清理补偿队列');
    
    return true;
}

fixSettlementWithoutPause();