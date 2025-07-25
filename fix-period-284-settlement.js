// fix-period-284-settlement.js - 修复期号284的结算错误
import db from './db/config.js';

async function fixPeriod284Settlement() {
    try {
        console.log('🔧 修复期号284结算错误...\n');
        
        // 需要修正的投注ID和奖金
        const corrections = [
            { id: 1844, shouldWin: true, winAmount: 198 }, // runnerup odd (亚军5号单)
            { id: 1845, shouldWin: true, winAmount: 198 }, // third big (第三名7号大)
            { id: 1848, shouldWin: true, winAmount: 198 }, // third odd (第三名7号单)
            { id: 1852, shouldWin: true, winAmount: 198 }, // fifth big (第五名6号大)
            { id: 1853, shouldWin: true, winAmount: 198 }, // sixth big (第六名10号大)
            { id: 1856, shouldWin: true, winAmount: 198 }, // seventh odd (第七名1号单)
            { id: 1858, shouldWin: true, winAmount: 198 }, // eighth big (第八名8号大)
            { id: 1860, shouldWin: true, winAmount: 198 }, // ninth odd (第九名3号单)
            { id: 1861, shouldWin: true, winAmount: 198 }, // tenth odd (第十名9号单)
            { id: 1862, shouldWin: true, winAmount: 198 }  // tenth big (第十名9号大)
        ];
        
        const totalCompensation = corrections.reduce((sum, c) => sum + c.winAmount, 0);
        console.log(`总共需要修正 ${corrections.length} 个投注`);
        console.log(`总补偿金额: $${totalCompensation}\n`);
        
        // 获取用户当前余额
        const member = await db.one('SELECT id, balance FROM members WHERE username = \'justin111\'');
        console.log(`用户当前余额: $${member.balance}`);
        
        // 在事务中执行所有修正
        await db.tx(async t => {
            console.log('开始修正投注记录...');
            
            // 修正每个投注记录
            for (const correction of corrections) {
                await t.none(`
                    UPDATE bet_history 
                    SET win = $1, win_amount = $2, settled_at = NOW()
                    WHERE id = $3
                `, [correction.shouldWin, correction.winAmount, correction.id]);
                
                console.log(`✅ 已修正投注ID ${correction.id}: 设为中奖 $${correction.winAmount}`);
            }
            
            // 更新用户余额
            const newBalance = parseFloat(member.balance) + totalCompensation;
            await t.none(`
                UPDATE members 
                SET balance = $1 
                WHERE id = $2
            `, [newBalance, member.id]);
            
            console.log(`✅ 余额已更新: $${member.balance} → $${newBalance}`);
            
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
                `期号284结算错误补偿 - 修正${corrections.length}笔投注`
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
        `, [corrections.map(c => c.id)]);
        
        console.log('修正后的投注状态:');
        correctedBets.forEach(bet => {
            const expected = corrections.find(c => c.id === bet.id);
            const correct = bet.win === expected.shouldWin && parseFloat(bet.win_amount) === expected.winAmount;
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
        
        console.log('\n🎯 期号284结算错误修复完成!');
        console.log(`✅ 已修正 ${corrections.length} 个错误投注`);
        console.log(`✅ 已补偿 $${totalCompensation} 到用户帐户`);
        console.log(`✅ 第十名9号(大单)的投注已正确设为中奖`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('修复过程中发生错误:', error);
        await db.$pool.end();
    }
}

fixPeriod284Settlement();