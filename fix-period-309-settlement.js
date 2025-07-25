// fix-period-309-settlement.js - 修复期号309的结算错误
import db from './db/config.js';
import analyzePeriod309 from './analyze-period-309.js';

async function fixPeriod309Settlement() {
    try {
        console.log('🔧 修复期号309的结算错误...\n');
        
        // 先分析并获取需要修正的投注列表
        const shouldWinBets = await analyzePeriod309();
        
        if (!shouldWinBets || shouldWinBets.length === 0) {
            console.log('没有需要修正的投注');
            await db.$pool.end();
            return;
        }
        
        const winAmount = 198; // 100 × 1.98
        const totalCompensation = shouldWinBets.length * winAmount;
        
        console.log(`\n开始修复...`);
        console.log(`需要修正的投注: ${shouldWinBets.length}笔`);
        console.log(`每笔中奖金额: $${winAmount}`);
        console.log(`总补偿金额: $${totalCompensation}\n`);
        
        // 获取用户当前余额
        const member = await db.one('SELECT id, balance FROM members WHERE username = \'justin111\'');
        console.log(`用户当前余额: $${member.balance}`);
        
        // 在事务中执行所有修正
        await db.tx(async t => {
            console.log('开始修正投注记录...\n');
            
            // 修正每个应该中奖的投注
            for (const bet of shouldWinBets) {
                await t.none(`
                    UPDATE bet_history 
                    SET win = true, win_amount = $1
                    WHERE id = $2
                `, [winAmount, bet.id]);
                
                console.log(`✅ 已修正投注ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} (开出${bet.positionValue}) -> 中奖 $${winAmount}`);
            }
            
            // 更新用户余额
            const newBalance = parseFloat(member.balance) + totalCompensation;
            await t.none(`
                UPDATE members 
                SET balance = $1 
                WHERE id = $2
            `, [newBalance, member.id]);
            
            console.log(`\n✅ 余额已更新: $${member.balance} → $${newBalance}`);
            
            // 记录补偿交易
            await t.none(`
                INSERT INTO transaction_records
                (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                VALUES ('member', $1, 'adjustment', $2, $3, $4, $5, NOW())
            `, [
                member.id, 
                totalCompensation, 
                parseFloat(member.balance), 
                newBalance, 
                `期号309结算错误补偿 - 修正${shouldWinBets.length}笔中奖投注`
            ]);
            
            console.log('✅ 补偿交易记录已保存');
        });
        
        // 验证修正结果
        console.log('\n🔍 验证修正结果...');
        
        const correctedBets = await db.any(`
            SELECT id, bet_type, bet_value, win, win_amount 
            FROM bet_history 
            WHERE id = ANY($1)
            ORDER BY id
        `, [shouldWinBets.map(b => b.id)]);
        
        console.log('\n修正后的投注状态:');
        let verifiedCount = 0;
        correctedBets.forEach(bet => {
            const correct = bet.win === true && parseFloat(bet.win_amount) === winAmount;
            if (correct) verifiedCount++;
            console.log(`ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${bet.win ? `中奖 $${bet.win_amount}` : '未中奖'} ${correct ? '✅' : '❌'}`);
        });
        
        // 验证最终余额
        const finalMember = await db.one('SELECT balance FROM members WHERE username = \'justin111\'');
        const expectedBalance = parseFloat(member.balance) + totalCompensation;
        const balanceCorrect = Math.abs(parseFloat(finalMember.balance) - expectedBalance) < 0.01;
        
        console.log('\n💳 余额验证:');
        console.log(`修正前余额: $${member.balance}`);
        console.log(`补偿金额: $${totalCompensation}`);
        console.log(`预期余额: $${expectedBalance}`);
        console.log(`实际余额: $${finalMember.balance}`);
        console.log(`余额正确: ${balanceCorrect ? '✅' : '❌'}`);
        
        // 最终统计
        const finalStats = await db.one(`
            SELECT 
                COUNT(*) as total_bets,
                SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as winning_bets,
                SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_winnings
            FROM bet_history 
            WHERE period = 20250714309 AND username = 'justin111'
        `);
        
        console.log('\n📊 期号309最终统计:');
        console.log(`总投注数: ${finalStats.total_bets}`);
        console.log(`中奖投注数: ${finalStats.winning_bets}`);
        console.log(`总中奖金额: $${finalStats.total_winnings}`);
        
        if (verifiedCount === shouldWinBets.length && balanceCorrect) {
            console.log('\n🎉 期号309结算错误修复成功!');
            console.log(`✅ 已修正 ${shouldWinBets.length} 个错误投注`);
            console.log(`✅ 已补偿 $${totalCompensation} 到用户帐户`);
        } else {
            console.log('\n⚠️ 修复可能未完全成功，请检查');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('修复过程中发生错误:', error);
        await db.$pool.end();
    }
}

fixPeriod309Settlement();