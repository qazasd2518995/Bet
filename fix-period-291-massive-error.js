// fix-period-291-massive-error.js - 修复期号291的大规模结算错误
import db from './db/config.js';

async function fixPeriod291MassiveError() {
    try {
        console.log('🚨 修复期号291大规模结算错误...\n');
        
        // 应该中奖的投注ID列表（基于调查结果）
        const correctWinners = [
            { id: 1867, description: 'champion big (10号)' },
            { id: 1863, description: 'champion even (10号)' },
            { id: 1870, description: 'runnerup big (6号)' },
            { id: 1868, description: 'runnerup even (6号)' },
            { id: 1874, description: 'third small (3号)' },
            { id: 1872, description: 'third odd (3号)' },
            { id: 1878, description: 'fourth small (5号)' },
            { id: 1876, description: 'fourth odd (5号)' },
            { id: 1880, description: 'fifth big (7号)' },
            { id: 1883, description: 'fifth odd (7号)' },
            { id: 1879, description: 'sixth big (8号)' },
            { id: 1886, description: 'sixth even (8号)' },
            { id: 1889, description: 'seventh small (1号)' },
            { id: 1887, description: 'seventh odd (1号)' },
            { id: 1892, description: 'eighth small (4号)' },
            { id: 1896, description: 'eighth even (4号)' },
            { id: 1899, description: 'ninth small (2号)' },
            { id: 1895, description: 'ninth even (2号)' },
            { id: 1901, description: 'tenth big (9号)' },
            { id: 1897, description: 'tenth odd (9号)' }
        ];
        
        const winAmount = 198; // 100 × 1.98
        const totalCompensation = correctWinners.length * winAmount;
        
        console.log(`需要修正的中奖投注: ${correctWinners.length}注`);
        console.log(`总补偿金额: $${totalCompensation}\n`);
        
        // 获取用户当前余额
        const member = await db.one('SELECT id, balance FROM members WHERE username = \'justin111\'');
        console.log(`用户当前余额: $${member.balance}`);
        
        // 在事务中执行所有修正
        await db.tx(async t => {
            console.log('开始大规模修正投注记录...');
            
            // 修正每个应该中奖的投注
            for (const winner of correctWinners) {
                await t.none(`
                    UPDATE bet_history 
                    SET win = true, win_amount = $1, settled_at = NOW()
                    WHERE id = $2
                `, [winAmount, winner.id]);
                
                console.log(`✅ 已修正投注ID ${winner.id}: ${winner.description} -> 中奖 $${winAmount}`);
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
                `期号291大规模结算错误补偿 - 修正${correctWinners.length}笔中奖投注`
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
        `, [correctWinners.map(w => w.id)]);
        
        console.log('\n修正后的投注状态:');
        let verifiedCount = 0;
        correctedBets.forEach(bet => {
            const expected = correctWinners.find(w => w.id === bet.id);
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
            WHERE period = 20250714291 AND username = 'justin111'
        `);
        
        console.log('\n📊 期号291最终统计:');
        console.log(`总投注数: ${finalStats.total_bets}`);
        console.log(`中奖投注数: ${finalStats.winning_bets}`);
        console.log(`总中奖金额: $${finalStats.total_winnings}`);
        
        console.log('\n🎯 期号291大规模结算错误修复完成!');
        console.log(`✅ 已修正 ${correctWinners.length} 个错误投注`);
        console.log(`✅ 已补偿 $${totalCompensation} 到用户帐户`);
        console.log(`✅ 用户应有的中奖已全部恢复`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('修复过程中发生错误:', error);
        await db.$pool.end();
    }
}

fixPeriod291MassiveError();