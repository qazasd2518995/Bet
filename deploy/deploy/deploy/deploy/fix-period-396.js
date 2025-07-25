// fix-period-396.js - 修正396期錯誤結算
import db from './db/config.js';

async function fixPeriod396() {
    try {
        console.log('🔧 修正期號 20250714396 的錯誤結算...\n');
        
        // 找到需要修正的投注（第3名號碼1，應該中獎但被標記為未中獎）
        const incorrectBet = await db.oneOrNone(`
            SELECT id, username, amount, odds, win, win_amount
            FROM bet_history 
            WHERE period = 20250714396 
                AND bet_type = 'number' 
                AND bet_value = '1' 
                AND position = 3
                AND win = false
        `);
        
        if (!incorrectBet) {
            console.log('❌ 找不到需要修正的投注');
            return;
        }
        
        console.log('找到需要修正的投注:');
        console.log(`  ID: ${incorrectBet.id}`);
        console.log(`  用戶: ${incorrectBet.username}`);
        console.log(`  金額: ${incorrectBet.amount}`);
        console.log(`  賠率: ${incorrectBet.odds}`);
        
        const winAmount = parseFloat(incorrectBet.amount) * parseFloat(incorrectBet.odds);
        console.log(`  應得派彩: ${winAmount}`);
        
        // 在事務中執行修正
        await db.tx(async t => {
            // 1. 更新投注狀態
            await t.none(`
                UPDATE bet_history 
                SET win = true, win_amount = $1
                WHERE id = $2
            `, [winAmount, incorrectBet.id]);
            
            // 2. 獲取用戶當前餘額
            const member = await t.one(`
                SELECT id, balance FROM members WHERE username = $1 FOR UPDATE
            `, [incorrectBet.username]);
            
            const currentBalance = parseFloat(member.balance);
            const newBalance = currentBalance + winAmount;
            
            // 3. 更新用戶餘額
            await t.none(`
                UPDATE members SET balance = $1 WHERE id = $2
            `, [newBalance, member.id]);
            
            // 4. 記錄交易
            await t.none(`
                INSERT INTO transaction_records 
                (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                VALUES ('member', $1, 'correction', $2, $3, $4, $5, NOW())
            `, [
                member.id,
                winAmount,
                currentBalance,
                newBalance,
                `期號 20250714396 結算修正 - 第3名號碼1中獎`
            ]);
            
            console.log(`\n✅ 修正完成:`);
            console.log(`  投注ID ${incorrectBet.id} 已標記為中獎`);
            console.log(`  派彩金額: ${winAmount}`);
            console.log(`  用戶餘額: ${currentBalance} → ${newBalance}`);
        });
        
        // 5. 更新結算日誌
        await db.none(`
            UPDATE settlement_logs 
            SET total_win_amount = $1,
                settlement_details = settlement_details || $2
            WHERE period = 20250714396
        `, [winAmount, JSON.stringify({ correction: `Bet ID ${incorrectBet.id} corrected to win ${winAmount}` })]);
        
        console.log(`\n🎉 期號 20250714396 結算修正完成！`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('修正過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

fixPeriod396();