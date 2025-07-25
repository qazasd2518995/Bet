// comprehensive-settlement-system.js - 完整的结算系统，支援所有投注类型
import db from './db/config.js';

// 建立结算日志以追踪问题
const settlementLog = {
    info: (msg, data) => console.log(`[SETTLEMENT INFO] ${msg}`, data || ''),
    warn: (msg, data) => console.warn(`[SETTLEMENT WARN] ${msg}`, data || ''),
    error: (msg, data) => console.error(`[SETTLEMENT ERROR] ${msg}`, data || '')
};

/**
 * 主要结算函数 - 处理指定期号的所有未结算投注
 * @param {string} period - 期号
 * @param {Object} drawResult - 开奖结果 (可能是 {positions: []} 或 {result: []} 格式)
 * @returns {Object} 结算结果
 */
export async function comprehensiveSettlement(period, drawResult) {
    const startTime = Date.now();
    settlementLog.info(`开始结算期号 ${period}`);
    settlementLog.info(`开奖结果原始数据:`, JSON.stringify(drawResult));
    
    try {
        // 1. 标准化开奖结果格式
        const winResult = normalizeDrawResult(drawResult);
        settlementLog.info('标准化开奖结果:', winResult);
        
        if (!winResult || !winResult.positions || winResult.positions.length !== 10) {
            throw new Error('无效的开奖结果格式');
        }
        
        // 2. 使用事务处理整个结算
        const result = await db.tx(async t => {
            // 2.1 获取并锁定所有未结算投注
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
                return { success: true, settledCount: 0, totalWinAmount: 0 };
            }
            
            settlementLog.info(`找到 ${unsettledBets.length} 笔未结算投注`);
            
            // 2.2 计算每笔投注的中奖结果
            const settlementResults = [];
            const balanceUpdates = new Map();
            let totalWinAmount = 0;
            let winCount = 0;
            
            for (const bet of unsettledBets) {
                try {
                    // 检查是否中奖
                    const winCheck = checkBetWin(bet, winResult);
                    let winAmount = 0;
                    
                    if (winCheck.isWin) {
                        // 计算中奖金额
                        winAmount = calculateWinAmount(bet, winCheck.odds);
                        totalWinAmount += winAmount;
                        winCount++;
                        
                        // 累计用户余额更新
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
                        
                        settlementLog.info(`投注 ${bet.id} 中奖: ${bet.bet_type} ${bet.bet_value} 位置${bet.position || '-'} 赢得 ${winAmount}`);
                    }
                    
                    settlementResults.push({
                        id: bet.id,
                        win: winCheck.isWin,
                        winAmount: winAmount,
                        reason: winCheck.reason
                    });
                    
                } catch (betError) {
                    settlementLog.error(`处理投注 ${bet.id} 时发生错误:`, betError);
                    // 记录错误但继续处理其他投注
                    settlementResults.push({
                        id: bet.id,
                        win: false,
                        winAmount: 0,
                        error: betError.message
                    });
                }
            }
            
            // 2.3 批量更新投注状态
            if (settlementResults.length > 0) {
                // 建构批量更新的 VALUES
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
            
            // 2.4 更新用户余额并记录交易
            if (balanceUpdates.size > 0) {
                // 批量更新余额
                for (const [username, update] of balanceUpdates.entries()) {
                    const newBalance = update.currentBalance + update.winAmount;
                    
                    await t.none(`
                        UPDATE members 
                        SET balance = $1
                        WHERE username = $2
                    `, [newBalance, username]);
                    
                    // 记录交易
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
            
            // 2.5 记录结算摘要
            await t.none(`
                INSERT INTO settlement_logs 
                (period, settled_count, win_count, total_win_amount, execution_time, created_at)
                VALUES ($1, $2, $3, $4, $5, NOW())
            `, [period, settlementResults.length, winCount, totalWinAmount, Date.now() - startTime]);
            
            return {
                success: true,
                settledCount: settlementResults.length,
                winCount: winCount,
                totalWinAmount: totalWinAmount,
                userWinnings: Object.fromEntries(balanceUpdates),
                executionTime: Date.now() - startTime
            };
        });
        
        settlementLog.info(`结算完成: ${result.settledCount}笔投注, ${result.winCount}笔中奖, 总派彩${result.totalWinAmount}, 耗时${result.executionTime}ms`);
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
 * 标准化开奖结果格式
 * @param {Object} drawResult - 原始开奖结果
 * @returns {Object} 标准化的结果 {positions: [1-10的数字阵列]}
 */
function normalizeDrawResult(drawResult) {
    if (!drawResult) return null;
    
    // 如果已经是标准格式
    if (drawResult.positions && Array.isArray(drawResult.positions)) {
        return drawResult;
    }
    
    // 如果是 result 栏位格式（从资料库读取）
    if (drawResult.result && Array.isArray(drawResult.result)) {
        return { positions: drawResult.result };
    }
    
    // 如果是单独的 position_1 到 position_10 栏位
    if (drawResult.position_1 !== undefined) {
        const positions = [];
        for (let i = 1; i <= 10; i++) {
            positions.push(drawResult[`position_${i}`]);
        }
        return { positions };
    }
    
    // 如果直接是数字阵列
    if (Array.isArray(drawResult) && drawResult.length === 10) {
        return { positions: drawResult };
    }
    
    return null;
}

/**
 * 检查投注是否中奖
 * @param {Object} bet - 投注记录
 * @param {Object} winResult - 标准化的开奖结果
 * @returns {Object} {isWin: boolean, reason: string, odds: number}
 */
function checkBetWin(bet, winResult) {
    const positions = winResult.positions;
    const betType = bet.bet_type;
    const betValue = String(bet.bet_value); // 确保是字串以便比较
    
    // 记录检查过程
    settlementLog.info(`检查投注: id=${bet.id}, type=${betType}, value=${betValue}, position=${bet.position}, username=${bet.username}`);
    
    // 1. 号码投注（所有位置）
    if (betType === 'number' && bet.position) {
        const position = parseInt(bet.position);
        const betNumber = parseInt(betValue);
        
        if (position < 1 || position > 10 || isNaN(betNumber)) {
            return { isWin: false, reason: '无效的位置或号码' };
        }
        
        const winningNumber = positions[position - 1];
        const isWin = winningNumber === betNumber;
        
        return {
            isWin: isWin,
            reason: `位置${position}开出${winningNumber}，投注${betNumber}${isWin ? '中奖' : '未中'}`,
            odds: bet.odds || 9.85 // 预设A盘赔率
        };
    }
    
    // 2. 位置投注（冠军到第十名）
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
        
        // 号码投注
        if (/^\d+$/.test(betValue)) {
            const betNumber = parseInt(betValue);
            const isWin = winningNumber === betNumber;
            settlementLog.info(`位置号码投注结果: betNumber=${betNumber}, winningNumber=${winningNumber}, isWin=${isWin}`);
            return {
                isWin: isWin,
                reason: `${betType}开出${winningNumber}，投注${betNumber}${isWin ? '中奖' : '未中'}`,
                odds: bet.odds || 9.85
            };
        }
        
        // 大小投注
        if (betValue === 'big' || betValue === '大') {
            const isWin = winningNumber >= 6;
            return {
                isWin: isWin,
                reason: `${betType}开出${winningNumber}(${winningNumber >= 6 ? '大' : '小'})`,
                odds: bet.odds || 1.985
            };
        }
        if (betValue === 'small' || betValue === '小') {
            const isWin = winningNumber <= 5;
            return {
                isWin: isWin,
                reason: `${betType}开出${winningNumber}(${winningNumber <= 5 ? '小' : '大'})`,
                odds: bet.odds || 1.985
            };
        }
        
        // 单双投注
        if (betValue === 'odd' || betValue === '单') {
            const isWin = winningNumber % 2 === 1;
            return {
                isWin: isWin,
                reason: `${betType}开出${winningNumber}(${winningNumber % 2 === 1 ? '单' : '双'})`,
                odds: bet.odds || 1.985
            };
        }
        if (betValue === 'even' || betValue === '双') {
            const isWin = winningNumber % 2 === 0;
            return {
                isWin: isWin,
                reason: `${betType}开出${winningNumber}(${winningNumber % 2 === 0 ? '双' : '单'})`,
                odds: bet.odds || 1.985
            };
        }
    }
    
    // 3. 冠亚和投注
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
        
        // 和值大小
        if (betValue === 'big' || betValue === '大') {
            const isWin = sum >= 12;
            return {
                isWin: isWin,
                reason: `冠亚和开出${sum}(${sum >= 12 ? '大' : '小'})`,
                odds: bet.odds || 1.985
            };
        }
        if (betValue === 'small' || betValue === '小') {
            const isWin = sum <= 11;
            return {
                isWin: isWin,
                reason: `冠亚和开出${sum}(${sum <= 11 ? '小' : '大'})`,
                odds: bet.odds || 1.985
            };
        }
        
        // 和值单双
        if (betValue === 'odd' || betValue === '单') {
            const isWin = sum % 2 === 1;
            return {
                isWin: isWin,
                reason: `冠亚和开出${sum}(${sum % 2 === 1 ? '单' : '双'})`,
                odds: bet.odds || 1.985
            };
        }
        if (betValue === 'even' || betValue === '双') {
            const isWin = sum % 2 === 0;
            return {
                isWin: isWin,
                reason: `冠亚和开出${sum}(${sum % 2 === 0 ? '双' : '单'})`,
                odds: bet.odds || 1.985
            };
        }
    }
    
    // 4. 龙虎投注
    if (betType === 'dragon_tiger' || betType === 'dragonTiger' || betType === '龙虎') {
        let pos1, pos2, betSide;
        
        // 新格式: dragon_1_10 或 tiger_1_10
        if (betValue.includes('dragon_') || betValue.includes('tiger_')) {
            const parts = betValue.split('_');
            betSide = parts[0];
            pos1 = parseInt(parts[1]);
            pos2 = parseInt(parts[2]);
        } else {
            // 旧格式: 1_10 (预设为龙)
            const parts = betValue.split('_');
            pos1 = parseInt(parts[0]);
            pos2 = parseInt(parts[1]);
            betSide = 'dragon';
        }
        
        if (pos1 >= 1 && pos1 <= 10 && pos2 >= 1 && pos2 <= 10 && pos1 !== pos2) {
            const num1 = positions[pos1 - 1];
            const num2 = positions[pos2 - 1];
            
            const isWin = (betSide === 'dragon' && num1 > num2) || 
                         (betSide === 'tiger' && num1 < num2);
            
            return {
                isWin: isWin,
                reason: `${pos1}位(${num1}) vs ${pos2}位(${num2})，${num1 > num2 ? '龙' : '虎'}赢`,
                odds: bet.odds || 1.985
            };
        }
    }
    
    // 5. 两面投注（各位置的大小单双）
    if (betType === '两面' || betType === 'two_sides') {
        // 格式: position_type (如: 1_big, 2_small, 3_odd, 4_even)
        const parts = betValue.split('_');
        if (parts.length === 2) {
            const position = parseInt(parts[0]);
            const type = parts[1];
            
            if (position >= 1 && position <= 10) {
                const winningNumber = positions[position - 1];
                let isWin = false;
                
                switch (type) {
                    case 'big':
                    case '大':
                        isWin = winningNumber >= 6;
                        break;
                    case 'small':
                    case '小':
                        isWin = winningNumber <= 5;
                        break;
                    case 'odd':
                    case '单':
                        isWin = winningNumber % 2 === 1;
                        break;
                    case 'even':
                    case '双':
                        isWin = winningNumber % 2 === 0;
                        break;
                }
                
                return {
                    isWin: isWin,
                    reason: `位置${position}开出${winningNumber}`,
                    odds: bet.odds || 1.985
                };
            }
        }
    }
    
    // 未知投注类型
    return {
        isWin: false,
        reason: `未知的投注类型: ${betType} ${betValue}`,
        odds: 0
    };
}

/**
 * 计算中奖金额
 * @param {Object} bet - 投注记录
 * @param {number} odds - 赔率
 * @returns {number} 中奖金额（含本金）
 */
function calculateWinAmount(bet, odds) {
    const betAmount = parseFloat(bet.amount);
    const finalOdds = odds || parseFloat(bet.odds) || 0;
    
    if (finalOdds <= 0) {
        settlementLog.warn(`投注 ${bet.id} 没有有效赔率`);
        return 0;
    }
    
    // 返回总奖金（含本金）
    return parseFloat((betAmount * finalOdds).toFixed(2));
}

/**
 * 获取冠亚和的赔率
 * @param {number} sum - 和值
 * @returns {number} 赔率
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

/**
 * 创建结算所需的资料表
 */
export async function createSettlementTables() {
    try {
        // 创建结算日志表
        await db.none(`
            CREATE TABLE IF NOT EXISTS settlement_logs (
                id SERIAL PRIMARY KEY,
                period VARCHAR(20) NOT NULL,
                settled_count INTEGER NOT NULL DEFAULT 0,
                win_count INTEGER NOT NULL DEFAULT 0,
                total_win_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
                execution_time INTEGER,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(period)
            )
        `);
        
        // 创建结算错误表
        await db.none(`
            CREATE TABLE IF NOT EXISTS settlement_errors (
                id SERIAL PRIMARY KEY,
                period VARCHAR(20) NOT NULL,
                bet_id INTEGER,
                error_type VARCHAR(50),
                error_message TEXT,
                bet_data JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        
        // 添加索引
        await db.none(`
            CREATE INDEX IF NOT EXISTS idx_settlement_logs_period ON settlement_logs(period);
            CREATE INDEX IF NOT EXISTS idx_settlement_errors_period ON settlement_errors(period);
            CREATE INDEX IF NOT EXISTS idx_bet_history_period_settled ON bet_history(period, settled);
        `);
        
        settlementLog.info('结算相关资料表建立完成');
        
    } catch (error) {
        settlementLog.error('建立资料表失败:', error);
        throw error;
    }
}

// 导出所有功能
export default {
    comprehensiveSettlement,
    createSettlementTables,
    normalizeDrawResult,
    checkBetWin,
    calculateWinAmount
};