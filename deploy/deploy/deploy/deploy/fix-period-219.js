// fix-period-219.js - 修復期號219的結算錯誤
import db from './db/config.js';

async function fixPeriod219() {
    console.log('🔧 修復期號 20250714219 的結算錯誤...\n');
    
    try {
        // 開始事務
        await db.tx(async t => {
            console.log('📊 修復前狀態檢查：');
            
            // 1. 獲取用戶當前餘額
            const member = await t.one(`
                SELECT id, balance FROM members
                WHERE username = 'justin111'
            `);
            
            console.log(`用戶當前餘額: $${member.balance}`);
            
            // 2. 修復投注ID 1652 (3號投注，錯誤判為中獎)
            console.log('\n🔧 修復投注ID 1652 (投注3號，錯誤判為中獎):');
            
            const bet1652 = await t.one(`
                SELECT * FROM bet_history WHERE id = 1652
            `);
            
            console.log(`當前狀態: win=${bet1652.win}, win_amount=${bet1652.win_amount}`);
            
            // 將此注單改為未中獎
            await t.none(`
                UPDATE bet_history
                SET win = false, win_amount = 0
                WHERE id = 1652
            `);
            
            // 扣除錯誤發放的中獎金額
            const newBalance1 = parseFloat(member.balance) - 989.00;
            await t.none(`
                UPDATE members
                SET balance = $1
                WHERE id = $2
            `, [newBalance1, member.id]);
            
            // 記錄調整交易
            await t.none(`
                INSERT INTO transaction_records
                (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                VALUES ('member', $1, 'adjustment', $2, $3, $4, $5, NOW())
            `, [member.id, -989.00, parseFloat(member.balance), newBalance1, '期號 20250714219 投注3號錯誤中獎調整']);
            
            console.log(`✅ 投注3號改為未中獎，扣除 $989.00`);
            console.log(`餘額: $${member.balance} → $${newBalance1}`);
            
            // 3. 修復投注ID 1654 (2號投注，錯誤判為未中獎)
            console.log('\n🔧 修復投注ID 1654 (投注2號，錯誤判為未中獎):');
            
            const bet1654 = await t.one(`
                SELECT * FROM bet_history WHERE id = 1654
            `);
            
            console.log(`當前狀態: win=${bet1654.win}, win_amount=${bet1654.win_amount}`);
            
            // 將此注單改為中獎
            await t.none(`
                UPDATE bet_history
                SET win = true, win_amount = 989.00
                WHERE id = 1654
            `);
            
            // 增加應得的中獎金額
            const finalBalance = newBalance1 + 989.00;
            await t.none(`
                UPDATE members
                SET balance = $1
                WHERE id = $2
            `, [finalBalance, member.id]);
            
            // 記錄中獎交易
            await t.none(`
                INSERT INTO transaction_records
                (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                VALUES ('member', $1, 'win', $2, $3, $4, $5, NOW())
            `, [member.id, 989.00, newBalance1, finalBalance, '期號 20250714219 投注2號中獎補發']);
            
            console.log(`✅ 投注2號改為中獎，增加 $989.00`);
            console.log(`餘額: $${newBalance1} → $${finalBalance}`);
            
            // 4. 驗證修復結果
            console.log('\n📊 修復後驗證：');
            
            const verifyBets = await t.any(`
                SELECT id, bet_value, win, win_amount
                FROM bet_history
                WHERE period = 20250714219
                AND bet_type = 'number'
                AND position = 7
                ORDER BY id
            `);
            
            console.log('第7名所有投注結果:');
            verifyBets.forEach(bet => {
                const shouldWin = bet.bet_value === '2'; // 第7名開出2號
                const status = bet.win === shouldWin ? '✅' : '❌';
                console.log(`${status} ID ${bet.id}: 投注${bet.bet_value}號, ${bet.win ? '中獎' : '未中獎'} $${bet.win_amount || 0}`);
            });
            
            const finalMember = await t.one(`
                SELECT balance FROM members WHERE username = 'justin111'
            `);
            
            console.log(`\n最終餘額: $${finalMember.balance}`);
            console.log(`淨變化: $${parseFloat(finalMember.balance) - parseFloat(member.balance)} (應該是 $0.00)`);
        });
        
        console.log('\n✅ 期號219結算錯誤修復完成！');
        
    } catch (error) {
        console.error('修復過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行修復
fixPeriod219();