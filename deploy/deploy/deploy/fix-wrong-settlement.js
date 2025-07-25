// fix-wrong-settlement.js - 修正錯誤的結算
import db from './db/config.js';

async function fixWrongSettlement() {
    console.log('🔧 修正錯誤的結算...\n');
    
    try {
        // 開始事務
        await db.tx(async t => {
            // 1. 查詢投注記錄
            const bet = await t.one(`
                SELECT * FROM bet_history
                WHERE id = 1645
            `);
            
            console.log('找到投注記錄：');
            console.log(`期號: ${bet.period}`);
            console.log(`投注: 第${bet.position}名 = ${bet.bet_value}號`);
            console.log(`金額: ${bet.amount}`);
            console.log(`當前狀態: ${bet.win ? '中獎' : '未中獎'}`);
            
            // 2. 確認開獎結果
            const result = await t.one(`
                SELECT result FROM result_history
                WHERE period = 20250714203
            `);
            
            // 解析結果（已知是數組格式）
            const positions = result.result;
            console.log(`\n開獎結果: ${positions}`);
            console.log(`第${bet.position}名: ${positions[bet.position - 1]}`);
            
            // 3. 確認應該中獎
            if (positions[bet.position - 1] == bet.bet_value) {
                console.log('\n✅ 確認：這注應該中獎！');
                
                // 4. 計算中獎金額
                const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                console.log(`中獎金額: ${winAmount} (${bet.amount} × ${bet.odds})`);
                
                // 5. 更新投注記錄
                await t.none(`
                    UPDATE bet_history
                    SET win = true, win_amount = $1
                    WHERE id = $2
                `, [winAmount, bet.id]);
                
                // 6. 獲取用戶當前餘額
                const member = await t.one(`
                    SELECT id, balance FROM members
                    WHERE username = $1
                `, [bet.username]);
                
                const oldBalance = parseFloat(member.balance);
                const newBalance = oldBalance + winAmount;
                
                // 7. 更新用戶餘額
                await t.none(`
                    UPDATE members
                    SET balance = $1
                    WHERE id = $2
                `, [newBalance, member.id]);
                
                // 8. 記錄交易
                await t.none(`
                    INSERT INTO transaction_records
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
                `, [member.id, winAmount, oldBalance, newBalance, `期號 ${bet.period} 中獎（修正）`]);
                
                console.log(`\n修正完成：`);
                console.log(`餘額: ${oldBalance} → ${newBalance} (+${winAmount})`);
            } else {
                console.log('\n❌ 這注確實不應該中獎');
            }
        });
        
        console.log('\n✅ 修正完成！');
        
    } catch (error) {
        console.error('修正過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行修正
fixWrongSettlement();