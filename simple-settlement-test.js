// simple-settlement-test.js - 简单测试结算系统
import db from './db/config.js';

async function simpleSettlementTest() {
    try {
        console.log('🧪 检查结算系统状况...\n');
        
        // 检查最近的号码投注是否正确结算
        const recentNumberBets = await db.any(`
            SELECT b.id, b.period, b.bet_type, b.bet_value, b.position, 
                   b.win, b.win_amount, b.amount, b.odds,
                   rh.result
            FROM bet_history b
            LEFT JOIN result_history rh ON b.period = rh.period
            WHERE b.bet_type = 'number' 
                AND b.period >= 20250714400 
                AND b.settled = true
                AND b.username = 'justin111'
            ORDER BY b.period DESC, b.id
            LIMIT 20
        `);
        
        console.log('最近的号码投注检查:');
        let correctCount = 0;
        let incorrectCount = 0;
        
        recentNumberBets.forEach(bet => {
            if (bet.result && Array.isArray(bet.result) && bet.position) {
                const positionIndex = parseInt(bet.position) - 1;
                const actualNumber = bet.result[positionIndex];
                const betNumber = parseInt(bet.bet_value);
                const shouldWin = actualNumber === betNumber;
                
                const isCorrect = bet.win === shouldWin;
                if (isCorrect) {
                    correctCount++;
                } else {
                    incorrectCount++;
                }
                
                const status = isCorrect ? '✅' : '❌';
                console.log(`${status} 期号${bet.period}, 位置${bet.position}, 投注${betNumber}, 开出${actualNumber}, 标记${bet.win ? '中' : '未中'}, 派彩${bet.win_amount}`);
                
                if (!isCorrect) {
                    const expectedWinAmount = shouldWin ? bet.amount * bet.odds : 0;
                    console.log(`   应该: ${shouldWin ? '中奖' : '未中奖'}, 派彩应为: ${expectedWinAmount}`);
                }
            }
        });
        
        console.log(`\n统计: 正确 ${correctCount} 笔, 错误 ${incorrectCount} 笔`);
        
        if (incorrectCount > 0) {
            console.log('\n❌ 发现结算错误，需要修正结算逻辑');
        } else {
            console.log('\n✅ 结算系统工作正常');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('测试过程中发生错误:', error);
        await db.$pool.end();
    }
}

simpleSettlementTest();