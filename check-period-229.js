// check-period-229.js - 檢查期號229的結算問題
import db from './db/config.js';

async function checkPeriod229() {
    console.log('🔍 檢查期號 20250714229 的結算問題...\n');
    
    try {
        // 1. 檢查期號229是否已經開獎
        console.log('📊 檢查期號229的開獎狀態：');
        const result = await db.oneOrNone(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714229
        `);
        
        if (result) {
            console.log(`✅ 期號229已開獎`);
            console.log(`開獎時間: ${result.created_at}`);
            console.log(`開獎結果: ${result.result}`);
            
            // 解析開獎結果
            let positions = [];
            if (Array.isArray(result.result)) {
                positions = result.result;
            } else if (typeof result.result === 'string') {
                positions = result.result.split(',').map(n => parseInt(n.trim()));
            }
            
            if (positions.length >= 6) {
                console.log(`第6名開出: ${positions[5]}號`);
            }
        } else {
            console.log('❌ 期號229尚未開獎或結果未保存');
            return;
        }
        
        // 2. 檢查投注記錄的狀態
        console.log('\n📋 檢查期號229的投注記錄：');
        const bets = await db.any(`
            SELECT id, username, bet_type, bet_value, position, amount, odds,
                   win, win_amount, settled, settled_at, created_at
            FROM bet_history
            WHERE period = 20250714229
            AND position = 6
            AND bet_type = 'number'
            ORDER BY created_at ASC
        `);
        
        if (bets.length > 0) {
            console.log(`找到 ${bets.length} 筆第6名投注記錄：\n`);
            
            bets.forEach(bet => {
                const status = bet.settled ? '已結算' : '⚠️ 未結算';
                const winStatus = bet.win ? `中獎 $${bet.win_amount}` : '未中獎';
                
                console.log(`ID ${bet.id}: 投注${bet.bet_value}號`);
                console.log(`  用戶: ${bet.username}`);
                console.log(`  投注時間: ${bet.created_at}`);
                console.log(`  結算狀態: ${status}`);
                console.log(`  結算時間: ${bet.settled_at || '無'}`);
                console.log(`  中獎狀態: ${winStatus}`);
                console.log('');
            });
            
            // 檢查是否有未結算的注單
            const unsettledCount = bets.filter(bet => !bet.settled).length;
            if (unsettledCount > 0) {
                console.log(`⚠️ 發現 ${unsettledCount} 筆未結算的注單！`);
            } else {
                console.log(`✅ 所有注單都已結算`);
            }
        } else {
            console.log('未找到期號229第6名的投注記錄');
        }
        
        // 3. 檢查結算日誌
        console.log('\n📝 檢查結算日誌：');
        try {
            const settlementLogs = await db.any(`
                SELECT period, settled_count, total_win_amount, settlement_details, created_at
                FROM settlement_logs
                WHERE period = 20250714229
                ORDER BY created_at ASC
            `);
            
            if (settlementLogs.length > 0) {
                console.log(`找到 ${settlementLogs.length} 條結算記錄：`);
                settlementLogs.forEach((log, idx) => {
                    console.log(`\n記錄 ${idx + 1} (${log.created_at}):`);
                    console.log(`  結算數量: ${log.settled_count}`);
                    console.log(`  總中獎金額: $${log.total_win_amount}`);
                    
                    if (log.settlement_details) {
                        try {
                            const details = JSON.parse(log.settlement_details);
                            const position6Bets = details.filter(d => d.username === 'justin111');
                            if (position6Bets.length > 0) {
                                console.log(`  justin111的結算:`);
                                position6Bets.forEach(detail => {
                                    console.log(`    ID ${detail.betId}: ${detail.isWin ? '中獎' : '未中獎'} $${detail.winAmount || 0}`);
                                });
                            }
                        } catch (e) {
                            console.log(`  詳情解析失敗: ${e.message}`);
                        }
                    }
                });
            } else {
                console.log('❌ 未找到結算日誌記錄');
                console.log('這表明結算系統可能沒有執行或執行失敗');
            }
        } catch (error) {
            console.log('結算日誌查詢失敗:', error.message);
        }
        
        // 4. 檢查可能的結算問題
        console.log('\n🔍 診斷可能的問題：');
        
        // 檢查當前遊戲狀態
        try {
            const currentState = await db.oneOrNone(`
                SELECT current_period, status, countdown_seconds, last_result
                FROM game_state
                ORDER BY id DESC
                LIMIT 1
            `);
            
            if (currentState) {
                console.log(`當前遊戲期號: ${currentState.current_period}`);
                console.log(`當前狀態: ${currentState.status}`);
                console.log(`倒計時: ${currentState.countdown_seconds}秒`);
                
                if (currentState.current_period > 20250714229) {
                    console.log('✅ 遊戲已進入下一期，期號229應該已結算');
                } else {
                    console.log('⚠️ 遊戲可能還在期號229或之前');
                }
            }
        } catch (error) {
            console.log('遊戲狀態查詢失敗:', error.message);
        }
        
        // 5. 檢查settlement_locks表是否有卡住的鎖
        try {
            const locks = await db.any(`
                SELECT lock_key, locked_at, expires_at
                FROM settlement_locks
                WHERE lock_key LIKE '%229%' OR expires_at > NOW()
            `);
            
            if (locks.length > 0) {
                console.log('\n🔒 發現活躍的結算鎖：');
                locks.forEach(lock => {
                    const isExpired = new Date(lock.expires_at) < new Date();
                    console.log(`  ${lock.lock_key}: ${isExpired ? '已過期' : '仍活躍'} (${lock.expires_at})`);
                });
            } else {
                console.log('\n✅ 沒有活躍的結算鎖');
            }
        } catch (error) {
            console.log('結算鎖查詢失敗:', error.message);
        }
        
        // 6. 檢查是否需要手動觸發結算
        if (result && bets.length > 0) {
            const unsettledBets = bets.filter(bet => !bet.settled);
            if (unsettledBets.length > 0) {
                console.log('\n🔧 需要執行的修復動作：');
                console.log('1. 手動觸發期號229的結算');
                console.log('2. 檢查結算系統是否正常運行');
                console.log('3. 清理可能卡住的結算鎖');
                console.log('4. 驗證結算結果的正確性');
                
                console.log('\n📋 未結算的注單ID：');
                unsettledBets.forEach(bet => {
                    console.log(`  ID ${bet.id}: 投注${bet.bet_value}號, 金額 $${bet.amount}`);
                });
            }
        }
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行檢查
checkPeriod229();