// fix-period-406-settlement.js - 修复期号 406 的结算
import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function fixPeriod406() {
    const period = '20250718406';
    
    try {
        console.log(`开始修复期号 ${period} 的结算...`);
        
        // 1. 查询开奖结果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            console.error('找不到开奖结果');
            return;
        }
        
        console.log('\n开奖结果：');
        console.log(`第1名: ${drawResult.position_1}号`);
        console.log(`第2名: ${drawResult.position_2}号`);
        console.log(`冠亚和: ${drawResult.position_1} + ${drawResult.position_2} = ${drawResult.position_1 + drawResult.position_2}`);
        
        // 2. 查询该期所有投注
        const bets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = $1 AND username = 'justin111'
            ORDER BY id
        `, [period]);
        
        console.log(`\n找到 ${bets.length} 笔投注`);
        
        // 3. 显示原始结算结果
        console.log('\n原始结算结果：');
        for (const bet of bets) {
            console.log(`ID ${bet.id}: ${bet.bet_type} ${bet.bet_value}, 金额$${bet.amount}, ${bet.win ? '赢' : '输'}, 派彩$${bet.win_amount || 0}`);
        }
        
        // 4. 重新结算
        console.log('\n开始重新结算...');
        
        // 先将所有投注标记为未结算
        await db.none(`
            UPDATE bet_history 
            SET settled = false, win = false, win_amount = 0
            WHERE period = $1
        `, [period]);
        
        // 执行增强结算
        const result = await enhancedSettlement(period, {
            positions: [
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
            ]
        });
        
        if (result.success) {
            console.log('\n结算完成！');
            console.log(`结算笔数: ${result.settledCount}`);
            console.log(`中奖笔数: ${result.winCount}`);
            console.log(`总派彩: $${result.totalWinAmount}`);
            
            // 5. 显示新的结算结果
            const newBets = await db.manyOrNone(`
                SELECT * FROM bet_history 
                WHERE period = $1 AND username = 'justin111'
                ORDER BY id
            `, [period]);
            
            console.log('\n新的结算结果：');
            for (const bet of newBets) {
                console.log(`ID ${bet.id}: ${bet.bet_type} ${bet.bet_value}, 金额$${bet.amount}, ${bet.win ? '✓赢' : '✗输'}, 派彩$${bet.win_amount || 0}`);
            }
            
            // 分析变化
            console.log('\n结算变化：');
            const sum = drawResult.position_1 + drawResult.position_2;
            console.log(`冠亚和 = ${sum}`);
            console.log(`- 冠亚和大（${sum} >= 12）：${sum >= 12 ? '中奖' : '未中'}`);
            console.log(`- 冠亚和单（${sum} % 2 = ${sum % 2}）：${sum % 2 === 1 ? '中奖' : '未中'}`);
            
        } else {
            console.error('结算失败:', result.error);
        }
        
    } catch (error) {
        console.error('修复失败:', error);
    } finally {
        process.exit();
    }
}

fixPeriod406();