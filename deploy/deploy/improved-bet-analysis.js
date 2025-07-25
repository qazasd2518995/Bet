// improved-bet-analysis.js - 改進的下注分析

import db from './db/config.js';

/**
 * 改進的下注分析函數
 * @param {string} period - 期號
 * @param {boolean} includeSettled - 是否包含已結算的下注（默認 true）
 */
export async function analyzePeriodBetsImproved(period, includeSettled = true) {
    try {
        console.log(`📊 [改進分析] 開始分析期號 ${period} 的下注情況 (包含已結算: ${includeSettled})`);
        
        // 構建查詢條件
        let whereClause = 'WHERE period = $1';
        if (!includeSettled) {
            whereClause += ' AND settled = false';
        }
        
        // 查詢所有下注
        const allBets = await db.manyOrNone(`
            SELECT 
                bet_type, 
                bet_value, 
                position, 
                amount, 
                username,
                settled,
                win,
                created_at
            FROM bet_history 
            ${whereClause}
            ORDER BY created_at ASC
        `, [period]);
        
        if (!allBets || allBets.length === 0) {
            console.log(`📊 [改進分析] 期號 ${period} 沒有找到任何下注記錄`);
            
            // 進一步檢查是否真的沒有記錄
            const checkExists = await db.oneOrNone(`
                SELECT COUNT(*) as total FROM bet_history WHERE period = $1
            `, [period]);
            
            if (checkExists && checkExists.total > 0) {
                console.log(`⚠️ [改進分析] 期號 ${period} 有 ${checkExists.total} 筆記錄，但查詢條件過濾了所有記錄`);
            }
            
            return {
                totalAmount: 0,
                betCount: 0,
                positionBets: {},
                userBets: {},
                platformRisk: 0,
                settledCount: 0,
                unsettledCount: 0
            };
        }
        
        console.log(`📊 [改進分析] 找到 ${allBets.length} 筆下注記錄`);
        
        // 統計已結算和未結算的數量
        const settledCount = allBets.filter(b => b.settled).length;
        const unsettledCount = allBets.filter(b => !b.settled).length;
        
        console.log(`   已結算: ${settledCount} 筆`);
        console.log(`   未結算: ${unsettledCount} 筆`);
        
        // 分析下注數據
        let totalAmount = 0;
        const positionBets = {};
        const userBets = {};
        
        for (const bet of allBets) {
            totalAmount += parseFloat(bet.amount);
            
            // 記錄用戶下注
            if (!userBets[bet.username]) {
                userBets[bet.username] = [];
            }
            userBets[bet.username].push({
                betType: bet.bet_type,
                betValue: bet.bet_value,
                position: bet.position,
                amount: parseFloat(bet.amount),
                settled: bet.settled,
                win: bet.win
            });
            
            // 記錄位置下注
            if (bet.bet_type === 'number' && bet.position) {
                const pos = parseInt(bet.position);
                if (!positionBets[pos]) {
                    positionBets[pos] = {};
                }
                const num = parseInt(bet.bet_value);
                if (!positionBets[pos][num]) {
                    positionBets[pos][num] = 0;
                }
                positionBets[pos][num] += parseFloat(bet.amount);
            }
        }
        
        // 計算平台風險
        const platformRisk = calculatePlatformRisk(positionBets, totalAmount);
        
        return {
            totalAmount,
            betCount: allBets.length,
            positionBets,
            userBets,
            platformRisk,
            settledCount,
            unsettledCount
        };
        
    } catch (error) {
        console.error(`❌ [改進分析] 分析失敗:`, error);
        return {
            totalAmount: 0,
            betCount: 0,
            positionBets: {},
            userBets: {},
            platformRisk: 0,
            settledCount: 0,
            unsettledCount: 0,
            error: error.message
        };
    }
}

/**
 * 計算平台風險
 */
function calculatePlatformRisk(positionBets, totalBetAmount) {
    if (totalBetAmount === 0) return 0;
    
    let maxPotentialPayout = 0;
    
    for (const [position, bets] of Object.entries(positionBets)) {
        let maxPayoutForPosition = 0;
        for (const [number, amount] of Object.entries(bets)) {
            const potentialPayout = amount * 9.89;
            if (potentialPayout > maxPayoutForPosition) {
                maxPayoutForPosition = potentialPayout;
            }
        }
        maxPotentialPayout += maxPayoutForPosition;
    }
    
    return maxPotentialPayout / totalBetAmount;
}

export default analyzePeriodBetsImproved;
