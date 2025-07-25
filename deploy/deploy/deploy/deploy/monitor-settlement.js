// monitor-settlement.js - 監控結算系統
import db from './db/config.js';

async function monitorSettlement() {
    console.log('🔍 監控結算系統狀態...\n');
    
    try {
        // 檢查最近5期的結算狀況
        const recentPeriods = await db.any(`
            SELECT bh.period, 
                   COUNT(*) as total_bets,
                   SUM(CASE WHEN bh.settled = true THEN 1 ELSE 0 END) as settled_count,
                   rh.created_at as draw_time,
                   sl.created_at as settlement_time,
                   sl.settled_count as log_settled_count
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            LEFT JOIN settlement_logs sl ON bh.period = sl.period
            WHERE bh.period >= 20250714254
            GROUP BY bh.period, rh.created_at, sl.created_at, sl.settled_count
            ORDER BY bh.period DESC
        `);
        
        console.log('📊 最近5期結算狀況：');
        console.log('期號 | 投注數 | 已結算 | 開獎時間 | 結算時間 | 狀態');
        console.log('-'.repeat(80));
        
        recentPeriods.forEach(period => {
            const unsettled = period.total_bets - period.settled_count;
            let status = '✅ 正常';
            
            if (period.draw_time && unsettled > 0) {
                status = `❌ ${unsettled}筆未結算`;
            } else if (!period.draw_time) {
                status = '⏳ 未開獎';
            } else if (!period.settlement_time) {
                status = '⚠️ 無結算日誌';
            }
            
            const drawTime = period.draw_time ? period.draw_time.toLocaleString('zh-TW') : '未開獎';
            const settlementTime = period.settlement_time ? period.settlement_time.toLocaleString('zh-TW') : '無';
            
            console.log(`${period.period} | ${period.total_bets} | ${period.settled_count} | ${drawTime} | ${settlementTime} | ${status}`);
        });
        
        // 檢查當前期號
        const currentState = await db.oneOrNone(`
            SELECT current_period, status, countdown_seconds
            FROM game_state
            ORDER BY id DESC
            LIMIT 1
        `);
        
        if (currentState) {
            console.log(`\n🎮 當前遊戲狀態：`);
            console.log(`期號: ${currentState.current_period}`);
            console.log(`狀態: ${currentState.status}`);
            console.log(`倒計時: ${currentState.countdown_seconds}秒`);
            
            // 檢查當前期號是否有投注
            const currentBets = await db.oneOrNone(`
                SELECT COUNT(*) as bet_count
                FROM bet_history
                WHERE period = $1
            `, [currentState.current_period]);
            
            if (currentBets && parseInt(currentBets.bet_count) > 0) {
                console.log(`當前期號投注數: ${currentBets.bet_count}`);
            } else {
                console.log('當前期號暫無投注');
            }
        }
        
        // 檢查結算系統健康狀況
        console.log('\n🏥 結算系統健康檢查：');
        
        // 檢查是否有活躍的結算鎖
        const activeLocks = await db.any(`
            SELECT COUNT(*) as lock_count
            FROM settlement_locks
            WHERE expires_at > NOW()
        `);
        
        const lockCount = activeLocks[0]?.lock_count || 0;
        console.log(`活躍結算鎖: ${lockCount} ${lockCount === 0 ? '✅' : '⚠️'}`);
        
        // 檢查最近結算活動
        const recentSettlements = await db.any(`
            SELECT period, created_at
            FROM settlement_logs
            WHERE created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
        `);
        
        console.log(`最近1小時結算活動: ${recentSettlements.length}次 ${recentSettlements.length > 0 ? '✅' : '⚠️'}`);
        
        if (recentSettlements.length > 0) {
            console.log('最近結算記錄：');
            recentSettlements.slice(0, 3).forEach(log => {
                console.log(`  期號 ${log.period}: ${log.created_at.toLocaleString('zh-TW')}`);
            });
        }
        
        // 總結
        const problemPeriods = recentPeriods.filter(p => 
            p.draw_time && (p.total_bets - p.settled_count) > 0
        );
        
        console.log('\n📋 系統狀態總結：');
        if (problemPeriods.length === 0) {
            console.log('✅ 結算系統運行正常');
            console.log('✅ 所有已開獎期號都已正確結算');
            console.log('✅ 新投注會在開獎後自動結算');
        } else {
            console.log(`❌ 發現 ${problemPeriods.length} 個期號有未結算問題`);
            problemPeriods.forEach(p => {
                console.log(`  期號 ${p.period}: ${p.total_bets - p.settled_count} 筆未結算`);
            });
        }
        
    } catch (error) {
        console.error('監控過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行監控
monitorSettlement();