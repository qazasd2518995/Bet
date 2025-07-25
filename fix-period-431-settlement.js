// fix-period-431-settlement.js - 修复期号 431 的冠亚和结算错误
import db from './db/config.js';

async function fixPeriod431() {
    const period = '20250718431';
    
    try {
        console.log(`开始修复期号 ${period} 的冠亚和结算错误...`);
        
        // 1. 查询开奖结果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            console.error('找不到开奖结果');
            return;
        }
        
        const sum = drawResult.position_1 + drawResult.position_2;
        console.log(`\n开奖结果：冠军${drawResult.position_1}号 + 亚军${drawResult.position_2}号 = ${sum} (${sum % 2 === 0 ? '双' : '单'})`);
        
        // 2. 查询错误的冠亚和单投注
        const wrongBets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = $1 
            AND (bet_type = 'sum' OR bet_type = 'sumValue' OR bet_type = '冠亚和')
            AND (bet_value = '单' OR bet_value = 'odd')
            AND win = true
        `, [period]);
        
        console.log(`\n找到 ${wrongBets.length} 笔错误结算的冠亚和单投注`);
        
        if (wrongBets.length === 0) {
            console.log('没有需要修复的投注');
            return;
        }
        
        // 3. 修复每笔错误的投注
        for (const bet of wrongBets) {
            console.log(`\n修复投注 ID ${bet.id}:`);
            console.log(`  用户: ${bet.username}`);
            console.log(`  投注: ${bet.bet_type} ${bet.bet_value}`);
            console.log(`  金额: $${bet.amount}`);
            console.log(`  错误派彩: $${bet.win_amount}`);
            
            // 更新投注状态为输
            await db.none(`
                UPDATE bet_history 
                SET win = false, win_amount = 0
                WHERE id = $1
            `, [bet.id]);
            
            // 查询用户当前余额
            const member = await db.oneOrNone(`
                SELECT id, balance FROM members WHERE username = $1
            `, [bet.username]);
            
            if (member) {
                const oldBalance = parseFloat(member.balance);
                const newBalance = oldBalance - parseFloat(bet.win_amount);
                
                console.log(`  修正余额: $${oldBalance} → $${newBalance}`);
                
                // 更新用户余额
                await db.none(`
                    UPDATE members 
                    SET balance = $1
                    WHERE id = $2
                `, [newBalance, member.id]);
                
                // 记录修正交易
                await db.none(`
                    INSERT INTO transaction_records 
                    (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                    VALUES ('member', $1, 'adjustment', $2, $3, $4, $5, NOW())
                `, [
                    member.id,
                    -parseFloat(bet.win_amount),
                    oldBalance,
                    newBalance,
                    `修正期号${period}冠亚和结算错误`
                ]);
                
                console.log(`  ✓ 已修正`);
            } else {
                console.error(`  找不到用户 ${bet.username}`);
            }
        }
        
        console.log('\n修复完成！');
        
    } catch (error) {
        console.error('修复失败:', error);
    } finally {
        process.exit();
    }
}

// 执行修复
fixPeriod431();