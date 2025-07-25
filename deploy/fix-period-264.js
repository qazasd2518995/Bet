// fix-period-264.js - 修复期号264的结算问题
import db from './db/config.js';

async function fixPeriod264() {
    try {
        console.log('检查期号264的结算状况...');
        
        // 检查所有期号264的投注
        const allBets = await db.any('SELECT id, bet_value, position, settled, win, win_amount FROM bet_history WHERE period = 20250714264 ORDER BY id');
        console.log('期号264所有投注:');
        allBets.forEach(bet => {
            console.log(`ID ${bet.id}: 第${bet.position}名${bet.bet_value}号 - ${bet.settled ? '已结算' : '未结算'} - ${bet.win ? `中奖$${bet.win_amount}` : '未中奖'}`);
        });
        
        // 获取开奖结果
        const result = await db.one('SELECT result FROM result_history WHERE period = 20250714264');
        const positions = result.result;
        console.log('开奖结果:', positions);
        console.log('第6名开出:', positions[5], '号');
        
        // 检查哪些投注应该中奖但还未结算
        const unsettledBets = allBets.filter(bet => !bet.settled);
        console.log('未结算的投注数:', unsettledBets.length);
        
        if (unsettledBets.length > 0) {
            console.log('手动结算未完成的投注...');
            
            for (const bet of unsettledBets) {
                const shouldWin = parseInt(bet.bet_value) === positions[bet.position - 1];
                const winAmount = shouldWin ? (100 * 9.89) : 0;
                
                console.log(`处理投注ID ${bet.id}: 第${bet.position}名${bet.bet_value}号 - ${shouldWin ? '应该中奖' : '应该未中奖'}`);
                
                // 更新投注结果
                await db.none(`
                    UPDATE bet_history 
                    SET settled = true, win = $1, win_amount = $2, settled_at = NOW()
                    WHERE id = $3
                `, [shouldWin, winAmount, bet.id]);
                
                if (shouldWin) {
                    // 更新用户余额
                    const member = await db.one('SELECT id, balance FROM members WHERE username = \'justin111\'');
                    const newBalance = parseFloat(member.balance) + winAmount;
                    
                    await db.none('UPDATE members SET balance = $1 WHERE id = $2', [newBalance, member.id]);
                    
                    // 记录交易
                    await db.none(`
                        INSERT INTO transaction_records
                        (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                        VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
                    `, [member.id, winAmount, parseFloat(member.balance), newBalance, `期号 20250714264 第${bet.position}名${bet.bet_value}号中奖`]);
                    
                    console.log(`✅ 用户余额已更新: +$${winAmount}`);
                }
            }
        }
        
        // 重新检查结算状况
        console.log('\n重新检查结算状况...');
        const finalBets = await db.any('SELECT id, bet_value, position, settled, win, win_amount FROM bet_history WHERE period = 20250714264 AND position = 6 ORDER BY bet_value::int');
        
        let totalWin = 0;
        let winCount = 0;
        
        console.log('第6名投注最终结果:');
        finalBets.forEach(bet => {
            const status = bet.settled ? '✅ 已结算' : '❌ 未结算';
            const winStatus = bet.win ? `中奖 $${bet.win_amount}` : '未中奖';
            console.log(`  ${bet.bet_value}号: ${status} - ${winStatus}`);
            
            if (bet.win) {
                totalWin += parseFloat(bet.win_amount);
                winCount++;
            }
        });
        
        console.log(`\n总结: 中奖${winCount}注，总中奖金额$${totalWin}`);
        console.log(`第6名开出${positions[5]}号，投注${positions[5]}号的应该中奖`);
        
        // 检查用户最终余额
        const finalMember = await db.one('SELECT balance FROM members WHERE username = \'justin111\'');
        console.log(`用户最终余额: $${finalMember.balance}`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('错误:', error);
        await db.$pool.end();
    }
}

fixPeriod264();