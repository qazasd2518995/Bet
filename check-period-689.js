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
            
            console.log('开奖结果:', positions.join(','));
            console.log('\n各位置详细:');
            for (let i = 0; i < 10; i++) {
                console.log(`第${i+1}名: ${positions[i]}`);
            }
            
            console.log(`\n🎯 第10名开出: ${result.position_10}`);
            
            if (result.position_10 === 4) {
                console.log('✅ 第10名确实是4号');
            } else {
                console.log(`❌ 第10名是${result.position_10}号，不是4号`);
            }
        } else {
            console.log('❌ 找不到期号 20250718689 的开奖结果');
        }
        
        // Check bets for this period
        console.log('\n查询相关投注记录...');
        const bets = await db.manyOrNone(
            `SELECT id, username, bet_type, bet_value, position, amount, win_amount, settled 
             FROM bet_history 
             WHERE period = $1 AND bet_type = 'number' AND position = '10' 
             ORDER BY id`,
            ['20250718689']
        );
        
        if (bets.length > 0) {
            console.log(`\n找到 ${bets.length} 笔第10名的投注:`);
            bets.forEach(bet => {
                console.log(`\nBet ID: ${bet.id}`);
                console.log(`用户: ${bet.username}`);
                console.log(`投注: 第${bet.position}名 号码${bet.bet_value}`);
                console.log(`金额: $${bet.amount}`);
                console.log(`派彩: $${bet.win_amount}`);
                console.log(`已结算: ${bet.settled}`);
                
                // 验证结算是否正确
                const isWin = bet.win_amount > 0;
                if (result && result.position_10 == bet.bet_value) {
                    if (isWin) {
                        console.log('✅ 结算正确 - 应该赢且派彩 > 0');
                    } else {
                        console.log('❌ 结算错误 - 应该赢但没有派彩');
                    }
                } else if (result) {
                    if (!isWin) {
                        console.log('✅ 结算正确 - 应该输且没有派彩');
                    } else {
                        console.log('❌ 结算错误 - 应该输但有派彩');
                    }
                }
            });
        } else {
            console.log('没有找到第10名的投注记录');
        }
        
        await db.$pool.end();
        process.exit(0);
    } catch (error) {
        console.error('错误:', error);
        await db.$pool.end();
        process.exit(1);
    }
}

checkPeriod689();