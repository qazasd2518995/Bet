import db from './db/config.js';

async function fixPeriod579Settlement() {
    try {
        console.log('🔧 修复期号 20250717579 的错误结算...\n');
        
        // 1. 确认开奖结果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717579'
        `);
        
        console.log('正确的开奖结果：');
        console.log(`第1名（冠军）: ${result.position_1} 号`);
        console.log(`6号是大（6-10是大），是双（偶数）\n`);
        
        // 2. 查询用户当前余额
        const member = await db.oneOrNone(`
            SELECT balance FROM members 
            WHERE username = 'justin111'
        `);
        
        console.log(`用户当前余额: $${member.balance}`);
        
        // 3. 修正错误的中奖记录
        console.log('\n修正错误中奖记录 (ID 3399: 投注小，错误中奖)...');
        
        // 更新投注记录
        await db.none(`
            UPDATE bet_history 
            SET win = false, win_amount = 0.00
            WHERE id = 3399
        `);
        console.log('✅ 投注记录已修正');
        
        // 4. 扣回错误派彩
        const newBalance = parseFloat(member.balance) - 1.98;
        await db.none(`
            UPDATE members 
            SET balance = $1
            WHERE username = 'justin111'
        `, [newBalance]);
        
        console.log(`✅ 已扣回错误派彩 $1.98`);
        console.log(`新余额: $${newBalance}`);
        
        // 5. 添加交易记录
        await db.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
            SELECT 'member', id, 'adjustment', -1.98, $2, $3, '修正期号20250717579错误派彩', NOW()
            FROM members WHERE username = $1
        `, ['justin111', member.balance, newBalance]);
        
        console.log('✅ 交易记录已添加');
        
        // 6. 验证修复结果
        console.log('\n验证修复结果：');
        const bets = await db.manyOrNone(`
            SELECT id, bet_type, bet_value, win, win_amount
            FROM bet_history
            WHERE period = '20250717579' 
            AND username = 'justin111'
            ORDER BY id
        `);
        
        bets.forEach(bet => {
            const correct = (bet.bet_value === 'small' && !bet.win) || (bet.bet_value === 'odd' && !bet.win);
            console.log(`ID ${bet.id}: 投注${bet.bet_value} → ${bet.win ? '中奖' : '未中'} ${correct ? '✅' : '❌'}`);
        });
        
        console.log('\n修复完成！');
        
    } catch (error) {
        console.error('修复失败:', error);
    } finally {
        process.exit(0);
    }
}

fixPeriod579Settlement();