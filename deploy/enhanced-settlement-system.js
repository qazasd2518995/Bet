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
    // 檢查是否有輸贏控制影響
    const controlCheck = await checkWinLossControlStatus(period);
    if (controlCheck.enabled) {
        settlementLog.warn(`⚠️ 注意：期號 ${period} 有輸贏控制設定 - 模式: ${controlCheck.mode}, 目標: ${controlCheck.target}`);
        settlementLog.warn(`輸贏控制不應影響結算判定，僅影響開獎結果生成`);
    }
    const startTime = Date.now();
    settlementLog.info(`開始增強結算期號 ${period}`);
    settlementLog.info(`開獎結果:`, JSON.stringify(drawResult));
    
    try {
        // 1. Normalize draw result
        const winResult = normalizeDrawResult(drawResult);
        settlementLog.info('標準化開獎結果:', winResult);
        
        if (!winResult || !winResult.positions || winResult.positions.length !== 10) {
            throw new Error('無效的開獎結果格式');
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
                settlementLog.info('沒有未結算的投注');
                
                // 即使沒有未結算投注，也要檢查是否需要處理退水
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
                            settlementLog.info(`發現已結算但未處理退水的注單，開始處理退水`);
                            await processRebates(period);
                            settlementLog.info(`退水處理完成: 期號 ${period}`);
                        } else {
                            settlementLog.info(`期號 ${period} 的退水已經處理過 (${hasRebates.count} 筆記錄)`);
                        }
                    }
                } catch (rebateError) {
                    settlementLog.error(`退水處理失敗: 期號 ${period}`, rebateError);
                    // Don't fail the entire settlement if rebate processing fails
                }
                
                return { success: true, settledCount: 0, winCount: 0, totalWinAmount: 0 };
            }
            
            settlementLog.info(`找到 ${unsettledBets.length} 筆未結算投注`);
            
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
                        
                        settlementLog.info(`投注 ${bet.id} 中獎: ${bet.bet_type} ${bet.bet_value} 贏得 ${winAmount}`);
                    }
                    
                    settlementResults.push({
                        id: bet.id,
                        win: winCheck.isWin,
                        winAmount: winAmount,
                        reason: winCheck.reason
                    });
                    
                } catch (betError) {
                    settlementLog.error(`處理投注 ${bet.id} 時發生錯誤:`, betError);
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
                
                settlementLog.info(`批量更新了 ${settlementResults.length} 筆投注狀態`);
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
                        `期號 ${period} 中獎 (${update.winBets.length}筆)`
                    ]);
                }
                
                settlementLog.info(`更新了 ${balanceUpdates.size} 個用戶的餘額`);
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
        
        settlementLog.info(`結算完成: ${result.settledCount}筆投注, ${result.winCount}筆中獎, 總派彩${result.totalWinAmount}`);
        
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
                        settlementLog.info(`發現已結算但未處理退水的注單，開始處理退水`);
                        await processRebates(period);
                        settlementLog.info(`退水處理完成: 期號 ${period}`);
                    } else {
                        settlementLog.info(`期號 ${period} 的退水已經處理過 (${hasRebates.count} 筆記錄)`);
                    }
                }
            } catch (rebateError) {
                settlementLog.error(`退水處理失敗: 期號 ${period}`, rebateError);
                // Don't fail the entire settlement if rebate processing fails
            }
        }
        
        return result;
        
    } catch (error) {
        settlementLog.error('結算失敗:', error);
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
    
    settlementLog.info(`檢查投注: id=${bet.id}, type=${betType}, value=${betValue}, position=${bet.position}`);
    if (betType === 'number' && bet.position) {
        settlementLog.info(`號碼投注詳情: 位置=${bet.position}, 下注號碼=${betValue}, 開獎號碼=${positions[parseInt(bet.position) - 1]}`);
    }
    
    // 1. 號碼投注 (position-based number betting)
    if (betType === 'number' && bet.position) {
        const position = parseInt(bet.position);
        const betNumber = parseInt(betValue);
        
        // 添加詳細驗證日誌
        settlementLog.info(`號碼投注詳細驗證: 投注ID=${bet.id}, 原始position="${bet.position}", 原始betValue="${betValue}"`);
        settlementLog.info(`轉換後: position=${position}, betNumber=${betNumber}`);
        settlementLog.info(`完整開獎陣列: ${JSON.stringify(positions)}`);
        
        if (position < 1 || position > 10 || isNaN(betNumber)) {
            settlementLog.warn(`無效投注數據: position=${position}, betNumber=${betNumber}, 原始值: position="${bet.position}", betValue="${betValue}"`);
            return { isWin: false, reason: '無效的位置或號碼' };
        }
        
        const winningNumber = positions[position - 1];
        
        // 確保開獎號碼有效
        if (!winningNumber || winningNumber < 1 || winningNumber > 10) {
            settlementLog.error(`異常開獎號碼: 第${position}名開出${winningNumber}, 完整陣列: ${JSON.stringify(positions)}`);
            throw new Error(`異常開獎號碼: 第${position}名開出${winningNumber}`);
        }
        
        // 使用多重驗證確保比較正確
        const winNum = parseInt(winningNumber);
        const betNum = parseInt(betNumber);
        const isWin = winNum === betNum;
        
        // 詳細記錄比較結果
        settlementLog.info(`號碼比較結果: 第${position}名開獎=${winNum}, 投注=${betNum}, 中獎=${isWin}`);
        
        // 移除額外的數據庫驗證，因為可能有時序問題
        // 我們已經有準確的開獎結果在 positions 陣列中
        if (isWin) {
            settlementLog.info(`✅ 號碼投注中獎確認: 投注ID=${bet.id}, 期號=${bet.period}, 位置${position}, 投注${betNum}=開獎${winNum}`);
        }
        
        // 額外警告：如果類型轉換後數值改變
        if (String(winNum) !== String(winningNumber).trim() || String(betNum) !== String(betNumber).trim()) {
            settlementLog.warn(`類型轉換警告: 原始開獎="${winningNumber}", 轉換後=${winNum}; 原始投注="${betNumber}", 轉換後=${betNum}`);
        }
        
        return {
            isWin: isWin,
            reason: `位置${position}開出${winningNumber}，投注${betNumber}${isWin ? '中獎' : '未中'}`,
            odds: bet.odds || 9.85
        };
    }
    
    // 2. 位置投注 (position-based two-sides betting)
    const positionMap = {
        '冠軍': 1, 'champion': 1,
        '亞軍': 2, 'runnerup': 2,
        '季軍': 3, '第三名': 3, 'third': 3,
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
        settlementLog.info(`位置投注檢查: betType=${betType}, positionIndex=${positionIndex}, winningNumber=${winningNumber}, betValue=${betValue}`);
        
        // 檢查是否為號碼投注（1-10）
        if (/^[1-9]$|^10$/.test(betValue)) {
            const betNumber = parseInt(betValue);
            const isWin = winningNumber === betNumber;
            return {
                isWin: isWin,
                reason: `${betType}開出${winningNumber}號，投注${betNumber}號${isWin ? '中獎' : '未中'}`,
                odds: bet.odds || 9.85
            };
        }
        
        // 否則為大小單雙投注
        return checkTwoSidesBet(betType, betValue, winningNumber, bet.odds);
    }
    
    // 3. 兩面投注 (general two-sides betting)
    if (betType === '兩面' || betType === 'two_sides') {
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
    
    // 4. 冠亞和投注 (champion + runner-up sum betting)
    if (betType === 'sum' || betType === 'sumValue' || betType === '冠亞和') {
        const sum = positions[0] + positions[1];
        
        // 和值數字投注
        if (/^\d+$/.test(betValue)) {
            const betSum = parseInt(betValue);
            const isWin = sum === betSum;
            return {
                isWin: isWin,
                reason: `冠亞和開出${sum}，投注${betSum}${isWin ? '中獎' : '未中'}`,
                odds: bet.odds || getSumOdds(betSum)
            };
        }
        
        // 和值大小單雙
        return checkTwoSidesBet('冠亞和', betValue, sum, bet.odds);
    }
    
    // 5. 龍虎投注 (dragon vs tiger betting)
    if (betType === 'dragon_tiger' || betType === 'dragonTiger' || betType === '龍虎') {
        return checkDragonTigerBet(betValue, positions, bet.odds);
    }
    
    // 6. 龍虎對戰 (specific dragon vs tiger battles)
    if (betType.includes('dragon') || betType.includes('tiger') || betType.includes('龍') || betType.includes('虎')) {
        return checkDragonTigerBet(betValue, positions, bet.odds);
    }
    
    // 7. 特殊投注格式支援
    if (betType.includes('_vs_') || betType.includes('對戰')) {
        return checkDragonTigerBet(betValue, positions, bet.odds);
    }
    
    // 未知投注類型
    return {
        isWin: false,
        reason: `未知的投注類型: ${betType} ${betValue}`,
        odds: 0
    };
}

/**
 * Check two-sides betting (big/small/odd/even)
 */
function checkTwoSidesBet(betType, betValue, winningNumber, odds) {
    let isWin = false;
    let description = '';
    
    // 判斷是否為冠亞和投注
    const isSumBet = betType === '冠亞和' || betType === 'sum' || betType === 'sumValue';
    
    switch (betValue) {
        case 'big':
        case '大':
            if (isSumBet) {
                // 冠亞和大小：12-19為大，3-11為小
                isWin = winningNumber >= 12;
                description = winningNumber >= 12 ? '大' : '小';
            } else {
                // 位置大小：6-10為大，1-5為小
                isWin = winningNumber >= 6;
                description = winningNumber >= 6 ? '大' : '小';
            }
            break;
        case 'small':
        case '小':
            if (isSumBet) {
                // 冠亞和大小：12-19為大，3-11為小
                isWin = winningNumber <= 11;
                description = winningNumber <= 11 ? '小' : '大';
            } else {
                // 位置大小：6-10為大，1-5為小
                isWin = winningNumber <= 5;
                description = winningNumber <= 5 ? '小' : '大';
            }
            break;
        case 'odd':
        case '單':
            isWin = winningNumber % 2 === 1;
            description = winningNumber % 2 === 1 ? '單' : '雙';
            break;
        case 'even':
        case '雙':
            isWin = winningNumber % 2 === 0;
            description = winningNumber % 2 === 0 ? '雙' : '單';
            break;
        default:
            return { isWin: false, reason: `未知的投注值: ${betValue}`, odds: 0 };
    }
    
    return {
        isWin: isWin,
        reason: `${betType}開出${winningNumber}(${description})`,
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
            return { isWin: false, reason: `無效的龍虎投注格式: ${betValue}`, odds: 0 };
        }
    }
    
    if (pos1 >= 1 && pos1 <= 10 && pos2 >= 1 && pos2 <= 10 && pos1 !== pos2) {
        const num1 = positions[pos1 - 1];
        const num2 = positions[pos2 - 1];
        
        const isWin = ((betSide === 'dragon' || betSide === '龍') && num1 > num2) || 
                     ((betSide === 'tiger' || betSide === '虎') && num1 < num2);
        
        return {
            isWin: isWin,
            reason: `${pos1}位(${num1}) vs ${pos2}位(${num2})，${num1 > num2 ? '龍' : '虎'}贏`,
            odds: odds || 1.985
        };
    }
    
    return { isWin: false, reason: `無效的龍虎投注位置: ${betValue}`, odds: 0 };
}

