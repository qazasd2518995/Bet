// fix-period-431-settlement.js - 修復期號 431 的冠亞和結算錯誤
import db from './db/config.js';

async function fixPeriod431() {
    const period = '20250718431';
    
    try {
        console.log(`開始修復期號 ${period} 的冠亞和結算錯誤...`);
        
        // 1. 查詢開獎結果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            console.error('找不到開獎結果');
            return;
        }
        
        const sum = drawResult.position_1 + drawResult.position_2;
        console.log(`\n開獎結果：冠軍${drawResult.position_1}號 + 亞軍${drawResult.position_2}號 = ${sum} (${sum % 2 === 0 ? '雙' : '單'})`);
        
        // 2. 查詢錯誤的冠亞和單投注
        const wrongBets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = $1 
            AND (bet_type = 'sum' OR bet_type = 'sumValue' OR bet_type = '冠亞和')
            AND (bet_value = '單' OR bet_value = 'odd')
            AND win = true
        `, [period]);
        
        console.log(`\n找到 ${wrongBets.length} 筆錯誤結算的冠亞和單投注`);
        
        if (wrongBets.length === 0) {
            console.log('沒有需要修復的投注');
            return;
        }
        
        // 3. 修復每筆錯誤的投注
        for (const bet of wrongBets) {
            console.log(`\n修復投注 ID ${bet.id}:`);
            console.log(`  用戶: ${bet.username}`);
            console.log(`  投注: ${bet.bet_type} ${bet.bet_value}`);
            console.log(`  金額: $${bet.amount}`);
            console.log(`  錯誤派彩: $${bet.win_amount}`);
            
            // 更新投注狀態為輸
            await db.none(`
                UPDATE bet_history 
                SET win = false, win_amount = 0
                WHERE id = $1
            `, [bet.id]);
            
            // 查詢用戶當前餘額
            const member = await db.oneOrNone(`
                SELECT id, balance FROM members WHERE username = $1
            `, [bet.username]);
            
            if (member) {
                const oldBalance = parseFloat(member.balance);
                const newBalance = oldBalance - parseFloat(bet.win_amount);
                
                console.log(`  修正餘額: $${oldBalance} → $${newBalance}`);
                
                // 更新用戶餘額
                await db.none(`
                    UPDATE members 
                    SET balance = $1
                    WHERE id = $2
                `, [newBalance, member.id]);
                
                // 記錄修正交易
                await db.none(`
                    INSERT INTO transaction_records 
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'adjustment', $2, $3, $4, $5, NOW())
                `, [
                    member.id,
                    -parseFloat(bet.win_amount),
                    oldBalance,
                    newBalance,
                    `修正期號${period}冠亞和結算錯誤`
                ]);
                
                console.log(`  ✓ 已修正`);
            } else {
                console.error(`  找不到用戶 ${bet.username}`);
            }
        }
        
        console.log('\n修復完成！');
        
    } catch (error) {
        console.error('修復失敗:', error);
    } finally {
        process.exit();
    }
}

// 執行修復
fixPeriod431();