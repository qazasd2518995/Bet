// 修复期号 422 的结算错误
import db from './db/config.js';

async function fixPeriod422Error() {
    console.log('🔧 修复期号 20250717422 的结算错误\n');
    
    try {
        await db.tx(async t => {
            // 1. 修正错误的中奖记录
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
                console.log(`- 用户：${errorBet.username}`);
                console.log(`- 错误奖金：${errorBet.win_amount}`);
                
                // 更新投注状态
                await t.none(`
                    UPDATE bet_history
                    SET win = false, win_amount = 0
                    WHERE id = $1
                `, [errorBet.id]);
                
                // 扣回错误奖金
                await t.none(`
                    UPDATE members
                    SET balance = balance - $1
                    WHERE username = $2
                `, [errorBet.win_amount, errorBet.username]);
                
                // 记录修正交易
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
                    `修正期号 20250717422 错误结算 (第10名投注10号，实际开出2号)`,
                    '20250717422'
                ]);
                
                console.log(`✅ 已修正，扣回奖金 ${errorBet.win_amount}`);
            }
            
            // 2. 检查是否有真正应该中奖的投注
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
                console.log(`\n发现应该中奖的投注 ${correctBet.id}：`);
                console.log(`- 用户：${correctBet.username}`);
                console.log(`- 投注金额：${correctBet.amount}`);
                
                const winAmount = parseFloat((correctBet.amount * correctBet.odds).toFixed(2));
                
                // 更新投注状态
                await t.none(`
                    UPDATE bet_history
                    SET win = true, win_amount = $1
                    WHERE id = $2
                `, [winAmount, correctBet.id]);
                
                // 补发奖金
                await t.none(`
                    UPDATE members
                    SET balance = balance + $1
                    WHERE username = $2
                `, [winAmount, correctBet.username]);
                
                // 记录补发交易
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
                    `补发期号 20250717422 奖金 (第10名投注2号中奖)`,
                    '20250717422'
                ]);
                
                console.log(`✅ 已补发奖金 ${winAmount}`);
            }
        });
        
        console.log('\n✅ 期号 20250717422 修正完成');
        
    } catch (error) {
        console.error('修正失败：', error);
        throw error;
    }
}

// 执行修正
fixPeriod422Error().then(() => {
    console.log('\n🎯 修正程序完成');
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误：', error);
    process.exit(1);
});