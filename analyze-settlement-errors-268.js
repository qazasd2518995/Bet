// analyze-settlement-errors-268.js - 详细分析期号268的结算错误
import db from './db/config.js';

async function analyzeSettlementErrors() {
    try {
        // 获取期号268的开奖结果
        const result = await db.one('SELECT result FROM result_history WHERE period = 20250714268');
        const positions = result.result;
        
        console.log('期号268开奖结果:', positions);
        console.log('各位置数值:');
        positions.forEach((num, index) => {
            const posName = ['冠军', '亚军', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'][index];
            const size = num >= 6 ? '大' : '小';
            const oddEven = num % 2 === 0 ? '双' : '单';
            console.log(`  ${posName}: ${num} (${size}, ${oddEven})`);
        });
        
        // 计算冠亚和
        const sum = positions[0] + positions[1];
        const sumSize = sum >= 12 ? '大' : '小';
        const sumOddEven = sum % 2 === 0 ? '双' : '单';
        console.log(`冠亚和: ${positions[0]} + ${positions[1]} = ${sum} (${sumSize}, ${sumOddEven})`);
        
        // 获取所有投注
        const bets = await db.any('SELECT * FROM bet_history WHERE period = 20250714268 ORDER BY id');
        
        console.log('\n详细错误分析:');
        const errors = [];
        
        for (const bet of bets) {
            let shouldWin = false;
            let analysis = '';
            let error = null;
            
            // 根据bet_type和bet_value判断是否应该中奖
            if (bet.bet_type === 'champion' && bet.bet_value === 'big') {
                shouldWin = positions[0] >= 6;
                analysis = `冠军${positions[0]}号${positions[0] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'champion' && bet.bet_value === 'even') {
                shouldWin = positions[0] % 2 === 0;
                analysis = `冠军${positions[0]}号${positions[0] % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'runnerup' && bet.bet_value === 'big') {
                shouldWin = positions[1] >= 6;
                analysis = `亚军${positions[1]}号${positions[1] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'runnerup' && bet.bet_value === 'even') {
                shouldWin = positions[1] % 2 === 0;
                analysis = `亚军${positions[1]}号${positions[1] % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'third' && bet.bet_value === 'big') {
                shouldWin = positions[2] >= 6;
                analysis = `第三名${positions[2]}号${positions[2] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'third' && bet.bet_value === 'even') {
                shouldWin = positions[2] % 2 === 0;
                analysis = `第三名${positions[2]}号${positions[2] % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'fourth' && bet.bet_value === 'big') {
                shouldWin = positions[3] >= 6;
                analysis = `第四名${positions[3]}号${positions[3] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'fourth' && bet.bet_value === 'even') {
                shouldWin = positions[3] % 2 === 0;
                analysis = `第四名${positions[3]}号${positions[3] % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'fifth' && bet.bet_value === 'big') {
                shouldWin = positions[4] >= 6;
                analysis = `第五名${positions[4]}号${positions[4] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'fifth' && bet.bet_value === 'even') {
                shouldWin = positions[4] % 2 === 0;
                analysis = `第五名${positions[4]}号${positions[4] % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'sixth' && bet.bet_value === 'big') {
                shouldWin = positions[5] >= 6;
                analysis = `第六名${positions[5]}号${positions[5] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'sixth' && bet.bet_value === 'even') {
                shouldWin = positions[5] % 2 === 0;
                analysis = `第六名${positions[5]}号${positions[5] % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'seventh' && bet.bet_value === 'big') {
                shouldWin = positions[6] >= 6;
                analysis = `第七名${positions[6]}号${positions[6] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'seventh' && bet.bet_value === 'even') {
                shouldWin = positions[6] % 2 === 0;
                analysis = `第七名${positions[6]}号${positions[6] % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'eighth' && bet.bet_value === 'big') {
                shouldWin = positions[7] >= 6;
                analysis = `第八名${positions[7]}号${positions[7] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'eighth' && bet.bet_value === 'even') {
                shouldWin = positions[7] % 2 === 0;
                analysis = `第八名${positions[7]}号${positions[7] % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'ninth' && bet.bet_value === 'big') {
                shouldWin = positions[8] >= 6;
                analysis = `第九名${positions[8]}号${positions[8] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'ninth' && bet.bet_value === 'even') {
                shouldWin = positions[8] % 2 === 0;
                analysis = `第九名${positions[8]}号${positions[8] % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'tenth' && bet.bet_value === 'big') {
                shouldWin = positions[9] >= 6;
                analysis = `第十名${positions[9]}号${positions[9] >= 6 ? '大' : '小'}`;
            } else if (bet.bet_type === 'tenth' && bet.bet_value === 'even') {
                shouldWin = positions[9] % 2 === 0;
                analysis = `第十名${positions[9]}号${positions[9] % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'sumValue' && bet.bet_value === 'small') {
                shouldWin = sum < 12;
                analysis = `冠亚和${sum}${sum < 12 ? '小' : '大'}`;
            } else if (bet.bet_type === 'sumValue' && bet.bet_value === 'even') {
                shouldWin = sum % 2 === 0;
                analysis = `冠亚和${sum}${sum % 2 === 0 ? '双' : '单'}`;
            } else if (bet.bet_type === 'sumValue' && /^\d+$/.test(bet.bet_value)) {
                shouldWin = sum === parseInt(bet.bet_value);
                analysis = `冠亚和值${bet.bet_value}, 实际${sum}`;
            } else if (bet.bet_type === 'dragonTiger') {
                // 解析龙虎投注
                if (bet.bet_value === 'dragon_1_10') {
                    shouldWin = positions[0] > positions[9]; // 冠军 vs 第十名
                    analysis = `冠军${positions[0]} vs 第十名${positions[9]} = ${positions[0] > positions[9] ? '龙' : '虎'}`;
                } else if (bet.bet_value === 'dragon_3_8') {
                    shouldWin = positions[2] > positions[7]; // 第三名 vs 第八名
                    analysis = `第三名${positions[2]} vs 第八名${positions[7]} = ${positions[2] > positions[7] ? '龙' : '虎'}`;
                } else if (bet.bet_value === 'dragon_5_6') {
                    shouldWin = positions[4] > positions[5]; // 第五名 vs 第六名
                    analysis = `第五名${positions[4]} vs 第六名${positions[5]} = ${positions[4] > positions[5] ? '龙' : '虎'}`;
                } else if (bet.bet_value === 'tiger_2_9') {
                    shouldWin = positions[1] < positions[8]; // 亚军 vs 第九名，投注虎
                    analysis = `亚军${positions[1]} vs 第九名${positions[8]} = ${positions[1] < positions[8] ? '虎' : '龙'}`;
                } else if (bet.bet_value === 'tiger_4_7') {
                    shouldWin = positions[3] < positions[6]; // 第四名 vs 第七名，投注虎
                    analysis = `第四名${positions[3]} vs 第七名${positions[6]} = ${positions[3] < positions[6] ? '虎' : '龙'}`;
                }
            }
            
            // 检查是否有结算错误
            if (shouldWin !== bet.win) {
                error = `❌ 结算错误! 应该${shouldWin ? '中奖' : '未中奖'}但实际${bet.win ? '中奖' : '未中奖'}`;
                errors.push({
                    id: bet.id,
                    bet_type: bet.bet_type,
                    bet_value: bet.bet_value,
                    shouldWin: shouldWin,
                    actualWin: bet.win,
                    analysis: analysis,
                    odds: bet.odds
                });
            }
            
            console.log(`ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${analysis} - ${error || '✅ 正确'}`);
        }
        
        console.log(`\n结算错误总结: ${errors.length}个错误`);
        
        if (errors.length > 0) {
            console.log('\n需要修正的投注:');
            let totalWinAmount = 0;
            
            errors.forEach(error => {
                const winAmount = error.shouldWin ? (100 * parseFloat(error.odds)) : 0;
                totalWinAmount += winAmount;
                console.log(`ID ${error.id}: ${error.bet_type} ${error.bet_value}`);
                console.log(`  ${error.analysis}`);
                console.log(`  应该${error.shouldWin ? '中奖' : '未中奖'}, 实际${error.actualWin ? '中奖' : '未中奖'}`);
                if (error.shouldWin) {
                    console.log(`  应获奖金: $${winAmount}`);
                }
                console.log('');
            });
            
            console.log(`总应补偿金额: $${totalWinAmount}`);
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('错误:', error);
        await db.$pool.end();
    }
}

analyzeSettlementErrors();