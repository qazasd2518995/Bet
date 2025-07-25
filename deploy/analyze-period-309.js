// analyze-period-309.js - 分析期号309的结算问题
import db from './db/config.js';
import { checkWin } from './improved-settlement-system.js';

async function analyzePeriod309() {
    try {
        console.log('🔍 分析期号309的结算问题...\n');
        
        // 1. 获取期号309的开奖结果
        const result = await db.oneOrNone('SELECT period, result FROM result_history WHERE period = 20250714309');
        if (!result) {
            console.log('❌ 找不到期号309的开奖结果');
            await db.$pool.end();
            return;
        }
        
        console.log('期号309开奖结果:');
        console.log('原始结果:', result.result);
        
        let positions = [];
        if (Array.isArray(result.result)) {
            positions = result.result;
        } else if (typeof result.result === 'string') {
            positions = result.result.split(',').map(n => parseInt(n.trim()));
        }
        
        console.log('解析后位置:', positions);
        console.log('\n各位置分析:');
        const positionNames = ['冠军', '亚军', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'];
        positions.forEach((num, index) => {
            const size = num >= 6 ? '大' : '小';
            const oddEven = num % 2 === 0 ? '双' : '单';
            console.log(`  ${positionNames[index]}: ${num} (${size}, ${oddEven})`);
        });
        
        // 2. 获取所有期号309的投注记录
        const allBets = await db.any(`
            SELECT id, bet_type, bet_value, position, amount, odds, win, win_amount, settled, created_at
            FROM bet_history 
            WHERE period = 20250714309 AND username = 'justin111'
            ORDER BY id
        `);
        
        console.log(`\n📊 期号309投注统计:`);
        console.log(`总投注记录数: ${allBets.length}`);
        console.log(`已结算投注数: ${allBets.filter(b => b.settled).length}`);
        console.log(`显示为中奖的投注数: ${allBets.filter(b => b.win).length}`);
        console.log(`显示为输的投注数: ${allBets.filter(b => !b.win).length}`);
        
        // 3. 分析哪些应该中奖
        console.log('\n🎯 应该中奖的投注:');
        
        const betTypeMapping = {
            'champion': 0, '冠军': 0,
            'runnerup': 1, '亚军': 1,
            'third': 2, '第三名': 2,
            'fourth': 3, '第四名': 3,
            'fifth': 4, '第五名': 4,
            'sixth': 5, '第六名': 5,
            'seventh': 6, '第七名': 6,
            'eighth': 7, '第八名': 7,
            'ninth': 8, '第九名': 8,
            'tenth': 9, '第十名': 9
        };
        
        let shouldWinBets = [];
        const winResult = { positions };
        
        allBets.forEach(bet => {
            // 测试checkWin函数
            const isWin = checkWin(bet, winResult);
            
            if (isWin && !bet.win) {
                const positionIndex = betTypeMapping[bet.bet_type];
                const positionValue = positions[positionIndex];
                shouldWinBets.push({
                    ...bet,
                    positionIndex,
                    positionValue,
                    reason: `${bet.bet_type} ${bet.bet_value} (开出${positionValue})`
                });
                console.log(`❌ ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} 应该中奖但显示为输 (开出${positionValue})`);
            }
        });
        
        console.log(`\n📈 统计结果:`);
        console.log(`应该中奖但显示为输的投注数: ${shouldWinBets.length}`);
        console.log(`遗失的中奖金额: $${shouldWinBets.length * 198}`);
        
        // 4. 按投注类型统计
        const betStats = {};
        allBets.forEach(bet => {
            const key = `${bet.bet_type}_${bet.bet_value}`;
            if (!betStats[key]) {
                betStats[key] = { count: 0, wins: 0 };
            }
            betStats[key].count++;
            if (bet.win) betStats[key].wins++;
        });
        
        console.log('\n📋 各投注类型统计:');
        Object.entries(betStats).forEach(([key, stats]) => {
            console.log(`  ${key}: ${stats.count}笔 (中奖${stats.wins}笔)`);
        });
        
        // 5. 检查结算日志
        const settlementLog = await db.oneOrNone(`
            SELECT period, settled_count, total_win_amount, created_at
            FROM settlement_logs 
            WHERE period = 20250714309
            ORDER BY created_at DESC
            LIMIT 1
        `);
        
        if (settlementLog) {
            console.log('\n📋 结算日志:');
            console.log(`  结算时间: ${settlementLog.created_at}`);
            console.log(`  结算数量: ${settlementLog.settled_count}`);
            console.log(`  总中奖金额: $${settlementLog.total_win_amount}`);
        } else {
            console.log('\n❌ 找不到结算日志');
        }
        
        // 6. 返回需要修正的投注列表
        if (shouldWinBets.length > 0) {
            console.log('\n💡 需要修正的投注ID列表:');
            shouldWinBets.forEach(bet => {
                console.log(`  ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} → $198`);
            });
        }
        
        await db.$pool.end();
        return shouldWinBets;
    } catch (error) {
        console.error('分析过程中发生错误:', error);
        await db.$pool.end();
    }
}

// 如果直接运行此档案
if (import.meta.url === `file://${process.argv[1]}`) {
    analyzePeriod309();
}

export default analyzePeriod309;