// optimized-betting-system.js - 優化的投注和結算系統
import db from './db/config.js';
import fetch from 'node-fetch';

// 緩存配置
const cache = new Map();
const CACHE_TTL = 60000; // 60秒緩存

// 會員信息緩存
const memberCache = new Map();
const MEMBER_CACHE_TTL = 300000; // 5分鐘緩存

// 優化的批量投注系統
export async function optimizedBatchBet(username, bets, period, AGENT_API_URL) {
    const startTime = Date.now();
    
    try {
        // 1. 並行獲取會員信息（使用緩存）
        const memberInfo = await getCachedMemberInfo(username, AGENT_API_URL);
        
        if (!memberInfo) {
            return { success: false, message: '無法獲取會員信息' };
        }
        
        // 檢查會員狀態
        if (memberInfo.status === 0) {
            return { success: false, message: '帳號已被停用，請聯繫客服' };
        } else if (memberInfo.status === 2) {
            return { success: false, message: '帳號已被凍結，只能觀看遊戲無法下注' };
        }
        
        // 2. 批量驗證和準備投注數據
        const totalAmount = bets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);
        const memberMarketType = memberInfo.market_type || 'D';
        
        // 3. 單次扣款
        const balanceResult = await deductBalance(username, totalAmount, AGENT_API_URL);
        if (!balanceResult.success) {
            return { success: false, message: balanceResult.message };
        }
        
        // 4. 批量插入投注記錄（使用單個查詢）
        const betInsertResult = await db.tx(async t => {
            // 準備批量插入數據
            const insertValues = bets.map((bet, index) => {
                const odds = getQuickOdds(bet.betType, bet.value, memberMarketType);
                return `(
                    '${username}', 
                    ${period}, 
                    '${bet.betType}', 
                    '${bet.value}', 
                    ${bet.position || 'NULL'}, 
                    ${bet.amount}, 
                    ${odds}, 
                    false, 
                    0, 
                    false, 
                    NOW()
                )`;
            }).join(',');
            
            // 批量插入
            const insertedBets = await t.manyOrNone(`
                INSERT INTO bet_history 
                (username, period, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at)
                VALUES ${insertValues}
                RETURNING id, bet_type, bet_value, amount, odds
            `);
            
            return insertedBets;
        });
        
        const elapsed = Date.now() - startTime;
        console.log(`✅ 批量投注完成: ${betInsertResult.length}筆, 耗時: ${elapsed}ms`);
        
        return {
            success: true,
            message: `下注成功: 共${betInsertResult.length}筆`,
            betIds: betInsertResult.map(b => b.id),
            balance: balanceResult.balance,
            executionTime: elapsed
        };
        
    } catch (error) {
        console.error('優化批量投注失敗:', error);
        
        // 錯誤時退還金額
        try {
            await refundBalance(username, totalAmount, AGENT_API_URL);
        } catch (refundError) {
            console.error('退款失敗:', refundError);
        }
        
        return {
            success: false,
            message: `系統錯誤: ${error.message}`
        };
    }
}

