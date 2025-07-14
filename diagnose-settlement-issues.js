// diagnose-settlement-issues.js - 診斷結算問題
import db from './db/config.js';

async function diagnoseSettlementIssues() {
    console.log('🔍 開始診斷結算系統問題...\n');
    
    try {
        // 1. 檢查最近的結算記錄
        console.log('📊 最近24小時的結算統計：');
        const recentStats = await db.oneOrNone(`
            SELECT 
                COUNT(DISTINCT period) as total_periods,
                COUNT(*) as total_bets,
                COUNT(CASE WHEN settled = true THEN 1 END) as settled_bets,
                COUNT(CASE WHEN settled = false THEN 1 END) as unsettled_bets,
                SUM(amount) as total_bet_amount,
                SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_win_amount
            FROM bet_history
            WHERE created_at > NOW() - INTERVAL '24 hours'
        `);
        
        if (recentStats) {
            console.log(`  - 總期數: ${recentStats.total_periods}`);
            console.log(`  - 總注單數: ${recentStats.total_bets}`);
            console.log(`  - 已結算: ${recentStats.settled_bets}`);
            console.log(`  - 未結算: ${recentStats.unsettled_bets}`);
            console.log(`  - 總下注額: ${recentStats.total_bet_amount || 0}`);
            console.log(`  - 總中獎額: ${recentStats.total_win_amount || 0}`);
        }
        
        // 2. 檢查可能的重複結算
        console.log('\n🔄 檢查重複結算情況：');
        const duplicateSettlements = await db.manyOrNone(`
            WITH bet_groups AS (
                SELECT 
                    period,
                    username,
                    bet_type,
                    bet_value,
                    position,
                    amount,
                    COUNT(*) as duplicate_count,
                    SUM(win_amount) as total_win_amount,
                    array_agg(id ORDER BY created_at) as bet_ids,
                    array_agg(settled ORDER BY created_at) as settled_status,
                    array_agg(created_at ORDER BY created_at) as created_times
                FROM bet_history
                WHERE created_at > NOW() - INTERVAL '24 hours'
                GROUP BY period, username, bet_type, bet_value, position, amount
                HAVING COUNT(*) > 1
            )
            SELECT * FROM bet_groups
            ORDER BY duplicate_count DESC, period DESC
            LIMIT 20
        `);
        
        if (duplicateSettlements && duplicateSettlements.length > 0) {
            console.log(`  ⚠️ 發現 ${duplicateSettlements.length} 組可能的重複注單：`);
            duplicateSettlements.forEach((dup, index) => {
                console.log(`\n  ${index + 1}. 期號: ${dup.period}, 用戶: ${dup.username}`);
                console.log(`     類型: ${dup.bet_type}, 值: ${dup.bet_value}, 金額: ${dup.amount}`);
                console.log(`     重複次數: ${dup.duplicate_count}, 總中獎: ${dup.total_win_amount || 0}`);
                console.log(`     注單ID: ${dup.bet_ids.join(', ')}`);
                console.log(`     結算狀態: ${dup.settled_status.join(', ')}`);
            });
        } else {
            console.log('  ✅ 沒有發現重複注單');
        }
        
        // 3. 檢查異常的中獎金額
        console.log('\n💰 檢查異常中獎金額：');
        const abnormalWins = await db.manyOrNone(`
            SELECT 
                id,
                period,
                username,
                bet_type,
                bet_value,
                amount,
                win_amount,
                win_amount / NULLIF(amount, 0) as win_ratio,
                created_at
            FROM bet_history
            WHERE settled = true 
            AND win = true
            AND win_amount > amount * 50  -- 賠率超過50倍的
            AND created_at > NOW() - INTERVAL '24 hours'
            ORDER BY win_ratio DESC
            LIMIT 10
        `);
        
        if (abnormalWins && abnormalWins.length > 0) {
            console.log(`  ⚠️ 發現 ${abnormalWins.length} 筆異常高賠率的中獎：`);
            abnormalWins.forEach(win => {
                console.log(`    - ID: ${win.id}, 期號: ${win.period}, 用戶: ${win.username}`);
                console.log(`      下注: ${win.amount}, 中獎: ${win.win_amount}, 倍率: ${win.win_ratio.toFixed(2)}x`);
            });
        } else {
            console.log('  ✅ 沒有發現異常的中獎金額');
        }
        
        // 4. 檢查用戶餘額異常
        console.log('\n👤 檢查用戶餘額異常：');
        const balanceIssues = await db.manyOrNone(`
            WITH user_stats AS (
                SELECT 
                    m.username,
                    m.balance as current_balance,
                    COALESCE(SUM(CASE WHEN tr.transaction_type = 'deposit' THEN tr.amount ELSE 0 END), 0) as total_deposits,
                    COALESCE(SUM(CASE WHEN tr.transaction_type = 'withdraw' THEN tr.amount ELSE 0 END), 0) as total_withdraws,
                    COALESCE(SUM(CASE WHEN tr.transaction_type = 'bet' THEN -tr.amount ELSE 0 END), 0) as total_bets,
                    COALESCE(SUM(CASE WHEN tr.transaction_type = 'win' THEN tr.amount ELSE 0 END), 0) as total_wins,
                    COALESCE(SUM(CASE WHEN tr.transaction_type = 'rebate' THEN tr.amount ELSE 0 END), 0) as total_rebates
                FROM members m
                LEFT JOIN transaction_records tr ON m.id = tr.user_id AND tr.user_type = 'member'
                WHERE m.balance != 0
                GROUP BY m.username, m.balance
            )
            SELECT 
                username,
                current_balance,
                total_deposits,
                total_withdraws,
                total_bets,
                total_wins,
                total_rebates,
                (total_deposits - total_withdraws + total_bets + total_wins + total_rebates) as calculated_balance,
                current_balance - (total_deposits - total_withdraws + total_bets + total_wins + total_rebates) as difference
            FROM user_stats
            WHERE ABS(current_balance - (total_deposits - total_withdraws + total_bets + total_wins + total_rebates)) > 1
            ORDER BY ABS(current_balance - (total_deposits - total_withdraws + total_bets + total_wins + total_rebates)) DESC
            LIMIT 10
        `);
        
        if (balanceIssues && balanceIssues.length > 0) {
            console.log(`  ⚠️ 發現 ${balanceIssues.length} 個用戶餘額可能有異常：`);
            balanceIssues.forEach(user => {
                console.log(`\n    用戶: ${user.username}`);
                console.log(`    當前餘額: ${user.current_balance}`);
                console.log(`    計算餘額: ${user.calculated_balance}`);
                console.log(`    差異: ${user.difference}`);
                console.log(`    明細: 存款(${user.total_deposits}) - 提款(${user.total_withdraws}) + 下注(${user.total_bets}) + 中獎(${user.total_wins}) + 退水(${user.total_rebates})`);
            });
        } else {
            console.log('  ✅ 用戶餘額計算正常');
        }
        
        // 5. 檢查未結算的過期注單
        console.log('\n⏰ 檢查未結算的過期注單：');
        const expiredUnsettled = await db.manyOrNone(`
            SELECT 
                period,
                COUNT(*) as bet_count,
                SUM(amount) as total_amount,
                MIN(created_at) as earliest_bet,
                MAX(created_at) as latest_bet
            FROM bet_history
            WHERE settled = false
            AND created_at < NOW() - INTERVAL '1 hour'
            GROUP BY period
            ORDER BY period DESC
            LIMIT 10
        `);
        
        if (expiredUnsettled && expiredUnsettled.length > 0) {
            console.log(`  ⚠️ 發現 ${expiredUnsettled.length} 個期號有超過1小時未結算的注單：`);
            expiredUnsettled.forEach(period => {
                console.log(`    期號: ${period.period}, 注單數: ${period.bet_count}, 總金額: ${period.total_amount}`);
                console.log(`    最早: ${period.earliest_bet}, 最晚: ${period.latest_bet}`);
            });
        } else {
            console.log('  ✅ 沒有發現過期未結算的注單');
        }
        
        // 6. 提供修復建議
        console.log('\n🔧 修復建議：');
        console.log('1. 執行 node init-settlement-system.js 初始化結算系統');
        console.log('2. 執行 node fix-duplicate-settlements-v2.cjs 修復重複結算');
        console.log('3. 重啟服務以使用新的結算系統');
        console.log('4. 監控 settlement_logs 表以追蹤結算情況');
        
    } catch (error) {
        console.error('❌ 診斷過程中發生錯誤:', error);
    }
}

// 如果直接執行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
    diagnoseSettlementIssues()
        .then(() => {
            console.log('\n診斷完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('診斷失敗:', error);
            process.exit(1);
        });
}

export default diagnoseSettlementIssues;