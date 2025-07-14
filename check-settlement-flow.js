// check-settlement-flow.js - 檢查結算流程問題
import db from './db/config.js';

async function checkSettlementFlow() {
    console.log('🔍 檢查結算流程和可能的重複問題...\n');
    
    try {
        // 1. 檢查最近的用戶 justin111 的投注和餘額變化
        console.log('1️⃣ 檢查用戶 justin111 的投注記錄...');
        const userBets = await db.any(`
            SELECT 
                bh.id,
                bh.period,
                bh.bet_type,
                bh.bet_value,
                bh.position,
                bh.amount,
                bh.odds,
                bh.win,
                bh.win_amount,
                bh.settled,
                bh.created_at,
                rh.winner_position,
                rh.winner_number
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE bh.username = 'justin111'
            AND bh.created_at >= NOW() - INTERVAL '2 hours'
            ORDER BY bh.period DESC, bh.created_at DESC
        `);
        
        console.log(`找到 ${userBets.length} 筆投注記錄：`);
        
        let totalBet = 0;
        let totalWin = 0;
        
        userBets.forEach(bet => {
            console.log(`\n期號: ${bet.period}`);
            console.log(`  投注ID: ${bet.id}`);
            console.log(`  類型: ${bet.bet_type}, 值: ${bet.bet_value}, 位置: ${bet.position || 'N/A'}`);
            console.log(`  金額: ${bet.amount}, 賠率: ${bet.odds || 'N/A'}`);
            console.log(`  結算: ${bet.settled ? '是' : '否'}, 中獎: ${bet.win ? '是' : '否'}`);
            
            if (bet.win) {
                console.log(`  中獎金額: ${bet.win_amount}`);
                totalWin += parseFloat(bet.win_amount);
            }
            totalBet += parseFloat(bet.amount);
            
            if (bet.winner_position && bet.winner_number) {
                console.log(`  開獎結果: 第${bet.winner_position}名 = ${bet.winner_number}`);
            }
        });
        
        console.log(`\n總計: 下注 ${totalBet} 元, 中獎 ${totalWin} 元, 淨利潤 ${totalWin - totalBet} 元`);
        
        // 2. 檢查交易記錄
        console.log('\n2️⃣ 檢查用戶的交易記錄...');
        const transactions = await db.any(`
            SELECT 
                tr.*
            FROM transaction_records tr
            JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
            WHERE m.username = 'justin111'
            AND tr.created_at >= NOW() - INTERVAL '2 hours'
            ORDER BY tr.created_at DESC
        `);
        
        console.log(`找到 ${transactions.length} 筆交易記錄：`);
        transactions.forEach(tx => {
            console.log(`\n交易ID: ${tx.id}`);
            console.log(`  類型: ${tx.transaction_type}`);
            console.log(`  金額: ${tx.amount}`);
            console.log(`  餘額: ${tx.balance_before} → ${tx.balance_after}`);
            console.log(`  描述: ${tx.description}`);
            console.log(`  時間: ${tx.created_at}`);
        });
        
        // 3. 檢查是否有重複的中獎記錄
        console.log('\n3️⃣ 檢查可能的重複中獎...');
        const duplicateWins = await db.any(`
            WITH win_details AS (
                SELECT 
                    period,
                    username,
                    bet_type,
                    bet_value,
                    position,
                    COUNT(*) as count,
                    SUM(CASE WHEN win THEN 1 ELSE 0 END) as win_count,
                    SUM(win_amount) as total_win_amount,
                    STRING_AGG(id::text, ', ') as bet_ids
                FROM bet_history
                WHERE username = 'justin111'
                AND created_at >= NOW() - INTERVAL '24 hours'
                GROUP BY period, username, bet_type, bet_value, position
                HAVING COUNT(*) > 1 OR SUM(CASE WHEN win THEN 1 ELSE 0 END) > 1
            )
            SELECT * FROM win_details
            ORDER BY period DESC
        `);
        
        if (duplicateWins.length > 0) {
            console.log(`⚠️ 發現可能的重複投注或中獎：`);
            duplicateWins.forEach(dup => {
                console.log(`  期號: ${dup.period}`);
                console.log(`  投注: ${dup.bet_type} = ${dup.bet_value}, 位置: ${dup.position || 'N/A'}`);
                console.log(`  數量: ${dup.count}, 中獎次數: ${dup.win_count}`);
                console.log(`  總中獎金額: ${dup.total_win_amount}`);
                console.log(`  注單ID: ${dup.bet_ids}`);
            });
        } else {
            console.log('✅ 沒有發現重複的投注或中獎');
        }
        
        // 4. 檢查實際的結算執行情況
        console.log('\n4️⃣ 檢查結算日誌（如果存在）...');
        const hasSettlementLogs = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'settlement_logs'
            ) as exists
        `);
        
        if (hasSettlementLogs?.exists) {
            const settlementLogs = await db.any(`
                SELECT * FROM settlement_logs
                WHERE created_at >= NOW() - INTERVAL '2 hours'
                ORDER BY created_at DESC
                LIMIT 10
            `);
            
            if (settlementLogs.length > 0) {
                console.log(`找到 ${settlementLogs.length} 筆結算日誌：`);
                settlementLogs.forEach(log => {
                    console.log(`  期號: ${log.period}`);
                    console.log(`  結算數: ${log.settled_count}, 總中獎: ${log.total_win_amount}`);
                    console.log(`  時間: ${log.created_at}`);
                });
            }
        } else {
            console.log('⚠️ 結算日誌表不存在');
        }
        
        // 5. 檢查當前用戶餘額
        console.log('\n5️⃣ 檢查用戶當前狀態...');
        const userInfo = await db.one(`
            SELECT username, balance, total_bet, total_win, created_at, updated_at
            FROM members
            WHERE username = 'justin111'
        `);
        
        console.log(`用戶: ${userInfo.username}`);
        console.log(`當前餘額: ${userInfo.balance}`);
        console.log(`總下注: ${userInfo.total_bet}`);
        console.log(`總中獎: ${userInfo.total_win}`);
        console.log(`註冊時間: ${userInfo.created_at}`);
        console.log(`更新時間: ${userInfo.updated_at}`);
        
        // 分析可能的問題
        console.log('\n📊 分析結果：');
        if (totalWin - totalBet > 1000) {
            console.log('⚠️ 檢測到異常高的淨利潤！可能存在重複結算問題。');
            console.log('\n可能的原因：');
            console.log('1. 舊的結算邏輯（legacySettleBets）和新的結算系統（improvedSettleBets）同時執行');
            console.log('2. 結算鎖機制未正常工作');
            console.log('3. 多個服務實例同時處理結算');
            
            console.log('\n建議修復方案：');
            console.log('1. 確保只使用 improvedSettleBets 進行結算');
            console.log('2. 檢查 backend.js 中是否完全移除了 legacySettleBets 的調用');
            console.log('3. 確保 settlement_locks 表存在並正常工作');
            console.log('4. 檢查是否有多個 backend.js 實例在運行');
        }
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行檢查
checkSettlementFlow();