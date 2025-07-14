// fix-period-264.js - 修復期號264的結算問題
import db from './db/config.js';

async function fixPeriod264() {
    try {
        console.log('檢查期號264的結算狀況...');
        
        // 檢查所有期號264的投注
        const allBets = await db.any('SELECT id, bet_value, position, settled, win, win_amount FROM bet_history WHERE period = 20250714264 ORDER BY id');
        console.log('期號264所有投注:');
        allBets.forEach(bet => {
            console.log(`ID ${bet.id}: 第${bet.position}名${bet.bet_value}號 - ${bet.settled ? '已結算' : '未結算'} - ${bet.win ? `中獎$${bet.win_amount}` : '未中獎'}`);
        });
        
        // 獲取開獎結果
        const result = await db.one('SELECT result FROM result_history WHERE period = 20250714264');
        const positions = result.result;
        console.log('開獎結果:', positions);
        console.log('第6名開出:', positions[5], '號');
        
        // 檢查哪些投注應該中獎但還未結算
        const unsettledBets = allBets.filter(bet => !bet.settled);
        console.log('未結算的投注數:', unsettledBets.length);
        
        if (unsettledBets.length > 0) {
            console.log('手動結算未完成的投注...');
            
            for (const bet of unsettledBets) {
                const shouldWin = parseInt(bet.bet_value) === positions[bet.position - 1];
                const winAmount = shouldWin ? (100 * 9.89) : 0;
                
                console.log(`處理投注ID ${bet.id}: 第${bet.position}名${bet.bet_value}號 - ${shouldWin ? '應該中獎' : '應該未中獎'}`);
                
                // 更新投注結果
                await db.none(`
                    UPDATE bet_history 
                    SET settled = true, win = $1, win_amount = $2, settled_at = NOW()
                    WHERE id = $3
                `, [shouldWin, winAmount, bet.id]);
                
                if (shouldWin) {
                    // 更新用戶餘額
                    const member = await db.one('SELECT id, balance FROM members WHERE username = \'justin111\'');
                    const newBalance = parseFloat(member.balance) + winAmount;
                    
                    await db.none('UPDATE members SET balance = $1 WHERE id = $2', [newBalance, member.id]);
                    
                    // 記錄交易
                    await db.none(`
                        INSERT INTO transaction_records
                        (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                        VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
                    `, [member.id, winAmount, parseFloat(member.balance), newBalance, `期號 20250714264 第${bet.position}名${bet.bet_value}號中獎`]);
                    
                    console.log(`✅ 用戶餘額已更新: +$${winAmount}`);
                }
            }
        }
        
        // 重新檢查結算狀況
        console.log('\n重新檢查結算狀況...');
        const finalBets = await db.any('SELECT id, bet_value, position, settled, win, win_amount FROM bet_history WHERE period = 20250714264 AND position = 6 ORDER BY bet_value::int');
        
        let totalWin = 0;
        let winCount = 0;
        
        console.log('第6名投注最終結果:');
        finalBets.forEach(bet => {
            const status = bet.settled ? '✅ 已結算' : '❌ 未結算';
            const winStatus = bet.win ? `中獎 $${bet.win_amount}` : '未中獎';
            console.log(`  ${bet.bet_value}號: ${status} - ${winStatus}`);
            
            if (bet.win) {
                totalWin += parseFloat(bet.win_amount);
                winCount++;
            }
        });
        
        console.log(`\n總結: 中獎${winCount}注，總中獎金額$${totalWin}`);
        console.log(`第6名開出${positions[5]}號，投注${positions[5]}號的應該中獎`);
        
        // 檢查用戶最終餘額
        const finalMember = await db.one('SELECT balance FROM members WHERE username = \'justin111\'');
        console.log(`用戶最終餘額: $${finalMember.balance}`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('錯誤:', error);
        await db.$pool.end();
    }
}

fixPeriod264();