// 優化的結算系統
export async function optimizedSettlement(period, winResult) {
    const startTime = Date.now();
    
    try {
        // 使用單個查詢完成所有結算
        const result = await db.tx(async t => {
            // 1. 批量獲取並鎖定未結算投注
            const unsettledBets = await t.manyOrNone(`
                SELECT b.*, m.id as member_id, m.balance as current_balance
                FROM bet_history b
                INNER JOIN members m ON b.username = m.username
                WHERE b.period = $1 AND b.settled = false
                FOR UPDATE OF b, m SKIP LOCKED
            `, [period]);
            
            if (!unsettledBets || unsettledBets.length === 0) {
                return { success: true, settledCount: 0, totalWinAmount: 0 };
            }
            
            // 2. 批量計算中獎結果
            const updates = [];
            const balanceUpdates = new Map();
            let totalWinAmount = 0;
            
            for (const bet of unsettledBets) {
                const isWin = quickCheckWin(bet, winResult);
                let winAmount = 0;
                
                if (isWin) {
                    winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                    totalWinAmount += winAmount;
                    
                    // 累計每個用戶的中獎金額
                    const currentTotal = balanceUpdates.get(bet.username) || { 
                        memberId: bet.member_id,
                        currentBalance: parseFloat(bet.current_balance),
                        winAmount: 0 
                    };
                    currentTotal.winAmount += winAmount;
                    balanceUpdates.set(bet.username, currentTotal);
                }
                
                updates.push({
                    id: bet.id,
                    win: isWin,
                    winAmount: winAmount
                });
            }
            
            // 3. 批量更新投注狀態
            if (updates.length > 0) {
                const updateValues = updates.map(u => 
                    `(${u.id}, ${u.win}, ${u.winAmount})`
                ).join(',');
                
                await t.none(`
                    UPDATE bet_history AS b
                    SET win = u.win,
                        win_amount = u.win_amount,
                        settled = true,
                        settled_at = NOW()
                    FROM (VALUES ${updateValues}) AS u(id, win, win_amount)
                    WHERE b.id = u.id::integer
                `);
            }
            
            // 4. 批量更新用戶餘額和記錄交易
            if (balanceUpdates.size > 0) {
                // 批量更新餘額
                const balanceUpdateValues = Array.from(balanceUpdates.entries()).map(([username, data]) => 
                    `('${username}', ${data.currentBalance + data.winAmount})`
                ).join(',');
                
                await t.none(`
                    UPDATE members AS m
                    SET balance = u.new_balance
                    FROM (VALUES ${balanceUpdateValues}) AS u(username, new_balance)
                    WHERE m.username = u.username
                `);
                
                // 批量插入交易記錄
                const transactionValues = Array.from(balanceUpdates.entries()).map(([username, data]) => 
                    `('member', ${data.memberId}, 'win', ${data.winAmount}, ${data.currentBalance}, ${data.currentBalance + data.winAmount}, '期號 ${period} 中獎', NOW())`
                ).join(',');
                
                await t.none(`
                    INSERT INTO transaction_records 
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ${transactionValues}
                `);
            }
            
            // 5. 記錄結算日誌
            await t.none(`
                INSERT INTO settlement_logs 
                (period, settled_count, total_win_amount, created_at)
                VALUES ($1, $2, $3, NOW())
            `, [period, updates.length, totalWinAmount]);
            
            return {
                success: true,
                settledCount: updates.length,
                totalWinAmount: totalWinAmount,
                userWinnings: Object.fromEntries(balanceUpdates)
            };
        });
        
        const elapsed = Date.now() - startTime;
        console.log(`✅ 優化結算完成: ${result.settledCount}筆, 總中獎: ${result.totalWinAmount}, 耗時: ${elapsed}ms`);
        
        // 異步處理退水（不阻塞主流程）
        if (result.settledCount > 0) {
            processRebatesAsync(period).catch(err => 
                console.error('退水處理失敗:', err)
            );
        }
        
        return result;
        
    } catch (error) {
        console.error('優化結算失敗:', error);
        return { success: false, error: error.message };
    }
}

// 快速檢查中獎（避免複雜邏輯）
function quickCheckWin(bet, winResult) {
    if (!winResult || !winResult.positions) {
        console.log(`[DEBUG] quickCheckWin: No winResult or positions for bet ${bet.id}`);
        return false;
    }
    
    const positions = winResult.positions;
    const betType = bet.bet_type;
    const betValue = bet.bet_value;
    
    // Debug logging for specific periods
    if (bet.period === '20250714396' || bet.period === 20250714396) {
        console.log(`[DEBUG] Period 396 Bet ${bet.id}: type=${betType}, value=${betValue}, position=${bet.position}, username=${bet.username}`);
        console.log(`[DEBUG] Win positions:`, positions);
    }
    
    // 處理 'number' 類型的投注（包含所有位置的號碼投注）
    if (betType === 'number' && bet.position) {
        // Ensure position is a number (it might come as string from DB)
        const position = parseInt(bet.position);
        if (isNaN(position) || position < 1 || position > 10) {
            console.log(`[WARNING] Invalid position for bet ${bet.id}: ${bet.position}`);
            return false;
        }
        
        // position 從 1 開始，陣列索引從 0 開始
        const winningNumber = positions[position - 1];
        const betNumber = parseInt(betValue);
        
        if (isNaN(betNumber)) {
            console.log(`[WARNING] Invalid bet value for bet ${bet.id}: ${betValue}`);
            return false;
        }
        
        const isWin = winningNumber === betNumber;
        
        // Debug logging for number bets
        if (bet.period === '20250714374' || bet.period === 20250714374) {
            console.log(`[DEBUG] Bet ${bet.id}: position=${position}, winningNumber=${winningNumber}, betNumber=${betNumber}, isWin=${isWin}`);
        }
        
        return isWin;
    }
    
    // 簡化的中獎檢查邏輯 - 包含中文位置名稱
    const positionTypes = ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
                          '冠軍', '亞軍', '季軍', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'];
    
    if (betType === 'position' || positionTypes.includes(betType)) {
        const positionIndex = getPositionIndex(betType, bet.position);
        
        // Debug logging for position bets
        if (bet.period === '20250714396' || bet.period === 20250714396) {
            console.log(`[DEBUG] Position bet check: betType=${betType}, positionIndex=${positionIndex}`);
        }
        
        if (positionIndex === -1) return false;
        
        const number = positions[positionIndex];
        
        // Debug logging for position result
        if (bet.period === '20250714396' || bet.period === 20250714396) {
            console.log(`[DEBUG] Position ${positionIndex + 1} has number ${number}, betting on ${betValue}`);
        }
        
        switch (betValue) {
            case 'big':
            case '大':
                return number >= 6;
            case 'small':
            case '小':
                return number <= 5;
            case 'odd':
            case '單':
                return number % 2 === 1;
            case 'even':
            case '雙':
                return number % 2 === 0;
            default: 
                return number === parseInt(betValue);
        }
    }
    
    // 其他投注類型...
    return false;
}

