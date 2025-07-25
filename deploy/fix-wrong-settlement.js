// fix-wrong-settlement.js - 修正错误的结算
import db from './db/config.js';

async function fixWrongSettlement() {
    console.log('🔧 修正错误的结算...\n');
    
    try {
        // 开始事务
        await db.tx(async t => {
            // 1. 查询投注记录
            const bet = await t.one(`
                SELECT * FROM bet_history
                WHERE id = 1645
            `);
            
            console.log('找到投注记录：');
            console.log(`期号: ${bet.period}`);
            console.log(`投注: 第${bet.position}名 = ${bet.bet_value}号`);
            console.log(`金额: ${bet.amount}`);
            console.log(`当前状态: ${bet.win ? '中奖' : '未中奖'}`);
            
            // 2. 确认开奖结果
            const result = await t.one(`
                SELECT result FROM result_history
                WHERE period = 20250714203
            `);
            
            // 解析结果（已知是数组格式）
            const positions = result.result;
            console.log(`\n开奖结果: ${positions}`);
            console.log(`第${bet.position}名: ${positions[bet.position - 1]}`);
            
            // 3. 确认应该中奖
            if (positions[bet.position - 1] == bet.bet_value) {
                console.log('\n✅ 确认：这注应该中奖！');
                
                // 4. 计算中奖金额
                const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
                console.log(`中奖金额: ${winAmount} (${bet.amount} × ${bet.odds})`);
                
                // 5. 更新投注记录
                await t.none(`
                    UPDATE bet_history
                    SET win = true, win_amount = $1
                    WHERE id = $2
                `, [winAmount, bet.id]);
                
                // 6. 获取用户当前余额
                const member = await t.one(`
                    SELECT id, balance FROM members
                    WHERE username = $1
                `, [bet.username]);
                
                const oldBalance = parseFloat(member.balance);
                const newBalance = oldBalance + winAmount;
                
                // 7. 更新用户余额
                await t.none(`
                    UPDATE members
                    SET balance = $1
                    WHERE id = $2
                `, [newBalance, member.id]);
                
                // 8. 记录交易
                await t.none(`
                    INSERT INTO transaction_records
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
                `, [member.id, winAmount, oldBalance, newBalance, `期号 ${bet.period} 中奖（修正）`]);
                
                console.log(`\n修正完成：`);
                console.log(`余额: ${oldBalance} → ${newBalance} (+${winAmount})`);
            } else {
                console.log('\n❌ 这注确实不应该中奖');
            }
        });
        
        console.log('\n✅ 修正完成！');
        
    } catch (error) {
        console.error('修正过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行修正
fixWrongSettlement();