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
        
        // 2. 批量驗證限紅和準備投注數據
        const totalAmount = bets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);
        const memberMarketType = memberInfo.market_type || 'D';
        
        // 批量驗證每筆下注的限紅
        const limitValidationResult = await validateBatchBettingLimits(username, bets, period, AGENT_API_URL);
        if (!limitValidationResult.success) {
            return { success: false, message: limitValidationResult.message };
        }
        
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
    
    // 處理位置大小單雙投注
    if (positionTypes.includes(betType) && ['big', 'small', 'odd', 'even', '大', '小', '單', '雙'].includes(betValue)) {
        const positionIndex = getPositionIndex(betType, bet.position);
        
        if (positionIndex === -1) return false;
        
        const number = positions[positionIndex];
        
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
        }
    }
    
    // 處理位置號碼投注
    if (positionTypes.includes(betType) && !['big', 'small', 'odd', 'even', '大', '小', '單', '雙'].includes(betValue)) {
        const positionIndex = getPositionIndex(betType, bet.position);
        if (positionIndex === -1) return false;
        
        const number = positions[positionIndex];
        return number === parseInt(betValue);
    }
    
    // 處理龍虎投注
    if (betType === 'dragonTiger' || betType === 'dragon_tiger' || betType === '龍虎') {
        // 解析投注值，格式可能是 "dragon_1_10" 或 "3_8_dragon" 等
        let pos1, pos2, betSide;
        
        if (betValue.includes('dragon_') || betValue.includes('tiger_')) {
            // 格式: dragon_1_10 或 tiger_1_10
            const parts = betValue.split('_');
            betSide = parts[0];
            pos1 = parseInt(parts[1]);
            pos2 = parseInt(parts[2]);
        } else if (betValue.includes('_dragon') || betValue.includes('_tiger')) {
            // 格式: 3_8_dragon 或 3_8_tiger
            const parts = betValue.split('_');
            pos1 = parseInt(parts[0]);
            pos2 = parseInt(parts[1]);
            betSide = parts[2];
        } else {
            // 其他格式，嘗試解析
            const parts = betValue.split('_');
            if (parts.length >= 2) {
                pos1 = parseInt(parts[0]);
                pos2 = parseInt(parts[1]);
                betSide = parts[2] || 'dragon';
            } else {
                return false;
            }
        }
        
        // 檢查位置是否有效
        if (isNaN(pos1) || isNaN(pos2) || pos1 < 1 || pos1 > 10 || pos2 < 1 || pos2 > 10 || pos1 === pos2) {
            return false;
        }
        
        // 獲取對應位置的號碼
        const num1 = positions[pos1 - 1];
        const num2 = positions[pos2 - 1];
        
        // 判斷輸贏
        if (betSide === 'dragon' || betSide === '龍') {
            return num1 > num2;
        } else if (betSide === 'tiger' || betSide === '虎') {
            return num1 < num2;
        }
        
        return false;
    }
    
    // 處理冠亞和投注
    if (betType === 'sumValue' || betType === 'sum' || betType === '冠亞和') {
        const sum = positions[0] + positions[1];
        
        // 和值數字投注
        if (/^\d+$/.test(betValue)) {
            return sum === parseInt(betValue);
        }
        
        // 和值大小單雙
        switch (betValue) {
            case 'big':
            case '大':
                return sum >= 12;
            case 'small':
            case '小':
                return sum <= 11;
            case 'odd':
            case '單':
                return sum % 2 === 1;
            case 'even':
            case '雙':
                return sum % 2 === 0;
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
        // 處理冠亞和大小單雙
        if (['big', 'small', 'odd', 'even', '大', '小', '單', '雙'].includes(value)) {
            odds = 2.0 * (1 - rebatePercentage);
        } else {
            // 處理數字和值
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
    }
    // 龍虎投注
    else if (betType === 'dragonTiger' || betType === 'dragon_tiger' || betType === '龍虎') {
        // 龍虎投注賠率：A盤 1.978，D盤 1.918
        const dragonTigerBaseOdds = 2.0;
        odds = dragonTigerBaseOdds * (1 - rebatePercentage);
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
    try {
        console.log(`開始處理期號 ${period} 的退水...`);
        // 引入 enhanced-settlement-system 的退水處理邏輯
        const { processRebates } = await import('./enhanced-settlement-system.js');
        await processRebates(period);
        console.log(`✅ 期號 ${period} 的退水處理完成`);
    } catch (error) {
        console.error(`❌ 退水處理失敗 (期號 ${period}):`, error.message);
        // 記錄錯誤但不阻塞主流程
    }
}

// 批量下注限紅驗證函數
async function validateBatchBettingLimits(username, bets, period, AGENT_API_URL) {
    try {
        console.log(`🔍 驗證用戶 ${username} 的批量下注限紅...`);
        
        // 1. 獲取用戶的限紅配置
        let userLimits = null;
        try {
            const response = await fetch(`${AGENT_API_URL}/api/agent/member-betting-limit-by-username?username=${username}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.config) {
                    userLimits = data.config;
                    console.log(`✅ 獲取到用戶 ${username} 的限紅配置`);
                }
            }
        } catch (apiError) {
            console.warn('獲取會員限紅設定失敗，使用預設限紅:', apiError.message);
        }
        
        // 2. 如果無法獲取用戶限紅，使用預設限紅
        if (!userLimits) {
            userLimits = {
                number: { maxBet: 2500, minBet: 1, periodLimit: 5000 },
                twoSide: { maxBet: 5000, minBet: 1, periodLimit: 5000 },
                sumValue: { maxBet: 1000, minBet: 1, periodLimit: 2000 },
                dragonTiger: { maxBet: 5000, minBet: 1, periodLimit: 5000 },
                sumValueSize: { maxBet: 5000, minBet: 1, periodLimit: 5000 },
                sumValueOddEven: { maxBet: 5000, minBet: 1, periodLimit: 5000 }
            };
            console.log(`⚠️ 使用預設限紅配置`);
        }
        
        // 3. 獲取用戶在當前期號已有的下注
        const existingBets = await db.any(`
            SELECT bet_type, bet_value, amount, position
            FROM bet_history 
            WHERE username = $1 AND period = $2 AND settled = false
        `, [username, period]);
        
        // 4. 按每個具體下注選項分組計算（新邏輯）
        const optionTotals = {};
        
        // 先計算已有下注
        existingBets.forEach(bet => {
            // 使用具體的選項鍵，而不是類別
            const optionKey = `${bet.bet_type}-${bet.bet_value}${bet.position ? `-${bet.position}` : ''}`;
            if (!optionTotals[optionKey]) {
                optionTotals[optionKey] = 0;
            }
            optionTotals[optionKey] += parseFloat(bet.amount);
        });
        
        // 5. 驗證新的批量下注
        for (const bet of bets) {
            const amount = parseFloat(bet.amount);
            const betCategory = getBetCategory(bet.betType, bet.value, bet.position);
            const limits = userLimits[betCategory];
            
            // 建立具體的選項鍵
            const optionKey = `${bet.betType}-${bet.value}${bet.position ? `-${bet.position}` : ''}`;
            
            console.log(`🎲 檢查下注: betType=${bet.betType}, value=${bet.value}, amount=${amount}, optionKey=${optionKey}`);
            console.log(`📊 限紅配置:`, limits);
            
            if (!limits) {
                return {
                    success: false,
                    message: `未知的下注類型: ${bet.betType}/${bet.value}`
                };
            }
            
            // 檢查單注最高限制
            if (amount > limits.maxBet) {
                console.log(`❌ 單注超限: ${amount} > ${limits.maxBet}`);
                const categoryName = getBetCategoryDisplayName(betCategory);
                return {
                    success: false,
                    message: `${categoryName}單注金額不能超過 ${limits.maxBet} 元，當前: ${amount} 元，請重新輸入金額後再下注`
                };
            }
            
            // 檢查最小下注限制
            if (amount < limits.minBet) {
                const categoryName = getBetCategoryDisplayName(betCategory);
                return {
                    success: false,
                    message: `${categoryName}單注金額不能少於 ${limits.minBet} 元，當前: ${amount} 元`
                };
            }
            
            // 累加到具體選項總額中（新邏輯）
            if (!optionTotals[optionKey]) {
                optionTotals[optionKey] = 0;
            }
            const newTotal = optionTotals[optionKey] + amount;
            
            // 檢查單期限額（每個選項獨立計算）
            if (newTotal > limits.periodLimit) {
                const existingAmount = optionTotals[optionKey];
                const categoryName = getBetCategoryDisplayName(betCategory);
                return {
                    success: false,
                    message: `該選項單期限額為 ${limits.periodLimit} 元，已投注 ${existingAmount} 元，無法再投注 ${amount} 元`
                };
            }
            
            // 更新選項總額
            optionTotals[optionKey] = newTotal;
        }
        
        console.log(`✅ 批量下注限紅驗證通過`);
        return { success: true };
        
    } catch (error) {
        console.error('批量下注限紅驗證失敗:', error);
        return {
            success: false,
            message: `限紅驗證失敗: ${error.message}`
        };
    }
}

// 獲取下注類型分類
function getBetCategory(betType, betValue, position) {
    // 龍虎下注
    if (betType === 'dragonTiger' || betType.includes('dragon') || betType.includes('tiger')) {
        return 'dragonTiger';
    }
    
    // 冠亞和值下注
    if (betType === 'sumValue' || betType === 'sum' || betType === '冠亞和') {
        if (['big', 'small', '大', '小'].includes(betValue)) {
            return 'sumValueSize';
        } else if (['odd', 'even', '單', '雙'].includes(betValue)) {
            return 'sumValueOddEven';
        } else {
            return 'sumValue';  // 具體數值
        }
    }
    
    // 號碼下注（包括位置號碼）
    if (betType === 'number' || (
        ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType) && 
        !['big', 'small', 'odd', 'even', '大', '小', '單', '雙'].includes(betValue)
    )) {
        return 'number';
    }
    
    // 兩面下注（位置大小單雙）
    if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'position'].includes(betType) && 
        ['big', 'small', 'odd', 'even', '大', '小', '單', '雙'].includes(betValue)) {
        return 'twoSide';
    }
    
    // 預設為兩面下注
    return 'twoSide';
}

// 獲取下注類型的中文名稱
function getBetCategoryDisplayName(category) {
    const displayNames = {
        'twoSide': '兩面',
        'number': '號碼',
        'sumValue': '冠亞和',
        'dragonTiger': '龍虎',
        'sumValueSize': '冠亞和大小',
        'sumValueOddEven': '冠亞和單雙'
    };
    return displayNames[category] || category;
}

export default {
    optimizedBatchBet,
    optimizedSettlement
};

// Export for testing
export { getQuickOdds };