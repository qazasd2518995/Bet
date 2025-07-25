// test-settlement-real-scenario.js - 測試真實場景的結算問題
import db from './db/config.js';
import { improvedSettleBets } from './improved-settlement-system.js';

async function testSettlementRealScenario() {
    try {
        console.log('🧪 測試真實場景的結算問題...\n');
        
        // 1. 創建測試期號
        const testPeriod = 20250714999;
        const testResult = [7, 9, 1, 3, 4, 2, 6, 10, 5, 8]; // 與期號309相同的結果
        
        console.log(`測試期號: ${testPeriod}`);
        console.log(`開獎結果: ${testResult}`);
        console.log('各位置分析:');
        const positions = ['冠軍', '亞軍', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'];
        testResult.forEach((num, idx) => {
            const size = num >= 6 ? '大' : '小';
            const oddEven = num % 2 === 0 ? '雙' : '單';
            console.log(`  ${positions[idx]}: ${num} (${size}, ${oddEven})`);
        });
        
        // 2. 創建測試投注
        console.log('\n📝 創建測試投注...');
        const testBets = [
            { bet_type: 'champion', bet_value: 'big', amount: 100, odds: 1.98 }, // 應該中獎 (7是大)
            { bet_type: 'champion', bet_value: 'odd', amount: 100, odds: 1.98 }, // 應該中獎 (7是單)
            { bet_type: 'champion', bet_value: 'small', amount: 100, odds: 1.98 }, // 應該輸
            { bet_type: 'champion', bet_value: 'even', amount: 100, odds: 1.98 }, // 應該輸
            { bet_type: 'tenth', bet_value: 'big', amount: 100, odds: 1.98 }, // 應該中獎 (8是大)
            { bet_type: 'tenth', bet_value: 'even', amount: 100, odds: 1.98 }, // 應該中獎 (8是雙)
        ];
        
        // 插入測試開獎結果
        await db.none(`
            INSERT INTO result_history (period, result, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (period) DO UPDATE SET result = $2
        `, [testPeriod, testResult]);
        
        // 插入測試投注
        for (const bet of testBets) {
            await db.none(`
                INSERT INTO bet_history (username, period, bet_type, bet_value, amount, odds, win, win_amount, settled, created_at)
                VALUES ('test_user', $1, $2, $3, $4, $5, false, 0, false, NOW())
            `, [testPeriod, bet.bet_type, bet.bet_value, bet.amount, bet.odds]);
        }
        
        // 3. 執行結算
        console.log('\n🎯 執行結算...');
        const settlementResult = await improvedSettleBets(testPeriod, { positions: testResult });
        
        console.log('\n📊 結算結果:');
        console.log(`成功: ${settlementResult.success}`);
        console.log(`結算數量: ${settlementResult.settledCount}`);
        console.log(`總中獎金額: ${settlementResult.totalWinAmount}`);
        
        // 4. 檢查結算後的投注狀態
        const settledBets = await db.any(`
            SELECT bet_type, bet_value, win, win_amount
            FROM bet_history
            WHERE period = $1 AND username = 'test_user'
            ORDER BY id
        `, [testPeriod]);
        
        console.log('\n📋 投注結算詳情:');
        settledBets.forEach((bet, idx) => {
            const expected = testBets[idx];
            console.log(`${bet.bet_type} ${bet.bet_value}: ${bet.win ? '中獎' : '輸'} ${bet.win_amount > 0 ? `$${bet.win_amount}` : ''}`);
        });
        
        // 5. 清理測試數據
        await db.none('DELETE FROM bet_history WHERE period = $1 AND username = $2', [testPeriod, 'test_user']);
        await db.none('DELETE FROM result_history WHERE period = $1', [testPeriod]);
        await db.none('DELETE FROM settlement_logs WHERE period = $1', [testPeriod]);
        await db.none('DELETE FROM settlement_locks WHERE lock_key = $1', [`settle_period_${testPeriod}`]);
        
        console.log('\n✅ 測試完成並清理數據');
        
        await db.$pool.end();
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
        // 清理可能的殘留數據
        try {
            await db.none('DELETE FROM bet_history WHERE period = 20250714999 AND username = \'test_user\'');
            await db.none('DELETE FROM result_history WHERE period = 20250714999');
            await db.none('DELETE FROM settlement_logs WHERE period = 20250714999');
            await db.none('DELETE FROM settlement_locks WHERE lock_key = \'settle_period_20250714999\'');
        } catch (cleanupError) {
            console.error('清理數據時發生錯誤:', cleanupError);
        }
        await db.$pool.end();
    }
}

testSettlementRealScenario();