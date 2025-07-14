// improved-settlement-system.js - 改進的結算系統
import db from './db/config.js';
import BetModel from './db/models/bet.js';
import UserModel from './db/models/user.js';

// 代理系統API URL
const AGENT_API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://bet-agent.onrender.com' 
  : 'http://localhost:3003';

// 分佈式鎖實現（使用數據庫）
class DistributedLock {
    static async acquire(lockKey, timeout = 30000) {
        try {
            // 嘗試插入鎖記錄
            await db.none(`
                INSERT INTO settlement_locks (lock_key, locked_at, expires_at)
                VALUES ($1, NOW(), NOW() + INTERVAL '${timeout} milliseconds')
            `, [lockKey]);
            return true;
        } catch (error) {
            // 如果插入失敗（鎖已存在），檢查是否已過期
            const lock = await db.oneOrNone(`
                SELECT * FROM settlement_locks 
                WHERE lock_key = $1 AND expires_at > NOW()
            `, [lockKey]);
            
            if (!lock) {
                // 鎖已過期，刪除並重新獲取
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

// 創建鎖表（需要在數據庫中執行）
export async function createLockTable() {
    await db.none(`
        CREATE TABLE IF NOT EXISTS settlement_locks (
            lock_key VARCHAR(100) PRIMARY KEY,
            locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMP NOT NULL
        )
    `);
}

// 改進的結算函數
export async function improvedSettleBets(period, winResult) {
    const lockKey = `settle_period_${period}`;
    let hasLock = false;
    
    try {
        // 1. 獲取分佈式鎖
        hasLock = await DistributedLock.acquire(lockKey);
        if (!hasLock) {
            console.log(`🔒 期號 ${period} 正在被其他進程結算，跳過`);
            return { success: false, reason: 'locked' };
        }
        
        console.log(`🎯 開始結算期號 ${period}`);
        
        // 2. 使用事務處理整個結算過程
        const result = await db.tx(async t => {
            // 檢查是否有未結算的投注
            const unsettledCount = await t.oneOrNone(`
                SELECT COUNT(*) as count 
                FROM bet_history 
                WHERE period = $1 AND settled = false
            `, [period]);
            
            if (!unsettledCount || parseInt(unsettledCount.count) === 0) {
                console.log(`📋 期號 ${period} 沒有未結算的注單`);
                return { success: true, settledCount: 0 };
            }
            
            // 獲取該期所有未結算的注單
            const unsettledBets = await t.manyOrNone(`
                SELECT * FROM bet_history 
                WHERE period = $1 AND settled = false
                FOR UPDATE  -- 行級鎖，防止並發修改
            `, [period]);
            
            if (!unsettledBets || unsettledBets.length === 0) {
                console.log(`📋 期號 ${period} 沒有未結算的注單`);
                return { success: true, settledCount: 0 };
            }
            
            console.log(`📋 找到 ${unsettledBets.length} 筆未結算注單`);
            
            // 結算統計
            let settledCount = 0;
            let totalWinAmount = 0;
            const userWinnings = {}; // 記錄每個用戶的總中獎金額
            const settlementRecords = [];
            
            // 處理每筆注單
            for (const bet of unsettledBets) {
                const isWin = checkWin(bet, winResult);
                let winAmount = 0;
                
                if (isWin) {
                    winAmount = calculateWinAmount(bet, winResult);
                    totalWinAmount += winAmount;
                    
                    // 累計用戶中獎金額
                    if (!userWinnings[bet.username]) {
                        userWinnings[bet.username] = 0;
                    }
                    userWinnings[bet.username] += winAmount;
                }
                
                // 更新注單狀態（在事務中）
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
            
            // 批量更新用戶餘額
            for (const [username, winAmount] of Object.entries(userWinnings)) {
                // 獲取當前餘額以記錄交易
                const currentMember = await t.one(`
                    SELECT id, balance FROM members WHERE username = $1 FOR UPDATE
                `, [username]);
                
                const balanceBefore = parseFloat(currentMember.balance);
                const balanceAfter = balanceBefore + winAmount;
                
                // 增加用戶餘額
                await t.none(`
                    UPDATE members 
                    SET balance = $1
                    WHERE username = $2
                `, [balanceAfter, username]);
                
                // 記錄交易
                await t.none(`
                    INSERT INTO transaction_records 
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
                `, [currentMember.id, winAmount, balanceBefore, balanceAfter, `期號 ${period} 中獎`]);
            }
            
            // 記錄結算日誌
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
        
        // 3. 如果結算成功，處理退水（在事務外，避免影響主要結算）
        if (result.success && result.settledCount > 0) {
            await processRebates(period);
        }
        
        // 4. 同步到代理系統
        if (result.success && result.userWinnings) {
            await syncToAgentSystem(result.userWinnings);
        }
        
        return result;
        
    } catch (error) {
        console.error(`❌ 結算期號 ${period} 時發生錯誤:`, error);
        throw error;
    } finally {
        // 釋放鎖
        if (hasLock) {
            await DistributedLock.release(lockKey);
        }
    }
}

// 檢查是否中獎
function checkWin(bet, winResult) {
    if (!winResult || !winResult.positions) return false;
    
    // 處理 'number' 類型的投注（包含所有位置的號碼投注）
    if (bet.bet_type === 'number' && bet.position) {
        // position 從 1 開始，陣列索引從 0 開始
        const winningNumber = winResult.positions[bet.position - 1];
        const betNumber = parseInt(bet.bet_value);
        return winningNumber === betNumber;
    }
    
    switch (bet.bet_type) {
        case 'champion':
            // 冠軍投注：支援號碼、大小、單雙
            if (/^\d+$/.test(bet.bet_value)) {
                // 號碼投注
                return winResult.positions[0] === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                // 大小投注
                return (bet.bet_value === 'big' && winResult.positions[0] >= 6) || 
                       (bet.bet_value === 'small' && winResult.positions[0] < 6);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                // 單雙投注
                return (bet.bet_value === 'odd' && winResult.positions[0] % 2 === 1) ||
                       (bet.bet_value === 'even' && winResult.positions[0] % 2 === 0);
            }
            break;
            
        case 'runnerup':
            // 亞軍投注：支援號碼、大小、單雙
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
            // 第三名投注：支援號碼、大小、單雙
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
            // 大小投注：冠亞和值
            const sum = winResult.positions[0] + winResult.positions[1];
            return (bet.bet_value === 'big' && sum >= 12) || 
                   (bet.bet_value === 'small' && sum < 12);
                   
        case 'odd_even':
            // 單雙投注：冠亞和值
            const sumOddEven = winResult.positions[0] + winResult.positions[1];
            return (bet.bet_value === 'odd' && sumOddEven % 2 === 1) ||
                   (bet.bet_value === 'even' && sumOddEven % 2 === 0);
                   
        case 'dragon_tiger':
        case 'dragonTiger':
            // 龍虎投注 - 支援新格式: dragon_1_10, tiger_4_7
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
                // 舊格式支援
                const positions = bet.bet_value.split('_');
                const pos1 = parseInt(positions[0]) - 1;
                const pos2 = parseInt(positions[1]) - 1;
                return winResult.positions[pos1] > winResult.positions[pos2];
            }
            
        case 'sum':
        case 'sumValue':
            // 冠亞和投注：支援數值、大小、單雙
            const actualSum = winResult.positions[0] + winResult.positions[1];
            if (/^\d+$/.test(bet.bet_value)) {
                // 和值數字投注
                return actualSum === parseInt(bet.bet_value);
            } else if (bet.bet_value === 'big' || bet.bet_value === 'small') {
                // 冠亞和大小
                return (bet.bet_value === 'big' && actualSum >= 12) || 
                       (bet.bet_value === 'small' && actualSum < 12);
            } else if (bet.bet_value === 'odd' || bet.bet_value === 'even') {
                // 冠亞和單雙
                return (bet.bet_value === 'odd' && actualSum % 2 === 1) ||
                       (bet.bet_value === 'even' && actualSum % 2 === 0);
            }
            break;
            
        default:
            console.warn(`未知的投注類型: ${bet.bet_type} with value: ${bet.bet_value}`);
            return false;
    }
    
    return false;
}

// 計算中獎金額
function calculateWinAmount(bet, winResult) {
    const betAmount = parseFloat(bet.amount);
    let odds = parseFloat(bet.odds); // 優先使用下注時記錄的賠率
    
    // 如果沒有記錄賠率，則根據類型計算
    if (!odds || odds === 0) {
        switch (bet.bet_type) {
            case 'number':
                odds = 9.89; // A盤號碼賠率
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
                // 檢查是號碼還是大小單雙投注
                if (/^\d+$/.test(bet.bet_value)) {
                    odds = 9.89; // 號碼投注
                } else {
                    odds = 1.98; // 大小單雙投注
                }
                break;
                
            case 'big_small':
            case 'odd_even':
                odds = 1.98; // A盤大小單雙賠率
                break;
                
            case 'dragon_tiger':
            case 'dragonTiger':
                odds = 1.98; // A盤龍虎賠率
                break;
                
            case 'sum':
            case 'sumValue':
                if (/^\d+$/.test(bet.bet_value)) {
                    // 和值數字投注，賠率根據具體數值不同（A盤）
                    const sumOdds = {
                        3: 44.51, 4: 22.75, 5: 14.84, 6: 11.37, 7: 8.90,
                        8: 7.42, 9: 6.43, 10: 5.64, 11: 5.64, 12: 6.43,
                        13: 7.42, 14: 8.90, 15: 11.37, 16: 14.84, 17: 22.75,
                        18: 44.51, 19: 89.02
                    };
                    odds = sumOdds[parseInt(bet.bet_value)] || 0;
                } else {
                    // 冠亞和大小單雙投注
                    odds = 1.98;
                }
                break;
                
            default:
                console.warn(`未知的投注類型賠率: ${bet.bet_type} with value: ${bet.bet_value}`);
                odds = 0;
        }
    }
    
    // 返回總獎金（含本金）
    return parseFloat((betAmount * odds).toFixed(2));
}

// 處理退水
async function processRebates(period) {
    try {
        console.log(`💰 開始處理期號 ${period} 的退水`);
        
        // 獲取該期所有已結算的注單
        const settledBets = await db.manyOrNone(`
            SELECT DISTINCT username, SUM(amount) as total_amount
            FROM bet_history
            WHERE period = $1 AND settled = true
            GROUP BY username
        `, [period]);
        
        console.log(`💰 找到 ${settledBets.length} 位會員需要處理退水`);
        
        for (const record of settledBets) {
            try {
                // 調用退水分配邏輯
                await distributeRebate(record.username, parseFloat(record.total_amount), period);
                console.log(`✅ 已為會員 ${record.username} 分配退水，下注金額: ${record.total_amount}`);
            } catch (rebateError) {
                console.error(`❌ 為會員 ${record.username} 分配退水失敗:`, rebateError);
            }
        }
        
    } catch (error) {
        console.error(`處理退水時發生錯誤:`, error);
    }
}

// 同步到代理系統
async function syncToAgentSystem(userWinnings) {
    try {
        // 實現同步邏輯
        console.log(`📤 同步中獎數據到代理系統`);
    } catch (error) {
        console.error(`同步到代理系統時發生錯誤:`, error);
    }
}

// 退水分配函數
async function distributeRebate(username, betAmount, period) {
    try {
        console.log(`開始為會員 ${username} 分配退水，下注金額: ${betAmount}`);
        
        // 獲取會員的代理鏈來確定最大退水比例
        const agentChain = await getAgentChain(username);
        if (!agentChain || agentChain.length === 0) {
            console.log(`會員 ${username} 沒有代理鏈，退水歸平台所有`);
            return;
        }
        
        // 計算固定的總退水池（根據盤口類型）
        const directAgent = agentChain[0]; // 第一個是直屬代理
        const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041; // A盤1.1%, D盤4.1%
        const totalRebatePool = parseFloat(betAmount) * maxRebatePercentage; // 固定總池
        
        console.log(`會員 ${username} 的代理鏈:`, agentChain.map(a => `${a.username}(L${a.level}-${a.rebate_mode}:${(a.rebate_percentage*100).toFixed(1)}%)`));
        console.log(`固定退水池: ${totalRebatePool.toFixed(2)} 元 (${(maxRebatePercentage*100).toFixed(1)}%)`);
        
        // 按層級順序分配退水，上級只拿差額
        let remainingRebate = totalRebatePool;
        let distributedPercentage = 0; // 已經分配的退水比例
        
        for (let i = 0; i < agentChain.length; i++) {
            const agent = agentChain[i];
            let agentRebateAmount = 0;
            
            // 如果沒有剩餘退水，結束分配
            if (remainingRebate <= 0.01) {
                console.log(`退水池已全部分配完畢`);
                break;
            }
            
            const rebatePercentage = parseFloat(agent.rebate_percentage);
            
            if (isNaN(rebatePercentage) || rebatePercentage <= 0) {
                // 退水比例為0，該代理不拿退水，全部給上級
                agentRebateAmount = 0;
                console.log(`代理 ${agent.username} 退水比例為 ${(rebatePercentage*100).toFixed(1)}%，不拿任何退水，剩餘 ${remainingRebate.toFixed(2)} 元繼續向上分配`);
            } else {
                // 計算該代理實際能拿的退水比例（不能超過已分配的）
                const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
                
                if (actualRebatePercentage <= 0) {
                    console.log(`代理 ${agent.username} 退水比例 ${(rebatePercentage*100).toFixed(1)}% 已被下級分完，不能再獲得退水`);
                    agentRebateAmount = 0;
                } else {
                    // 計算該代理實際獲得的退水金額
                    agentRebateAmount = parseFloat(betAmount) * actualRebatePercentage;
                    // 確保不超過剩餘退水池
                    agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
                    // 四捨五入到小數點後2位
                    agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
                    remainingRebate -= agentRebateAmount;
                    distributedPercentage += actualRebatePercentage;
                    
                    console.log(`代理 ${agent.username} 退水比例為 ${(rebatePercentage*100).toFixed(1)}%，實際獲得 ${(actualRebatePercentage*100).toFixed(1)}% = ${agentRebateAmount.toFixed(2)} 元，剩餘池額 ${remainingRebate.toFixed(2)} 元`);
                }
                
                // 如果該代理的比例達到或超過最大值，說明是全拿模式
                if (rebatePercentage >= maxRebatePercentage) {
                    console.log(`代理 ${agent.username} 拿了全部退水池，結束分配`);
                    remainingRebate = 0;
                }
            }
            
            if (agentRebateAmount > 0) {
                // 分配退水給代理
                await allocateRebateToAgent(agent.id, agent.username, agentRebateAmount, username, betAmount, period);
                console.log(`✅ 分配退水 ${agentRebateAmount.toFixed(2)} 給代理 ${agent.username} (比例: ${(parseFloat(agent.rebate_percentage)*100).toFixed(1)}%, 剩餘: ${remainingRebate.toFixed(2)})`);
                
                // 如果沒有剩餘退水了，結束分配
                if (remainingRebate <= 0.01) {
                    break;
                }
            }
        }
        
        // 剩餘退水歸平台所有
        if (remainingRebate > 0.01) { // 考慮浮點數精度問題
            console.log(`剩餘退水池 ${remainingRebate.toFixed(2)} 元歸平台所有`);
        }
        
        console.log(`✅ 退水分配完成，總池: ${totalRebatePool.toFixed(2)}元，已分配: ${(totalRebatePool - remainingRebate).toFixed(2)}元，平台保留: ${remainingRebate.toFixed(2)}元`);
        
    } catch (error) {
        console.error('分配退水時發生錯誤:', error);
    }
}

// 獲取會員的代理鏈
async function getAgentChain(username) {
    try {
        const response = await fetch(`${AGENT_API_URL}/api/agent/internal/get-agent-chain?username=${username}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error(`獲取代理鏈失敗: ${response.status}`);
            return [];
        }
        
        const data = await response.json();
        if (data.success) {
            return data.agentChain || [];
        } else {
            console.error('獲取代理鏈失敗:', data.message);
            return [];
        }
    } catch (error) {
        console.error('獲取代理鏈時發生錯誤:', error);
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
        
        console.log(`成功分配退水 ${rebateAmount} 給代理 ${agentUsername}`);
        
    } catch (error) {
        console.error(`分配退水給代理 ${agentUsername} 失敗:`, error);
        throw error;
    }
}

// 創建必要的表
export async function createSettlementTables() {
    // 創建鎖表
    await createLockTable();
    
    // 創建結算日誌表
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
    
    // 為 bet_history 添加結算時間欄位
    await db.none(`
        ALTER TABLE bet_history 
        ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP
    `);
    
    // 創建索引以提高查詢性能
    await db.none(`
        CREATE INDEX IF NOT EXISTS idx_bet_history_period_settled 
        ON bet_history(period, settled)
    `);
    
    console.log('✅ 結算相關表創建完成');
}

// 導出函數供測試使用
export { checkWin, calculateWinAmount };

export default {
    improvedSettleBets,
    createSettlementTables,
    checkWin,
    calculateWinAmount
};