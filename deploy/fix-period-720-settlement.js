// fix-period-720-settlement.js - 修复期号 720 的错误结算
import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function fixPeriod720Settlement() {
    try {
        console.log('修复期号 20250717720 的错误结算...\n');
        
        const period = '20250717720';
        
        // 1. 查询开奖结果
        const drawResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   draw_time
            FROM result_history 
            WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            console.log('❌ 找不到开奖结果');
            return;
        }
        
        console.log('开奖结果：');
        console.log(`期号: ${drawResult.period}`);
        console.log(`第1名(冠军): ${drawResult.position_1}号`);
        console.log(`第2名(亚军): ${drawResult.position_2}号`);
        
        // 2. 构建正确的开奖结果阵列
        const positions = [];
        for (let i = 1; i <= 10; i++) {
            positions.push(parseInt(drawResult[`position_${i}`]));
        }
        console.log('\n开奖阵列:', positions);
        
        // 3. 重置该期号的结算状态
        console.log('\n重置结算状态...');
        await db.none(`
            UPDATE bet_history 
            SET settled = false, 
                win = false, 
                win_amount = 0,
                settled_at = NULL
            WHERE period = $1
        `, [period]);
        
        const resetCount = await db.one(`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1
        `, [period]);
        console.log(`✅ 已重置 ${resetCount.count} 笔投注记录`);
        
        // 4. 重新执行结算
        console.log('\n重新执行结算...');
        const settlementResult = await enhancedSettlement(period, { positions });
        
        if (settlementResult.success) {
            console.log('\n✅ 结算成功！');
            console.log(`结算数量: ${settlementResult.settledCount}`);
            console.log(`中奖数量: ${settlementResult.winCount}`);
            console.log(`总派彩: ${settlementResult.totalWinAmount}`);
            
            // 5. 查询修复后的结果
            const fixedBets = await db.manyOrNone(`
                SELECT id, username, bet_type, bet_value, 
                       amount, win, win_amount
                FROM bet_history
                WHERE period = $1 AND username = 'justin111'
                ORDER BY id
            `, [period]);
            
            console.log('\n修复后的投注记录：');
            fixedBets.forEach((bet, idx) => {
                console.log(`${idx + 1}. ID:${bet.id}`);
                console.log(`   类型: ${bet.bet_type}`);
                console.log(`   选项: ${bet.bet_value}`);
                console.log(`   金额: $${bet.amount}`);
                console.log(`   中奖: ${bet.win ? '是' : '否'}`);
                console.log(`   派彩: $${bet.win_amount || 0}`);
                
                // 验证冠军投注
                if (bet.bet_type === 'champion') {
                    const champion = positions[0]; // 第1名
                    let shouldWin = false;
                    if (bet.bet_value === 'big') {
                        shouldWin = champion >= 6;
                    } else if (bet.bet_value === 'odd') {
                        shouldWin = champion % 2 === 1;
                    }
                    
                    if (shouldWin !== bet.win) {
                        console.log(`   ❌ 仍然错误！应该是${shouldWin ? '赢' : '输'}`);
                    } else {
                        console.log(`   ✅ 正确！`);
                    }
                }
            });
            
            // 6. 更新用户余额（如果需要）
            const totalCorrectWin = fixedBets
                .filter(b => b.win)
                .reduce((sum, b) => sum + parseFloat(b.win_amount || 0), 0);
            
            console.log(`\n总正确派彩: $${totalCorrectWin.toFixed(2)}`);
            
        } else {
            console.log('❌ 结算失败:', settlementResult.error);
        }
        
    } catch (error) {
        console.error('修复失败:', error);
    } finally {
        process.exit();
    }
}

fixPeriod720Settlement();