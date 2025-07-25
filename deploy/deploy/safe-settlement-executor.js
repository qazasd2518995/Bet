// safe-settlement-executor.js - 安全的結算執行器
import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

/**
 * 安全執行結算，確保從數據庫讀取最新的開獎結果
 */
export async function safeExecuteSettlement(period) {
    console.log(`🎯 [安全結算] 開始執行期號 ${period} 的結算`);
    
    try {
        // 1. 從數據庫讀取開獎結果
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
            throw new Error(`找不到期號 ${period} 的開獎結果`);
        }
        
        console.log(`✅ [安全結算] 從數據庫讀取到開獎結果:`);
        console.log(`   期號: ${dbResult.period}`);
        console.log(`   開獎時間: ${dbResult.draw_time}`);
        
        // 2. 構建標準格式的開獎結果
        const positions = [];
        for (let i = 1; i <= 10; i++) {
            const position = dbResult[`position_${i}`];
            positions.push(parseInt(position));
            console.log(`   第${i}名: ${position}號`);
        }
        
        // 3. 驗證開獎結果的完整性
        const uniqueNumbers = new Set(positions);
        if (uniqueNumbers.size !== 10 || positions.some(n => n < 1 || n > 10)) {
            throw new Error(`開獎結果異常: ${JSON.stringify(positions)}`);
        }
        
        // 4. 檢查是否已經結算過
        const alreadySettled = await db.oneOrNone(`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1 AND settled = true
        `, [period]);
        
        if (alreadySettled && parseInt(alreadySettled.count) > 0) {
            console.log(`⚠️ [安全結算] 期號 ${period} 已有 ${alreadySettled.count} 筆已結算記錄`);
            
            // 檢查是否還有未結算的
            const unsettled = await db.oneOrNone(`
                SELECT COUNT(*) as count 
                FROM bet_history 
                WHERE period = $1 AND settled = false
            `, [period]);
            
            if (!unsettled || parseInt(unsettled.count) === 0) {
                console.log(`✅ [安全結算] 期號 ${period} 所有投注都已結算`);
                
                // 查詢已結算的統計數據
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
                    message: '所有投注都已結算',
                    alreadySettled: parseInt(alreadySettled.count),
                    settledCount: parseInt(stats.settled_count),
                    winCount: parseInt(stats.win_count),
                    totalWinAmount: parseFloat(stats.total_win_amount)
                };
            }
        }
        
        // 5. 執行結算
        console.log(`🎲 [安全結算] 開始執行結算...`);
        const settlementResult = await enhancedSettlement(period, { positions });
        
        // 6. 記錄結算結果
        if (settlementResult.success) {
            console.log(`✅ [安全結算] 結算成功:`);
            console.log(`   結算數量: ${settlementResult.settledCount}`);
            console.log(`   中獎數量: ${settlementResult.winCount}`);
            console.log(`   總派彩: ${settlementResult.totalWinAmount}`);
            
            // 記錄到結算日誌
            await db.none(`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'success', $2, $3, NOW())
            `, [
                period,
                `結算成功: ${settlementResult.settledCount}筆`,
                JSON.stringify({
                    settledCount: settlementResult.settledCount,
                    winCount: settlementResult.winCount,
                    totalWinAmount: settlementResult.totalWinAmount,
                    positions: positions
                })
            ]);
        } else {
            console.error(`❌ [安全結算] 結算失敗: ${settlementResult.error}`);
            
            // 記錄失敗日誌
            await db.none(`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'failed', $2, $3, NOW())
            `, [
                period,
                `結算失敗: ${settlementResult.error}`,
                JSON.stringify({
                    error: settlementResult.error,
                    positions: positions
                })
            ]);
        }
        
        return settlementResult;
        
    } catch (error) {
        console.error(`❌ [安全結算] 執行失敗:`, error);
        
        // 記錄錯誤日誌
        try {
            await db.none(`
                INSERT INTO settlement_logs (period, status, message, details, created_at)
                VALUES ($1, 'error', $2, $3, NOW())
            `, [
                period,
                `結算錯誤: ${error.message}`,
                JSON.stringify({
                    error: error.message,
                    stack: error.stack
                })
            ]);
        } catch (logError) {
            console.error('記錄錯誤日誌失敗:', logError);
        }
        
        return {
            success: false,
            period: period,
            error: error.message
        };
    }
}

export default safeExecuteSettlement;
