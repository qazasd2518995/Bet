// analyze-period-734-issue.js - 分析期号 734 赢控制逻辑问题
import db from './db/config.js';

async function analyzePeriod734Issue() {
    try {
        console.log('分析期号 20250717734 赢控制逻辑问题...\n');
        
        // 1. 查询开奖结果
        const drawResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   draw_time
            FROM result_history 
            WHERE period = $1
        `, ['20250717734']);
        
        if (drawResult) {
            console.log('开奖结果：');
            console.log(`期号: ${drawResult.period}`);
            console.log(`第1名(冠军): ${drawResult.position_1}号`);
            
            const champion = drawResult.position_1;
            console.log('\n冠军分析：');
            console.log(`冠军号码: ${champion}`);
            console.log(`是否为大: ${champion >= 6 ? '是（大）' : '否（小）'}`);
            console.log(`是否为单: ${champion % 2 === 1 ? '是（单）' : '否（双）'}`);
            
            // 2. 查询用户的下注
            const bets = await db.manyOrNone(`
                SELECT id, username, bet_type, bet_value, position, 
                       amount, odds, win, win_amount, settled
                FROM bet_history
                WHERE period = $1 AND username = 'justin111'
                ORDER BY id
            `, ['20250717734']);
            
            console.log(`\n\n找到 ${bets.length} 笔下注记录：`);
            bets.forEach((bet, idx) => {
                console.log(`\n${idx + 1}. ID:${bet.id}`);
                console.log(`   类型: ${bet.bet_type}`);
                console.log(`   选项: ${bet.bet_value}`);
                console.log(`   金额: $${bet.amount}`);
                console.log(`   中奖: ${bet.win ? '是' : '否'}`);
                
                // 分析应该的结果
                if (bet.bet_type === 'champion') {
                    let shouldWin = false;
                    if (bet.bet_value === 'big' || bet.bet_value === '大') {
                        shouldWin = champion >= 6;
                    } else if (bet.bet_value === 'small' || bet.bet_value === '小') {
                        shouldWin = champion <= 5;
                    } else if (bet.bet_value === 'odd' || bet.bet_value === '单') {
                        shouldWin = champion % 2 === 1;
                    } else if (bet.bet_value === 'even' || bet.bet_value === '双') {
                        shouldWin = champion % 2 === 0;
                    }
                    
                    console.log(`   应该中奖: ${shouldWin ? '是' : '否'}`);
                    
                    if (bet.win !== shouldWin) {
                        console.log(`   ❌ 结算正确但控制逻辑错误！`);
                    }
                }
            });
            
            console.log('\n\n问题分析：');
            console.log('1. 系统说要让用户赢（10%机率），但开出的结果让用户输了');
            console.log('2. 用户下注：冠军小、冠军单');
            console.log('3. 开奖结果：冠军10号（大且双）');
            console.log('4. 结果：两注都输');
            console.log('\n原因：generateWinningResultFixed 函数只处理了数字类型的投注，');
            console.log('      没有处理大小单双类型的投注，导致赢控制失效。');
            
        } else {
            console.log('❌ 找不到期号 20250717734 的开奖结果');
        }
        
    } catch (error) {
        console.error('分析错误:', error);
    } finally {
        process.exit();
    }
}

analyzePeriod734Issue();