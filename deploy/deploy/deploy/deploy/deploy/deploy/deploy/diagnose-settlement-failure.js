// diagnose-settlement-failure.js - 診斷自動結算失敗的原因
import db from './db/config.js';

async function diagnoseSettlementFailure() {
    console.log('🔍 診斷期號229自動結算失敗的原因...\n');
    
    try {
        // 1. 檢查期號229的時間線
        console.log('⏰ 期號229的時間線分析：');
        
        // 獲取開獎時間
        const result = await db.one(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714229
        `);
        
        console.log(`開獎時間: ${result.created_at}`);
        
        // 獲取最早和最晚的投注時間
        const betTimes = await db.any(`
            SELECT MIN(created_at) as first_bet, MAX(created_at) as last_bet
            FROM bet_history
            WHERE period = 20250714229
        `);
        
        if (betTimes[0].first_bet) {
            console.log(`第一筆投注: ${betTimes[0].first_bet}`);
            console.log(`最後投注: ${betTimes[0].last_bet}`);
            
            const drawTime = new Date(result.created_at);
            const lastBetTime = new Date(betTimes[0].last_bet);
            const timeDiff = Math.round((drawTime - lastBetTime) / 1000);
            
            console.log(`投注截止到開獎間隔: ${timeDiff}秒`);
            
            if (timeDiff < 30) {
                console.log('⚠️ 投注時間太接近開獎時間，可能影響結算');
            }
        }
        
        // 2. 檢查結算系統的調用記錄
        console.log('\n📋 檢查結算系統調用：');
        
        // 檢查settlement_logs是否有其他期號的記錄
        const recentSettlements = await db.any(`
            SELECT period, settled_count, total_win_amount, created_at
            FROM settlement_logs
            WHERE period >= 20250714227
            ORDER BY period DESC
        `);
        
        if (recentSettlements.length > 0) {
            console.log('最近的結算記錄：');
            recentSettlements.forEach(log => {
                console.log(`  期號 ${log.period}: ${log.settled_count}注, $${log.total_win_amount}, ${log.created_at}`);
            });
            
            // 檢查是否有連續的結算空檔
            const missingPeriods = [];
            for (let i = 227; i <= 232; i++) {
                const period = 20250714000 + i;
                const found = recentSettlements.find(log => log.period == period);
                if (!found) {
                    missingPeriods.push(period);
                }
            }
            
            if (missingPeriods.length > 0) {
                console.log(`\n⚠️ 缺少結算記錄的期號: ${missingPeriods.join(', ')}`);
            }
        } else {
            console.log('❌ 沒有找到任何結算記錄');
        }
        
        // 3. 檢查backend.js的結算調用邏輯
        console.log('\n🎯 分析可能的結算失敗原因：');
        
        // 檢查是否有結算鎖殘留
        const oldLocks = await db.any(`
            SELECT lock_key, locked_at, expires_at
            FROM settlement_locks
            WHERE locked_at < NOW() - INTERVAL '1 hour'
        `);
        
        if (oldLocks.length > 0) {
            console.log('發現過期的結算鎖：');
            oldLocks.forEach(lock => {
                console.log(`  ${lock.lock_key}: ${lock.locked_at} (已過期)`);
            });
        }
        
        // 4. 檢查後端日誌或錯誤
        console.log('\n🔧 可能的失敗原因：');
        console.log('1. 後端服務在期號229開獎時未運行');
        console.log('2. 結算函數調用時發生異常');
        console.log('3. 數據庫連接問題');
        console.log('4. total_win欄位不存在導致結算失敗');
        console.log('5. 結算鎖機制阻止了結算');
        console.log('6. 事務回滾導致結算未完成');
        
        // 5. 檢查其他可能未結算的期號
        console.log('\n🔍 檢查其他可能的未結算期號：');
        
        const unsettledPeriods = await db.any(`
            SELECT period, COUNT(*) as total_bets,
                   SUM(CASE WHEN settled = true THEN 1 ELSE 0 END) as settled_count
            FROM bet_history
            WHERE period >= 20250714225
            GROUP BY period
            HAVING COUNT(*) > SUM(CASE WHEN settled = true THEN 1 ELSE 0 END)
            ORDER BY period ASC
        `);
        
        if (unsettledPeriods.length > 0) {
            console.log('發現有未結算注單的期號：');
            unsettledPeriods.forEach(period => {
                const unsettled = period.total_bets - period.settled_count;
                console.log(`  期號 ${period.period}: ${unsettled}/${period.total_bets} 未結算`);
            });
        } else {
            console.log('✅ 除了期號229，其他期號都已正常結算');
        }
        
        // 6. 建議的修復和預防措施
        console.log('\n💡 建議的修復和預防措施：');
        console.log('1. 修復improved-settlement-system.js中的total_win欄位問題 ✅ 已完成');
        console.log('2. 增加結算失敗時的重試機制');
        console.log('3. 添加結算狀態監控和告警');
        console.log('4. 實施結算完整性檢查');
        console.log('5. 定期清理過期的結算鎖');
        console.log('6. 增加結算日誌的詳細記錄');
        
        // 7. 實時檢查當前系統狀態
        console.log('\n📊 當前系統狀態：');
        
        const currentPeriod = await db.oneOrNone(`
            SELECT current_period, status
            FROM game_state
            ORDER BY id DESC
            LIMIT 1
        `);
        
        if (currentPeriod) {
            console.log(`當前期號: ${currentPeriod.current_period}`);
            console.log(`當前狀態: ${currentPeriod.status}`);
            
            // 檢查當前期號是否有投注
            const currentBets = await db.oneOrNone(`
                SELECT COUNT(*) as bet_count
                FROM bet_history
                WHERE period = $1
            `, [currentPeriod.current_period]);
            
            if (currentBets && parseInt(currentBets.bet_count) > 0) {
                console.log(`當前期號投注數: ${currentBets.bet_count}`);
                console.log('✅ 系統正常接受投注');
            }
        }
        
    } catch (error) {
        console.error('診斷過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行診斷
diagnoseSettlementFailure();