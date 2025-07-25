// check-period-720-settlement.js - 检查期号 720 的结算问题
import db from './db/config.js';

async function checkPeriod720Settlement() {
    try {
        console.log('检查期号 20250717720 的结算问题...\n');
        
        // 1. 查询开奖结果
        const drawResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   result,
                   draw_time
            FROM result_history 
            WHERE period = $1
        `, ['20250717720']);
        
        if (drawResult) {
            console.log('开奖结果：');
            console.log('期号:', drawResult.period);
            console.log('开奖时间:', drawResult.draw_time);
            console.log('\n各位置的号码：');
            console.log(`第1名(冠军): ${drawResult.position_1}号`);
            console.log(`第2名(亚军): ${drawResult.position_2}号`);
            console.log(`第3名(季军): ${drawResult.position_3}号`);
            
            const champion = drawResult.position_1;
            console.log('\n冠军分析：');
            console.log(`冠军号码: ${champion}`);
            console.log(`是否为大: ${champion >= 6 ? '是（大）' : '否（小）'} (6-10为大)`);
            console.log(`是否为单: ${champion % 2 === 1 ? '是（单）' : '否（双）'} (奇数为单)`);
            
            // 2. 查询相关的下注记录
            const bets = await db.manyOrNone(`
                SELECT id, username, bet_type, bet_value, position, 
                       amount, odds, win, win_amount, settled, 
                       created_at, settled_at
                FROM bet_history
                WHERE period = $1 AND username = 'justin111'
                ORDER BY id
            `, ['20250717720']);
            
            console.log(`\n\n找到 ${bets.length} 笔下注记录：`);
            bets.forEach((bet, idx) => {
                console.log(`\n${idx + 1}. ID:${bet.id}`);
                console.log(`   类型: ${bet.bet_type}`);
                console.log(`   选项: ${bet.bet_value}`);
                console.log(`   金额: $${bet.amount}`);
                console.log(`   赔率: ${bet.odds}`);
                console.log(`   已结算: ${bet.settled ? '是' : '否'}`);
                console.log(`   中奖: ${bet.win ? '是' : '否'}`);
                console.log(`   派彩: $${bet.win_amount || 0}`);
                
                // 判断是否应该中奖
                if (bet.bet_type === 'champion') {
                    let shouldWin = false;
                    if (bet.bet_value === 'big' || bet.bet_value === '大') {
                        shouldWin = champion >= 6;
                        console.log(`   应该中奖: ${shouldWin ? '是' : '否'} (冠军${champion} ${shouldWin ? '≥' : '<'} 6)`);
                    } else if (bet.bet_value === 'small' || bet.bet_value === '小') {
                        shouldWin = champion <= 5;
                        console.log(`   应该中奖: ${shouldWin ? '是' : '否'} (冠军${champion} ${shouldWin ? '≤' : '>'} 5)`);
                    } else if (bet.bet_value === 'odd' || bet.bet_value === '单') {
                        shouldWin = champion % 2 === 1;
                        console.log(`   应该中奖: ${shouldWin ? '是' : '否'} (冠军${champion} ${shouldWin ? '是' : '不是'}奇数)`);
                    } else if (bet.bet_value === 'even' || bet.bet_value === '双') {
                        shouldWin = champion % 2 === 0;
                        console.log(`   应该中奖: ${shouldWin ? '是' : '否'} (冠军${champion} ${shouldWin ? '是' : '不是'}偶数)`);
                    }
                    
                    if (shouldWin !== bet.win) {
                        console.log(`   ❌ 错误！系统判定为${bet.win ? '赢' : '输'}，但应该是${shouldWin ? '赢' : '输'}`);
                    }
                }
            });
            
            // 3. 查询结算记录
            const settlementLogs = await db.manyOrNone(`
                SELECT *
                FROM settlement_logs
                WHERE period = $1
                ORDER BY created_at
            `, ['20250717720']);
            
            console.log(`\n\n结算日志 (${settlementLogs.length} 笔)：`);
            settlementLogs.forEach(log => {
                console.log(`时间: ${log.created_at}`);
                console.log(`已结算数: ${log.settled_count}`);
                console.log(`总派彩: ${log.total_win_amount}`);
                console.log(`状态: ${log.status || 'N/A'}`);
            });
            
        } else {
            console.log('❌ 找不到期号 20250717720 的开奖结果');
        }
        
    } catch (error) {
        console.error('检查错误:', error);
    } finally {
        process.exit();
    }
}

checkPeriod720Settlement();