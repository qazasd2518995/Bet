// improved-bet-analysis.js - 改进的下注分析

import db from './db/config.js';

/**
 * 改进的下注分析函数
 * @param {string} period - 期号
 * @param {boolean} includeSettled - 是否包含已结算的下注（默认 true）
 */
export async function analyzePeriodBetsImproved(period, includeSettled = true) {
    try {
        console.log(`📊 [改进分析] 开始分析期号 ${period} 的下注情况 (包含已结算: ${includeSettled})`);
        
        // 构建查询条件
        let whereClause = 'WHERE period = $1';
        if (!includeSettled) {
            whereClause += ' AND settled = false';
        }
        
        // 查询所有下注
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
            console.log(`📊 [改进分析] 期号 ${period} 没有找到任何下注记录`);
            
            // 进一步检查是否真的没有记录
            const checkExists = await db.oneOrNone(`
                SELECT COUNT(*) as total FROM bet_history WHERE period = $1
            `, [period]);
            
            if (checkExists && checkExists.total > 0) {
                console.log(`⚠️ [改进分析] 期号 ${period} 有 ${checkExists.total} 笔记录，但查询条件过滤了所有记录`);
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
        
        console.log(`📊 [改进分析] 找到 ${allBets.length} 笔下注记录`);
        
        // 统计已结算和未结算的数量
        const settledCount = allBets.filter(b => b.settled).length;
        const unsettledCount = allBets.filter(b => !b.settled).length;
        
        console.log(`   已结算: ${settledCount} 笔`);
        console.log(`   未结算: ${unsettledCount} 笔`);
        
        // 分析下注数据
        let totalAmount = 0;
        const positionBets = {};
        const userBets = {};
        
        for (const bet of allBets) {
            totalAmount += parseFloat(bet.amount);
            
            // 记录用户下注
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
            
            // 记录位置下注
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
        
        // 计算平台风险
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
        console.error(`❌ [改进分析] 分析失败:`, error);
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
 * 计算平台风险
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
