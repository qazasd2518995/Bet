// analyze-period-284.js - 分析期号284的结算问题
import db from './db/config.js';

async function analyzePeriod284() {
    try {
        console.log('🔍 分析期号284的结算问题...\n');
        
        // 获取期号284的开奖结果
        const result = await db.oneOrNone('SELECT period, result FROM result_history WHERE period = 20250714284');
        if (!result) {
            console.log('❌ 找不到期号284的开奖结果');
            await db.$pool.end();
            return;
        }
        
        console.log('期号284开奖结果:');
        console.log('原始结果:', result.result);
        
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        console.log('解析后位置:', positions);
        console.log('各位置分析:');
        positions.forEach((num, index) => {
            const posName = ['冠军', '亚军', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'][index];
            const size = num >= 6 ? '大' : '小';
            const oddEven = num % 2 === 0 ? '双' : '单';
            console.log(`  ${posName}: ${num} (${size}, ${oddEven})`);
        });
        
        // 重点检查第十名
        const tenthPosition = positions[9];
        const tenthSize = tenthPosition >= 6 ? '大' : '小';
        const tenthOddEven = tenthPosition % 2 === 0 ? '双' : '单';
        
        console.log(`\n🎯 第十名详细分析:`);
        console.log(`第十名开出: ${tenthPosition}号`);
        console.log(`大小: ${tenthSize} (${tenthPosition >= 6 ? '≥6为大' : '<6为小'})`);
        console.log(`单双: ${tenthOddEven} (${tenthPosition % 2 === 0 ? '偶数为双' : '奇数为单'})`);
        
        // 获取所有期号284的投注
        const bets = await db.any('SELECT * FROM bet_history WHERE period = 20250714284 ORDER BY id');
        console.log(`\n期号284投注记录数: ${bets.length}`);
        
        console.log('\n投注详情分析:');
        const errorBets = [];
        
        for (const bet of bets) {
            let shouldWin = false;
            let analysis = '';
            
            // 根据投注类型检查
            if (bet.bet_type === 'tenth') {
                if (bet.bet_value === 'big') {
                    shouldWin = tenthPosition >= 6;
                    analysis = `第十名${tenthPosition}号${tenthSize}`;
                } else if (bet.bet_value === 'small') {
                    shouldWin = tenthPosition < 6;
                    analysis = `第十名${tenthPosition}号${tenthSize}`;
                } else if (bet.bet_value === 'odd') {
                    shouldWin = tenthPosition % 2 === 1;
                    analysis = `第十名${tenthPosition}号${tenthOddEven}`;
                } else if (bet.bet_value === 'even') {
                    shouldWin = tenthPosition % 2 === 0;
                    analysis = `第十名${tenthPosition}号${tenthOddEven}`;
                }
            } else {
                // 检查其他位置
                const positionMap = {
                    'champion': 0, 'runnerup': 1, 'third': 2, 'fourth': 3, 'fifth': 4,
                    'sixth': 5, 'seventh': 6, 'eighth': 7, 'ninth': 8
                };
                
                const posIndex = positionMap[bet.bet_type];
                if (posIndex !== undefined) {
                    const posValue = positions[posIndex];
                    const posName = ['冠军', '亚军', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名'][posIndex];
                    
                    if (bet.bet_value === 'big') {
                        shouldWin = posValue >= 6;
                        analysis = `${posName}${posValue}号${posValue >= 6 ? '大' : '小'}`;
                    } else if (bet.bet_value === 'small') {
                        shouldWin = posValue < 6;
                        analysis = `${posName}${posValue}号${posValue >= 6 ? '大' : '小'}`;
                    } else if (bet.bet_value === 'odd') {
                        shouldWin = posValue % 2 === 1;
                        analysis = `${posName}${posValue}号${posValue % 2 === 0 ? '双' : '单'}`;
                    } else if (bet.bet_value === 'even') {
                        shouldWin = posValue % 2 === 0;
                        analysis = `${posName}${posValue}号${posValue % 2 === 0 ? '双' : '单'}`;
                    }
                }
            }
            
            // 检查结算是否正确
            if (shouldWin !== bet.win) {
                console.log(`❌ ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${analysis} - 应该${shouldWin ? '中奖' : '未中奖'}但实际${bet.win ? '中奖' : '未中奖'}`);
                errorBets.push({
                    id: bet.id,
                    bet_type: bet.bet_type,
                    bet_value: bet.bet_value,
                    shouldWin: shouldWin,
                    actualWin: bet.win,
                    analysis: analysis,
                    odds: bet.odds
                });
            } else {
                console.log(`✅ ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${analysis} - 结算正确`);
            }
        }
        
        console.log(`\n结算错误总结: ${errorBets.length}个错误`);
        
        if (errorBets.length > 0) {
            console.log('\n需要修正的投注:');
            let totalCompensation = 0;
            
            errorBets.forEach(error => {
                const winAmount = error.shouldWin ? (100 * parseFloat(error.odds)) : 0;
                totalCompensation += winAmount;
                console.log(`ID ${error.id}: ${error.bet_type} ${error.bet_value}`);
                console.log(`  ${error.analysis}`);
                console.log(`  应该${error.shouldWin ? '中奖' : '未中奖'}, 实际${error.actualWin ? '中奖' : '未中奖'}`);
                if (error.shouldWin) {
                    console.log(`  应获奖金: $${winAmount}`);
                }
                console.log('');
            });
            
            console.log(`💰 总应补偿金额: $${totalCompensation}`);
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('错误:', error);
        await db.$pool.end();
    }
}

analyzePeriod284();