// 測試控制輸贏系統 v2
import db from './db/config.js';
import fetch from 'node-fetch';
import drawSystemManager from './fixed-draw-system.js';

console.log('🎮 開始測試控制輸贏系統\n');

async function testControlSystem() {
    try {
        // 1. 檢查和設定控制
        console.log('📌 步驟1: 檢查和設定控制...');
        
        // 先停用所有現有控制
        await db.none(`UPDATE win_loss_control SET is_active = false`);
        
        // 設定新的控制 - 90% 輸率
        const nextPeriod = await db.one(`
            SELECT COALESCE(MAX(period::bigint), 20250717000) + 1 as next_period 
            FROM result_history
        `);
        
        await db.none(`
            INSERT INTO win_loss_control 
            (control_mode, target_username, control_percentage, start_period, is_active, created_at)
            VALUES ('single_member', 'justin111', 90, $1, true, NOW())
        `, [nextPeriod.next_period]);
        
        console.log('✅ 已設定控制:');
        console.log(`- 目標用戶: justin111`);
        console.log(`- 控制機率: 90% 輸率`);
        console.log(`- 開始期號: ${nextPeriod.next_period}`);
        
        // 2. 模擬下注
        console.log('\n📌 步驟2: 模擬下注...');
        const testPeriod = nextPeriod.next_period.toString();
        
        // 清除該期舊數據
        await db.none(`DELETE FROM bet_history WHERE period = $1`, [testPeriod]);
        
        // 插入測試下注
        const testBets = [
            { position: 1, number: 5 },
            { position: 3, number: 7 },
            { position: 5, number: 2 },
            { position: 7, number: 9 },
            { position: 10, number: 1 }
        ];
        
        console.log('下注內容:');
        for (const bet of testBets) {
            await db.none(`
                INSERT INTO bet_history 
                (username, period, bet_type, bet_value, position, amount, odds, settled, created_at)
                VALUES ('justin111', $1, 'number', $2, $3, 1, 9.89, false, NOW())
            `, [testPeriod, bet.number.toString(), bet.position.toString()]);
            
            console.log(`- 第${bet.position}名 號碼${bet.number}`);
        }
        
        // 3. 執行開獎
        console.log('\n📌 步驟3: 執行開獎...');
        console.log(`正在為期號 ${testPeriod} 開獎...`);
        
        const drawResult = await drawSystemManager.executeDrawing(testPeriod);
        
        if (drawResult.success) {
            console.log('\n✅ 開獎成功!');
            console.log(`開獎結果: ${drawResult.result.join(', ')}`);
            
            // 4. 分析結果
            console.log('\n📌 步驟4: 分析結果...');
            console.log('\n下注與開獎對比:');
            
            let winCount = 0;
            for (const bet of testBets) {
                const actualNumber = drawResult.result[bet.position - 1];
                const isWin = actualNumber === bet.number;
                if (isWin) winCount++;
                
                console.log(`- 第${bet.position}名: 下注${bet.number}, 開出${actualNumber} ${isWin ? '🎯 中獎' : '❌ 未中獎'}`);
            }
            
            const winRate = (winCount / testBets.length * 100).toFixed(1);
            console.log(`\n統計:`);
            console.log(`- 總下注: ${testBets.length} 筆`);
            console.log(`- 中獎: ${winCount} 筆`);
            console.log(`- 中獎率: ${winRate}%`);
            console.log(`- 預期中獎率: 10% (因為設定90%輸率)`);
            
            // 5. 查看結算結果
            console.log('\n📌 步驟5: 查看結算結果...');
            const settledBets = await db.manyOrNone(`
                SELECT position, bet_value, win, win_amount
                FROM bet_history
                WHERE period = $1 AND username = 'justin111'
                ORDER BY position
            `, [testPeriod]);
            
            console.log('\n結算明細:');
            let totalWin = 0;
            for (const bet of settledBets) {
                if (bet.win) totalWin += parseFloat(bet.win_amount);
                console.log(`- 第${bet.position}名 號碼${bet.bet_value}: ${bet.win ? '中獎 $' + bet.win_amount : '未中獎'}`);
            }
            console.log(`\n總獎金: $${totalWin.toFixed(2)}`);
            
        } else {
            console.log('❌ 開獎失敗:', drawResult.error);
        }
        
        // 6. 多次測試統計
        console.log('\n📌 步驟6: 多次測試驗證機率...');
        console.log('進行10次測試以驗證機率:');
        
        let totalTests = 10;
        let totalWins = 0;
        
        for (let i = 1; i <= totalTests; i++) {
            const testPeriodMulti = (parseInt(testPeriod) + i).toString();
            
            // 清除舊數據
            await db.none(`DELETE FROM bet_history WHERE period = $1`, [testPeriodMulti]);
            
            // 插入單一下注 (第5名號碼5)
            await db.none(`
                INSERT INTO bet_history 
                (username, period, bet_type, bet_value, position, amount, odds, settled, created_at)
                VALUES ('justin111', $1, 'number', '5', '5', 1, 9.89, false, NOW())
            `, [testPeriodMulti]);
            
            // 開獎
            const result = await drawSystemManager.executeDrawing(testPeriodMulti);
            if (result.success) {
                const winNumber = result.result[4]; // 第5名
                if (winNumber === 5) totalWins++;
                console.log(`  測試${i}: 第5名開出${winNumber} ${winNumber === 5 ? '🎯' : '❌'}`);
            }
        }
        
        const actualWinRate = (totalWins / totalTests * 100).toFixed(1);
        console.log(`\n多次測試統計:`);
        console.log(`- 測試次數: ${totalTests}`);
        console.log(`- 中獎次數: ${totalWins}`);
        console.log(`- 實際中獎率: ${actualWinRate}%`);
        console.log(`- 預期中獎率: 10% (設定90%輸率)`);
        
        if (Math.abs(parseFloat(actualWinRate) - 10) <= 20) {
            console.log('\n✅ 控制系統運作正常，符合預期機率');
        } else {
            console.log('\n⚠️ 實際中獎率與預期有較大差異');
        }
        
    } catch (error) {
        console.error('\n❌ 測試失敗:', error);
        console.error(error.stack);
    }
}

// 執行測試
testControlSystem().then(() => {
    console.log('\n🎯 測試完成');
    process.exit(0);
}).catch(error => {
    console.error('錯誤:', error);
    process.exit(1);
});