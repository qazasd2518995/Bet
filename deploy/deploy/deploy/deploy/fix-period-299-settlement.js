// fix-period-299-settlement.js - 修復期號299的結算錯誤
import db from './db/config.js';

async function fixPeriod299Settlement() {
    try {
        console.log('🔧 修復期號299的結算錯誤...\n');
        
        // 應該中獎的投注ID列表
        const shouldWinBets = [
            { id: 1923, bet_type: 'champion', bet_value: 'odd', position_value: 5 },
            { id: 1925, bet_type: 'third', bet_value: 'odd', position_value: 3 },
            { id: 1927, bet_type: 'fifth', bet_value: 'odd', position_value: 9 },
            { id: 1930, bet_type: 'ninth', bet_value: 'odd', position_value: 7 },
            { id: 1932, bet_type: 'tenth', bet_value: 'odd', position_value: 1 },
            { id: 1934, bet_type: 'runnerup', bet_value: 'even', position_value: 2 },
            { id: 1936, bet_type: 'fourth', bet_value: 'even', position_value: 6 },
            { id: 1938, bet_type: 'sixth', bet_value: 'even', position_value: 4 },
            { id: 1939, bet_type: 'eighth', bet_value: 'even', position_value: 8 },
            { id: 1940, bet_type: 'seventh', bet_value: 'even', position_value: 10 }
        ];
        
        const winAmount = 198; // 100 × 1.98
        const totalCompensation = shouldWinBets.length * winAmount;
        
        console.log(`需要修正的投注: ${shouldWinBets.length}筆`);
        console.log(`每筆中獎金額: $${winAmount}`);
        console.log(`總補償金額: $${totalCompensation}\n`);
        
        // 獲取用戶當前餘額
        const member = await db.one('SELECT id, balance FROM members WHERE username = \'justin111\'');
        console.log(`用戶當前餘額: $${member.balance}`);
        
        // 在事務中執行所有修正
        await db.tx(async t => {
            console.log('開始修正投注記錄...\n');
            
            // 修正每個應該中獎的投注
            for (const bet of shouldWinBets) {
                await t.none(`
                    UPDATE bet_history 
                    SET win = true, win_amount = $1
                    WHERE id = $2
                `, [winAmount, bet.id]);
                
                console.log(`✅ 已修正投注ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} (開出${bet.position_value}) -> 中獎 $${winAmount}`);
            }
            
            // 更新用戶餘額
            const newBalance = parseFloat(member.balance) + totalCompensation;
            await t.none(`
                UPDATE members 
                SET balance = $1 
                WHERE id = $2
            `, [newBalance, member.id]);
            
            console.log(`\n✅ 餘額已更新: $${member.balance} → $${newBalance}`);
            
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
                `期號299結算錯誤補償 - 修正${shouldWinBets.length}筆中獎投注`
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
        `, [shouldWinBets.map(b => b.id)]);
        
        console.log('\n修正後的投注狀態:');
        let verifiedCount = 0;
        correctedBets.forEach(bet => {
            const correct = bet.win === true && parseFloat(bet.win_amount) === winAmount;
            if (correct) verifiedCount++;
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
        
        // 最終統計
        const finalStats = await db.one(`
            SELECT 
                COUNT(*) as total_bets,
                SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as winning_bets,
                SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_winnings
            FROM bet_history 
            WHERE period = 20250714299 AND username = 'justin111'
        `);
        
        console.log('\n📊 期號299最終統計:');
        console.log(`總投注數: ${finalStats.total_bets}`);
        console.log(`中獎投注數: ${finalStats.winning_bets}`);
        console.log(`總中獎金額: $${finalStats.total_winnings}`);
        
        if (verifiedCount === shouldWinBets.length && balanceCorrect) {
            console.log('\n🎉 期號299結算錯誤修復成功!');
            console.log(`✅ 已修正 ${shouldWinBets.length} 個錯誤投注`);
            console.log(`✅ 已補償 $${totalCompensation} 到用戶帳戶`);
        } else {
            console.log('\n⚠️ 修復可能未完全成功，請檢查');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('修復過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

fixPeriod299Settlement();