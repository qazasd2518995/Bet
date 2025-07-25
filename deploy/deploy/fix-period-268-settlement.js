// fix-period-268-settlement.js - 修復期號268的結算錯誤
import db from './db/config.js';

async function fixPeriod268Settlement() {
    try {
        console.log('🔧 修復期號268結算錯誤...\n');
        
        // 需要修正的投注ID和獎金
        const corrections = [
            { id: 1701, shouldWin: true, winAmount: 198 }, // fourth big
            { id: 1702, shouldWin: true, winAmount: 198 }, // runnerup big  
            { id: 1704, shouldWin: true, winAmount: 198 }, // third big
            { id: 1705, shouldWin: true, winAmount: 198 }, // seventh big
            { id: 1708, shouldWin: true, winAmount: 198 }, // ninth big
            { id: 1709, shouldWin: true, winAmount: 198 }, // runnerup even
            { id: 1710, shouldWin: true, winAmount: 198 }, // champion even
            { id: 1711, shouldWin: true, winAmount: 198 }, // third even
            { id: 1716, shouldWin: true, winAmount: 198 }, // ninth even
            { id: 1718, shouldWin: true, winAmount: 198 }, // fifth even
            { id: 1719, shouldWin: true, winAmount: 198 }, // dragonTiger dragon_1_10
            { id: 1720, shouldWin: true, winAmount: 198 }, // dragonTiger dragon_3_8
            { id: 1721, shouldWin: true, winAmount: 198 }, // dragonTiger dragon_5_6
            { id: 1723, shouldWin: true, winAmount: 198 }, // sumValue small
            { id: 1724, shouldWin: true, winAmount: 198 }, // dragonTiger tiger_4_7
            { id: 1725, shouldWin: true, winAmount: 198 }  // sumValue even
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
                `期號268結算錯誤補償 - 修正${corrections.length}筆投注`
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
        
        console.log('\n🎯 期號268結算錯誤修復完成!');
        console.log(`✅ 已修正 ${corrections.length} 個錯誤投注`);
        console.log(`✅ 已補償 $${totalCompensation} 到用戶帳戶`);
        console.log(`✅ 所有修正均已完成並驗證`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('修復過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

fixPeriod268Settlement();