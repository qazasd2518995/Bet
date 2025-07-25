// fix-period-219.js - 修复期号219的结算错误
import db from './db/config.js';

async function fixPeriod219() {
    console.log('🔧 修复期号 20250714219 的结算错误...\n');
    
    try {
        // 开始事务
        await db.tx(async t => {
            console.log('📊 修复前状态检查：');
            
            // 1. 获取用户当前余额
            const member = await t.one(`
                SELECT id, balance FROM members
                WHERE username = 'justin111'
            `);
            
            console.log(`用户当前余额: $${member.balance}`);
            
            // 2. 修复投注ID 1652 (3号投注，错误判为中奖)
            console.log('\n🔧 修复投注ID 1652 (投注3号，错误判为中奖):');
            
            const bet1652 = await t.one(`
                SELECT * FROM bet_history WHERE id = 1652
            `);
            
            console.log(`当前状态: win=${bet1652.win}, win_amount=${bet1652.win_amount}`);
            
            // 将此注单改为未中奖
            await t.none(`
                UPDATE bet_history
                SET win = false, win_amount = 0
                WHERE id = 1652
            `);
            
            // 扣除错误发放的中奖金额
            const newBalance1 = parseFloat(member.balance) - 989.00;
            await t.none(`
                UPDATE members
                SET balance = $1
                WHERE id = $2
            `, [newBalance1, member.id]);
            
            // 记录调整交易
            await t.none(`
                INSERT INTO transaction_records
                (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                VALUES ('member', $1, 'adjustment', $2, $3, $4, $5, NOW())
            `, [member.id, -989.00, parseFloat(member.balance), newBalance1, '期号 20250714219 投注3号错误中奖调整']);
            
            console.log(`✅ 投注3号改为未中奖，扣除 $989.00`);
            console.log(`余额: $${member.balance} → $${newBalance1}`);
            
            // 3. 修复投注ID 1654 (2号投注，错误判为未中奖)
            console.log('\n🔧 修复投注ID 1654 (投注2号，错误判为未中奖):');
            
            const bet1654 = await t.one(`
                SELECT * FROM bet_history WHERE id = 1654
            `);
            
            console.log(`当前状态: win=${bet1654.win}, win_amount=${bet1654.win_amount}`);
            
            // 将此注单改为中奖
            await t.none(`
                UPDATE bet_history
                SET win = true, win_amount = 989.00
                WHERE id = 1654
            `);
            
            // 增加应得的中奖金额
            const finalBalance = newBalance1 + 989.00;
            await t.none(`
                UPDATE members
                SET balance = $1
                WHERE id = $2
            `, [finalBalance, member.id]);
            
            // 记录中奖交易
            await t.none(`
                INSERT INTO transaction_records
                (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
            `, [member.id, 989.00, newBalance1, finalBalance, '期号 20250714219 投注2号中奖补发']);
            
            console.log(`✅ 投注2号改为中奖，增加 $989.00`);
            console.log(`余额: $${newBalance1} → $${finalBalance}`);
            
            // 4. 验证修复结果
            console.log('\n📊 修复后验证：');
            
            const verifyBets = await t.any(`
                SELECT id, bet_value, win, win_amount
                FROM bet_history
                WHERE period = 20250714219
                AND bet_type = 'number'
                AND position = 7
                ORDER BY id
            `);
            
            console.log('第7名所有投注结果:');
            verifyBets.forEach(bet => {
                const shouldWin = bet.bet_value === '2'; // 第7名开出2号
                const status = bet.win === shouldWin ? '✅' : '❌';
                console.log(`${status} ID ${bet.id}: 投注${bet.bet_value}号, ${bet.win ? '中奖' : '未中奖'} $${bet.win_amount || 0}`);
            });
            
            const finalMember = await t.one(`
                SELECT balance FROM members WHERE username = 'justin111'
            `);
            
            console.log(`\n最终余额: $${finalMember.balance}`);
            console.log(`净变化: $${parseFloat(finalMember.balance) - parseFloat(member.balance)} (应该是 $0.00)`);
        });
        
        console.log('\n✅ 期号219结算错误修复完成！');
        
    } catch (error) {
        console.error('修复过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行修复
fixPeriod219();