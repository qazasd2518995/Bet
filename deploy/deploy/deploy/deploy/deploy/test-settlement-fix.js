// test-settlement-fix.js - 測試結算系統修復
import db from './db/config.js';
import { checkWin as improvedCheckWin } from './improved-settlement-system.js';
import optimizedSystem from './optimized-betting-system.js';

// 從優化系統中提取 quickCheckWin 函數進行測試
const { optimizedSettlement } = optimizedSystem;

async function testSettlementFix() {
    try {
        console.log('=== 測試結算系統修復 ===\n');
        
        // 測試數據
        const testPeriod = 20250714364;
        const winResult = { positions: [1, 3, 10, 9, 7, 6, 5, 4, 8, 2] };
        
        console.log('測試開獎結果:', winResult.positions);
        console.log('冠軍號碼:', winResult.positions[0]);
        
        // 測試注單
        const testBets = [
            { bet_type: 'number', bet_value: '1', position: 1, amount: 100, odds: 9.89 },
            { bet_type: 'number', bet_value: '2', position: 1, amount: 100, odds: 9.89 },
            { bet_type: 'number', bet_value: '3', position: 1, amount: 100, odds: 9.89 },
            { bet_type: 'number', bet_value: '1', position: 2, amount: 100, odds: 9.89 }, // 亞軍位置
            { bet_type: 'number', bet_value: '3', position: 2, amount: 100, odds: 9.89 }, // 亞軍位置
        ];
        
        console.log('\n1. 測試 improved-settlement-system.js 的 checkWin 函數:');
        testBets.forEach(bet => {
            const isWin = improvedCheckWin(bet, winResult);
            const expectedWin = winResult.positions[bet.position - 1] === parseInt(bet.bet_value);
            const status = isWin === expectedWin ? '✅ 正確' : '❌ 錯誤';
            console.log(`  位置${bet.position} 投注號碼${bet.bet_value}: 實際${isWin ? '中獎' : '未中獎'}, 預期${expectedWin ? '中獎' : '未中獎'} - ${status}`);
        });
        
        // 檢查實際資料庫中的注單
        console.log('\n2. 檢查實際資料庫中的注單:');
        const realBets = await db.any(`
            SELECT id, username, bet_type, bet_value, position, amount, win, settled
            FROM bet_history
            WHERE period = $1
            ORDER BY id
            LIMIT 10
        `, [testPeriod]);
        
        console.log(`找到 ${realBets.length} 筆注單`);
        realBets.forEach(bet => {
            const shouldWin = winResult.positions[bet.position - 1] === parseInt(bet.bet_value);
            const actualWin = bet.win === true;
            const correct = shouldWin === actualWin;
            console.log(`  ID: ${bet.id}, bet_type: "${bet.bet_type}", 位置: ${bet.position}, 號碼: ${bet.bet_value}, 應該${shouldWin ? '中獎' : '未中獎'}, 實際${actualWin ? '中獎' : '未中獎'} - ${correct ? '✅' : '❌'}`);
        });
        
        // 測試優化結算系統
        console.log('\n3. 測試優化結算系統的處理:');
        
        // 創建測試期號
        const testNewPeriod = new Date().getTime(); // 使用時間戳作為測試期號
        console.log(`創建測試期號: ${testNewPeriod}`);
        
        // 插入測試注單
        const testUsername = 'test_user_' + Math.random().toString(36).substr(2, 9);
        console.log(`創建測試用戶: ${testUsername}`);
        
        // 先創建測試用戶
        await db.none(`
            INSERT INTO members (username, password_hash, balance, created_at)
            VALUES ($1, 'test_hash', 1000, NOW())
            ON CONFLICT (username) DO NOTHING
        `, [testUsername]);
        
        // 插入測試注單
        for (let i = 1; i <= 3; i++) {
            await db.none(`
                INSERT INTO bet_history (username, bet_type, bet_value, position, amount, odds, period, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            `, [testUsername, 'number', i.toString(), 1, 10, 9.89, testNewPeriod]);
        }
        
        console.log('已插入 3 筆測試注單');
        
        // 使用優化結算系統結算
        const settlementResult = await optimizedSettlement(testNewPeriod, { positions: [2, 1, 3, 4, 5, 6, 7, 8, 9, 10] });
        
        if (settlementResult.success) {
            console.log('優化結算成功:');
            console.log(`  - 結算注單數: ${settlementResult.settledCount}`);
            console.log(`  - 總中獎金額: ${settlementResult.totalWinAmount}`);
            
            // 檢查結算結果
            const settledBets = await db.any(`
                SELECT bet_value, win, win_amount
                FROM bet_history
                WHERE period = $1 AND username = $2
                ORDER BY bet_value
            `, [testNewPeriod, testUsername]);
            
            console.log('\n測試注單結算結果:');
            settledBets.forEach(bet => {
                console.log(`  號碼 ${bet.bet_value}: ${bet.win ? '✅ 中獎' : '❌ 未中獎'}, 贏金: $${bet.win_amount || 0}`);
            });
        } else {
            console.log('優化結算失敗:', settlementResult.error);
        }
        
        // 清理測試數據
        await db.none(`DELETE FROM bet_history WHERE period = $1`, [testNewPeriod]);
        await db.none(`DELETE FROM members WHERE username = $1`, [testUsername]);
        console.log('\n已清理測試數據');
        
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行測試
testSettlementFix();