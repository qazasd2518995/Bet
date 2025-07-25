// resettle-period-364.js - 重新結算期號 364
import db from './db/config.js';
import settlementSystem from './improved-settlement-system.js';

async function resettlePeriod364() {
    try {
        console.log('=== 重新結算期號 20250714364 ===\n');
        
        // 1. 獲取開獎結果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = $1
        `, [20250714364]);
        
        if (!result) {
            console.log('❌ 找不到期號 20250714364 的開獎結果！');
            return;
        }
        
        const resultArray = result.result.split ? result.result.split(',').map(Number) : result.result;
        const winResult = { positions: resultArray };
        
        console.log('開獎結果:', resultArray);
        console.log('冠軍號碼:', resultArray[0]);
        
        // 2. 獲取該期所有注單
        const bets = await db.any(`
            SELECT * FROM bet_history 
            WHERE period = $1
            ORDER BY id
        `, [20250714364]);
        
        console.log(`\n找到 ${bets.length} 筆注單`);
        
        // 3. 重置注單狀態
        console.log('\n重置注單狀態...');
        await db.none(`
            UPDATE bet_history 
            SET settled = false, win = false, win_amount = 0
            WHERE period = $1
        `, [20250714364]);
        
        // 4. 使用改進的結算系統重新結算
        console.log('\n使用改進的結算系統重新結算...');
        const settlementResult = await settlementSystem.improvedSettleBets(20250714364, winResult);
        
        if (settlementResult.success) {
            console.log('\n✅ 結算成功！');
            console.log(`結算注單數: ${settlementResult.settledCount}`);
            console.log(`總中獎金額: $${settlementResult.totalWinAmount}`);
            
            if (settlementResult.userWinnings) {
                console.log('\n用戶中獎明細:');
                for (const [username, amount] of Object.entries(settlementResult.userWinnings)) {
                    console.log(`  ${username}: $${amount}`);
                }
            }
        } else {
            console.log('\n❌ 結算失敗:', settlementResult.reason);
        }
        
        // 5. 驗證結算結果
        console.log('\n驗證結算結果...');
        const verifyBets = await db.any(`
            SELECT 
                id,
                username,
                bet_type,
                bet_value,
                position,
                amount,
                win,
                win_amount,
                settled
            FROM bet_history 
            WHERE period = $1 AND position = 1
            ORDER BY id
        `, [20250714364]);
        
        console.log('\n冠軍位置投注結果:');
        verifyBets.forEach(bet => {
            const status = bet.win ? '✅ 中獎' : '❌ 未中獎';
            console.log(`  用戶: ${bet.username}, 號碼: ${bet.bet_value}, ${status}, 贏金: $${bet.win_amount || 0}`);
        });
        
        // 6. 檢查用戶餘額
        const users = [...new Set(bets.map(b => b.username))];
        console.log('\n用戶餘額檢查:');
        for (const username of users) {
            const member = await db.oneOrNone(`
                SELECT balance FROM members WHERE username = $1
            `, [username]);
            if (member) {
                console.log(`  ${username}: $${member.balance}`);
            }
        }
        
    } catch (error) {
        console.error('重新結算過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行重新結算
resettlePeriod364();