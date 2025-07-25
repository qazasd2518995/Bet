import db from './db/config.js';

async function checkRecentPeriodsControl() {
    console.log('🔍 检查justin111最近的下注和控制情况...\n');
    
    try {
        // 1. 查询最近有下注的期数
        console.log('📋 1. 查询最近有下注的期数:');
        const recentBets = await db.manyOrNone(`
            SELECT DISTINCT period 
            FROM bet_history 
            WHERE username = 'justin111' 
            AND period >= '20250717330'
            ORDER BY period DESC
            LIMIT 20
        `);
        
        console.log(`找到 ${recentBets.length} 个有下注的期数\n`);
        
        // 2. 详细分析每期
        for (const record of recentBets) {
            const period = record.period;
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📊 期号: ${period}`);
            console.log(`${'='.repeat(80)}`);
            
            // 查询该期下注详情
            const periodBets = await db.manyOrNone(`
                SELECT bet_type, bet_value, position, amount, odds, win_amount
                FROM bet_history
                WHERE period = $1 AND username = 'justin111'
                ORDER BY position, bet_value
            `, [period]);
            
            // 查询开奖结果
            const result = await db.oneOrNone(`
                SELECT position_1, position_2, position_3, position_4, position_5,
                       position_6, position_7, position_8, position_9, position_10
                FROM result_history
                WHERE period = $1
            `, [period]);
            
            if (periodBets.length > 0) {
                // 按位置分组显示
                const betsByPosition = {};
                let totalBet = 0;
                let totalWin = 0;
                let winCount = 0;
                
                periodBets.forEach(bet => {
                    if (bet.position) {
                        if (!betsByPosition[bet.position]) {
                            betsByPosition[bet.position] = {
                                numbers: [],
                                totalAmount: 0,
                                isWin: false,
                                winAmount: 0
                            };
                        }
                        betsByPosition[bet.position].numbers.push(bet.bet_value);
                        betsByPosition[bet.position].totalAmount += parseFloat(bet.amount);
                        if (bet.win_amount > 0) {
                            betsByPosition[bet.position].isWin = true;
                            betsByPosition[bet.position].winAmount += parseFloat(bet.win_amount);
                            winCount++;
                        }
                    }
                    totalBet += parseFloat(bet.amount);
                    totalWin += parseFloat(bet.win_amount || 0);
                });
                
                console.log('\n下注详情:');
                Object.entries(betsByPosition).forEach(([pos, info]) => {
                    const coverage = (info.numbers.length / 10 * 100).toFixed(1);
                    const notBet = [];
                    for (let i = 1; i <= 10; i++) {
                        if (!info.numbers.includes(i.toString())) {
                            notBet.push(i);
                        }
                    }
                    
                    console.log(`\n  第${pos}名:`);
                    console.log(`    下注号码: ${info.numbers.sort((a,b) => a-b).join(', ')} (${info.numbers.length}个, 覆盖率${coverage}%)`);
                    console.log(`    未下注: ${notBet.join(', ')}`);
                    if (result) {
                        const winNum = result[`position_${pos}`];
                        const isWin = info.numbers.includes(winNum.toString());
                        console.log(`    开奖号码: ${winNum} ${isWin ? '✅ 中奖' : '❌ 未中'}`);
                        
                        // 分析控制效果
                        if (info.numbers.length >= 7) {
                            console.log(`    ⚠️ 覆盖率过高(${coverage}%)，控制系统难以生效`);
                        }
                    }
                    console.log(`    下注金额: ${info.totalAmount}`);
                    if (info.isWin) {
                        console.log(`    中奖金额: ${info.winAmount}`);
                    }
                });
                
                const profit = totalWin - totalBet;
                console.log(`\n统计:`);
                console.log(`  总下注: ${totalBet}`);
                console.log(`  总中奖: ${totalWin}`);
                console.log(`  盈亏: ${profit > 0 ? '+' : ''}${profit}`);
                console.log(`  中奖率: ${periodBets.length > 0 ? (winCount/periodBets.length*100).toFixed(1) : 0}%`);
                
                // 检查控制逻辑
                const hasHighCoverage = Object.values(betsByPosition).some(info => info.numbers.length >= 7);
                if (hasHighCoverage) {
                    console.log(`\n💡 控制分析: 该期有高覆盖率下注，90%输控制难以生效`);
                }
            }
        }
        
        // 3. 总体统计
        console.log(`\n\n${'='.repeat(80)}`);
        console.log('📈 总体统计 (最近有下注的期数)');
        console.log(`${'='.repeat(80)}`);
        
        const overallStats = await db.oneOrNone(`
            SELECT 
                COUNT(DISTINCT period) as period_count,
                COUNT(*) as total_bets,
                SUM(amount) as total_amount,
                SUM(CASE WHEN win_amount > 0 THEN 1 ELSE 0 END) as win_count,
                SUM(win_amount) as total_win,
                SUM(win_amount) - SUM(amount) as total_profit
            FROM bet_history
            WHERE username = 'justin111'
            AND period >= '20250717330'
        `);
        
        if (overallStats) {
            const winRate = overallStats.total_bets > 0 ? 
                (overallStats.win_count / overallStats.total_bets * 100).toFixed(1) : 0;
            
            console.log(`期数: ${overallStats.period_count}`);
            console.log(`总下注数: ${overallStats.total_bets}`);
            console.log(`总下注金额: ${overallStats.total_amount}`);
            console.log(`总中奖数: ${overallStats.win_count}`);
            console.log(`总中奖金额: ${overallStats.total_win}`);
            console.log(`总盈亏: ${overallStats.total_profit > 0 ? '+' : ''}${overallStats.total_profit}`);
            console.log(`中奖率: ${winRate}%`);
            
            // 分析控制效果
            console.log(`\n🎮 控制效果分析:`);
            console.log(`当前设定: 90%输控制 (理论中奖率10%)`);
            console.log(`实际中奖率: ${winRate}%`);
            
            if (parseFloat(winRate) > 20) {
                console.log(`⚠️ 实际中奖率高于预期，可能原因:`);
                console.log(`  1. 下注覆盖率过高，系统无法有效控制`);
                console.log(`  2. 控制系统可能未正确执行`);
            }
        }
        
    } catch (error) {
        console.error('查询过程中出错:', error);
    } finally {
        await db.$pool.end();
    }
}

checkRecentPeriodsControl();