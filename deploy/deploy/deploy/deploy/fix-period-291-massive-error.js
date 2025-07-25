// fix-period-291-massive-error.js - 修復期號291的大規模結算錯誤
import db from './db/config.js';

async function fixPeriod291MassiveError() {
    try {
        console.log('🚨 修復期號291大規模結算錯誤...\n');
        
        // 應該中獎的投注ID列表（基於調查結果）
        const correctWinners = [
            { id: 1867, description: 'champion big (10號)' },
            { id: 1863, description: 'champion even (10號)' },
            { id: 1870, description: 'runnerup big (6號)' },
            { id: 1868, description: 'runnerup even (6號)' },
            { id: 1874, description: 'third small (3號)' },
            { id: 1872, description: 'third odd (3號)' },
            { id: 1878, description: 'fourth small (5號)' },
            { id: 1876, description: 'fourth odd (5號)' },
            { id: 1880, description: 'fifth big (7號)' },
            { id: 1883, description: 'fifth odd (7號)' },
            { id: 1879, description: 'sixth big (8號)' },
            { id: 1886, description: 'sixth even (8號)' },
            { id: 1889, description: 'seventh small (1號)' },
            { id: 1887, description: 'seventh odd (1號)' },
            { id: 1892, description: 'eighth small (4號)' },
            { id: 1896, description: 'eighth even (4號)' },
            { id: 1899, description: 'ninth small (2號)' },
            { id: 1895, description: 'ninth even (2號)' },
            { id: 1901, description: 'tenth big (9號)' },
            { id: 1897, description: 'tenth odd (9號)' }
        ];
        
        const winAmount = 198; // 100 × 1.98
        const totalCompensation = correctWinners.length * winAmount;
        
        console.log(`需要修正的中獎投注: ${correctWinners.length}注`);
        console.log(`總補償金額: $${totalCompensation}\n`);
        
        // 獲取用戶當前餘額
        const member = await db.one('SELECT id, balance FROM members WHERE username = \'justin111\'');
        console.log(`用戶當前餘額: $${member.balance}`);
        
        // 在事務中執行所有修正
        await db.tx(async t => {
            console.log('開始大規模修正投注記錄...');
            
            // 修正每個應該中獎的投注
            for (const winner of correctWinners) {
                await t.none(`
                    UPDATE bet_history 
                    SET win = true, win_amount = $1, settled_at = NOW()
                    WHERE id = $2
                `, [winAmount, winner.id]);
                
                console.log(`✅ 已修正投注ID ${winner.id}: ${winner.description} -> 中獎 $${winAmount}`);
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
                `期號291大規模結算錯誤補償 - 修正${correctWinners.length}筆中獎投注`
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
        `, [correctWinners.map(w => w.id)]);
        
        console.log('\n修正後的投注狀態:');
        let verifiedCount = 0;
        correctedBets.forEach(bet => {
            const expected = correctWinners.find(w => w.id === bet.id);
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
            WHERE period = 20250714291 AND username = 'justin111'
        `);
        
        console.log('\n📊 期號291最終統計:');
        console.log(`總投注數: ${finalStats.total_bets}`);
        console.log(`中獎投注數: ${finalStats.winning_bets}`);
        console.log(`總中獎金額: $${finalStats.total_winnings}`);
        
        console.log('\n🎯 期號291大規模結算錯誤修復完成!');
        console.log(`✅ 已修正 ${correctWinners.length} 個錯誤投注`);
        console.log(`✅ 已補償 $${totalCompensation} 到用戶帳戶`);
        console.log(`✅ 用戶應有的中獎已全部恢復`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('修復過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

fixPeriod291MassiveError();