// enhanced-settlement-system.js - Enhanced settlement system with ALL bet types support
import db from './db/config.js';
import fetch from 'node-fetch';

const settlementLog = {
    info: (msg, data) => console.log(`[SETTLEMENT INFO] ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`[SETTLEMENT WARN] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[SETTLEMENT ERROR] ${msg}`, data || '')
};

/**
 * Enhanced settlement function with comprehensive bet type support
 * @param {string} period - Period number
 * @param {Object} drawResult - Draw result
 * @returns {Object} Settlement result
 */
export async function enhancedSettlement(period, drawResult) {
    // 检查是否有输赢控制影响
    const controlCheck = await checkWinLossControlStatus(period);
    if (controlCheck.enabled) {
        settlementLog.warn(`⚠️ 注意：期号 ${period} 有输赢控制设定 - 模式: ${controlCheck.mode}, 目标: ${controlCheck.target}`);
        settlementLog.warn(`输赢控制不应影响结算判定，仅影响开奖结果生成`);
    }
    const startTime = Date.now();
    settlementLog.info(`开始增强结算期号 ${period}`);
    settlementLog.info(`开奖结果:`, JSON.stringify(drawResult));
    
    try {
        // 1. Normalize draw result
        const winResult = normalizeDrawResult(drawResult);
        settlementLog.info('标准化开奖结果:', winResult);
        
        if (!winResult || !winResult.positions || winResult.positions.length !== 10) {
            throw new Error('无效的开奖结果格式');
        }
        
        // 2. Process settlement in transaction
        const result = await db.tx(async t => {
            // Get unsettled bets
            const unsettledBets = await t.manyOrNone(`
                SELECT 
                    bh.*,
                    m.id as member_id,
                    m.balance as current_balance,
                    m.market_type
                FROM bet_history bh
                INNER JOIN members m ON bh.username = m.username
                WHERE bh.period = $1 AND bh.settled = false
                FOR UPDATE OF bh, m SKIP LOCKED
            `, [period]);
            
            if (!unsettledBets || unsettledBets.length === 0) {
                settlementLog.info('没有未结算的投注');
                
                // 即使没有未结算投注，也要检查是否需要处理退水
                try {
                    const hasSettledBets = await t.oneOrNone(`
                        SELECT COUNT(*) as count 
                        FROM bet_history 
                        WHERE period = $1 AND settled = true
                    `, [period]);
                    
                    if (hasSettledBets && parseInt(hasSettledBets.count) > 0) {
                        const hasRebates = await t.oneOrNone(`
                            SELECT COUNT(*) as count 
                            FROM transaction_records
                            WHERE period = $1 AND transaction_type = 'rebate'
                        `, [period]);
                        
                        if (!hasRebates || parseInt(hasRebates.count) === 0) {
                            settlementLog.info(`发现已结算但未处理退水的注单，开始处理退水`);
                            await processRebates(period);
                            settlementLog.info(`退水处理完成: 期号 ${period}`);
                        } else {
                            settlementLog.info(`期号 ${period} 的退水已经处理过 (${hasRebates.count} 笔记录)`);
                        }
                    }
                } catch (rebateError) {
                    settlementLog.error(`退水处理失败: 期号 ${period}`, rebateError);
                    // Don't fail the entire settlement if rebate processing fails
                }
                
                return { success: true, settledCount: 0, winCount: 0, totalWinAmount: 0 };
            }
            
            settlementLog.info(`找到 ${unsettledBets.length} 笔未结算投注`);
            
            // Process each bet
            const settlementResults = [];
            const balanceUpdates = new Map();
            let totalWinAmount = 0;
            let winCount = 0;
            
            for (const bet of unsettledBets) {
                try {
                    const winCheck = await checkBetWinEnhanced(bet, winResult);
                    let winAmount = 0;
                    
                    if (winCheck.isWin) {
                        winAmount = calculateWinAmount(bet, winCheck.odds);
                        totalWinAmount += winAmount;
                        winCount++;
                        
                        // Update balance tracking
                        const userUpdate = balanceUpdates.get(bet.username) || {
                            memberId: bet.member_id,
                            currentBalance: parseFloat(bet.current_balance),
                            winAmount: 0,
                            winBets: []
                        };
                        userUpdate.winAmount += winAmount;
                        userUpdate.winBets.push({
                            betId: bet.id,
                            betType: bet.bet_type,
                            betValue: bet.bet_value,
                            position: bet.position,
                            amount: bet.amount,
                            winAmount: winAmount
                        });
                        balanceUpdates.set(bet.username, userUpdate);
                        
                        settlementLog.info(`投注 ${bet.id} 中奖: ${bet.bet_type} ${bet.bet_value} 赢得 ${winAmount}`);
                    }
                    
                    settlementResults.push({
                        id: bet.id,
                        win: winCheck.isWin,
                        winAmount: winAmount,
                        reason: winCheck.reason
                    });
                    
                } catch (betError) {
                    settlementLog.error(`处理投注 ${bet.id} 时发生错误:`, betError);
                    settlementResults.push({
                        id: bet.id,
                        win: false,
                        winAmount: 0,
                        error: betError.message
                    });
                }
            }
            
            // Update bet status
            if (settlementResults.length > 0) {
                const updateValues = settlementResults.map(r => 
                    `(${r.id}, ${r.win}, ${r.winAmount})`
                ).join(',');
                
                await t.none(`
                    UPDATE bet_history AS b
                    SET 
                        win = u.win,
                        win_amount = u.win_amount,
                        settled = true,
                        settled_at = NOW()
                    FROM (VALUES ${updateValues}) AS u(id, win, win_amount)
                    WHERE b.id = u.id::integer
                `);
                
                settlementLog.info(`批量更新了 ${settlementResults.length} 笔投注状态`);
            }
            
            // Update user balances
            if (balanceUpdates.size > 0) {
                for (const [username, update] of balanceUpdates.entries()) {
                    const newBalance = update.currentBalance + update.winAmount;
                    
                    await t.none(`
                        UPDATE members 
                        SET balance = $1
                        WHERE username = $2
                    `, [newBalance, username]);
                    
                    // Record transaction
                    await t.none(`
                        INSERT INTO transaction_records 
                        (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                        VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
                    `, [
                        update.memberId,
                        update.winAmount,
                        update.currentBalance,
                        newBalance,
                        `期号 ${period} 中奖 (${update.winBets.length}笔)`
                    ]);
                }
                
                settlementLog.info(`更新了 ${balanceUpdates.size} 个用户的余额`);
            }
            
            return {
                success: true,
                settledCount: settlementResults.length,
                winCount: winCount,
                totalWinAmount: totalWinAmount,
                userWinnings: Object.fromEntries(balanceUpdates),
                executionTime: Date.now() - startTime
            };
        });
        
        settlementLog.info(`结算完成: ${result.settledCount}笔投注, ${result.winCount}笔中奖, 总派彩${result.totalWinAmount}`);
        
        // Process rebates if settlement was successful
        // Also check if there are any settled bets that need rebate processing
        if (result.success) {
            try {
                // Check if there are any settled bets for this period
                const hasSettledBets = await db.oneOrNone(`
                    SELECT COUNT(*) as count FROM bet_history 
                    WHERE period = $1 AND settled = true
                `, [period]);
                
                if (hasSettledBets && parseInt(hasSettledBets.count) > 0) {
                    // Check if rebates have already been processed for this period
                    const hasRebates = await db.oneOrNone(`
                        SELECT COUNT(*) as count FROM transaction_records
                        WHERE transaction_type = 'rebate' 
                        AND period = $1
                    `, [period]);
                    
                    if (!hasRebates || parseInt(hasRebates.count) === 0) {
                        settlementLog.info(`发现已结算但未处理退水的注单，开始处理退水`);
                        await processRebates(period);
                        settlementLog.info(`退水处理完成: 期号 ${period}`);
                    } else {
                        settlementLog.info(`期号 ${period} 的退水已经处理过 (${hasRebates.count} 笔记录)`);
                    }
                }
            } catch (rebateError) {
                settlementLog.error(`退水处理失败: 期号 ${period}`, rebateError);
                // Don't fail the entire settlement if rebate processing fails
            }
        }
        
        return result;
        
    } catch (error) {
        settlementLog.error('结算失败:', error);
        return { 
            success: false, 
            error: error.message,
            executionTime: Date.now() - startTime
        };
    }
}

/**
 * Normalize draw result format
 */
function normalizeDrawResult(drawResult) {
    if (!drawResult) return null;
    
    if (drawResult.positions && Array.isArray(drawResult.positions)) {
        return drawResult;
    }
    
    if (drawResult.result && Array.isArray(drawResult.result)) {
        return { positions: drawResult.result };
    }
    
    if (drawResult.position_1 !== undefined) {
        const positions = [];
        for (let i = 1; i <= 10; i++) {
            positions.push(drawResult[`position_${i}`]);
        }
        return { positions };
    }
    
    if (Array.isArray(drawResult) && drawResult.length === 10) {
        return { positions: drawResult };
    }
    
    return null;
}

/**
 * Enhanced bet win checking with comprehensive bet type support
 */
async function checkBetWinEnhanced(bet, winResult) {
    const positions = winResult.positions;
    const betType = bet.bet_type;
    const betValue = String(bet.bet_value);
    
    settlementLog.info(`检查投注: id=${bet.id}, type=${betType}, value=${betValue}, position=${bet.position}`);
    if (betType === 'number' && bet.position) {
        settlementLog.info(`号码投注详情: 位置=${bet.position}, 下注号码=${betValue}, 开奖号码=${positions[parseInt(bet.position) - 1]}`);
    }
    
    // 1. 号码投注 (position-based number betting)
    if (betType === 'number' && bet.position) {
        const position = parseInt(bet.position);
        const betNumber = parseInt(betValue);
        
        // 添加详细验证日志
        settlementLog.info(`号码投注详细验证: 投注ID=${bet.id}, 原始position="${bet.position}", 原始betValue="${betValue}"`);
        settlementLog.info(`转换后: position=${position}, betNumber=${betNumber}`);
        settlementLog.info(`完整开奖阵列: ${JSON.stringify(positions)}`);
        
        if (position < 1 || position > 10 || isNaN(betNumber)) {
            settlementLog.warn(`无效投注数据: position=${position}, betNumber=${betNumber}, 原始值: position="${bet.position}", betValue="${betValue}"`);
            return { isWin: false, reason: '无效的位置或号码' };
        }
        
        const winningNumber = positions[position - 1];
        
        // 确保开奖号码有效
        if (!winningNumber || winningNumber < 1 || winningNumber > 10) {
            settlementLog.error(`异常开奖号码: 第${position}名开出${winningNumber}, 完整阵列: ${JSON.stringify(positions)}`);
            throw new Error(`异常开奖号码: 第${position}名开出${winningNumber}`);
        }
        
        // 使用多重验证确保比较正确
        const winNum = parseInt(winningNumber);
        const betNum = parseInt(betNumber);
        const isWin = winNum === betNum;
        
        // 详细记录比较结果
        settlementLog.info(`号码比较结果: 第${position}名开奖=${winNum}, 投注=${betNum}, 中奖=${isWin}`);
        
        // 移除额外的数据库验证，因为可能有时序问题
        // 我们已经有准确的开奖结果在 positions 阵列中
        if (isWin) {
            settlementLog.info(`✅ 号码投注中奖确认: 投注ID=${bet.id}, 期号=${bet.period}, 位置${position}, 投注${betNum}=开奖${winNum}`);
        }
        
        // 额外警告：如果类型转换后数值改变
        if (String(winNum) !== String(winningNumber).trim() || String(betNum) !== String(betNumber).trim()) {
            settlementLog.warn(`类型转换警告: 原始开奖="${winningNumber}", 转换后=${winNum}; 原始投注="${betNumber}", 转换后=${betNum}`);
        }
        
        return {
            isWin: isWin,
            reason: `位置${position}开出${winningNumber}，投注${betNumber}${isWin ? '中奖' : '未中'}`,
            odds: bet.odds || 9.85
        };
    }
    
    // 2. 位置投注 (position-based two-sides betting)
    const positionMap = {
        '冠军': 1, 'champion': 1,
        '亚军': 2, 'runnerup': 2,
        '季军': 3, '第三名': 3, 'third': 3,
        '第四名': 4, 'fourth': 4,
        '第五名': 5, 'fifth': 5,
        '第六名': 6, 'sixth': 6,
        '第七名': 7, 'seventh': 7,
        '第八名': 8, 'eighth': 8,
        '第九名': 9, 'ninth': 9,
        '第十名': 10, 'tenth': 10
    };
    
    const positionIndex = positionMap[betType];
    if (positionIndex) {
        const winningNumber = positions[positionIndex - 1];
        settlementLog.info(`位置投注检查: betType=${betType}, positionIndex=${positionIndex}, winningNumber=${winningNumber}, betValue=${betValue}`);
        
        // 检查是否为号码投注（1-10）
        if (/^[1-9]$|^10$/.test(betValue)) {
            const betNumber = parseInt(betValue);
            const isWin = winningNumber === betNumber;
            return {
                isWin: isWin,
                reason: `${betType}开出${winningNumber}号，投注${betNumber}号${isWin ? '中奖' : '未中'}`,
                odds: bet.odds || 9.85
            };
        }
        
        // 否则为大小单双投注
        return checkTwoSidesBet(betType, betValue, winningNumber, bet.odds);
    }
    
    // 3. 两面投注 (general two-sides betting)
    if (betType === '两面' || betType === 'two_sides') {
        const parts = betValue.split('_');
        if (parts.length === 2) {
            const position = parseInt(parts[0]);
            const type = parts[1];
            
            if (position >= 1 && position <= 10) {
                const winningNumber = positions[position - 1];
                return checkTwoSidesBet(`位置${position}`, type, winningNumber, bet.odds);
            }
        }
    }
    
    // 4. 冠亚和投注 (champion + runner-up sum betting)
    if (betType === 'sum' || betType === 'sumValue' || betType === '冠亚和') {
        const sum = positions[0] + positions[1];
        
        // 和值数字投注
        if (/^\d+$/.test(betValue)) {
            const betSum = parseInt(betValue);
            const isWin = sum === betSum;
            return {
                isWin: isWin,
                reason: `冠亚和开出${sum}，投注${betSum}${isWin ? '中奖' : '未中'}`,
                odds: bet.odds || getSumOdds(betSum)
            };
        }
        
        // 和值大小单双
        return checkTwoSidesBet('冠亚和', betValue, sum, bet.odds);
    }
    
    // 5. 龙虎投注 (dragon vs tiger betting)
    if (betType === 'dragon_tiger' || betType === 'dragonTiger' || betType === '龙虎') {
        return checkDragonTigerBet(betValue, positions, bet.odds);
    }
    
    // 6. 龙虎对战 (specific dragon vs tiger battles)
    if (betType.includes('dragon') || betType.includes('tiger') || betType.includes('龙') || betType.includes('虎')) {
        return checkDragonTigerBet(betValue, positions, bet.odds);
    }
    
    // 7. 特殊投注格式支援
    if (betType.includes('_vs_') || betType.includes('对战')) {
        return checkDragonTigerBet(betValue, positions, bet.odds);
    }
    
    // 未知投注类型
    return {
        isWin: false,
        reason: `未知的投注类型: ${betType} ${betValue}`,
        odds: 0
    };
}

/**
 * Check two-sides betting (big/small/odd/even)
 */
function checkTwoSidesBet(betType, betValue, winningNumber, odds) {
    let isWin = false;
    let description = '';
    
    // 判断是否为冠亚和投注
    const isSumBet = betType === '冠亚和' || betType === 'sum' || betType === 'sumValue';
    
    switch (betValue) {
        case 'big':
        case '大':
            if (isSumBet) {
                // 冠亚和大小：12-19为大，3-11为小
                isWin = winningNumber >= 12;
                description = winningNumber >= 12 ? '大' : '小';
            } else {
                // 位置大小：6-10为大，1-5为小
                isWin = winningNumber >= 6;
                description = winningNumber >= 6 ? '大' : '小';
            }
            break;
        case 'small':
        case '小':
            if (isSumBet) {
                // 冠亚和大小：12-19为大，3-11为小
                isWin = winningNumber <= 11;
                description = winningNumber <= 11 ? '小' : '大';
            } else {
                // 位置大小：6-10为大，1-5为小
                isWin = winningNumber <= 5;
                description = winningNumber <= 5 ? '小' : '大';
            }
            break;
        case 'odd':
        case '单':
            isWin = winningNumber % 2 === 1;
            description = winningNumber % 2 === 1 ? '单' : '双';
            break;
        case 'even':
        case '双':
            isWin = winningNumber % 2 === 0;
            description = winningNumber % 2 === 0 ? '双' : '单';
            break;
        default:
            return { isWin: false, reason: `未知的投注值: ${betValue}`, odds: 0 };
    }
    
    return {
        isWin: isWin,
        reason: `${betType}开出${winningNumber}(${description})`,
        odds: odds || 1.985
    };
}

/**
 * Check dragon vs tiger betting
 */
function checkDragonTigerBet(betValue, positions, odds) {
    let pos1, pos2, betSide;
    
    // Parse different formats
    if (betValue.includes('dragon_') || betValue.includes('tiger_')) {
        const parts = betValue.split('_');
        betSide = parts[0];
        pos1 = parseInt(parts[1]);
        pos2 = parseInt(parts[2]);
    } else if (betValue.includes('_vs_')) {
        const parts = betValue.split('_vs_');
        pos1 = parseInt(parts[0]);
        pos2 = parseInt(parts[1]);
        betSide = 'dragon'; // default
    } else {
        const parts = betValue.split('_');
        if (parts.length >= 2) {
            pos1 = parseInt(parts[0]);
            pos2 = parseInt(parts[1]);
            betSide = parts[2] || 'dragon';
        } else {
            return { isWin: false, reason: `无效的龙虎投注格式: ${betValue}`, odds: 0 };
        }
    }
    
    if (pos1 >= 1 && pos1 <= 10 && pos2 >= 1 && pos2 <= 10 && pos1 !== pos2) {
        const num1 = positions[pos1 - 1];
        const num2 = positions[pos2 - 1];
        
        const isWin = ((betSide === 'dragon' || betSide === '龙') && num1 > num2) || 
                     ((betSide === 'tiger' || betSide === '虎') && num1 < num2);
        
        return {
            isWin: isWin,
            reason: `${pos1}位(${num1}) vs ${pos2}位(${num2})，${num1 > num2 ? '龙' : '虎'}赢`,
            odds: odds || 1.985
        };
    }
    
    return { isWin: false, reason: `无效的龙虎投注位置: ${betValue}`, odds: 0 };
}

/**
 * Calculate win amount
 */
function calculateWinAmount(bet, odds) {
    const betAmount = parseFloat(bet.amount);
    const finalOdds = odds || parseFloat(bet.odds) || 0;
    
    if (finalOdds <= 0) {
        settlementLog.warn(`投注 ${bet.id} 没有有效赔率`);
        return 0;
    }
    
    return parseFloat((betAmount * finalOdds).toFixed(2));
}

/**
 * Get sum odds for champion + runner-up sum
 */
function getSumOdds(sum) {
    const sumOdds = {
        3: 43.00, 4: 21.50, 5: 14.33, 6: 10.75, 7: 8.60,
        8: 7.16, 9: 6.14, 10: 5.37, 11: 5.37, 12: 6.14,
        13: 7.16, 14: 8.60, 15: 10.75, 16: 14.33, 17: 21.50,
        18: 43.00, 19: 86.00
    };
    return sumOdds[sum] || 0;
}

// 代理系统API URL
const AGENT_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://bet-agent.onrender.com' 
  : 'http://localhost:3003';

// 处理退水 - 修复版本，防止重复处理
async function processRebates(period) {
    try {
        settlementLog.info(`💰 开始处理期号 ${period} 的退水`);
        
        // 使用事务和锁来防止重复处理
        await db.tx(async t => {
            // 先检查是否已经处理过该期的退水
            const existingRebates = await t.oneOrNone(`
                SELECT COUNT(*) as count 
                FROM transaction_records 
                WHERE period = $1 
                AND transaction_type = 'rebate'
                LIMIT 1
            `, [period]);
            
            if (existingRebates && parseInt(existingRebates.count) > 0) {
                settlementLog.info(`期号 ${period} 的退水已经处理过，跳过`);
                return;
            }
            
            // 获取该期所有已结算的注单
            const settledBets = await t.manyOrNone(`
                SELECT username, SUM(amount) as total_amount
                FROM bet_history
                WHERE period = $1 AND settled = true
                GROUP BY username
            `, [period]);
            
            settlementLog.info(`💰 找到 ${settledBets.length} 位会员需要处理退水`);
            
            for (const record of settledBets) {
                try {
                    // 调用退水分配逻辑，传入事务对象
                    await distributeRebateInTransaction(record.username, parseFloat(record.total_amount), period, t);
                    settlementLog.info(`✅ 已为会员 ${record.username} 分配退水，下注金额: ${record.total_amount}`);
                } catch (rebateError) {
                    settlementLog.error(`❌ 为会员 ${record.username} 分配退水失败:`, rebateError);
                    // 如果是唯一约束冲突错误，说明已经处理过了，跳过
                    if (rebateError.code === '23505') {
                        settlementLog.info(`会员 ${record.username} 的退水已经处理过，跳过`);
                    } else {
                        throw rebateError;
                    }
                }
            }
        });
        
    } catch (error) {
        settlementLog.error(`处理退水时发生错误:`, error);
        throw error;
    }
}

// 支援事务的退水分配函数 - 新逻辑：所有退水直接给总代理
async function distributeRebateInTransaction(username, betAmount, period, transaction) {
    const t = transaction || db;
    try {
        settlementLog.info(`开始为会员 ${username} 分配退水，下注金额: ${betAmount}`);
        
        // 获取会员的代理链来确定盘口类型和总代理
        const agentChain = await getAgentChain(username);
        if (!agentChain || agentChain.length === 0) {
            settlementLog.info(`会员 ${username} 没有代理链，退水归平台所有`);
            return;
        }
        
        // 找到最顶层的总代理（没有上级的代理）
        const topAgent = agentChain[agentChain.length - 1];
        const marketType = topAgent.market_type || 'D';
        
        // 计算固定的退水金额（根据盘口类型）
        const rebatePercentage = marketType === 'A' ? 0.011 : 0.041; // A盘1.1%, D盘4.1%
        const rebateAmount = parseFloat(betAmount) * rebatePercentage;
        const roundedRebateAmount = Math.round(rebateAmount * 100) / 100;
        
        settlementLog.info(`会员 ${username} 的代理链:`, agentChain.map(a => `${a.username}(L${a.level})`));
        settlementLog.info(`${marketType}盘，退水 ${(rebatePercentage*100).toFixed(1)}% = ${roundedRebateAmount.toFixed(2)} 元`);
        settlementLog.info(`所有退水将直接分配给总代理: ${topAgent.username}`);
        
        if (roundedRebateAmount > 0) {
            // 直接分配全部退水给总代理
            await allocateRebateToAgent(
                topAgent.id, 
                topAgent.username, 
                roundedRebateAmount, 
                username, 
                betAmount, 
                period
            );
            settlementLog.info(`✅ 已分配全部退水 ${roundedRebateAmount.toFixed(2)} 元给总代理 ${topAgent.username}`);
        }
        
    } catch (error) {
        settlementLog.error('分配退水时发生错误:', error);
        throw error;
    }
}

// 原有的退水分配函数（保留以支援向后兼容）
async function distributeRebate(username, betAmount, period) {
    return distributeRebateInTransaction(username, betAmount, period, null);
}

// 获取会员的代理链
async function getAgentChain(username) {
    try {
        const response = await fetch(`${AGENT_API_URL}/api/agent/member-agent-chain?username=${username}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            settlementLog.error(`获取代理链失败: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        if (data.success) {
            return data.agentChain || [];
        } else {
            settlementLog.error('获取代理链失败:', data.message);
            return [];
        }
    } catch (error) {
        settlementLog.error('获取代理链时发生错误:', error);
        return [];
    }
}

// 分配退水给代理
async function allocateRebateToAgent(agentId, agentUsername, rebateAmount, memberUsername, betAmount, period) {
    try {
        // 调用代理系统的退水分配API
        const response = await fetch(`${AGENT_API_URL}/api/agent/allocate-rebate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                agentId: agentId,
                agentUsername: agentUsername,
                rebateAmount: rebateAmount,
                memberUsername: memberUsername,
                betAmount: betAmount,
                period: period,
                reason: `期号 ${period} 退水分配`
            })
        });
        
        if (!response.ok) {
            throw new Error(`代理系统API返回错误: ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(`退水分配失败: ${result.message}`);
        }
        
        settlementLog.info(`成功分配退水 ${rebateAmount} 给代理 ${agentUsername}`);
        
    } catch (error) {
        settlementLog.error(`分配退水给代理 ${agentUsername} 失败:`, error);
        throw error;
    }
}

export {
    checkBetWinEnhanced,
    calculateWinAmount,
    getSumOdds,
    processRebates
};


// 检查输赢控制状态（仅用于日志记录）
async function checkWinLossControlStatus(period) {
    try {
        const response = await fetch(`${AGENT_API_URL}/api/agent/internal/win-loss-control/active`);
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
                return {
                    enabled: true,
                    mode: result.data.control_mode,
                    target: result.data.target_username
                };
            }
        }
    } catch (error) {
        // 忽略错误
    }
    return { enabled: false };
}

export default {
    enhancedSettlement,
    normalizeDrawResult,
    checkBetWinEnhanced,
    calculateWinAmount,
    getSumOdds,
    processRebates
};