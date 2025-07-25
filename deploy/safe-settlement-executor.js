// safe-settlement-executor.js - 安全的结算执行器
import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

/**
 * 安全执行结算，确保从数据库读取最新的开奖结果
 */
export async function safeExecuteSettlement(period) {
    console.log(`🎯 [安全结算] 开始执行期号 ${period} 的结算`);
    
    try {
        // 1. 从数据库读取开奖结果
        const dbResult = await db.oneOrNone(`
            SELECT 
                period,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                result,
                draw_time
            FROM result_history
            WHERE period = $1
        `, [period]);
        
        if (!dbResult) {
            throw new Error(`找不到期号 ${period} 的开奖结果`);
        }
        
        console.log(`✅ [安全结算] 从数据库读取到开奖结果:`);
        console.log(`   期号: ${dbResult.period}`);
        console.log(`   开奖时间: ${dbResult.draw_time}`);
        
        // 2. 构建标准格式的开奖结果
        const positions = [];
        for (let i = 1; i <= 10; i++) {
            const position = dbResult[`position_${i}`];
            positions.push(parseInt(position));
            console.log(`   第${i}名: ${position}号`);
        }
        
        // 3. 验证开奖结果的完整性
        const uniqueNumbers = new Set(positions);
        if (uniqueNumbers.size !== 10 || positions.some(n => n < 1 || n > 10)) {
            throw new Error(`开奖结果异常: ${JSON.stringify(positions)}`);
        }
        
        // 4. 检查是否已经结算过
        const alreadySettled = await db.oneOrNone(`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1 AND settled = true
        `, [period]);
        
        if (alreadySettled && parseInt(alreadySettled.count) > 0) {
            console.log(`⚠️ [安全结算] 期号 ${period} 已有 ${alreadySettled.count} 笔已结算记录`);
            
            // 检查是否还有未结算的
            const unsettled = await db.oneOrNone(`
                SELECT COUNT(*) as count 
                FROM bet_history 
                WHERE period = $1 AND settled = false
            `, [period]);
            
            if (!unsettled || parseInt(unsettled.count) === 0) {
                console.log(`✅ [安全结算] 期号 ${period} 所有投注都已结算`);
                
                // 查询已结算的统计数据
                const stats = await db.oneOrNone(`
                    SELECT 
                        COUNT(*) as settled_count,
                        COUNT(CASE WHEN win = true THEN 1 END) as win_count,
                        COALESCE(SUM(win_amount), 0) as total_win_amount
                    FROM bet_history
                    WHERE period = $1
                `, [period]);
                
                return {
                    success: true,
                    period: period,
                    message: '所有投注都已结算',
                    alreadySettled: parseInt(alreadySettled.count),
                    settledCount: parseInt(stats.settled_count),
                    winCount: parseInt(stats.win_count),
                    totalWinAmount: parseFloat(stats.total_win_amount)
                };
            }
        }
        
        // 5. 执行结算
        console.log(`🎲 [安全结算] 开始执行结算...`);
        const settlementResult = await enhancedSettlement(period, { positions });
        
        // 6. 记录结算结果
        if (settlementResult.success) {
            console.log(`✅ [安全结算] 结算成功:`);
            console.log(`   结算数量: ${settlementResult.settledCount}`);
            console.log(`   中奖数量: ${settlementResult.winCount}`);
            console.log(`   总派彩: ${settlementResult.totalWinAmount}`);
            
            // 记录到结算日志
            await db.none(`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'success', $2, $3, NOW())
            `, [
                period,
                `结算成功: ${settlementResult.settledCount}笔`,
                JSON.stringify({
                    settledCount: settlementResult.settledCount,
                    winCount: settlementResult.winCount,
                    totalWinAmount: settlementResult.totalWinAmount,
                    positions: positions
                })
            ]);
        } else {
            console.error(`❌ [安全结算] 结算失败: ${settlementResult.error}`);
            
            // 记录失败日志
            await db.none(`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'failed', $2, $3, NOW())
            `, [
                period,
                `结算失败: ${settlementResult.error}`,
                JSON.stringify({
                    error: settlementResult.error,
                    positions: positions
                })
            ]);
        }
        
        return settlementResult;
        
    } catch (error) {
        console.error(`❌ [安全结算] 执行失败:`, error);
        
        // 记录错误日志
        try {
            await db.none(`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'error', $2, $3, NOW())
            `, [
                period,
                `结算错误: ${error.message}`,
                JSON.stringify({
                    error: error.message,
                    stack: error.stack
                })
            ]);
        } catch (logError) {
            console.error('记录错误日志失败:', logError);
        }
        
        return {
            success: false,
            period: period,
            error: error.message
        };
    }
}

export default safeExecuteSettlement;
