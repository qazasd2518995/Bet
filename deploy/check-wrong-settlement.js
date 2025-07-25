// check-wrong-settlement.js - 检查错误的结算
import db from './db/config.js';

async function checkWrongSettlement() {
    console.log('🔍 检查投注结算问题...\n');
    
    try {
        // 1. 查询期号 20250714203 的开奖结果
        const result = await db.oneOrNone(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714203
        `);
        
        if (!result) {
            console.log('找不到期号 20250714203 的开奖结果');
            return;
        }
        
        console.log(`期号: ${result.period}`);
        console.log(`开奖时间: ${result.created_at}`);
        
        // 解析开奖结果
        let positions = [];
        try {
            const resultObj = JSON.parse(result.result);
            positions = resultObj.positions || resultObj;
        } catch (e) {
            // 尝试其他解析方式
            if (result.result.includes('positions')) {
                const match = result.result.match(/"positions":\s*\[([^\]]+)\]/);
                if (match) {
                    positions = match[1].split(',').map(n => parseInt(n.trim()));
                }
            }
        }
        
        if (positions.length > 0) {
            console.log('\n开奖结果（各名次号码）：');
            positions.forEach((num, idx) => {
                console.log(`第${idx + 1}名: ${num}${idx === 2 && num === 7 ? ' ✅ (第3名是7号!)' : ''}`);
            });
        }
        
        // 2. 查询该期的投注记录
        const bet = await db.oneOrNone(`
            SELECT *
            FROM bet_history
            WHERE period = 20250714203
            AND username = 'justin111'
            AND bet_type = 'number'
            AND bet_value = '7'
            AND position = 3
        `);
        
        if (bet) {
            console.log('\n投注资讯：');
            console.log(`投注ID: ${bet.id}`);
            console.log(`投注内容: 第${bet.position}名 = ${bet.bet_value}号`);
            console.log(`投注金额: ${bet.amount} 元`);
            console.log(`赔率: ${bet.odds}`);
            console.log(`结算状态: ${bet.settled ? '已结算' : '未结算'}`);
            console.log(`中奖状态: ${bet.win ? '✅ 中奖' : '❌ 未中奖'}`);
            console.log(`中奖金额: ${bet.win_amount || 0} 元`);
            
            // 检查是否应该中奖
            if (positions.length > 2 && positions[2] === 7 && !bet.win) {
                console.log('\n⚠️ 发现问题！');
                console.log('第3名确实开出7号，但系统判定为未中奖');
                console.log('这是一个结算错误，需要修正');
                
                // 检查结算逻辑
                console.log('\n可能的原因：');
                console.log('1. 结算系统的位置索引可能有误（0-based vs 1-based）');
                console.log('2. 号码比对逻辑可能有问题');
                console.log('3. 数据类型不匹配（字串 vs 数字）');
            }
        } else {
            console.log('\n找不到符合的投注记录');
        }
        
        // 3. 检查该期所有中奖的投注
        const winners = await db.any(`
            SELECT bet_type, bet_value, position, amount, win_amount
            FROM bet_history
            WHERE period = 20250714203
            AND win = true
            ORDER BY win_amount DESC
        `);
        
        if (winners.length > 0) {
            console.log(`\n该期共有 ${winners.length} 注中奖：`);
            winners.forEach(w => {
                if (w.position) {
                    console.log(`- ${w.bet_type}: 第${w.position}名=${w.bet_value}, 中奖${w.win_amount}元`);
                } else {
                    console.log(`- ${w.bet_type}: ${w.bet_value}, 中奖${w.win_amount}元`);
                }
            });
        }
        
    } catch (error) {
        console.error('检查过程中发生错误:', error);
    } finally {
        await db.$pool.end();
    }
}

// 执行检查
checkWrongSettlement();