// 修復期號 422 的結算錯誤
import db from './db/config.js';

async function fixPeriod422Error() {
    console.log('🔧 修復期號 20250717422 的結算錯誤\n');
    
    try {
        await db.tx(async t => {
            // 1. 修正錯誤的中獎記錄
            const errorBet = await t.oneOrNone(`
                SELECT id, username, amount, win_amount
                FROM bet_history
                WHERE period = '20250717422'
                AND position = '10'
                AND bet_value = '10'
                AND win = true
                AND bet_type = 'number'
            `);
            
            if (errorBet) {
                console.log(`修正投注 ${errorBet.id}：`);
                console.log(`- 用戶：${errorBet.username}`);
                console.log(`- 錯誤獎金：${errorBet.win_amount}`);
                
                // 更新投注狀態
                await t.none(`
                    UPDATE bet_history
                    SET win = false, win_amount = 0
                    WHERE id = $1
                `, [errorBet.id]);
                
                // 扣回錯誤獎金
                await t.none(`
                    UPDATE members
                    SET balance = balance - $1
                    WHERE username = $2
                `, [errorBet.win_amount, errorBet.username]);
                
                // 記錄修正交易
                const member = await t.one(`
                    SELECT id, balance FROM members WHERE username = $1
                `, [errorBet.username]);
                
                await t.none(`
                    INSERT INTO transaction_records
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, period, created_at)
                    VALUES ('member', $1, 'adjustment', $2, $3, $4, $5, $6, NOW())
                `, [
                    member.id,
                    -errorBet.win_amount,
                    parseFloat(member.balance) + parseFloat(errorBet.win_amount),
                    member.balance,
                    `修正期號 20250717422 錯誤結算 (第10名投注10號，實際開出2號)`,
                    '20250717422'
                ]);
                
                console.log(`✅ 已修正，扣回獎金 ${errorBet.win_amount}`);
            }
            
            // 2. 檢查是否有真正應該中獎的投注
            const correctBet = await t.oneOrNone(`
                SELECT id, username, amount, odds
                FROM bet_history
                WHERE period = '20250717422'
                AND position = '10'
                AND bet_value = '2'
                AND win = false
                AND bet_type = 'number'
                AND settled = true
            `);
            
            if (correctBet) {
                console.log(`\n發現應該中獎的投注 ${correctBet.id}：`);
                console.log(`- 用戶：${correctBet.username}`);
                console.log(`- 投注金額：${correctBet.amount}`);
                
                const winAmount = parseFloat((correctBet.amount * correctBet.odds).toFixed(2));
                
                // 更新投注狀態
                await t.none(`
                    UPDATE bet_history
                    SET win = true, win_amount = $1
                    WHERE id = $2
                `, [winAmount, correctBet.id]);
                
                // 補發獎金
                await t.none(`
                    UPDATE members
                    SET balance = balance + $1
                    WHERE username = $2
                `, [winAmount, correctBet.username]);
                
                // 記錄補發交易
                const member = await t.one(`
                    SELECT id, balance FROM members WHERE username = $1
                `, [correctBet.username]);
                
                await t.none(`
                    INSERT INTO transaction_records
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, period, created_at)
                    VALUES ('member', $1, 'win', $2, $3, $4, $5, $6, NOW())
                `, [
                    member.id,
                    winAmount,
                    parseFloat(member.balance) - winAmount,
                    member.balance,
                    `補發期號 20250717422 獎金 (第10名投注2號中獎)`,
                    '20250717422'
                ]);
                
                console.log(`✅ 已補發獎金 ${winAmount}`);
            }
        });
        
        console.log('\n✅ 期號 20250717422 修正完成');
        
    } catch (error) {
        console.error('修正失敗：', error);
        throw error;
    }
}

// 執行修正
fixPeriod422Error().then(() => {
    console.log('\n🎯 修正程序完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});