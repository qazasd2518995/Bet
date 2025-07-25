import db from './db/config.js';

async function checkPeriod689() {
    try {
        console.log('Checking period 20250718689...\n');
        
        // Get draw result
        const result = await db.oneOrNone(
            'SELECT * FROM result_history WHERE period = $1',
            ['20250718689']
        );
        
        if (result) {
            console.log('✅ Found draw result for period 20250718689:');
            const positions = [
                result.position_1, result.position_2, result.position_3,
                result.position_4, result.position_5, result.position_6,
                result.position_7, result.position_8, result.position_9,
                result.position_10
            ];
            
            console.log('開獎結果:', positions.join(','));
            console.log('\n各位置詳細:');
            for (let i = 0; i < 10; i++) {
                console.log(`第${i+1}名: ${positions[i]}`);
            }
            
            console.log(`\n🎯 第10名開出: ${result.position_10}`);
            
            if (result.position_10 === 4) {
                console.log('✅ 第10名確實是4號');
            } else {
                console.log(`❌ 第10名是${result.position_10}號，不是4號`);
            }
        } else {
            console.log('❌ 找不到期號 20250718689 的開獎結果');
        }
        
        // Check bets for this period
        console.log('\n查詢相關投注記錄...');
        const bets = await db.manyOrNone(
            `SELECT id, username, bet_type, bet_value, position, amount, win_amount, settled 
             FROM bet_history 
             WHERE period = $1 AND bet_type = 'number' AND position = '10' 
             ORDER BY id`,
            ['20250718689']
        );
        
        if (bets.length > 0) {
            console.log(`\n找到 ${bets.length} 筆第10名的投注:`);
            bets.forEach(bet => {
                console.log(`\nBet ID: ${bet.id}`);
                console.log(`用戶: ${bet.username}`);
                console.log(`投注: 第${bet.position}名 號碼${bet.bet_value}`);
                console.log(`金額: $${bet.amount}`);
                console.log(`派彩: $${bet.win_amount}`);
                console.log(`已結算: ${bet.settled}`);
                
                // 驗證結算是否正確
                const isWin = bet.win_amount > 0;
                if (result && result.position_10 == bet.bet_value) {
                    if (isWin) {
                        console.log('✅ 結算正確 - 應該贏且派彩 > 0');
                    } else {
                        console.log('❌ 結算錯誤 - 應該贏但沒有派彩');
                    }
                } else if (result) {
                    if (!isWin) {
                        console.log('✅ 結算正確 - 應該輸且沒有派彩');
                    } else {
                        console.log('❌ 結算錯誤 - 應該輸但有派彩');
                    }
                }
            });
        } else {
            console.log('沒有找到第10名的投注記錄');
        }
        
        await db.$pool.end();
        process.exit(0);
    } catch (error) {
        console.error('錯誤:', error);
        await db.$pool.end();
        process.exit(1);
    }
}

checkPeriod689();