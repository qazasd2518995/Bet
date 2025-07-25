// fix-period-493-result.js - 修复期号 20250718493 的开奖结果不一致问题
import db from './db/config.js';

async function fixPeriod493() {
    console.log('========== 修复期号 20250718493 开奖结果 ==========\n');
    
    const period = '20250718493';
    
    try {
        // 1. 查询当前资料库中的开奖结果
        const currentResult = await db.oneOrNone(`
            SELECT * FROM result_history WHERE period = $1
        `, [period]);
        
        if (!currentResult) {
            console.error('找不到该期的开奖结果');
            return;
        }
        
        console.log('当前资料库中的开奖结果：');
        for (let i = 1; i <= 10; i++) {
            console.log(`  第${i}名: ${currentResult[`position_${i}`]}号`);
        }
        
        // 2. 系统日志中的正确开奖结果（结算时使用的）
        const correctPositions = [2, 1, 3, 8, 7, 5, 10, 6, 4, 9];
        
        console.log('\n系统结算时使用的正确开奖结果：');
        for (let i = 0; i < correctPositions.length; i++) {
            console.log(`  第${i + 1}名: ${correctPositions[i]}号`);
        }
        
        // 3. 查询该期所有投注记录
        const bets = await db.manyOrNone(`
            SELECT id, username, bet_type, bet_value, position, amount, odds, win, win_amount
            FROM bet_history 
            WHERE period = $1
            ORDER BY id
        `, [period]);
        
        console.log(`\n找到 ${bets.length} 笔投注记录`);
        
        // 4. 验证当前结算状态是否与正确开奖结果一致
        console.log('\n验证结算状态：');
        let isConsistent = true;
        
        for (const bet of bets) {
            if (bet.bet_type === 'number' && bet.position == 1) {
                const betNumber = parseInt(bet.bet_value);
                const shouldWin = correctPositions[0] === betNumber;
                
                if (bet.win !== shouldWin) {
                    console.log(`❌ 结算错误: 号码${betNumber}, 当前${bet.win ? '赢' : '输'}, 应该${shouldWin ? '赢' : '输'}`);
                    isConsistent = false;
                } else {
                    console.log(`✅ 结算正确: 号码${betNumber}, ${bet.win ? '赢' : '输'}`);
                }
            }
        }
        
        if (isConsistent) {
            console.log('\n结算状态与正确开奖结果一致，只需要更新资料库中的开奖记录');
            
            // 5. 更新资料库中的开奖结果
            await db.tx(async t => {
                // 建立更新语句
                const updateColumns = [];
                for (let i = 0; i < correctPositions.length; i++) {
                    updateColumns.push(`position_${i + 1} = ${correctPositions[i]}`);
                }
                
                await t.none(`
                    UPDATE result_history 
                    SET ${updateColumns.join(', ')}
                    WHERE period = $1
                `, [period]);
                
                console.log('\n✅ 已更新资料库中的开奖结果');
            });
            
            // 6. 验证更新后的结果
            const updatedResult = await db.oneOrNone(`
                SELECT * FROM result_history WHERE period = $1
            `, [period]);
            
            console.log('\n更新后的开奖结果：');
            for (let i = 1; i <= 10; i++) {
                console.log(`  第${i}名: ${updatedResult[`position_${i}`]}号`);
            }
            
            console.log('\n✅ 修复完成！开奖结果已与结算结果保持一致');
        } else {
            console.log('\n⚠️ 发现结算状态与正确开奖结果不一致，需要进一步调查');
        }
        
    } catch (error) {
        console.error('修复过程中发生错误:', error);
    }
    
    process.exit();
}

// 执行修复
fixPeriod493();