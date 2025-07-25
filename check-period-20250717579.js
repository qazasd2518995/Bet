// check-period-20250717579.js - 检查期号 20250717579 的结算错误
import db from './db/config.js';

async function checkPeriod579() {
    console.log('=== 检查期号 20250717579 ===\n');
    
    try {
        // 1. 检查开奖结果
        console.log('1. 开奖结果:');
        const result = await db.oneOrNone(`
            SELECT 
                period,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                result,
                draw_time
            FROM result_history
            WHERE period = '20250717579'
        `);
        
        if (result) {
            console.log(`期号: ${result.period}`);
            console.log(`开奖时间: ${result.draw_time}`);
            console.log(`开奖结果:`);
            for (let i = 1; i <= 10; i++) {
                const pos = result[`position_${i}`];
                console.log(`  第${i}名: ${pos}号`);
            }
            console.log(`JSON结果: ${result.result}`);
            console.log(`\n冠军号码: ${result.position_1} (${result.position_1 >= 6 ? '大' : '小'})`);
        } else {
            console.log('找不到该期开奖结果！');
        }
        
        // 2. 检查相关投注
        console.log('\n2. 相关投注记录:');
        const bets = await db.manyOrNone(`
            SELECT 
                id, username, bet_type, bet_value, position,
                amount, odds, win, win_amount, settled,
                created_at, settled_at
            FROM bet_history
            WHERE period = '20250717579'
            AND (
                (bet_type = '冠军' AND bet_value IN ('大', '小'))
                OR (bet_type = 'champion' AND bet_value IN ('big', 'small'))
                OR (bet_type = 'number' AND position = '1')
            )
            ORDER BY created_at
        `);
        
        if (bets && bets.length > 0) {
            console.log(`找到 ${bets.length} 笔相关投注：`);
            for (const bet of bets) {
                console.log(`\n投注ID: ${bet.id}`);
                console.log(`  用户: ${bet.username}`);
                console.log(`  类型: ${bet.bet_type}`);
                console.log(`  内容: ${bet.bet_value}`);
                console.log(`  位置: ${bet.position || 'N/A'}`);
                console.log(`  金额: ${bet.amount}`);
                console.log(`  赔率: ${bet.odds}`);
                console.log(`  已结算: ${bet.settled ? '是' : '否'}`);
                console.log(`  中奖: ${bet.win ? '是' : '否'}`);
                console.log(`  派彩: ${bet.win_amount || 0}`);
                console.log(`  下注时间: ${bet.created_at}`);
                console.log(`  结算时间: ${bet.settled_at || 'N/A'}`);
            }
        } else {
            console.log('没有找到相关投注记录');
        }
        
        // 3. 检查结算日志
        console.log('\n3. 结算日志:');
        const logs = await db.manyOrNone(`
            SELECT 
                id, status, message, details, created_at
            FROM settlement_logs
            WHERE period = '20250717579'
            ORDER BY created_at
        `);
        
        if (logs && logs.length > 0) {
            console.log(`找到 ${logs.length} 笔结算日志：`);
            for (const log of logs) {
                console.log(`\n日志ID: ${log.id}`);
                console.log(`  状态: ${log.status}`);
                console.log(`  讯息: ${log.message}`);
                console.log(`  详情: ${log.details}`);
                console.log(`  时间: ${log.created_at}`);
            }
        } else {
            console.log('没有找到结算日志');
        }
        
        // 4. 检查所有"冠军小"的投注
        console.log('\n4. 所有"冠军小"的投注:');
        const smallBets = await db.manyOrNone(`
            SELECT 
                id, username, amount, win, win_amount, settled_at
            FROM bet_history
            WHERE period = '20250717579'
            AND ((bet_type = '冠军' AND bet_value = '小') 
                 OR (bet_type = 'champion' AND bet_value = 'small'))
        `);
        
        if (smallBets && smallBets.length > 0) {
            console.log(`找到 ${smallBets.length} 笔"冠军小"投注：`);
            let totalWrong = 0;
            for (const bet of smallBets) {
                if (bet.win) {
                    totalWrong++;
                    console.log(`❌ 错误结算 - ID: ${bet.id}, 用户: ${bet.username}, 金额: ${bet.amount}, 派彩: ${bet.win_amount}`);
                } else {
                    console.log(`✅ 正确结算 - ID: ${bet.id}, 用户: ${bet.username}, 金额: ${bet.amount}`);
                }
            }
            if (totalWrong > 0) {
                console.log(`\n⚠️ 发现 ${totalWrong} 笔错误结算！`);
            }
        }
        
        // 5. 检查结算时的系统状态
        console.log('\n5. 检查开奖和结算时序:');
        
        // 获取开奖时间
        if (result) {
            const drawTime = new Date(result.draw_time);
            console.log(`开奖时间: ${drawTime.toISOString()}`);
            
            // 获取第一笔结算时间
            const firstSettlement = await db.oneOrNone(`
                SELECT MIN(settled_at) as first_settled
                FROM bet_history
                WHERE period = '20250717579' AND settled = true
            `);
            
            if (firstSettlement?.first_settled) {
                const settlementTime = new Date(firstSettlement.first_settled);
                console.log(`首次结算时间: ${settlementTime.toISOString()}`);
                
                const timeDiff = (settlementTime - drawTime) / 1000;
                console.log(`时间差: ${timeDiff.toFixed(1)} 秒`);
            }
        }
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        await db.$pool.end();
    }
}

checkPeriod579();