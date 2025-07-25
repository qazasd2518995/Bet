// check-settlement-logs-291.js - 檢查期號291的結算日誌
import db from './db/config.js';

async function checkSettlementLogs291() {
    try {
        console.log('🔍 檢查期號291的結算日誌...\n');
        
        // 1. 檢查結算日誌
        const logs = await db.manyOrNone(`
            SELECT period, settled_count, total_win_amount, created_at, settlement_details
            FROM settlement_logs 
            WHERE period = 20250714291 
            ORDER BY created_at
        `);
        
        console.log(`找到 ${logs.length} 條結算日誌記錄:\n`);
        
        logs.forEach((log, index) => {
            console.log(`結算記錄 ${index + 1}:`);
            console.log(`  期號: ${log.period}`);
            console.log(`  結算數量: ${log.settled_count}`);
            console.log(`  總中獎金額: $${log.total_win_amount}`);
            console.log(`  結算時間: ${log.created_at}`);
            
            if (log.settlement_details) {
                try {
                    const details = JSON.parse(log.settlement_details);
                    console.log(`  中獎詳情: ${details.filter(d => d.isWin).length} 個中獎注單`);
                } catch (e) {
                    console.log(`  結算詳情解析錯誤: ${log.settlement_details}`);
                }
            }
            console.log('');
        });
        
        // 2. 檢查事務記錄
        const transactions = await db.manyOrNone(`
            SELECT user_id, transaction_type, amount, balance_before, balance_after, description, created_at
            FROM transaction_records 
            WHERE description LIKE '%291%' OR description LIKE '%期號291%'
            ORDER BY created_at
        `);
        
        console.log(`📋 相關事務記錄 (${transactions.length}條):\n`);
        
        transactions.forEach((tx, index) => {
            console.log(`事務 ${index + 1}:`);
            console.log(`  類型: ${tx.transaction_type}`);
            console.log(`  金額: $${tx.amount}`);
            console.log(`  餘額變化: $${tx.balance_before} → $${tx.balance_after}`);
            console.log(`  描述: ${tx.description}`);
            console.log(`  時間: ${tx.created_at}`);
            console.log('');
        });
        
        // 3. 檢查用戶當前狀態
        const user = await db.oneOrNone(`
            SELECT id, username, balance 
            FROM members 
            WHERE username = 'justin111'
        `);
        
        console.log('👤 用戶當前狀態:');
        console.log(`  用戶名: ${user.username}`);
        console.log(`  當前餘額: $${user.balance}`);
        
        // 4. 檢查期號291的投注總覽
        const betSummary = await db.one(`
            SELECT 
                COUNT(*) as total_bets,
                SUM(amount) as total_bet_amount,
                SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as winning_bets,
                SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_winnings,
                MIN(created_at) as first_bet_time,
                MAX(created_at) as last_bet_time
            FROM bet_history 
            WHERE period = 20250714291 AND username = 'justin111'
        `);
        
        console.log('\n📊 期號291投注總覽:');
        console.log(`  總投注數: ${betSummary.total_bets}`);
        console.log(`  總投注金額: $${betSummary.total_bet_amount}`);
        console.log(`  中獎投注數: ${betSummary.winning_bets}`);
        console.log(`  總中獎金額: $${betSummary.total_winnings}`);
        console.log(`  投注時間範圍: ${betSummary.first_bet_time} 到 ${betSummary.last_bet_time}`);
        
        // 5. 檢查系統是否認為已結算
        const unsettledCount = await db.one(`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = 20250714291 AND settled = false
        `);
        
        console.log(`\n🔍 當前未結算注單數: ${unsettledCount.count}`);
        
        if (unsettledCount.count === 0) {
            console.log('✅ 系統認為期號291已完全結算');
        } else {
            console.log('⚠️ 仍有未結算的注單');
        }
        
        // 6. 分析可能的問題原因
        console.log('\n🔍 問題分析:');
        
        if (logs.length === 0) {
            console.log('❌ 沒有結算日誌 - 表示improvedSettleBets沒有被正確調用');
        } else if (logs.length === 1 && logs[0].settled_count === 40) {
            console.log('✅ 結算日誌正常 - 一次性結算了40筆注單');
        } else if (logs.length > 1) {
            console.log('⚠️ 多次結算 - 可能有重複結算問題');
        }
        
        if (transactions.filter(t => t.transaction_type === 'win').length !== 1) {
            console.log('⚠️ 中獎事務記錄異常 - 應該只有一筆合併的中獎記錄');
        }
        
        if (transactions.filter(t => t.transaction_type === 'adjustment').length > 0) {
            console.log('✅ 找到補償記錄 - 說明手動修復已執行');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

checkSettlementLogs291();