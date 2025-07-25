// check-period-431-sum.js - 检查期号 431 的冠亚和结算
import db from './db/config.js';
import { checkBetWinEnhanced } from './enhanced-settlement-system.js';

async function checkPeriod431() {
    const period = '20250718431';
    
    try {
        console.log(`检查期号 ${period} 的冠亚和结算问题...`);
        
        // 1. 查询开奖结果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            console.error('找不到开奖结果');
            return;
        }
        
        console.log('\n开奖结果：');
        console.log(`冠军: ${drawResult.position_1}号`);
        console.log(`亚军: ${drawResult.position_2}号`);
        const sum = drawResult.position_1 + drawResult.position_2;
        console.log(`冠亚和: ${drawResult.position_1} + ${drawResult.position_2} = ${sum}`);
        console.log(`冠亚和单双: ${sum % 2 === 1 ? '单' : '双'}`);
        
        // 2. 查询冠亚和投注
        const sumBets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = $1 
            AND (bet_type = 'sum' OR bet_type = 'sumValue' OR bet_type = '冠亚和')
            AND (bet_value = '单' OR bet_value = 'odd')
            ORDER BY id
        `, [period]);
        
        console.log(`\n找到 ${sumBets.length} 笔冠亚和单的投注`);
        
        // 3. 显示每笔投注的结算结果
        console.log('\n投注详情：');
        for (const bet of sumBets) {
            console.log(`\nID ${bet.id}:`);
            console.log(`  用户: ${bet.username}`);
            console.log(`  投注类型: ${bet.bet_type}`);
            console.log(`  投注值: ${bet.bet_value}`);
            console.log(`  金额: $${bet.amount}`);
            console.log(`  系统结算: ${bet.win ? '✓赢' : '✗输'}, 派彩$${bet.win_amount || 0}`);
            
            // 重新检查结算逻辑
            const positions = [
                drawResult.position_1,
                drawResult.position_2,
                drawResult.position_3,
                drawResult.position_4,
                drawResult.position_5,
                drawResult.position_6,
                drawResult.position_7,
                drawResult.position_8,
                drawResult.position_9,
                drawResult.position_10
            ];
            
            const winCheck = await checkBetWinEnhanced(bet, { positions });
            console.log(`  重新检查: ${winCheck.isWin ? '✓应该赢' : '✗应该输'}`);
            console.log(`  原因: ${winCheck.reason}`);
            
            if (bet.win !== winCheck.isWin) {
                console.log(`  ⚠️ 结算错误！系统判定${bet.win ? '赢' : '输'}，但应该${winCheck.isWin ? '赢' : '输'}`);
            }
        }
        
        // 4. 分析问题
        console.log('\n\n问题分析：');
        console.log(`冠亚和 = ${sum} (${sum % 2 === 1 ? '单' : '双'})`);
        console.log(`- 投注「单」应该${sum % 2 === 1 ? '中奖' : '不中'}`);
        console.log(`- 投注「双」应该${sum % 2 === 0 ? '中奖' : '不中'}`);
        
        // 5. 查看 checkTwoSidesBet 函数的逻辑
        console.log('\n\n检查 checkTwoSidesBet 函数逻辑：');
        console.log('当 betType = "冠亚和" 且 betValue = "单" 时：');
        console.log(`- isSumBet = true (因为 betType === '冠亚和')`);
        console.log(`- 执行: isWin = winningNumber % 2 === 1`);
        console.log(`- 冠亚和${sum} % 2 = ${sum % 2}`);
        console.log(`- 应该返回: ${sum % 2 === 1 ? 'true (赢)' : 'false (输)'}`);
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        process.exit();
    }
}

checkPeriod431();