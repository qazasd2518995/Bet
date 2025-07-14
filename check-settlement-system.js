// check-settlement-system.js - 檢查整個結算系統
import db from './db/config.js';

async function checkSettlementSystem() {
    console.log('🔍 檢查整個結算系統的運作狀態...\n');
    
    try {
        // 1. 檢查期號234的狀態
        console.log('📊 檢查期號234的詳細狀態：');
        
        // 檢查是否已開獎
        const result234 = await db.oneOrNone(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714234
        `);
        
        if (result234) {
            console.log(`✅ 期號234已開獎: ${result234.created_at}`);
            console.log(`開獎結果: ${result234.result}`);
            
            // 解析第4名
            let positions = [];
            if (Array.isArray(result234.result)) {
                positions = result234.result;
            } else if (typeof result234.result === 'string') {
                positions = result234.result.split(',').map(n => parseInt(n.trim()));
            }
            
            if (positions.length >= 4) {
                console.log(`第4名開出: ${positions[3]}號`);
            }
        } else {
            console.log('❌ 期號234尚未開獎');
        }
        
        // 檢查投注記錄
        const bets234 = await db.any(`
            SELECT id, username, bet_type, bet_value, position, amount, odds,
                   win, win_amount, settled, settled_at, created_at
            FROM bet_history
            WHERE period = 20250714234
            ORDER BY created_at ASC
        `);
        
        console.log(`\n📋 期號234投注記錄 (${bets234.length}筆):`);
        bets234.forEach(bet => {
            const status = bet.settled ? '已結算' : '⚠️ 未結算';
            console.log(`ID ${bet.id}: ${bet.username} 第${bet.position}名=${bet.bet_value}號, $${bet.amount}, ${status}`);
        });
        
        // 2. 檢查最近幾期的結算情況
        console.log('\n📈 檢查最近幾期的結算情況：');
        
        const recentPeriods = await db.any(`
            SELECT bh.period, 
                   COUNT(*) as total_bets,
                   SUM(CASE WHEN bh.settled = true THEN 1 ELSE 0 END) as settled_count,
                   MAX(bh.created_at) as latest_bet,
                   rh.created_at as draw_time
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE bh.period >= 20250714230
            GROUP BY bh.period, rh.created_at
            ORDER BY bh.period DESC
        `);
        
        console.log('期號 | 總投注 | 已結算 | 開獎時間 | 最後投注時間');
        console.log('-'.repeat(60));
        recentPeriods.forEach(period => {
            const unsettled = period.total_bets - period.settled_count;
            const drawStatus = period.draw_time ? '已開獎' : '未開獎';
            const settlementStatus = unsettled > 0 ? `❌ ${unsettled}未結算` : '✅ 全部結算';
            
            console.log(`${period.period} | ${period.total_bets} | ${period.settled_count} | ${drawStatus} | ${settlementStatus}`);
            if (period.draw_time && period.latest_bet) {
                const timeDiff = Math.round((new Date(period.draw_time) - new Date(period.latest_bet)) / 1000);
                console.log(`  時間差: ${timeDiff}秒 (投注到開獎)`);
            }
        });
        
        // 3. 檢查結算日誌
        console.log('\n📝 檢查結算日誌記錄：');
        
        const settlementLogs = await db.any(`
            SELECT period, settled_count, total_win_amount, created_at
            FROM settlement_logs
            WHERE period >= 20250714230
            ORDER BY period DESC
        `);
        
        if (settlementLogs.length > 0) {
            console.log('有結算日誌的期號：');
            settlementLogs.forEach(log => {
                console.log(`  期號 ${log.period}: ${log.settled_count}注, $${log.total_win_amount}, ${log.created_at}`);
            });
            
            // 找出缺少結算日誌的期號
            const loggedPeriods = settlementLogs.map(log => log.period);
            const allPeriods = recentPeriods.map(p => p.period);
            const missingLogs = allPeriods.filter(period => !loggedPeriods.includes(period));
            
            if (missingLogs.length > 0) {
                console.log(`\n⚠️ 缺少結算日誌的期號: ${missingLogs.join(', ')}`);
            }
        } else {
            console.log('❌ 最近期號都沒有結算日誌記錄');
        }
        
        // 4. 檢查當前遊戲狀態
        console.log('\n🎮 檢查當前遊戲狀態：');
        
        const gameState = await db.oneOrNone(`
            SELECT current_period, status, countdown_seconds, last_result
            FROM game_state
            ORDER BY id DESC
            LIMIT 1
        `);
        
        if (gameState) {
            console.log(`當前期號: ${gameState.current_period}`);
            console.log(`當前狀態: ${gameState.status}`);
            console.log(`倒計時: ${gameState.countdown_seconds}秒`);
            
            // 檢查遊戲是否正常循環
            if (gameState.current_period <= 20250714234) {
                console.log('⚠️ 遊戲期號推進可能有問題');
            } else {
                console.log('✅ 遊戲正常推進到新期號');
            }
        }
        
        // 5. 檢查後端服務狀態（通過最近的活動）
        console.log('\n🔧 檢查後端服務活動狀態：');
        
        // 檢查最近的開獎活動
        const recentDraws = await db.any(`
            SELECT period, created_at
            FROM result_history
            WHERE created_at > NOW() - INTERVAL '30 minutes'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        if (recentDraws.length > 0) {
            console.log('最近30分鐘的開獎活動：');
            recentDraws.forEach(draw => {
                console.log(`  期號 ${draw.period}: ${draw.created_at}`);
            });
            console.log('✅ 後端服務正在正常開獎');
        } else {
            console.log('❌ 最近30分鐘沒有開獎活動');
        }
        
        // 檢查最近的投注活動
        const recentBets = await db.any(`
            SELECT period, COUNT(*) as bet_count, MAX(created_at) as latest_bet
            FROM bet_history
            WHERE created_at > NOW() - INTERVAL '30 minutes'
            GROUP BY period
            ORDER BY latest_bet DESC
        `);
        
        if (recentBets.length > 0) {
            console.log('\n最近30分鐘的投注活動：');
            recentBets.forEach(bet => {
                console.log(`  期號 ${bet.period}: ${bet.bet_count}筆投注, 最後: ${bet.latest_bet}`);
            });
            console.log('✅ 投注系統正常工作');
        } else {
            console.log('\n❌ 最近30分鐘沒有投注活動');
        }
        
        // 6. 檢查結算鎖狀態
        console.log('\n🔒 檢查結算鎖狀態：');
        
        const activeLocks = await db.any(`
            SELECT lock_key, locked_at, expires_at
            FROM settlement_locks
            WHERE expires_at > NOW()
        `);
        
        if (activeLocks.length > 0) {
            console.log('發現活躍的結算鎖：');
            activeLocks.forEach(lock => {
                console.log(`  ${lock.lock_key}: ${lock.locked_at} -> ${lock.expires_at}`);
            });
        } else {
            console.log('✅ 沒有活躍的結算鎖');
        }
        
        // 7. 診斷結算失敗的可能原因
        console.log('\n🔍 診斷結算系統問題：');
        
        const problemsFound = [];
        
        // 檢查是否有系統性的結算失敗
        const unsettledPeriods = recentPeriods.filter(p => 
            p.draw_time && (p.total_bets - p.settled_count) > 0
        );
        
        if (unsettledPeriods.length > 0) {
            problemsFound.push(`${unsettledPeriods.length}個期號有未結算注單`);
        }
        
        // 檢查是否缺少結算日誌
        const periodsWithBets = recentPeriods.filter(p => p.total_bets > 0);
        const periodsWithLogs = settlementLogs.length;
        
        if (periodsWithBets.length > periodsWithLogs) {
            problemsFound.push(`${periodsWithBets.length - periodsWithLogs}個期號缺少結算日誌`);
        }
        
        if (problemsFound.length > 0) {
            console.log('❌ 發現的問題：');
            problemsFound.forEach(problem => console.log(`  - ${problem}`));
            
            console.log('\n🔧 可能的原因：');
            console.log('1. 後端服務在開獎後沒有正確調用結算函數');
            console.log('2. improved-settlement-system.js 的 total_win 欄位問題導致結算失敗');
            console.log('3. 結算過程中發生異常但沒有重試機制');
            console.log('4. 數據庫連接或事務問題');
            console.log('5. 結算鎖機制阻止了結算執行');
            
            console.log('\n💡 建議的修復措施：');
            console.log('1. 重啟後端服務確保使用最新的代碼');
            console.log('2. 手動觸發未結算期號的結算');
            console.log('3. 添加結算失敗重試機制');
            console.log('4. 增強結算日誌和異常處理');
            console.log('5. 實施結算狀態監控');
        } else {
            console.log('✅ 沒有發現明顯的系統性問題');
        }
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行檢查
checkSettlementSystem();