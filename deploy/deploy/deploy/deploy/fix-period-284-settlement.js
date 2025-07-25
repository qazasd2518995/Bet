// fix-period-284-settlement.js - 修復期號284的結算錯誤
import db from './db/config.js';

async function fixPeriod284Settlement() {
    try {
        console.log('🔧 修復期號284結算錯誤...\n');
        
        // 需要修正的投注ID和獎金
        const corrections = [
            { id: 1844, shouldWin: true, winAmount: 198 }, // runnerup odd (亞軍5號單)
            { id: 1845, shouldWin: true, winAmount: 198 }, // third big (第三名7號大)
            { id: 1848, shouldWin: true, winAmount: 198 }, // third odd (第三名7號單)
            { id: 1852, shouldWin: true, winAmount: 198 }, // fifth big (第五名6號大)
            { id: 1853, shouldWin: true, winAmount: 198 }, // sixth big (第六名10號大)
            { id: 1856, shouldWin: true, winAmount: 198 }, // seventh odd (第七名1號單)
            { id: 1858, shouldWin: true, winAmount: 198 }, // eighth big (第八名8號大)
            { id: 1860, shouldWin: true, winAmount: 198 }, // ninth odd (第九名3號單)
            { id: 1861, shouldWin: true, winAmount: 198 }, // tenth odd (第十名9號單)
            { id: 1862, shouldWin: true, winAmount: 198 }  // tenth big (第十名9號大)
        ];
        
        const totalCompensation = corrections.reduce((sum, c) => sum + c.winAmount, 0);
        console.log(`總共需要修正 ${corrections.length} 個投注`);
        console.log(`總補償金額: $${totalCompensation}\n`);
        
        // 獲取用戶當前餘額
        const member = await db.one('SELECT id, balance FROM members WHERE username = \'justin111\'');
        console.log(`用戶當前餘額: $${member.balance}`);
        
        // 在事務中執行所有修正
        await db.tx(async t => {
            console.log('開始修正投注記錄...');
            
            // 修正每個投注記錄
            for (const correction of corrections) {
                await t.none(`
                    UPDATE bet_history 
                    SET win = $1, win_amount = $2, settled_at = NOW()
                    WHERE id = $3
                `, [correction.shouldWin, correction.winAmount, correction.id]);
                
                console.log(`✅ 已修正投注ID ${correction.id}: 設為中獎 $${correction.winAmount}`);
            }
            
            // 更新用戶餘額
            const newBalance = parseFloat(member.balance) + totalCompensation;
            await t.none(`
                UPDATE members 
                SET balance = $1 
                WHERE id = $2
            `, [newBalance, member.id]);
            
            console.log(`✅ 餘額已更新: $${member.balance} → $${newBalance}`);
            
            // 記錄補償交易
            await t.none(`
                INSERT INTO transaction_records
                (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
                VALUES ('member', $1, 'adjustment', $2, $3, $4, $5, NOW())
            `, [
                member.id, 
                totalCompensation, 
                parseFloat(member.balance), 
                newBalance, 
                `期號284結算錯誤補償 - 修正${corrections.length}筆投注`
            ]);
            
            console.log('✅ 補償交易記錄已保存');
        });
        
        // 驗證修正結果
        console.log('\n🔍 驗證修正結果...');
        
        const correctedBets = await db.any(`
            SELECT id, bet_type, bet_value, win, win_amount 
            FROM bet_history 
            WHERE id = ANY($1)
            ORDER BY id
        `, [corrections.map(c => c.id)]);
        
        console.log('修正後的投注狀態:');
        correctedBets.forEach(bet => {
            const expected = corrections.find(c => c.id === bet.id);
            const correct = bet.win === expected.shouldWin && parseFloat(bet.win_amount) === expected.winAmount;
            console.log(`ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${bet.win ? `中獎 $${bet.win_amount}` : '未中獎'} ${correct ? '✅' : '❌'}`);
        });
        
        // 驗證最終餘額
        const finalMember = await db.one('SELECT balance FROM members WHERE username = \'justin111\'');
        const expectedBalance = parseFloat(member.balance) + totalCompensation;
        const balanceCorrect = Math.abs(parseFloat(finalMember.balance) - expectedBalance) < 0.01;
        
        console.log('\n💳 餘額驗證:');
        console.log(`修正前餘額: $${member.balance}`);
        console.log(`補償金額: $${totalCompensation}`);
        console.log(`預期餘額: $${expectedBalance}`);
        console.log(`實際餘額: $${finalMember.balance}`);
        console.log(`餘額正確: ${balanceCorrect ? '✅' : '❌'}`);
        
        console.log('\n🎯 期號284結算錯誤修復完成!');
        console.log(`✅ 已修正 ${corrections.length} 個錯誤投注`);
        console.log(`✅ 已補償 $${totalCompensation} 到用戶帳戶`);
        console.log(`✅ 第十名9號(大單)的投注已正確設為中獎`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('修復過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

fixPeriod284Settlement();