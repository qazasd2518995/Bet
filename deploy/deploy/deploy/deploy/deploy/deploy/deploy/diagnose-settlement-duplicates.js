// diagnose-settlement-duplicates.js - 診斷重複結算問題
import db from './db/config.js';

async function diagnoseDuplicateSettlements() {
    console.log('🔍 開始診斷重複結算問題...\n');
    
    try {
        // 1. 檢查是否有重複的結算記錄
        console.log('1️⃣ 檢查重複結算記錄...');
        const duplicateSettlements = await db.any(`
            WITH bet_settlements AS (
                SELECT 
                    period,
                    username,
                    bet_type,
                    bet_value,
                    position,
                    amount,
                    COUNT(*) as settlement_count,
                    SUM(win_amount) as total_win_amount,
                    STRING_AGG(id::text, ', ') as bet_ids,
                    STRING_AGG(CASE WHEN settled THEN 'Y' ELSE 'N' END, ', ') as settled_flags
                FROM bet_history
                WHERE period >= (SELECT MAX(period) - 10 FROM bet_history)
                GROUP BY period, username, bet_type, bet_value, position, amount
                HAVING COUNT(*) > 1
            )
            SELECT * FROM bet_settlements
            ORDER BY period DESC, username, bet_type
        `);
        
        if (duplicateSettlements.length > 0) {
            console.log(`❌ 發現 ${duplicateSettlements.length} 組重複的注單！`);
            console.log('\n詳細信息：');
            duplicateSettlements.forEach(dup => {
                console.log(`  期號: ${dup.period}, 用戶: ${dup.username}`);
                console.log(`  類型: ${dup.bet_type}, 值: ${dup.bet_value}, 位置: ${dup.position || 'N/A'}`);
                console.log(`  金額: ${dup.amount}, 結算次數: ${dup.settlement_count}`);
                console.log(`  總中獎金額: ${dup.total_win_amount}`);
                console.log(`  注單ID: ${dup.bet_ids}`);
                console.log(`  已結算標記: ${dup.settled_flags}`);
                console.log('  ---');
            });
        } else {
            console.log('✅ 沒有發現重複的注單記錄');
        }
        
        // 2. 檢查交易記錄中的重複
        console.log('\n2️⃣ 檢查交易記錄中的重複結算...');
        const duplicateTransactions = await db.any(`
            WITH win_transactions AS (
                SELECT 
                    user_id,
                    transaction_type,
                    amount,
                    description,
                    created_at::date as transaction_date,
                    COUNT(*) as count,
                    STRING_AGG(id::text, ', ') as transaction_ids
                FROM transaction_records
                WHERE transaction_type = 'win'
                AND created_at >= NOW() - INTERVAL '7 days'
                GROUP BY user_id, transaction_type, amount, description, created_at::date
                HAVING COUNT(*) > 1
            )
            SELECT 
                t.*,
                m.username
            FROM win_transactions t
            JOIN members m ON t.user_id = m.id
            ORDER BY t.transaction_date DESC
        `);
        
        if (duplicateTransactions.length > 0) {
            console.log(`❌ 發現 ${duplicateTransactions.length} 組重複的中獎交易！`);
            duplicateTransactions.forEach(dup => {
                console.log(`  用戶: ${dup.username}, 日期: ${dup.transaction_date}`);
                console.log(`  金額: ${dup.amount}, 描述: ${dup.description}`);
                console.log(`  重複次數: ${dup.count}`);
                console.log(`  交易ID: ${dup.transaction_ids}`);
                console.log('  ---');
            });
        } else {
            console.log('✅ 沒有發現重複的中獎交易記錄');
        }
        
        // 3. 檢查結算鎖表
        console.log('\n3️⃣ 檢查結算鎖表...');
        const lockTableExists = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'settlement_locks'
            ) as exists
        `);
        
        if (lockTableExists?.exists) {
            const currentLocks = await db.any(`
                SELECT * FROM settlement_locks 
                WHERE expires_at > NOW()
                ORDER BY locked_at DESC
            `);
            
            if (currentLocks.length > 0) {
                console.log(`⚠️ 發現 ${currentLocks.length} 個活躍的結算鎖：`);
                currentLocks.forEach(lock => {
                    console.log(`  鎖鍵: ${lock.lock_key}`);
                    console.log(`  鎖定時間: ${lock.locked_at}`);
                    console.log(`  過期時間: ${lock.expires_at}`);
                });
            } else {
                console.log('✅ 沒有活躍的結算鎖');
            }
            
            // 檢查過期的鎖
            const expiredLocks = await db.any(`
                SELECT COUNT(*) as count FROM settlement_locks 
                WHERE expires_at <= NOW()
            `);
            
            if (expiredLocks[0].count > 0) {
                console.log(`⚠️ 發現 ${expiredLocks[0].count} 個過期的結算鎖需要清理`);
            }
        } else {
            console.log('❌ 結算鎖表不存在！這可能導致並發結算問題');
        }
        
        // 4. 檢查最近的結算記錄
        console.log('\n4️⃣ 檢查最近的結算記錄...');
        const recentSettlements = await db.any(`
            SELECT 
                period,
                COUNT(*) as bet_count,
                SUM(CASE WHEN settled THEN 1 ELSE 0 END) as settled_count,
                SUM(CASE WHEN win THEN 1 ELSE 0 END) as win_count,
                SUM(win_amount) as total_win_amount,
                MIN(created_at) as first_bet_time,
                MAX(CASE WHEN settled THEN settled_at ELSE NULL END) as last_settled_time
            FROM bet_history
            WHERE period >= (SELECT MAX(period) - 5 FROM bet_history)
            GROUP BY period
            ORDER BY period DESC
        `);
        
        console.log('最近5期的結算情況：');
        recentSettlements.forEach(record => {
            console.log(`  期號: ${record.period}`);
            console.log(`  總注單: ${record.bet_count}, 已結算: ${record.settled_count}`);
            console.log(`  中獎數: ${record.win_count}, 總中獎金額: ${record.total_win_amount || 0}`);
            console.log(`  首次下注: ${record.first_bet_time}`);
            console.log(`  最後結算: ${record.last_settled_time || '未結算'}`);
            console.log('  ---');
        });
        
        // 5. 檢查用戶餘額異常
        console.log('\n5️⃣ 檢查用戶餘額異常（可能因重複結算）...');
        const balanceAnomalies = await db.any(`
            WITH user_stats AS (
                SELECT 
                    m.username,
                    m.balance,
                    COALESCE(SUM(CASE WHEN bh.win THEN bh.win_amount ELSE 0 END), 0) as total_wins,
                    COALESCE(SUM(bh.amount), 0) as total_bets,
                    COUNT(bh.id) as bet_count,
                    COUNT(CASE WHEN bh.win THEN 1 END) as win_count
                FROM members m
                LEFT JOIN bet_history bh ON m.username = bh.username 
                    AND bh.created_at >= NOW() - INTERVAL '24 hours'
                    AND bh.settled = true
                GROUP BY m.username, m.balance
                HAVING COUNT(bh.id) > 0
            )
            SELECT *,
                   (total_wins - total_bets) as expected_profit,
                   CASE 
                       WHEN total_bets > 0 AND (total_wins / total_bets) > 5 THEN '異常高'
                       WHEN total_bets > 0 AND (total_wins / total_bets) > 2 THEN '偏高'
                       ELSE '正常'
                   END as win_ratio_status
            FROM user_stats
            WHERE total_wins > total_bets * 2  -- 贏的金額超過下注金額的2倍
            ORDER BY (total_wins - total_bets) DESC
            LIMIT 10
        `);
        
        if (balanceAnomalies.length > 0) {
            console.log(`⚠️ 發現 ${balanceAnomalies.length} 個用戶的中獎金額異常偏高：`);
            balanceAnomalies.forEach(user => {
                console.log(`  用戶: ${user.username}`);
                console.log(`  當前餘額: ${user.balance}`);
                console.log(`  24小時內: 下注${user.bet_count}次, 中獎${user.win_count}次`);
                console.log(`  總下注: ${user.total_bets}, 總中獎: ${user.total_wins}`);
                console.log(`  淨利潤: ${user.expected_profit} (${user.win_ratio_status})`);
                console.log('  ---');
            });
        } else {
            console.log('✅ 沒有發現餘額異常的用戶');
        }
        
        // 6. 提供修復建議
        console.log('\n📋 診斷總結與建議：');
        if (duplicateSettlements.length > 0 || duplicateTransactions.length > 0) {
            console.log('❌ 發現重複結算問題！');
            console.log('\n建議的修復步驟：');
            console.log('1. 立即停止遊戲服務，防止問題擴大');
            console.log('2. 備份當前資料庫');
            console.log('3. 執行 fix-duplicate-settlements-v3.cjs 修復重複結算');
            console.log('4. 確保 settlement_locks 表存在並正常工作');
            console.log('5. 檢查是否有多個服務實例同時運行');
            console.log('6. 驗證改進的結算系統 (improved-settlement-system.js) 是否正確引入');
        } else {
            console.log('✅ 未發現明顯的重複結算問題');
            console.log('\n但如果用戶報告餘額異常，請檢查：');
            console.log('1. 是否有並發結算的情況');
            console.log('2. 結算鎖機制是否正常工作');
            console.log('3. 代理系統和遊戲系統之間的同步是否有延遲');
        }
        
    } catch (error) {
        console.error('診斷過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行診斷
diagnoseDuplicateSettlements();