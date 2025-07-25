// investigate-period-291.js - 调查期号291的投注消失问题
import db from './db/config.js';

async function investigatePeriod291() {
    try {
        console.log('🔍 调查期号291的投注消失问题...\n');
        
        // 1. 获取期号291的开奖结果
        const result = await db.oneOrNone('SELECT period, result FROM result_history WHERE period = 20250714291');
        if (!result) {
            console.log('❌ 找不到期号291的开奖结果');
            await db.$pool.end();
            return;
        }
        
        console.log('期号291开奖结果:');
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
        
        // 2. 获取所有期号291的投注记录
        const allBets = await db.any(`
            SELECT id, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = 20250714291 AND username = 'justin111'
            ORDER BY id
        `);
        
        console.log(`\n📊 期号291投注统计:`);
        console.log(`总投注记录数: ${allBets.length}`);
        console.log(`已结算投注数: ${allBets.filter(b => b.settled).length}`);
        console.log(`未结算投注数: ${allBets.filter(b => !b.settled).length}`);
        console.log(`中奖投注数: ${allBets.filter(b => b.win).length}`);
        
        // 3. 按投注类型分组统计
        const betsByType = {};
        allBets.forEach(bet => {
            const key = `${bet.bet_type}_${bet.bet_value}`;
            if (!betsByType[key]) {
                betsByType[key] = [];
            }
            betsByType[key].push(bet);
        });
        
        console.log('\n📋 投注详细分析:');
        
        // 预期的40注组合
        const expectedBets = [];
        const betTypes = ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
        const betValues = ['big', 'small', 'odd', 'even'];
        
        betTypes.forEach(type => {
            betValues.forEach(value => {
                expectedBets.push(`${type}_${value}`);
            });
        });
        
        console.log(`预期投注组合数: ${expectedBets.length}`);
        console.log(`实际投注组合数: ${Object.keys(betsByType).length}`);
        
        // 4. 检查缺失的投注
        const missingBets = expectedBets.filter(expected => !betsByType[expected]);
        if (missingBets.length > 0) {
            console.log(`\n❌ 缺失的投注组合 (${missingBets.length}个):`);
            missingBets.forEach(missing => {
                console.log(`  ${missing}`);
            });
        }
        
        // 5. 检查应该中奖但没有出现的投注
        console.log('\n🔍 检查应该中奖的投注:');
        
        const positionNames = ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
        
        positions.forEach((num, index) => {
            const posType = positionNames[index];
            const size = num >= 6 ? 'big' : 'small';
            const oddEven = num % 2 === 0 ? 'even' : 'odd';
            
            // 检查大小投注
            const sizeKey = `${posType}_${size}`;
            const sizeWinner = betsByType[sizeKey];
            if (!sizeWinner) {
                console.log(`❌ 缺失中奖投注: ${posType} ${size} (${num}号)`);
            } else if (!sizeWinner[0].win) {
                console.log(`❌ 应中奖但标记为输: ${posType} ${size} (${num}号) - ID ${sizeWinner[0].id}`);
            } else {
                console.log(`✅ 正确中奖: ${posType} ${size} (${num}号) - ID ${sizeWinner[0].id}`);
            }
            
            // 检查单双投注
            const oddEvenKey = `${posType}_${oddEven}`;
            const oddEvenWinner = betsByType[oddEvenKey];
            if (!oddEvenWinner) {
                console.log(`❌ 缺失中奖投注: ${posType} ${oddEven} (${num}号)`);
            } else if (!oddEvenWinner[0].win) {
                console.log(`❌ 应中奖但标记为输: ${posType} ${oddEven} (${num}号) - ID ${oddEvenWinner[0].id}`);
            } else {
                console.log(`✅ 正确中奖: ${posType} ${oddEven} (${num}号) - ID ${oddEvenWinner[0].id}`);
            }
        });
        
        // 6. 检查投注时间范围
        if (allBets.length > 0) {
            const timeRange = {
                earliest: new Date(Math.min(...allBets.map(b => new Date(b.created_at)))),
                latest: new Date(Math.max(...allBets.map(b => new Date(b.created_at))))
            };
            console.log('\n⏰ 投注时间范围:');
            console.log(`最早: ${timeRange.earliest.toLocaleString('zh-TW')}`);
            console.log(`最晚: ${timeRange.latest.toLocaleString('zh-TW')}`);
            console.log(`时间跨度: ${(timeRange.latest - timeRange.earliest) / 1000} 秒`);
        }
        
        // 7. 检查是否有重复的投注ID或组合
        const duplicateChecks = {};
        allBets.forEach(bet => {
            const key = `${bet.bet_type}_${bet.bet_value}`;
            if (duplicateChecks[key]) {
                console.log(`⚠️ 发现重复投注: ${key} - IDs: ${duplicateChecks[key].id}, ${bet.id}`);
            } else {
                duplicateChecks[key] = bet;
            }
        });
        
        // 8. 计算应该的总中奖金额
        let expectedWinAmount = 0;
        let actualWinAmount = 0;
        
        positions.forEach((num, index) => {
            const posType = positionNames[index];
            const size = num >= 6 ? 'big' : 'small';
            const oddEven = num % 2 === 0 ? 'even' : 'odd';
            
            // 每个位置应该有2注中奖（大小+单双）
            expectedWinAmount += 2 * 100 * 1.98; // 2注 × 100元 × 1.98赔率
        });
        
        allBets.filter(b => b.win).forEach(bet => {
            actualWinAmount += parseFloat(bet.win_amount);
        });
        
        console.log('\n💰 中奖金额统计:');
        console.log(`预期总中奖: $${expectedWinAmount} (20注 × $198)`);
        console.log(`实际总中奖: $${actualWinAmount}`);
        console.log(`差额: $${expectedWinAmount - actualWinAmount}`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('调查过程中发生错误:', error);
        await db.$pool.end();
    }
}

investigatePeriod291();