import db from './db/config.js';

async function fixPeriod579Settlement() {
    try {
        console.log('🔧 修復期號 20250717579 的錯誤結算...\n');
        
        // 1. 確認開獎結果
        const result = await db.oneOrNone(`
            SELECT * FROM result_history 
            WHERE period = '20250717579'
        `);
        
        console.log('正確的開獎結果：');
        console.log(`第1名（冠軍）: ${result.position_1} 號`);
        console.log(`6號是大（6-10是大），是雙（偶數）\n`);
        
        // 2. 查詢用戶當前餘額
        const member = await db.oneOrNone(`
            SELECT balance FROM members 
            WHERE username = 'justin111'
        `);
        
        console.log(`用戶當前餘額: $${member.balance}`);
        
        // 3. 修正錯誤的中獎記錄
        console.log('\n修正錯誤中獎記錄 (ID 3399: 投注小，錯誤中獎)...');
        
        // 更新投注記錄
        await db.none(`
            UPDATE bet_history 
            SET win = false, win_amount = 0.00
            WHERE id = 3399
        `);
        console.log('✅ 投注記錄已修正');
        
        // 4. 扣回錯誤派彩
        const newBalance = parseFloat(member.balance) - 1.98;
        await db.none(`
            UPDATE members 
            SET balance = $1
            WHERE username = 'justin111'
        `, [newBalance]);
        
        console.log(`✅ 已扣回錯誤派彩 $1.98`);
        console.log(`新餘額: $${newBalance}`);
        
        // 5. 添加交易記錄
        await db.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
            SELECT 'member', id, 'adjustment', -1.98, $2, $3, '修正期號20250717579錯誤派彩', NOW()
            FROM members WHERE username = $1
        `, ['justin111', member.balance, newBalance]);
        
        console.log('✅ 交易記錄已添加');
        
        // 6. 驗證修復結果
        console.log('\n驗證修復結果：');
        const bets = await db.manyOrNone(`
            SELECT id, bet_type, bet_value, win, win_amount
            FROM bet_history
            WHERE period = '20250717579' 
            AND username = 'justin111'
            ORDER BY id
        `);
        
        bets.forEach(bet => {
            const correct = (bet.bet_value === 'small' && !bet.win) || (bet.bet_value === 'odd' && !bet.win);
            console.log(`ID ${bet.id}: 投注${bet.bet_value} → ${bet.win ? '中獎' : '未中'} ${correct ? '✅' : '❌'}`);
        });
        
        console.log('\n修復完成！');
        
    } catch (error) {
        console.error('修復失敗:', error);
    } finally {
        process.exit(0);
    }
}

fixPeriod579Settlement();