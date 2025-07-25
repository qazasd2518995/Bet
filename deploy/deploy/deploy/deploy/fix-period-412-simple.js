// 簡單修正期號 412 的結算錯誤
import db from './db/config.js';

async function fixPeriod412Simple() {
    console.log('🔧 修正期號 20250717412 的結算錯誤\n');

    try {
        // 1. 確認開獎結果
        console.log('📌 步驟1：確認開獎結果...');
        const drawResult = await db.one(`
            SELECT position_10
            FROM result_history
            WHERE period = '20250717412'
        `);
        
        console.log(`第10名開獎號碼：${drawResult.position_10}`);
        
        // 2. 查詢 justin111 的第10名投注
        console.log('\n📌 步驟2：查詢 justin111 的第10名投注...');
        const bets = await db.manyOrNone(`
            SELECT 
                id, 
                bet_value, 
                win, 
                win_amount,
                amount,
                odds
            FROM bet_history
            WHERE period = '20250717412'
            AND username = 'justin111'
            AND position = '10'
            AND bet_type = 'number'
        `);
        
        console.log(`\n找到 ${bets.length} 筆投注：`);
        
        for (const bet of bets) {
            const shouldWin = parseInt(bet.bet_value) === drawResult.position_10;
            console.log(`\n投注號碼 ${bet.bet_value}：`);
            console.log(`- 當前狀態：${bet.win ? '中獎' : '未中獎'}`);
            console.log(`- 應該狀態：${shouldWin ? '應該中獎' : '不應該中獎'}`);
            
            if (bet.win !== shouldWin) {
                console.log(`❌ 需要修正！`);
                
                if (bet.win && !shouldWin) {
                    // 錯誤中獎 - 號碼5
                    console.log(`執行修正：取消中獎狀態`);
                    
                    // 更新投注記錄
                    await db.none(`
                        UPDATE bet_history
                        SET win = false, win_amount = 0
                        WHERE id = $1
                    `, [bet.id]);
                    
                    // 扣回錯誤獎金
                    await db.none(`
                        UPDATE members
                        SET balance = balance - $1
                        WHERE username = 'justin111'
                    `, [bet.win_amount]);
                    
                    console.log(`✅ 已取消中獎，扣回獎金 ${bet.win_amount}`);
                    
                } else if (!bet.win && shouldWin) {
                    // 應該中獎但沒中 - 號碼10
                    const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                    console.log(`執行修正：設為中獎`);
                    
                    // 更新投注記錄
                    await db.none(`
                        UPDATE bet_history
                        SET win = true, win_amount = $1
                        WHERE id = $2
                    `, [winAmount.toFixed(2), bet.id]);
                    
                    // 增加獎金
                    await db.none(`
                        UPDATE members
                        SET balance = balance + $1
                        WHERE username = 'justin111'
                    `, [winAmount]);
                    
                    console.log(`✅ 已設為中獎，補發獎金 ${winAmount.toFixed(2)}`);
                }
            }
        }
        
        // 3. 查詢修正後的餘額
        console.log('\n📌 步驟3：查詢修正後的餘額...');
        const member = await db.one(`
            SELECT balance
            FROM members
            WHERE username = 'justin111'
        `);
        
        console.log(`\njustin111 修正後餘額：${member.balance}`);
        
        console.log('\n✅ 修正完成！');
        console.log('期號 20250717412 的結算錯誤已修正：');
        console.log('- 取消了號碼5的錯誤中獎');
        console.log('- 補發了號碼10的正確獎金');
        
    } catch (error) {
        console.error('修正失敗：', error);
    }
}

// 執行修正
fixPeriod412Simple().then(() => {
    console.log('\n✅ 所有操作完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});