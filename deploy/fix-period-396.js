// fix-period-396.js - 修正396期错误结算
import db from './db/config.js';

async function fixPeriod396() {
    try {
        console.log('🔧 修正期号 20250714396 的错误结算...\n');
        
        // 找到需要修正的投注（第3名号码1，应该中奖但被标记为未中奖）
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
        console.log(`  用户: ${incorrectBet.username}`);
        console.log(`  金额: ${incorrectBet.amount}`);
        console.log(`  赔率: ${incorrectBet.odds}`);
        
        const winAmount = parseFloat(incorrectBet.amount) * parseFloat(incorrectBet.odds);
        console.log(`  应得派彩: ${winAmount}`);
        
        // 在事务中执行修正
        await db.tx(async t => {
            // 1. 更新投注状态
            await t.none(`
                UPDATE bet_history 
                SET win = true, win_amount = $1
                WHERE id = $2
            `, [winAmount, incorrectBet.id]);
            
            // 2. 获取用户当前余额
            const member = await t.one(`
                SELECT id, balance FROM members WHERE username = $1 FOR UPDATE
            `, [incorrectBet.username]);
            
            const currentBalance = parseFloat(member.balance);
            const newBalance = currentBalance + winAmount;
            
            // 3. 更新用户余额
            await t.none(`
                UPDATE members SET balance = $1 WHERE id = $2
            `, [newBalance, member.id]);
            
            // 4. 记录交易
            await t.none(`
                INSERT INTO transaction_records 
                (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                VALUES ('member', $1, 'correction', $2, $3, $4, $5, NOW())
            `, [
                member.id,
                winAmount,
                currentBalance,
                newBalance,
                `期号 20250714396 结算修正 - 第3名号码1中奖`
            ]);
            
            console.log(`\n✅ 修正完成:`);
            console.log(`  投注ID ${incorrectBet.id} 已标记为中奖`);
            console.log(`  派彩金额: ${winAmount}`);
            console.log(`  用户余额: ${currentBalance} → ${newBalance}`);
        });
        
        // 5. 更新结算日志
        await db.none(`
            UPDATE settlement_logs 
            SET total_win_amount = $1,
                settlement_details = settlement_details || $2
            WHERE period = 20250714396
        `, [winAmount, JSON.stringify({ correction: `Bet ID ${incorrectBet.id} corrected to win ${winAmount}` })]);
        
        console.log(`\n🎉 期号 20250714396 结算修正完成！`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('修正过程中发生错误:', error);
        await db.$pool.end();
    }
}

fixPeriod396();