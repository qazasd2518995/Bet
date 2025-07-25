// check-period-299-bets.js - 检查期号299的实际投注记录
import db from './db/config.js';

async function checkPeriod299Bets() {
    try {
        console.log('🔍 检查期号299的实际投注记录...\n');
        
        // 获取所有投注记录的详细信息
        const allBets = await db.any(`
            SELECT id, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = 20250714299 AND username = 'justin111'
            ORDER BY created_at, id
        `);
        
        console.log(`找到 ${allBets.length} 笔投注记录:\n`);
        
        // 显示前10笔的详细信息
        console.log('投注详情（前10笔）:');
        allBets.slice(0, 10).forEach((bet, index) => {
            console.log(`${index + 1}. ID: ${bet.id}`);
            console.log(`   bet_type: "${bet.bet_type}"`);
            console.log(`   bet_value: "${bet.bet_value}"`);
            console.log(`   position: ${bet.position}`);
            console.log(`   amount: $${bet.amount}`);
            console.log(`   odds: ${bet.odds}`);
            console.log(`   win: ${bet.win}`);
            console.log(`   win_amount: ${bet.win_amount}`);
            console.log(`   settled: ${bet.settled}`);
            console.log(`   created_at: ${bet.created_at.toLocaleString('zh-TW')}`);
            console.log('');
        });
        
        // 统计bet_type的分布
        const betTypeCount = {};
        allBets.forEach(bet => {
            if (!betTypeCount[bet.bet_type]) {
                betTypeCount[bet.bet_type] = 0;
            }
            betTypeCount[bet.bet_type]++;
        });
        
        console.log('投注类型分布:');
        Object.entries(betTypeCount).forEach(([type, count]) => {
            console.log(`  "${type}": ${count}笔`);
        });
        
        // 统计bet_value的分布
        const betValueCount = {};
        allBets.forEach(bet => {
            if (!betValueCount[bet.bet_value]) {
                betValueCount[bet.bet_value] = 0;
            }
            betValueCount[bet.bet_value]++;
        });
        
        console.log('\n投注选项分布:');
        Object.entries(betValueCount).forEach(([value, count]) => {
            console.log(`  "${value}": ${count}笔`);
        });
        
        // 检查是否有中文编码问题
        console.log('\n检查可能的编码问题:');
        const uniqueBetTypes = [...new Set(allBets.map(b => b.bet_type))];
        uniqueBetTypes.forEach(type => {
            console.log(`  bet_type: "${type}" (长度: ${type.length}, 字符码: ${[...type].map(c => c.charCodeAt(0)).join(', ')})`);
        });
        
        // 获取开奖结果
        const result = await db.one('SELECT result FROM result_history WHERE period = 20250714299');
        const positions = Array.isArray(result.result) ? result.result : result.result.split(',').map(n => parseInt(n.trim()));
        
        console.log('\n开奖结果:', positions);
        console.log('各位置单双:');
        positions.forEach((num, index) => {
            const posName = ['冠军', '亚军', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'][index];
            console.log(`  ${posName}: ${num} (${num % 2 === 0 ? '双' : '单'})`);
        });
        
        // 手动检查哪些应该中奖
        console.log('\n🎯 根据实际数据分析中奖情况:');
        
        let shouldWinBets = [];
        allBets.forEach(bet => {
            let positionIndex = -1;
            
            // 根据实际的bet_type值来判断位置
            if (bet.bet_type.includes('冠') || bet.bet_type === 'champion') {
                positionIndex = 0;
            } else if (bet.bet_type.includes('亚') || bet.bet_type.includes('亚') || bet.bet_type === 'runnerup') {
                positionIndex = 1;
            } else if (bet.bet_type.includes('第三') || bet.bet_type === 'third') {
                positionIndex = 2;
            } else if (bet.bet_type.includes('第四') || bet.bet_type === 'fourth') {
                positionIndex = 3;
            } else if (bet.bet_type.includes('第五') || bet.bet_type === 'fifth') {
                positionIndex = 4;
            } else if (bet.bet_type.includes('第六') || bet.bet_type === 'sixth') {
                positionIndex = 5;
            } else if (bet.bet_type.includes('第七') || bet.bet_type === 'seventh') {
                positionIndex = 6;
            } else if (bet.bet_type.includes('第八') || bet.bet_type === 'eighth') {
                positionIndex = 7;
            } else if (bet.bet_type.includes('第九') || bet.bet_type === 'ninth') {
                positionIndex = 8;
            } else if (bet.bet_type.includes('第十') || bet.bet_type === 'tenth') {
                positionIndex = 9;
            }
            
            if (positionIndex >= 0) {
                const positionValue = positions[positionIndex];
                const isEven = positionValue % 2 === 0;
                const betIsEven = bet.bet_value === '双' || bet.bet_value === 'even';
                const betIsOdd = bet.bet_value === '单' || bet.bet_value === 'odd';
                
                const shouldWin = (betIsEven && isEven) || (betIsOdd && !isEven);
                
                if (shouldWin) {
                    shouldWinBets.push({
                        ...bet,
                        positionIndex,
                        positionValue,
                        reason: `${bet.bet_type} 开出 ${positionValue} (${isEven ? '双' : '单'}), 投注 ${bet.bet_value}`
                    });
                }
            }
        });
        
        console.log(`\n应该中奖的投注 (${shouldWinBets.length}笔):`);
        shouldWinBets.forEach(bet => {
            console.log(`❌ ID ${bet.id}: ${bet.reason}`);
            console.log(`   状态: win=${bet.win}, win_amount=${bet.win_amount}`);
        });
        
        const totalMissingWinAmount = shouldWinBets.length * 198;
        console.log(`\n💰 遗失的中奖金额: $${totalMissingWinAmount}`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('检查过程中发生错误:', error);
        await db.$pool.end();
    }
}

checkPeriod299Bets();