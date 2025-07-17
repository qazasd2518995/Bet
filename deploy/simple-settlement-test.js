// simple-settlement-test.js - 簡單測試結算系統
import db from './db/config.js';

async function simpleSettlementTest() {
    try {
        console.log('🧪 檢查結算系統狀況...\n');
        
        // 檢查最近的號碼投注是否正確結算
        const recentNumberBets = await db.any(`
            SELECT b.id, b.period, b.bet_type, b.bet_value, b.position, 
                   b.win, b.win_amount, b.amount, b.odds,
                   rh.result
            FROM bet_history b
            LEFT JOIN result_history rh ON b.period = rh.period
            WHERE b.bet_type = 'number' 
                AND b.period >= 20250714400 
                AND b.settled = true
                AND b.username = 'justin111'
            ORDER BY b.period DESC, b.id
            LIMIT 20
        `);
        
        console.log('最近的號碼投注檢查:');
        let correctCount = 0;
        let incorrectCount = 0;
        
        recentNumberBets.forEach(bet => {
            if (bet.result && Array.isArray(bet.result) && bet.position) {
                const positionIndex = parseInt(bet.position) - 1;
                const actualNumber = bet.result[positionIndex];
                const betNumber = parseInt(bet.bet_value);
                const shouldWin = actualNumber === betNumber;
                
                const isCorrect = bet.win === shouldWin;
                if (isCorrect) {
                    correctCount++;
                } else {
                    incorrectCount++;
                }
                
                const status = isCorrect ? '✅' : '❌';
                console.log(`${status} 期號${bet.period}, 位置${bet.position}, 投注${betNumber}, 開出${actualNumber}, 標記${bet.win ? '中' : '未中'}, 派彩${bet.win_amount}`);
                
                if (!isCorrect) {
                    const expectedWinAmount = shouldWin ? bet.amount * bet.odds : 0;
                    console.log(`   應該: ${shouldWin ? '中獎' : '未中獎'}, 派彩應為: ${expectedWinAmount}`);
                }
            }
        });
        
        console.log(`\n統計: 正確 ${correctCount} 筆, 錯誤 ${incorrectCount} 筆`);
        
        if (incorrectCount > 0) {
            console.log('\n❌ 發現結算錯誤，需要修正結算邏輯');
        } else {
            console.log('\n✅ 結算系統工作正常');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

simpleSettlementTest();