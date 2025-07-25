// fix-settlement-errors.js - 修复结算错误
import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function fixSettlementErrors() {
    // 需要修复的期号
    const periodsToFix = [
        '20250718477', // 大小结算错误
        '20250718478', // 号码结算错误
        '20250718479'  // 龙虎结算错误
    ];
    
    for (const period of periodsToFix) {
        console.log(`\n========== 修复期号 ${period} ==========`);
        
        try {
            // 1. 查询开奖结果
            const drawResult = await db.oneOrNone(`
                SELECT * FROM result_history WHERE period = $1
            `, [period]);
            
            if (!drawResult) {
                console.error(`找不到期号 ${period} 的开奖结果`);
                continue;
            }
            
            console.log('开奖结果：');
            const positions = [];
            for (let i = 1; i <= 10; i++) {
                const pos = drawResult[`position_${i}`];
                positions.push(pos);
                console.log(`  第${i}名: ${pos}号`);
            }
            
            // 2. 查询该期所有投注
            const bets = await db.manyOrNone(`
                SELECT * FROM bet_history 
                WHERE period = $1
                ORDER BY id
            `, [period]);
            
            console.log(`\n找到 ${bets.length} 笔投注，开始重新结算...`);
            
            // 3. 先将所有投注标记为未结算
            await db.none(`
                UPDATE bet_history 
                SET settled = false, win = false, win_amount = 0
                WHERE period = $1
            `, [period]);
            
            // 4. 执行增强结算
            const result = await enhancedSettlement(period, { positions });
            
            if (result.success) {
                console.log('\n结算完成：');
                console.log(`  结算笔数: ${result.settledCount}`);
                console.log(`  中奖笔数: ${result.winCount}`);
                console.log(`  总派彩: $${result.totalWinAmount}`);
                
                // 5. 显示结算后的结果
                const updatedBets = await db.manyOrNone(`
                    SELECT id, username, bet_type, bet_value, position, amount, win, win_amount
                    FROM bet_history 
                    WHERE period = $1
                    ORDER BY id
                `, [period]);
                
                console.log('\n结算详情：');
                for (const bet of updatedBets) {
                    console.log(`  ID ${bet.id}: ${bet.bet_type} ${bet.bet_value}${bet.position ? ` (位置${bet.position})` : ''}, $${bet.amount} → ${bet.win ? `✓赢 $${bet.win_amount}` : '✗输'}`);
                }
            } else {
                console.error(`结算失败: ${result.error}`);
            }
            
        } catch (error) {
            console.error(`处理期号 ${period} 时出错:`, error);
        }
    }
    
    console.log('\n\n修复完成！');
    process.exit();
}

// 执行修复
fixSettlementErrors();