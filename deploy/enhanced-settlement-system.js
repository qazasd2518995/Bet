// enhanced-settlement-system.js - Enhanced settlement system with ALL bet types support
import db from './db/config.js';

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
                    const winCheck = checkBetWinEnhanced(bet, winResult);
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
function checkBetWinEnhanced(bet, winResult) {
    const positions = winResult.positions;
    const betType = bet.bet_type;
    const betValue = String(bet.bet_value);
    
    settlementLog.info(`檢查投注: id=${bet.id}, type=${betType}, value=${betValue}, position=${bet.position}`);
    
    // 1. 號碼投注 (position-based number betting)
    if (betType === 'number' && bet.position) {
        const position = parseInt(bet.position);
        const betNumber = parseInt(betValue);
        
        if (position < 1 || position > 10 || isNaN(betNumber)) {
            return { isWin: false, reason: '無效的位置或號碼' };
        }
        
        const winningNumber = positions[position - 1];
        const isWin = winningNumber === betNumber;
        
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
    
    switch (betValue) {
        case 'big':
        case '大':
            isWin = winningNumber >= 6;
            description = winningNumber >= 6 ? '大' : '小';
            break;
        case 'small':
        case '小':
            isWin = winningNumber <= 5;
            description = winningNumber <= 5 ? '小' : '大';
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
        
        const isWin = (betSide === 'dragon' && num1 > num2) || 
                     (betSide === 'tiger' && num1 < num2);
        
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

export {
    checkBetWinEnhanced,
    calculateWinAmount,
    getSumOdds
};

export default {
    enhancedSettlement,
    normalizeDrawResult,
    checkBetWinEnhanced,
    calculateWinAmount,
    getSumOdds
};