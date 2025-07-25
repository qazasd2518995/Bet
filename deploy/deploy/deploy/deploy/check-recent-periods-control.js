import db from './db/config.js';

async function checkRecentPeriodsControl() {
    console.log('🔍 檢查justin111最近的下注和控制情況...\n');
    
    try {
        // 1. 查詢最近有下注的期數
        console.log('📋 1. 查詢最近有下注的期數:');
        const recentBets = await db.manyOrNone(`
            SELECT DISTINCT period 
            FROM bet_history 
            WHERE username = 'justin111' 
            AND period >= '20250717330'
            ORDER BY period DESC
            LIMIT 20
        `);
        
        console.log(`找到 ${recentBets.length} 個有下注的期數\n`);
        
        // 2. 詳細分析每期
        for (const record of recentBets) {
            const period = record.period;
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📊 期號: ${period}`);
            console.log(`${'='.repeat(80)}`);
            
            // 查詢該期下注詳情
            const periodBets = await db.manyOrNone(`
                SELECT bet_type, bet_value, position, amount, odds, win_amount
                FROM bet_history
                WHERE period = $1 AND username = 'justin111'
                ORDER BY position, bet_value
            `, [period]);
            
            // 查詢開獎結果
            const result = await db.oneOrNone(`
                SELECT position_1, position_2, position_3, position_4, position_5,
                       position_6, position_7, position_8, position_9, position_10
                FROM result_history
                WHERE period = $1
            `, [period]);
            
            if (periodBets.length > 0) {
                // 按位置分組顯示
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
                
                console.log('\n下注詳情:');
                Object.entries(betsByPosition).forEach(([pos, info]) => {
                    const coverage = (info.numbers.length / 10 * 100).toFixed(1);
                    const notBet = [];
                    for (let i = 1; i <= 10; i++) {
                        if (!info.numbers.includes(i.toString())) {
                            notBet.push(i);
                        }
                    }
                    
                    console.log(`\n  第${pos}名:`);
                    console.log(`    下注號碼: ${info.numbers.sort((a,b) => a-b).join(', ')} (${info.numbers.length}個, 覆蓋率${coverage}%)`);
                    console.log(`    未下注: ${notBet.join(', ')}`);
                    if (result) {
                        const winNum = result[`position_${pos}`];
                        const isWin = info.numbers.includes(winNum.toString());
                        console.log(`    開獎號碼: ${winNum} ${isWin ? '✅ 中獎' : '❌ 未中'}`);
                        
                        // 分析控制效果
                        if (info.numbers.length >= 7) {
                            console.log(`    ⚠️ 覆蓋率過高(${coverage}%)，控制系統難以生效`);
                        }
                    }
                    console.log(`    下注金額: ${info.totalAmount}`);
                    if (info.isWin) {
                        console.log(`    中獎金額: ${info.winAmount}`);
                    }
                });
                
                const profit = totalWin - totalBet;
                console.log(`\n統計:`);
                console.log(`  總下注: ${totalBet}`);
                console.log(`  總中獎: ${totalWin}`);
                console.log(`  盈虧: ${profit > 0 ? '+' : ''}${profit}`);
                console.log(`  中獎率: ${periodBets.length > 0 ? (winCount/periodBets.length*100).toFixed(1) : 0}%`);
                
                // 檢查控制邏輯
                const hasHighCoverage = Object.values(betsByPosition).some(info => info.numbers.length >= 7);
                if (hasHighCoverage) {
                    console.log(`\n💡 控制分析: 該期有高覆蓋率下注，90%輸控制難以生效`);
                }
            }
        }
        
        // 3. 總體統計
        console.log(`\n\n${'='.repeat(80)}`);
        console.log('📈 總體統計 (最近有下注的期數)');
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
            
            console.log(`期數: ${overallStats.period_count}`);
            console.log(`總下注數: ${overallStats.total_bets}`);
            console.log(`總下注金額: ${overallStats.total_amount}`);
            console.log(`總中獎數: ${overallStats.win_count}`);
            console.log(`總中獎金額: ${overallStats.total_win}`);
            console.log(`總盈虧: ${overallStats.total_profit > 0 ? '+' : ''}${overallStats.total_profit}`);
            console.log(`中獎率: ${winRate}%`);
            
            // 分析控制效果
            console.log(`\n🎮 控制效果分析:`);
            console.log(`當前設定: 90%輸控制 (理論中獎率10%)`);
            console.log(`實際中獎率: ${winRate}%`);
            
            if (parseFloat(winRate) > 20) {
                console.log(`⚠️ 實際中獎率高於預期，可能原因:`);
                console.log(`  1. 下注覆蓋率過高，系統無法有效控制`);
                console.log(`  2. 控制系統可能未正確執行`);
            }
        }
        
    } catch (error) {
        console.error('查詢過程中出錯:', error);
    } finally {
        await db.$pool.end();
    }
}

checkRecentPeriodsControl();