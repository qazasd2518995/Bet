// improved-settlement-system.js - 改进的结算系统
import db from './db/config.js';
import BetModel from './db/models/bet.js';
import UserModel from './db/models/user.js';

// 代理系统API URL
const AGENT_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://bet-agent.onrender.com' 
  : 'http://localhost:3003';

// 分布式锁实现（使用数据库）
class DistributedLock {
    static async acquire(lockKey, timeout = 30000) {
        try {
            // 尝试插入锁记录
            await db.none(`
                INSERT INTO settlement_locks (lock_key, locked_at, expires_at)
                VALUES ($1, NOW(), NOW() + INTERVAL '${timeout} milliseconds')
            `, [lockKey]);
            return true;
        } catch (error) {
            // 如果插入失败（锁已存在），检查是否已过期
            const lock = await db.oneOrNone(`
                SELECT * FROM settlement_locks 
                WHERE lock_key = $1 AND expires_at > NOW()
            `, [lockKey]);
            
            if (!lock) {
                // 锁已过期，删除并重新获取
                await db.none(`DELETE FROM settlement_locks WHERE lock_key = $1`, [lockKey]);
                return await this.acquire(lockKey, timeout);
            }
            
            return false;
        }
    }
    
    static async release(lockKey) {
        await db.none(`DELETE FROM settlement_locks WHERE lock_key = $1`, [lockKey]);
    }
}

// 创建锁表（需要在数据库中执行）
export async function createLockTable() {
    await db.none(`
        CREATE TABLE IF NOT EXISTS settlement_locks (
            lock_key VARCHAR(100) PRIMARY KEY,
            locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMP NOT NULL
        )
    `);
}

// 改进的结算函数
export async function improvedSettleBets(period, winResult) {
    const lockKey = `settle_period_${period}`;
    let hasLock = false;
    
    try {
        // 1. 获取分布式锁
        hasLock = await DistributedLock.acquire(lockKey);
        if (!hasLock) {
            console.log(`🔒 期号 ${period} 正在被其他进程结算，跳过`);
            return { success: false, reason: 'locked' };
        }
        
        console.log(`🎯 开始结算期号 ${period}`);
        
        // 2. 使用事务处理整个结算过程
        const result = await db.tx(async t => {
            // 检查是否有未结算的投注
            const unsettledCount = await t.oneOrNone(`
                SELECT COUNT(*) as count 
                FROM bet_history 
                WHERE period = $1 AND settled = false
            `, [period]);
            
            if (!unsettledCount || parseInt(unsettledCount.count) === 0) {
                console.log(`📋 期号 ${period} 没有未结算的注单`);
                return { success: true, settledCount: 0 };
            }
            
            // 获取该期所有未结算的注单
            const unsettledBets = await t.manyOrNone(`
                SELECT * FROM bet_history 
                WHERE period = $1 AND settled = false
                FOR UPDATE  -- 行级锁，防止并发修改
            `, [period]);
            
            if (!unsettledBets || unsettledBets.length === 0) {
                console.log(`📋 期号 ${period} 没有未结算的注单`);
                return { success: true, settledCount: 0 };
            }
            
            console.log(`📋 找到 ${unsettledBets.length} 笔未结算注单`);
            
            // 结算统计
            let settledCount = 0;
            let totalWinAmount = 0;
            const userWinnings = {}; // 记录每个用户的总中奖金额
            const settlementRecords = [];
            
            // 处理每笔注单
            for (const bet of unsettledBets) {
                const isWin = checkWin(bet, winResult);
                let winAmount = 0;
                
                if (isWin) {
                    winAmount = calculateWinAmount(bet, winResult);
                    totalWinAmount += winAmount;
                    
                    // 累计用户中奖金额
                    if (!userWinnings[bet.username]) {
                        userWinnings[bet.username] = 0;
                    }
                    userWinnings[bet.username] += winAmount;
                }
                
                // 更新注单状态（在事务中）
                await t.none(`
                    UPDATE bet_history 
                    SET win = $1, win_amount = $2, settled = true, settled_at = NOW()
                    WHERE id = $3 AND settled = false
                `, [isWin, winAmount, bet.id]);
                
                settlementRecords.push({
                    betId: bet.id,
                    username: bet.username,
                    isWin,
                    winAmount,
                    betAmount: bet.amount
                });
                
                settledCount++;
            }
            
            // 批量更新用户余额
            for (const [username, winAmount] of Object.entries(userWinnings)) {
                // 获取当前余额以记录交易
                const currentMember = await t.one(`
                    SELECT id, balance FROM members WHERE username = $1 FOR UPDATE
                `, [username]);
                
                const balanceBefore = parseFloat(currentMember.balance);
                const balanceAfter = balanceBefore + winAmount;
                
                // 增加用户余额
                await t.none(`
                    UPDATE members 
                    SET balance = $1
                    WHERE username = $2
                `, [balanceAfter, username]);
                
                // 记录交易
                await t.none(`
                    INSERT INTO transaction_records 
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
                `, [currentMember.id, winAmount, balanceBefore, balanceAfter, `期号 ${period} 中奖`]);
            }
            
            // 记录结算日志
            await t.none(`
                INSERT INTO settlement_logs 
                (period, settled_count, total_win_amount, settlement_details, created_at)
                VALUES ($1, $2, $3, $4, NOW())
            `, [period, settledCount, totalWinAmount, JSON.stringify(settlementRecords)]);
            
            return {
                success: true,
                settledCount,
                totalWinAmount,
                userWinnings
            };
        });
        
        // 3. 如果结算成功，处理退水（在事务外，避免影响主要结算）
        if (result.success && result.settledCount > 0) {
            await processRebates(period);
        }
        
        // 4. 同步到代理系统
        if (result.success && result.userWinnings) {
            await syncToAgentSystem(result.userWinnings);
        }
        
        return result;
        
    } catch (error) {
        console.error(`❌ 结算期号 ${period} 时发生错误:`, error);
        throw error;
    } finally {
        // 释放锁
        if (hasLock) {
            await DistributedLock.release(lockKey);
        }
    }
}

