// optimized-betting-system.js - 优化的投注和结算系统
import db from './db/config.js';
import fetch from 'node-fetch';

// 缓存配置
const cache = new Map();
const CACHE_TTL = 60000; // 60秒缓存

// 会员信息缓存
const memberCache = new Map();
const MEMBER_CACHE_TTL = 300000; // 5分钟缓存

// 优化的批量投注系统
export async function optimizedBatchBet(username, bets, period, AGENT_API_URL) {
    const startTime = Date.now();
    
    try {
        // 1. 并行获取会员信息（使用缓存）
        const memberInfo = await getCachedMemberInfo(username, AGENT_API_URL);
        
        if (!memberInfo) {
            return { success: false, message: '无法获取会员信息' };
        }
        
        // 检查会员状态
        if (memberInfo.status === 0) {
            return { success: false, message: '帐号已被停用，请联系客服' };
        } else if (memberInfo.status === 2) {
            return { success: false, message: '帐号已被冻结，只能观看游戏无法下注' };
        }
        
        // 2. 批量验证限红和准备投注数据
        const totalAmount = bets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);
        const memberMarketType = memberInfo.market_type || 'D';
        
        // 批量验证每笔下注的限红
        const limitValidationResult = await validateBatchBettingLimits(username, bets, period, AGENT_API_URL);
        if (!limitValidationResult.success) {
            return { success: false, message: limitValidationResult.message };
        }
        
        // 3. 单次扣款
        const balanceResult = await deductBalance(username, totalAmount, AGENT_API_URL);
        if (!balanceResult.success) {
            return { success: false, message: balanceResult.message };
        }
        
        // 4. 批量插入投注记录（使用单个查询）
        const betInsertResult = await db.tx(async t => {
            // 准备批量插入数据
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
        console.log(`✅ 批量投注完成: ${betInsertResult.length}笔, 耗时: ${elapsed}ms`);
        
        return {
            success: true,
            message: `下注成功: 共${betInsertResult.length}笔`,
            betIds: betInsertResult.map(b => b.id),
            balance: balanceResult.balance,
            executionTime: elapsed
        };
        
    } catch (error) {
        console.error('优化批量投注失败:', error);
        
        // 错误时退还金额
        try {
            await refundBalance(username, totalAmount, AGENT_API_URL);
        } catch (refundError) {
            console.error('退款失败:', refundError);
        }
        
        return {
            success: false,
            message: `系统错误: ${error.message}`
        };
    }
}

// 优化的结算系统
export async function optimizedSettlement(period, winResult) {
    const startTime = Date.now();
    
    try {
        // 使用单个查询完成所有结算
        const result = await db.tx(async t => {
            // 1. 批量获取并锁定未结算投注
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
            
            // 2. 批量计算中奖结果
            const updates = [];
            const balanceUpdates = new Map();
            let totalWinAmount = 0;
            
            for (const bet of unsettledBets) {
                const isWin = quickCheckWin(bet, winResult);
                let winAmount = 0;
                
                if (isWin) {
                    winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                    totalWinAmount += winAmount;
                    
                    // 累计每个用户的中奖金额
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
            
            // 3. 批量更新投注状态
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
            
            // 4. 批量更新用户余额和记录交易
            if (balanceUpdates.size > 0) {
                // 批量更新余额
                const balanceUpdateValues = Array.from(balanceUpdates.entries()).map(([username, data]) => 
                    `('${username}', ${data.currentBalance + data.winAmount})`
                ).join(',');
                
                await t.none(`
                    UPDATE members AS m
                    SET balance = u.new_balance
                    FROM (VALUES ${balanceUpdateValues}) AS u(username, new_balance)
                    WHERE m.username = u.username
                `);
                
                // 批量插入交易记录
                const transactionValues = Array.from(balanceUpdates.entries()).map(([username, data]) => 
                    `('member', ${data.memberId}, 'win', ${data.winAmount}, ${data.currentBalance}, ${data.currentBalance + data.winAmount}, '期号 ${period} 中奖', NOW())`
                ).join(',');
                
                await t.none(`
                    INSERT INTO transaction_records 
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ${transactionValues}
                `);
            }
            
            // 5. 记录结算日志
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
        console.log(`✅ 优化结算完成: ${result.settledCount}笔, 总中奖: ${result.totalWinAmount}, 耗时: ${elapsed}ms`);
        
        // 异步处理退水（不阻塞主流程）
        if (result.settledCount > 0) {
            processRebatesAsync(period).catch(err => 
                console.error('退水处理失败:', err)
            );
        }
        
        return result;
        
    } catch (error) {
        console.error('优化结算失败:', error);
        return { success: false, error: error.message };
    }
}

// 快速检查中奖（避免复杂逻辑）
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
    
    // 处理 'number' 类型的投注（包含所有位置的号码投注）
    if (betType === 'number' && bet.position) {
        // Ensure position is a number (it might come as string from DB)
        const position = parseInt(bet.position);
        if (isNaN(position) || position < 1 || position > 10) {
            console.log(`[WARNING] Invalid position for bet ${bet.id}: ${bet.position}`);
            return false;
        }
        
        // position 从 1 开始，阵列索引从 0 开始
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
    
    // 简化的中奖检查逻辑 - 包含中文位置名称
    const positionTypes = ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
                          '冠军', '亚军', '季军', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'];
    
    // 处理位置大小单双投注
    if (positionTypes.includes(betType) && ['big', 'small', 'odd', 'even', '大', '小', '单', '双'].includes(betValue)) {
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
            case '单':
                return number % 2 === 1;
            case 'even':
            case '双':
                return number % 2 === 0;
        }
    }
    
    // 处理位置号码投注
    if (positionTypes.includes(betType) && !['big', 'small', 'odd', 'even', '大', '小', '单', '双'].includes(betValue)) {
        const positionIndex = getPositionIndex(betType, bet.position);
        if (positionIndex === -1) return false;
        
        const number = positions[positionIndex];
        return number === parseInt(betValue);
    }
    
    // 处理龙虎投注
    if (betType === 'dragonTiger' || betType === 'dragon_tiger' || betType === '龙虎') {
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
            // 其他格式，尝试解析
            const parts = betValue.split('_');
            if (parts.length >= 2) {
                pos1 = parseInt(parts[0]);
                pos2 = parseInt(parts[1]);
                betSide = parts[2] || 'dragon';
            } else {
                return false;
            }
        }
        
        // 检查位置是否有效
        if (isNaN(pos1) || isNaN(pos2) || pos1 < 1 || pos1 > 10 || pos2 < 1 || pos2 > 10 || pos1 === pos2) {
            return false;
        }
        
        // 获取对应位置的号码
        const num1 = positions[pos1 - 1];
        const num2 = positions[pos2 - 1];
        
        // 判断输赢
        if (betSide === 'dragon' || betSide === '龙') {
            return num1 > num2;
        } else if (betSide === 'tiger' || betSide === '虎') {
            return num1 < num2;
        }
        
        return false;
    }
    
    // 处理冠亚和投注
    if (betType === 'sumValue' || betType === 'sum' || betType === '冠亚和') {
        const sum = positions[0] + positions[1];
        
        // 和值数字投注
        if (/^\d+$/.test(betValue)) {
            return sum === parseInt(betValue);
        }
        
        // 和值大小单双
        switch (betValue) {
            case 'big':
            case '大':
                return sum >= 12;
            case 'small':
            case '小':
                return sum <= 11;
            case 'odd':
            case '单':
                return sum % 2 === 1;
            case 'even':
            case '双':
                return sum % 2 === 0;
        }
    }
    
    // 其他投注类型...
    return false;
}

// 获取位置索引
function getPositionIndex(betType, position) {
    if (betType === 'position' && position) {
        return parseInt(position) - 1;
    }
    
    const positionMap = {
        'champion': 0, 'runnerup': 1, 'third': 2, 'fourth': 3,
        'fifth': 4, 'sixth': 5, 'seventh': 6, 'eighth': 7,
        'ninth': 8, 'tenth': 9,
        // 中文位置名称
        '冠军': 0, '亚军': 1, '季军': 2, '第三名': 2,
        '第四名': 3, '第五名': 4, '第六名': 5, '第七名': 6,
        '第八名': 7, '第九名': 8, '第十名': 9
    };
    
    return positionMap[betType] !== undefined ? positionMap[betType] : -1;
}

// 快速获取赔率（使用缓存）
function getQuickOdds(betType, value, marketType) {
    const cacheKey = `${betType}-${value}-${marketType}`;
    const cached = cache.get(cacheKey);
    
    if (cached && cached.expires > Date.now()) {
        return cached.odds;
    }
    
    // 计算赔率
    let odds = 1.0;
    const rebatePercentage = marketType === 'A' ? 0.011 : 0.041;
    
    // 冠亚和值投注
    if (betType === 'sumValue' || betType === 'sum' || betType === '冠亚和') {
        // 处理冠亚和大小单双
        if (['big', 'small', 'odd', 'even', '大', '小', '单', '双'].includes(value)) {
            odds = 2.0 * (1 - rebatePercentage);
        } else {
            // 处理数字和值
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
    // 龙虎投注
    else if (betType === 'dragonTiger' || betType === 'dragon_tiger' || betType === '龙虎') {
        // 龙虎投注赔率：A盘 1.978，D盘 1.918
        const dragonTigerBaseOdds = 2.0;
        odds = dragonTigerBaseOdds * (1 - rebatePercentage);
    }
    // 两面投注
    else if (['big', 'small', 'odd', 'even'].includes(value)) {
        odds = 2.0 * (1 - rebatePercentage);
    } 
    // 号码投注
    else if (betType === 'number' || !isNaN(parseInt(value))) {
        odds = 10.0 * (1 - rebatePercentage);
    }
    
    // 缓存结果
    const finalOdds = parseFloat(odds.toFixed(3));
    cache.set(cacheKey, {
        odds: finalOdds,
        expires: Date.now() + CACHE_TTL
    });
    
    return finalOdds;
}

// 缓存的会员信息获取
async function getCachedMemberInfo(username, AGENT_API_URL) {
    const cached = memberCache.get(username);
    
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }
    
    try {
        const response = await fetch(`${AGENT_API_URL}/api/agent/member/info/${username}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000 // 5秒超时
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.member) {
                // 缓存结果
                memberCache.set(username, {
                    data: data.member,
                    expires: Date.now() + MEMBER_CACHE_TTL
                });
                return data.member;
            }
        }
    } catch (error) {
        console.error('获取会员信息失败:', error);
    }
    
    return null;
}

// 扣除余额
async function deductBalance(username, amount, AGENT_API_URL) {
    try {
        const response = await fetch(`${AGENT_API_URL}/api/agent/deduct-member-balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                amount: amount,
                reason: '批量游戏下注'
            }),
            timeout: 5000
        });
        
        const data = await response.json();
        return data;
    } catch (error) {
        return { success: false, message: '余额扣除失败' };
    }
}

// 退还余额
async function refundBalance(username, amount, AGENT_API_URL) {
    try {
        await fetch(`${AGENT_API_URL}/api/agent/add-member-balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                amount: amount,
                reason: '投注失败退款'
            }),
            timeout: 5000
        });
    } catch (error) {
        console.error('退款请求失败:', error);
    }
}

// 异步处理退水
async function processRebatesAsync(period) {
    try {
        console.log(`开始处理期号 ${period} 的退水...`);
        // 引入 enhanced-settlement-system 的退水处理逻辑
        const { processRebates } = await import('./enhanced-settlement-system.js');
        await processRebates(period);
        console.log(`✅ 期号 ${period} 的退水处理完成`);
    } catch (error) {
        console.error(`❌ 退水处理失败 (期号 ${period}):`, error.message);
        // 记录错误但不阻塞主流程
    }
}

// 批量下注限红验证函数
async function validateBatchBettingLimits(username, bets, period, AGENT_API_URL) {
    try {
        console.log(`🔍 验证用户 ${username} 的批量下注限红...`);
        
        // 1. 获取用户的限红配置
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
                    console.log(`✅ 获取到用户 ${username} 的限红配置`);
                }
            }
        } catch (apiError) {
            console.warn('获取会员限红设定失败，使用预设限红:', apiError.message);
        }
        
        // 2. 如果无法获取用户限红，使用预设限红
        if (!userLimits) {
            userLimits = {
                number: { maxBet: 2500, minBet: 1, periodLimit: 5000 },
                twoSide: { maxBet: 5000, minBet: 1, periodLimit: 5000 },
                sumValue: { maxBet: 1000, minBet: 1, periodLimit: 2000 },
                dragonTiger: { maxBet: 5000, minBet: 1, periodLimit: 5000 },
                sumValueSize: { maxBet: 5000, minBet: 1, periodLimit: 5000 },
                sumValueOddEven: { maxBet: 5000, minBet: 1, periodLimit: 5000 }
            };
            console.log(`⚠️ 使用预设限红配置`);
        }
        
        // 3. 获取用户在当前期号已有的下注
        const existingBets = await db.any(`
            SELECT bet_type, bet_value, amount, position
            FROM bet_history 
            WHERE username = $1 AND period = $2 AND settled = false
        `, [username, period]);
        
        // 4. 按每个具体下注选项分组计算（新逻辑）
        const optionTotals = {};
        
        // 先计算已有下注
        existingBets.forEach(bet => {
            // 使用具体的选项键，而不是类别
            const optionKey = `${bet.bet_type}-${bet.bet_value}${bet.position ? `-${bet.position}` : ''}`;
            if (!optionTotals[optionKey]) {
                optionTotals[optionKey] = 0;
            }
            optionTotals[optionKey] += parseFloat(bet.amount);
        });
        
        // 5. 验证新的批量下注
        for (const bet of bets) {
            const amount = parseFloat(bet.amount);
            const betCategory = getBetCategory(bet.betType, bet.value, bet.position);
            const limits = userLimits[betCategory];
            
            // 建立具体的选项键
            const optionKey = `${bet.betType}-${bet.value}${bet.position ? `-${bet.position}` : ''}`;
            
            console.log(`🎲 检查下注: betType=${bet.betType}, value=${bet.value}, amount=${amount}, optionKey=${optionKey}`);
            console.log(`📊 限红配置:`, limits);
            
            if (!limits) {
                return {
                    success: false,
                    message: `未知的下注类型: ${bet.betType}/${bet.value}`
                };
            }
            
            // 检查单注最高限制
            if (amount > limits.maxBet) {
                console.log(`❌ 单注超限: ${amount} > ${limits.maxBet}`);
                const categoryName = getBetCategoryDisplayName(betCategory);
                return {
                    success: false,
                    message: `${categoryName}单注金额不能超过 ${limits.maxBet} 元，当前: ${amount} 元，请重新输入金额后再下注`
                };
            }
            
            // 检查最小下注限制
            if (amount < limits.minBet) {
                const categoryName = getBetCategoryDisplayName(betCategory);
                return {
                    success: false,
                    message: `${categoryName}单注金额不能少于 ${limits.minBet} 元，当前: ${amount} 元`
                };
            }
            
            // 累加到具体选项总额中（新逻辑）
            if (!optionTotals[optionKey]) {
                optionTotals[optionKey] = 0;
            }
            const newTotal = optionTotals[optionKey] + amount;
            
            // 检查单期限额（每个选项独立计算）
            if (newTotal > limits.periodLimit) {
                const existingAmount = optionTotals[optionKey];
                const categoryName = getBetCategoryDisplayName(betCategory);
                return {
                    success: false,
                    message: `该选项单期限额为 ${limits.periodLimit} 元，已投注 ${existingAmount} 元，无法再投注 ${amount} 元`
                };
            }
            
            // 更新选项总额
            optionTotals[optionKey] = newTotal;
        }
        
        console.log(`✅ 批量下注限红验证通过`);
        return { success: true };
        
    } catch (error) {
        console.error('批量下注限红验证失败:', error);
        return {
            success: false,
            message: `限红验证失败: ${error.message}`
        };
    }
}

// 获取下注类型分类
function getBetCategory(betType, betValue, position) {
    // 龙虎下注
    if (betType === 'dragonTiger' || betType.includes('dragon') || betType.includes('tiger')) {
        return 'dragonTiger';
    }
    
    // 冠亚和值下注
    if (betType === 'sumValue' || betType === 'sum' || betType === '冠亚和') {
        if (['big', 'small', '大', '小'].includes(betValue)) {
            return 'sumValueSize';
        } else if (['odd', 'even', '单', '双'].includes(betValue)) {
            return 'sumValueOddEven';
        } else {
            return 'sumValue';  // 具体数值
        }
    }
    
    // 号码下注（包括位置号码）
    if (betType === 'number' || (
        ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType) && 
        !['big', 'small', 'odd', 'even', '大', '小', '单', '双'].includes(betValue)
    )) {
        return 'number';
    }
    
    // 两面下注（位置大小单双）
    if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'position'].includes(betType) && 
        ['big', 'small', 'odd', 'even', '大', '小', '单', '双'].includes(betValue)) {
        return 'twoSide';
    }
    
    // 预设为两面下注
    return 'twoSide';
}

// 获取下注类型的中文名称
function getBetCategoryDisplayName(category) {
    const displayNames = {
        'twoSide': '两面',
        'number': '号码',
        'sumValue': '冠亚和',
        'dragonTiger': '龙虎',
        'sumValueSize': '冠亚和大小',
        'sumValueOddEven': '冠亚和单双'
    };
    return displayNames[category] || category;
}

export default {
    optimizedBatchBet,
    optimizedSettlement
};

// Export for testing
export { getQuickOdds };