/**
 * Calculate win amount
 */
function calculateWinAmount(bet, odds) {
    const betAmount = parseFloat(bet.amount);
    const finalOdds = odds || parseFloat(bet.odds) || 0;
    
    if (finalOdds <= 0) {
        settlementLog.warn(`投注 ${bet.id} 沒有有效賠率`);
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

// 代理系統API URL
const AGENT_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://bet-agent.onrender.com' 
  : 'http://localhost:3003';

// 處理退水 - 修復版本，防止重複處理
async function processRebates(period) {
    try {
        settlementLog.info(`💰 開始處理期號 ${period} 的退水`);
        
        // 使用事務和鎖來防止重複處理
        await db.tx(async t => {
            // 先檢查是否已經處理過該期的退水
            const existingRebates = await t.oneOrNone(`
                SELECT COUNT(*) as count 
                FROM transaction_records 
                WHERE period = $1 
                AND transaction_type = 'rebate'
                LIMIT 1
            `, [period]);
            
            if (existingRebates && parseInt(existingRebates.count) > 0) {
                settlementLog.info(`期號 ${period} 的退水已經處理過，跳過`);
                return;
            }
            
            // 獲取該期所有已結算的注單
            const settledBets = await t.manyOrNone(`
                SELECT username, SUM(amount) as total_amount
                FROM bet_history
                WHERE period = $1 AND settled = true
                GROUP BY username
            `, [period]);
            
            settlementLog.info(`💰 找到 ${settledBets.length} 位會員需要處理退水`);
            
            for (const record of settledBets) {
                try {
                    // 調用退水分配邏輯，傳入事務對象
                    await distributeRebateInTransaction(record.username, parseFloat(record.total_amount), period, t);
                    settlementLog.info(`✅ 已為會員 ${record.username} 分配退水，下注金額: ${record.total_amount}`);
                } catch (rebateError) {
                    settlementLog.error(`❌ 為會員 ${record.username} 分配退水失敗:`, rebateError);
                    // 如果是唯一約束衝突錯誤，說明已經處理過了，跳過
                    if (rebateError.code === '23505') {
                        settlementLog.info(`會員 ${record.username} 的退水已經處理過，跳過`);
                    } else {
                        throw rebateError;
                    }
                }
            }
        });
        
    } catch (error) {
        settlementLog.error(`處理退水時發生錯誤:`, error);
        throw error;
    }
}

// 支援事務的退水分配函數 - 新邏輯：所有退水直接給總代理
async function distributeRebateInTransaction(username, betAmount, period, transaction) {
    const t = transaction || db;
    try {
        settlementLog.info(`開始為會員 ${username} 分配退水，下注金額: ${betAmount}`);
        
        // 獲取會員的代理鏈來確定盤口類型和總代理
        const agentChain = await getAgentChain(username);
        if (!agentChain || agentChain.length === 0) {
            settlementLog.info(`會員 ${username} 沒有代理鏈，退水歸平台所有`);
            return;
        }
        
        // 找到最頂層的總代理（沒有上級的代理）
        const topAgent = agentChain[agentChain.length - 1];
        const marketType = topAgent.market_type || 'D';
        
        // 計算固定的退水金額（根據盤口類型）
        const rebatePercentage = marketType === 'A' ? 0.011 : 0.041; // A盤1.1%, D盤4.1%
        const rebateAmount = parseFloat(betAmount) * rebatePercentage;
        const roundedRebateAmount = Math.round(rebateAmount * 100) / 100;
        
        settlementLog.info(`會員 ${username} 的代理鏈:`, agentChain.map(a => `${a.username}(L${a.level})`));
        settlementLog.info(`${marketType}盤，退水 ${(rebatePercentage*100).toFixed(1)}% = ${roundedRebateAmount.toFixed(2)} 元`);
        settlementLog.info(`所有退水將直接分配給總代理: ${topAgent.username}`);
        
        if (roundedRebateAmount > 0) {
            // 直接分配全部退水給總代理
            await allocateRebateToAgent(
                topAgent.id, 
                topAgent.username, 
                roundedRebateAmount, 
                username, 
                betAmount, 
                period
            );
            settlementLog.info(`✅ 已分配全部退水 ${roundedRebateAmount.toFixed(2)} 元給總代理 ${topAgent.username}`);
        }
        
    } catch (error) {
        settlementLog.error('分配退水時發生錯誤:', error);
        throw error;
    }
}

// 原有的退水分配函數（保留以支援向後兼容）
async function distributeRebate(username, betAmount, period) {
    return distributeRebateInTransaction(username, betAmount, period, null);
}

// 獲取會員的代理鏈
async function getAgentChain(username) {
    try {
        const response = await fetch(`${AGENT_API_URL}/api/agent/member-agent-chain?username=${username}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            settlementLog.error(`獲取代理鏈失敗: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        if (data.success) {
            return data.agentChain || [];
        } else {
            settlementLog.error('獲取代理鏈失敗:', data.message);
            return [];
        }
    } catch (error) {
        settlementLog.error('獲取代理鏈時發生錯誤:', error);
        return [];
    }
}

// 分配退水給代理
async function allocateRebateToAgent(agentId, agentUsername, rebateAmount, memberUsername, betAmount, period) {
    try {
        // 調用代理系統的退水分配API
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
                reason: `期號 ${period} 退水分配`
            })
        });
        
        if (!response.ok) {
            throw new Error(`代理系統API返回錯誤: ${response.status}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(`退水分配失敗: ${result.message}`);
        }
        
        settlementLog.info(`成功分配退水 ${rebateAmount} 給代理 ${agentUsername}`);
        
    } catch (error) {
        settlementLog.error(`分配退水給代理 ${agentUsername} 失敗:`, error);
        throw error;
    }
}

export {
    checkBetWinEnhanced,
    calculateWinAmount,
    getSumOdds,
    processRebates
};


// 檢查輸贏控制狀態（僅用於日誌記錄）
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
        // 忽略錯誤
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