// 检查是否中奖
function checkWin(bet, winResult) {
    if (!winResult || !winResult.positions) return false;
    
    // 处理 'number' 类型的投注（包含所有位置的号码投注）
    if (bet.bet_type === 'number' && bet.position) {
        // position 从 1 开始，阵列索引从 0 开始
        const winningNumber = winResult.positions[bet.position - 1];
        const betNumber = parseInt(bet.bet_value);
        return winningNumber === betNumber;
    }
    
    switch (bet.bet_type) {
        case 'champion':
            // 冠军投注：支援号码、大小、单双
            if (/^\d+$/.test(bet.bet_value)) {
                // 号码投注
                return winResult.positions[0] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                // 大小投注
                return (bet.bet_value === 'big' && winResult.positions[0] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[0] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                // 单双投注
                return (bet.bet_value === 'odd' && winResult.positions[0] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[0] % 2 === 0);
            }
            break;
            
        case 'runnerup':
            // 亚军投注：支援号码、大小、单双
            if (/^\d+$/.test(bet.bet_value)) {
                return winResult.positions[1] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                return (bet.bet_value === 'big' && winResult.positions[1] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[1] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                return (bet.bet_value === 'odd' && winResult.positions[1] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[1] % 2 === 0);
            }
            break;
            
        case 'third':
            // 第三名投注：支援号码、大小、单双
            if (/^\d+$/.test(bet.bet_value)) {
                return winResult.positions[2] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                return (bet.bet_value === 'big' && winResult.positions[2] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[2] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                return (bet.bet_value === 'odd' && winResult.positions[2] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[2] % 2 === 0);
            }
            break;
            
        case 'fourth':
            if (/^\d+$/.test(bet.bet_value)) {
                return winResult.positions[3] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                return (bet.bet_value === 'big' && winResult.positions[3] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[3] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                return (bet.bet_value === 'odd' && winResult.positions[3] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[3] % 2 === 0);
            }
            break;
            
        case 'fifth':
            if (/^\d+$/.test(bet.bet_value)) {
                return winResult.positions[4] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                return (bet.bet_value === 'big' && winResult.positions[4] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[4] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                return (bet.bet_value === 'odd' && winResult.positions[4] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[4] % 2 === 0);
            }
            break;
            
        case 'sixth':
            if (/^\d+$/.test(bet.bet_value)) {
                return winResult.positions[5] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                return (bet.bet_value === 'big' && winResult.positions[5] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[5] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                return (bet.bet_value === 'odd' && winResult.positions[5] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[5] % 2 === 0);
            }
            break;
            
        case 'seventh':
            if (/^\d+$/.test(bet.bet_value)) {
                return winResult.positions[6] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                return (bet.bet_value === 'big' && winResult.positions[6] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[6] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                return (bet.bet_value === 'odd' && winResult.positions[6] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[6] % 2 === 0);
            }
            break;
            
        case 'eighth':
            if (/^\d+$/.test(bet.bet_value)) {
                return winResult.positions[7] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                return (bet.bet_value === 'big' && winResult.positions[7] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[7] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                return (bet.bet_value === 'odd' && winResult.positions[7] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[7] % 2 === 0);
            }
            break;
            
        case 'ninth':
            if (/^\d+$/.test(bet.bet_value)) {
                return winResult.positions[8] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                return (bet.bet_value === 'big' && winResult.positions[8] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[8] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                return (bet.bet_value === 'odd' && winResult.positions[8] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[8] % 2 === 0);
            }
            break;
            
        case 'tenth':
            if (/^\d+$/.test(bet.bet_value)) {
                return winResult.positions[9] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                return (bet.bet_value === 'big' && winResult.positions[9] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[9] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                return (bet.bet_value === 'odd' && winResult.positions[9] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[9] % 2 === 0);
            }
            break;
            
        case 'big_small':
            // 大小投注：冠亚和值
            const sum = winResult.positions[0] + winResult.positions[1];
            return (bet.bet_value === 'big' && sum >= 12) || 
                   (bet.bet_value === 'small' && sum < 12);
                   
        case 'odd_even':
            // 单双投注：冠亚和值
            const sumOddEven = winResult.positions[0] + winResult.positions[1];
            return (bet.bet_value === 'odd' && sumOddEven % 2 === 1) ||
                   (bet.bet_value === 'even' && sumOddEven % 2 === 0);
                   
        case 'dragon_tiger':
        case 'dragonTiger':
            // 龙虎投注 - 支援新格式: dragon_1_10, tiger_4_7
            if (bet.bet_value.startsWith('dragon_')) {
                const positions = bet.bet_value.replace('dragon_', '').split('_');
                const pos1 = parseInt(positions[0]) - 1;
                const pos2 = parseInt(positions[1]) - 1;
                return winResult.positions[pos1] > winResult.positions[pos2];
            } else if (bet.bet_value.startsWith('tiger_')) {
                const positions = bet.bet_value.replace('tiger_', '').split('_');
                const pos1 = parseInt(positions[0]) - 1;
                const pos2 = parseInt(positions[1]) - 1;
                return winResult.positions[pos1] < winResult.positions[pos2];
            } else {
                // 旧格式支援
                const positions = bet.bet_value.split('_');
                const pos1 = parseInt(positions[0]) - 1;
                const pos2 = parseInt(positions[1]) - 1;
                return winResult.positions[pos1] > winResult.positions[pos2];
            }
            
        case 'sum':
        case 'sumValue':
            // 冠亚和投注：支援数值、大小、单双
            const actualSum = winResult.positions[0] + winResult.positions[1];
            if (/^\d+$/.test(bet.bet_value)) {
                // 和值数字投注
                return actualSum === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                // 冠亚和大小
                return (bet.bet_value === 'big' && actualSum >= 12) || 
                       (bet.bet_value === 'small' && actualSum < 12);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                // 冠亚和单双
                return (bet.bet_value === 'odd' && actualSum % 2 === 1) ||
                       (bet.bet_value === 'even' && actualSum % 2 === 0);
            }
            break;
            
        default:
            console.warn(`未知的投注类型: ${bet.bet_type} with value: ${bet.bet_value}`);
            return false;
    }
    
    return false;
}

// 计算中奖金额
function calculateWinAmount(bet, winResult) {
    const betAmount = parseFloat(bet.amount);
    let odds = parseFloat(bet.odds); // 优先使用下注时记录的赔率
    
    // 如果没有记录赔率，则根据类型计算
    if (!odds || odds === 0) {
        switch (bet.bet_type) {
            case 'number':
                odds = 9.89; // A盘号码赔率
                break;
                
            case 'champion':
            case 'runnerup':
            case 'third':
            case 'fourth':
            case 'fifth':
            case 'sixth':
            case 'seventh':
            case 'eighth':
            case 'ninth':
            case 'tenth':
                // 检查是号码还是大小单双投注
                if (/^\d+$/.test(bet.bet_value)) {
                    odds = 9.89; // 号码投注
                } else {
                    odds = 1.98; // 大小单双投注
                }
                break;
                
            case 'big_small':
            case 'odd_even':
                odds = 1.98; // A盘大小单双赔率
                break;
                
            case 'dragon_tiger':
            case 'dragonTiger':
                odds = 1.98; // A盘龙虎赔率
                break;
                
            case 'sum':
            case 'sumValue':
                if (/^\d+$/.test(bet.bet_value)) {
                    // 和值数字投注，赔率根据具体数值不同（A盘）
                    const sumOdds = {
                        3: 44.51, 4: 22.75, 5: 14.84, 6: 11.37, 7: 8.90,
                        8: 7.42, 9: 6.43, 10: 5.64, 11: 5.64, 12: 6.43,
                        13: 7.42, 14: 8.90, 15: 11.37, 16: 14.84, 17: 22.75,
                        18: 44.51, 19: 89.02
                    };
                    odds = sumOdds[parseInt(bet.bet_value)] || 0;
                } else {
                    // 冠亚和大小单双投注
                    odds = 1.98;
                }
                break;
                
            default:
                console.warn(`未知的投注类型赔率: ${bet.bet_type} with value: ${bet.bet_value}`);
                odds = 0;
        }
    }
    
    // 返回总奖金（含本金）
    return parseFloat((betAmount * odds).toFixed(2));
}

// 处理退水
async function processRebates(period) {
    try {
        console.log(`💰 开始处理期号 ${period} 的退水`);
        
        // 获取该期所有已结算的注单
        const settledBets = await db.manyOrNone(`
            SELECT DISTINCT username, SUM(amount) as total_amount
            FROM bet_history
            WHERE period = $1 AND settled = true
            GROUP BY username
        `, [period]);
        
        console.log(`💰 找到 ${settledBets.length} 位会员需要处理退水`);
        
        for (const record of settledBets) {
            try {
                // 调用退水分配逻辑
                await distributeRebate(record.username, parseFloat(record.total_amount), period);
                console.log(`✅ 已为会员 ${record.username} 分配退水，下注金额: ${record.total_amount}`);
            } catch (rebateError) {
                console.error(`❌ 为会员 ${record.username} 分配退水失败:`, rebateError);
            }
        }
        
    } catch (error) {
        console.error(`处理退水时发生错误:`, error);
    }
}

// 同步到代理系统
async function syncToAgentSystem(userWinnings) {
    try {
        // 实现同步逻辑
        console.log(`📤 同步中奖数据到代理系统`);
    } catch (error) {
        console.error(`同步到代理系统时发生错误:`, error);
    }
}

// 退水分配函数
async function distributeRebate(username, betAmount, period) {
    try {
        console.log(`开始为会员 ${username} 分配退水，下注金额: ${betAmount}`);
        
        // 获取会员的代理链来确定最大退水比例
        const agentChain = await getAgentChain(username);
        if (!agentChain || agentChain.length === 0) {
            console.log(`会员 ${username} 没有代理链，退水归平台所有`);
            return;
        }
        
        // 计算固定的总退水池（根据盘口类型）
        const directAgent = agentChain[0]; // 第一个是直属代理
        const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041; // A盘1.1%, D盘4.1%
        const totalRebatePool = parseFloat(betAmount) * maxRebatePercentage; // 固定总池
        
        console.log(`会员 ${username} 的代理链:`, agentChain.map(a => `${a.username}(L${a.level}-${a.rebate_mode}:${(a.rebate_percentage*100).toFixed(1)}%)`));
        console.log(`固定退水池: ${totalRebatePool.toFixed(2)} 元 (${(maxRebatePercentage*100).toFixed(1)}%)`);
        
        // 按层级顺序分配退水，上级只拿差额
        let remainingRebate = totalRebatePool;
        let distributedPercentage = 0; // 已经分配的退水比例
        
        for (let i = 0; i < agentChain.length; i++) {
            const agent = agentChain[i];
            let agentRebateAmount = 0;
            
            // 如果没有剩余退水，结束分配
            if (remainingRebate <= 0.01) {
                console.log(`退水池已全部分配完毕`);
                break;
            }
            
            const rebatePercentage = parseFloat(agent.rebate_percentage);
            
            if (isNaN(rebatePercentage) || rebatePercentage <= 0) {
                // 退水比例为0，该代理不拿退水，全部给上级
                agentRebateAmount = 0;
                console.log(`代理 ${agent.username} 退水比例为 ${(rebatePercentage*100).toFixed(1)}%，不拿任何退水，剩余 ${remainingRebate.toFixed(2)} 元继续向上分配`);
            } else {
                // 计算该代理实际能拿的退水比例（不能超过已分配的）
                const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
                
                if (actualRebatePercentage <= 0) {
                    console.log(`代理 ${agent.username} 退水比例 ${(rebatePercentage*100).toFixed(1)}% 已被下级分完，不能再获得退水`);
                    agentRebateAmount = 0;
                } else {
                    // 计算该代理实际获得的退水金额
                    agentRebateAmount = parseFloat(betAmount) * actualRebatePercentage;
                    // 确保不超过剩余退水池
                    agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
                    // 四舍五入到小数点后2位
                    agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
                    remainingRebate -= agentRebateAmount;
                    distributedPercentage += actualRebatePercentage;
                    
                    console.log(`代理 ${agent.username} 退水比例为 ${(rebatePercentage*100).toFixed(1)}%，实际获得 ${(actualRebatePercentage*100).toFixed(1)}% = ${agentRebateAmount.toFixed(2)} 元，剩余池额 ${remainingRebate.toFixed(2)} 元`);
                }
                
                // 如果该代理的比例达到或超过最大值，说明是全拿模式
                if (rebatePercentage >= maxRebatePercentage) {
                    console.log(`代理 ${agent.username} 拿了全部退水池，结束分配`);
                    remainingRebate = 0;
                }
            }
            
            if (agentRebateAmount > 0) {
                // 分配退水给代理
                await allocateRebateToAgent(agent.id, agent.username, agentRebateAmount, username, betAmount, period);
                console.log(`✅ 分配退水 ${agentRebateAmount.toFixed(2)} 给代理 ${agent.username} (比例: ${(parseFloat(agent.rebate_percentage)*100).toFixed(1)}%, 剩余: ${remainingRebate.toFixed(2)})`);
                
                // 如果没有剩余退水了，结束分配
                if (remainingRebate <= 0.01) {
                    break;
                }
            }
        }
        
        // 剩余退水归平台所有
        if (remainingRebate > 0.01) { // 考虑浮点数精度问题
            console.log(`剩余退水池 ${remainingRebate.toFixed(2)} 元归平台所有`);
        }
        
        console.log(`✅ 退水分配完成，总池: ${totalRebatePool.toFixed(2)}元，已分配: ${(totalRebatePool - remainingRebate).toFixed(2)}元，平台保留: ${remainingRebate.toFixed(2)}元`);
        
    } catch (error) {
        console.error('分配退水时发生错误:', error);
    }
}

// 获取会员的代理链
async function getAgentChain(username) {
    try {
        const response = await fetch(`${AGENT_API_URL}/api/agent/internal/get-agent-chain?username=${username}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error(`获取代理链失败: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        if (data.success) {
            return data.agentChain || [];
        } else {
            console.error('获取代理链失败:', data.message);
            return [];
        }
    } catch (error) {
        console.error('获取代理链时发生错误:', error);
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
        
        console.log(`成功分配退水 ${rebateAmount} 给代理 ${agentUsername}`);
        
    } catch (error) {
        console.error(`分配退水给代理 ${agentUsername} 失败:`, error);
        throw error;
    }
}

// 创建必要的表
export async function createSettlementTables() {
    // 创建锁表
    await createLockTable();
    
    // 创建结算日志表
    await db.none(`
        CREATE TABLE IF NOT EXISTS settlement_logs (
            id SERIAL PRIMARY KEY,
            period BIGINT NOT NULL,
            settled_count INTEGER NOT NULL,
            total_win_amount DECIMAL(15, 2) NOT NULL,
            settlement_details JSONB,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    
    // 为 bet_history 添加结算时间栏位
    await db.none(`
        ALTER TABLE bet_history 
        ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP
    `);
    
    // 创建索引以提高查询性能
    await db.none(`
        CREATE INDEX IF NOT EXISTS idx_bet_history_period_settled 
        ON bet_history(period, settled)
    `);
    
    console.log('✅ 结算相关表创建完成');
}

// 导出函数供测试使用
export { checkWin, calculateWinAmount };

export default {
    improvedSettleBets,
    createSettlementTables,
    checkWin,
    calculateWinAmount
};