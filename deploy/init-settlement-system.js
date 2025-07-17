// init-settlement-system.js - 初始化結算系統
import db from './db/config.js';
import { createSettlementTables } from './improved-settlement-system.js';

async function initializeSettlementSystem() {
    console.log('🚀 開始初始化結算系統...');
    
    try {
        // 1. 創建結算相關表
        console.log('📋 創建結算系統表...');
        await createSettlementTables();
        
        // 2. 檢查現有的未結算注單
        console.log('🔍 檢查未結算的注單...');
        const unsettledBets = await db.oneOrNone(`
            SELECT COUNT(*) as count, MIN(period) as min_period, MAX(period) as max_period
            FROM bet_history
            WHERE settled = false
        `);
        
        if (unsettledBets && parseInt(unsettledBets.count) > 0) {
            console.log(`⚠️ 發現 ${unsettledBets.count} 筆未結算注單`);
            console.log(`   期號範圍: ${unsettledBets.min_period} - ${unsettledBets.max_period}`);
        } else {
            console.log('✅ 沒有未結算的注單');
        }
        
        // 3. 檢查重複結算的情況
        console.log('🔍 檢查重複結算情況...');
        const duplicateSettlements = await db.manyOrNone(`
            SELECT period, username, COUNT(*) as count, SUM(win_amount) as total_win
            FROM bet_history
            WHERE settled = true
            GROUP BY period, username, bet_type, bet_value, position, amount
            HAVING COUNT(*) > 1
            ORDER BY period DESC
            LIMIT 10
        `);
        
        if (duplicateSettlements && duplicateSettlements.length > 0) {
            console.log(`⚠️ 發現可能的重複結算情況：`);
            duplicateSettlements.forEach(dup => {
                console.log(`   期號: ${dup.period}, 用戶: ${dup.username}, 重複次數: ${dup.count}, 總中獎: ${dup.total_win}`);
            });
        } else {
            console.log('✅ 沒有發現重複結算的情況');
        }
        
        // 4. 清理過期的結算鎖
        console.log('🧹 清理過期的結算鎖...');
        const cleanedLocks = await db.result(`
            DELETE FROM settlement_locks 
            WHERE expires_at < NOW()
        `);
        console.log(`   清理了 ${cleanedLocks.rowCount} 個過期鎖`);
        
        // 5. 創建測試數據（可選）
        const createTestData = process.argv.includes('--test');
        if (createTestData) {
            console.log('📝 創建測試數據...');
            await createTestBets();
        }
        
        console.log('✅ 結算系統初始化完成！');
        
    } catch (error) {
        console.error('❌ 初始化結算系統時發生錯誤:', error);
        throw error;
    }
}

// 創建測試注單（用於測試）
async function createTestBets() {
    const testPeriod = Date.now();
    const testUsers = ['test_user1', 'test_user2', 'test_user3'];
    const betTypes = [
        { type: 'number', value: '1', position: 1, amount: 100, odds: 9 },
        { type: 'big_small', value: 'big', position: null, amount: 200, odds: 1.95 },
        { type: 'odd_even', value: 'odd', position: null, amount: 150, odds: 1.95 },
        { type: 'dragon_tiger', value: '1_10', position: null, amount: 300, odds: 1.95 },
        { type: 'sum', value: '11', position: null, amount: 100, odds: 8.3 }
    ];
    
    for (const user of testUsers) {
        for (const bet of betTypes) {
            await db.none(`
                INSERT INTO bet_history (username, bet_type, bet_value, position, amount, odds, period, settled, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())
            `, [user, bet.type, bet.value, bet.position, bet.amount, bet.odds, testPeriod]);
        }
    }
    
    console.log(`   創建了 ${testUsers.length * betTypes.length} 筆測試注單，期號: ${testPeriod}`);
}

// 如果直接執行此文件
if (process.argv[1] === new URL(import.meta.url).pathname) {
    initializeSettlementSystem()
        .then(() => {
            console.log('程序執行完畢');
            process.exit(0);
        })
        .catch(error => {
            console.error('程序執行失敗:', error);
            process.exit(1);
        });
}

export default initializeSettlementSystem;