// 獲取位置索引
function getPositionIndex(betType, position) {
    if (betType === 'position' && position) {
        return parseInt(position) - 1;
    }
    
    const positionMap = {
        'champion': 0, 'runnerup': 1, 'third': 2, 'fourth': 3,
        'fifth': 4, 'sixth': 5, 'seventh': 6, 'eighth': 7,
        'ninth': 8, 'tenth': 9,
        // 中文位置名稱
        '冠軍': 0, '亞軍': 1, '季軍': 2, '第三名': 2,
        '第四名': 3, '第五名': 4, '第六名': 5, '第七名': 6,
        '第八名': 7, '第九名': 8, '第十名': 9
    };
    
    return positionMap[betType] !== undefined ? positionMap[betType] : -1;
}

// 快速獲取賠率（使用緩存）
function getQuickOdds(betType, value, marketType) {
    const cacheKey = `${betType}-${value}-${marketType}`;
    const cached = cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
        return cached.odds;
    }
    
    // 計算賠率
    let odds = 1.0;
    const rebatePercentage = marketType === 'A' ? 0.011 : 0.041;
    
    // 冠亞和值投注
    if (betType === 'sumValue' || betType === 'sum' || betType === '冠亞和') {
        const sumOdds = {
            '3': parseFloat((45.0 * (1 - rebatePercentage)).toFixed(3)), 
            '4': parseFloat((23.0 * (1 - rebatePercentage)).toFixed(3)), 
            '5': parseFloat((15.0 * (1 - rebatePercentage)).toFixed(3)), 
            '6': parseFloat((11.5 * (1 - rebatePercentage)).toFixed(3)), 
            '7': parseFloat((9.0 * (1 - rebatePercentage)).toFixed(3)), 
            '8': parseFloat((7.5 * (1 - rebatePercentage)).toFixed(3)), 
            '9': parseFloat((6.5 * (1 - rebatePercentage)).toFixed(3)), 
            '10': parseFloat((5.7 * (1 - rebatePercentage)).toFixed(3)), 
            '11': parseFloat((5.7 * (1 - rebatePercentage)).toFixed(3)), 
            '12': parseFloat((6.5 * (1 - rebatePercentage)).toFixed(3)), 
            '13': parseFloat((7.5 * (1 - rebatePercentage)).toFixed(3)), 
            '14': parseFloat((9.0 * (1 - rebatePercentage)).toFixed(3)), 
            '15': parseFloat((11.5 * (1 - rebatePercentage)).toFixed(3)), 
            '16': parseFloat((15.0 * (1 - rebatePercentage)).toFixed(3)), 
            '17': parseFloat((23.0 * (1 - rebatePercentage)).toFixed(3)),
            '18': parseFloat((45.0 * (1 - rebatePercentage)).toFixed(3)), 
            '19': parseFloat((90.0 * (1 - rebatePercentage)).toFixed(3))
        };
        odds = sumOdds[value] || 1.0;
    }
    // 兩面投注
    else if (['big', 'small', 'odd', 'even'].includes(value)) {
        odds = 2.0 * (1 - rebatePercentage);
    } 
    // 號碼投注
    else if (betType === 'number' || !isNaN(parseInt(value))) {
        odds = 10.0 * (1 - rebatePercentage);
    }
    
    // 緩存結果
    const finalOdds = parseFloat(odds.toFixed(3));
    cache.set(cacheKey, {
        odds: finalOdds,
        expires: Date.now() + CACHE_TTL
    });
    
    return finalOdds;
}

// 緩存的會員信息獲取
async function getCachedMemberInfo(username, AGENT_API_URL) {
    const cached = memberCache.get(username);
    
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }
    
    try {
        const response = await fetch(`${AGENT_API_URL}/api/agent/member/info/${username}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000 // 5秒超時
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.member) {
                // 緩存結果
                memberCache.set(username, {
                    data: data.member,
                    expires: Date.now() + MEMBER_CACHE_TTL
                });
                return data.member;
            }
        }
    } catch (error) {
        console.error('獲取會員信息失敗:', error);
    }
    
    return null;
}

// 扣除餘額
async function deductBalance(username, amount, AGENT_API_URL) {
    try {
        const response = await fetch(`${AGENT_API_URL}/api/agent/deduct-member-balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                amount: amount,
                reason: '批量遊戲下注'
            }),
            timeout: 5000
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        return { success: false, message: '餘額扣除失敗' };
    }
}

// 退還餘額
async function refundBalance(username, amount, AGENT_API_URL) {
    try {
        await fetch(`${AGENT_API_URL}/api/agent/add-member-balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                amount: amount,
                reason: '投注失敗退款'
            }),
            timeout: 5000
        });
    } catch (error) {
        console.error('退款請求失敗:', error);
    }
}

// 異步處理退水
async function processRebatesAsync(period) {
    // 退水邏輯（不阻塞主流程）
    console.log(`開始處理期號 ${period} 的退水...`);
    // 實際退水邏輯
}

export default {
    optimizedBatchBet,
    optimizedSettlement
};