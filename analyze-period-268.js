// analyze-period-268.js - 分析期号268的结算问题
import db from './db/config.js';

async function analyzePeriod268() {
    try {
        // 获取期号268的开奖结果
        const result = await db.oneOrNone('SELECT period, result FROM result_history WHERE period = 20250714268');
        if (!result) {
            console.log('找不到期号268的开奖结果');
            await db.$pool.end();
            return;
        }
        
        console.log('期号268开奖结果:');
        console.log('原始结果:', result.result);
        
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        console.log('解析后位置:', positions);
        console.log('冠军(1st):', positions[0]);
        console.log('亚军(2nd):', positions[1]);
        console.log('第三名:', positions[2]);
        console.log('第四名:', positions[3]);
        console.log('第五名:', positions[4]);
        console.log('第六名:', positions[5]);
        console.log('第七名:', positions[6]);
        console.log('第八名:', positions[7]);
        console.log('第九名:', positions[8]);
        console.log('第十名:', positions[9]);
        
        // 计算冠亚和
        const sum = positions[0] + positions[1];
        console.log('\n冠亚和计算:');
        console.log('冠军 + 亚军 =', positions[0], '+', positions[1], '=', sum);
        console.log('冠亚和大小:', sum >= 12 ? '大' : '小');
        console.log('冠亚和单双:', sum % 2 === 0 ? '双' : '单');
        
        // 获取所有期号268的投注
        const bets = await db.any('SELECT * FROM bet_history WHERE period = 20250714268 ORDER BY id');
        console.log('\n期号268投注记录数:', bets.length);
        
        console.log('\n投注详情分析:');
        const errorBets = [];
        
        for (const bet of bets) {
            console.log(`\nID ${bet.id}: ${bet.bet_type} - ${bet.bet_value} (位置${bet.position || 'N/A'}) - ${bet.win ? '中奖' : '未中奖'}`);
            
            // 检查每种投注类型的正确性
            let shouldWin = false;
            let analysis = '';
            
            if (bet.bet_type === 'sumValue') {
                // 冠亚和数值
                shouldWin = sum === parseInt(bet.bet_value);
                analysis = `和值${bet.bet_value}, 实际${sum}`;
            } else if (bet.bet_type === 'sumOddEven') {
                // 冠亚和单双
                const actualOddEven = sum % 2 === 0 ? '双' : '单';
                shouldWin = bet.bet_value === actualOddEven;
                analysis = `投注${bet.bet_value}, 实际${actualOddEven}`;
            } else if (bet.bet_type === 'sumSize') {
                // 冠亚和大小
                const actualSize = sum >= 12 ? '大' : '小';
                shouldWin = bet.bet_value === actualSize;
                analysis = `投注${bet.bet_value}, 实际${actualSize}`;
            } else if (bet.bet_type === 'oddEven' && bet.position) {
                // 位置单双
                const positionValue = positions[bet.position - 1];
                const actualOddEven = positionValue % 2 === 0 ? '双' : '单';
                shouldWin = bet.bet_value === actualOddEven;
                analysis = `第${bet.position}名投注${bet.bet_value}, 实际${positionValue}=${actualOddEven}`;
            } else if (bet.bet_type === 'size' && bet.position) {
                // 位置大小
                const positionValue = positions[bet.position - 1];
                const actualSize = positionValue >= 6 ? '大' : '小';
                shouldWin = bet.bet_value === actualSize;
                analysis = `第${bet.position}名投注${bet.bet_value}, 实际${positionValue}=${actualSize}`;
            } else if (bet.bet_type === 'dragonTiger') {
                // 龙虎 - 需要解析bet_value中的位置信息
                const parts = bet.bet_value.match(/([龙虎])\((.+)vs(.+)\)/);
                if (parts) {
                    const dragonTiger = parts[1];
                    const pos1Name = parts[2];
                    const pos2Name = parts[3];
                    
                    // 位置名称对应
                    const posMap = {
                        '冠军': 0, '亚军': 1, '第3名': 2, '第4名': 3, '第5名': 4,
                        '第6名': 5, '第7名': 6, '第8名': 7, '第9名': 8, '第十名': 9
                    };
                    const pos1 = posMap[pos1Name];
                    const pos2 = posMap[pos2Name];
                    
                    if (pos1 !== undefined && pos2 !== undefined) {
                        const val1 = positions[pos1];
                        const val2 = positions[pos2];
                        const actualResult = val1 > val2 ? '龙' : (val1 < val2 ? '虎' : '和');
                        shouldWin = dragonTiger === actualResult && actualResult !== '和'; // 和局通常不算赢
                        analysis = `投注${dragonTiger}, ${pos1Name}${val1}vs${pos2Name}${val2}=${actualResult}`;
                    }
                }
            }
            
            console.log(`  应该: ${shouldWin ? '中奖' : '未中奖'} (${analysis})`);
            
            // 标记结算错误
            if (shouldWin !== bet.win) {
                console.log(`  ❌ 结算错误! 应该${shouldWin ? '中奖' : '未中奖'}但实际${bet.win ? '中奖' : '未中奖'}`);
                errorBets.push({
                    id: bet.id,
                    bet_type: bet.bet_type,
                    bet_value: bet.bet_value,
                    position: bet.position,
                    shouldWin: shouldWin,
                    actualWin: bet.win,
                    analysis: analysis
                });
            } else {
                console.log(`  ✅ 结算正确`);
            }
        }
        
        console.log(`\n结算错误总结: ${errorBets.length}个投注结算错误`);
        if (errorBets.length > 0) {
            console.log('\n需要修正的投注:');
            errorBets.forEach(bet => {
                console.log(`ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${bet.analysis}`);
                console.log(`  应该${bet.shouldWin ? '中奖' : '未中奖'}, 实际${bet.actualWin ? '中奖' : '未中奖'}`);
            });
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('错误:', error);
        await db.$pool.end();
    }
}

analyzePeriod268();