import db from './db/config.js';

async function checkRecentBets() {
    try {
        console.log('查询最近的下注和结算情况...\n');
        
        // Get the most recent bets
        const recentBets = await db.manyOrNone(`
            SELECT 
                bh.id,
                bh.period,
                bh.username,
                bh.bet_type,
                bh.bet_value,
                bh.position,
                bh.amount,
                bh.win_amount,
                bh.settled,
                bh.created_at,
                rh.created_at as draw_time,
                rh.position_1, rh.position_2, rh.position_3, rh.position_4, rh.position_5,
                rh.position_6, rh.position_7, rh.position_8, rh.position_9, rh.position_10
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE bh.username = 'justin111'
            ORDER BY bh.id DESC
            LIMIT 20
        `);
        
        console.log(`找到 ${recentBets.length} 笔最近的下注\n`);
        
        // Group by period to analyze
        const periodMap = {};
        recentBets.forEach(bet => {
            if (!periodMap[bet.period]) {
                periodMap[bet.period] = {
                    bets: [],
                    drawTime: bet.draw_time,
                    drawResult: bet.position_1 ? [
                        bet.position_1, bet.position_2, bet.position_3, bet.position_4, bet.position_5,
                        bet.position_6, bet.position_7, bet.position_8, bet.position_9, bet.position_10
                    ] : null
                };
            }
            periodMap[bet.period].bets.push(bet);
        });
        
        // Analyze each period
        for (const [period, data] of Object.entries(periodMap)) {
            console.log('='.repeat(70));
            console.log(`期号: ${period}`);
            console.log(`开奖结果: ${data.drawResult ? data.drawResult.join(',') : '尚未开奖'}`);
            console.log(`开奖时间: ${data.drawTime || '尚未开奖'}`);
            console.log(`\n该期的下注:`);
            
            data.bets.forEach(bet => {
                console.log(`\n  ID: ${bet.id}`);
                console.log(`  下注: ${bet.bet_type} - ${bet.position ? `第${bet.position}名` : ''} ${bet.bet_value}`);
                console.log(`  金额: $${bet.amount}`);
                console.log(`  下注时间: ${bet.created_at}`);
                console.log(`  已结算: ${bet.settled}`);
                console.log(`  派彩: $${bet.win_amount}`);
                
                // Check if settled before draw
                if (bet.settled && !data.drawResult) {
                    console.log(`  ⚠️ 警告: 已结算但还没有开奖结果！`);
                }
                
                // Verify settlement correctness for number bets
                if (bet.bet_type === 'number' && bet.position && data.drawResult) {
                    const position = parseInt(bet.position);
                    const betNumber = parseInt(bet.bet_value);
                    const winningNumber = data.drawResult[position - 1];
                    const shouldWin = winningNumber === betNumber;
                    const actuallyWon = bet.win_amount > 0;
                    
                    console.log(`  验证: 第${position}名开出${winningNumber}，投注${betNumber}`);
                    console.log(`  结果: ${shouldWin === actuallyWon ? '✅ 正确' : '❌ 错误'}`);
                    if (shouldWin !== actuallyWon) {
                        console.log(`  错误类型: ${shouldWin ? '应该赢但没赢' : '应该输但赢了'}`);
                    }
                }
            });
        }
        
        // Check for any bets that were settled without draw results
        console.log('\n' + '='.repeat(70));
        console.log('检查是否有在开奖前就结算的投注...\n');
        
        const problematicBets = await db.manyOrNone(`
            SELECT 
                bh.id,
                bh.period,
                bh.bet_type,
                bh.bet_value,
                bh.position,
                bh.settled,
                bh.created_at as bet_time,
                rh.created_at as draw_time
            FROM bet_history bh
            LEFT JOIN result_history rh ON bh.period = rh.period
            WHERE bh.username = 'justin111'
            AND bh.settled = true
            AND rh.created_at IS NULL
            ORDER BY bh.id DESC
            LIMIT 10
        `);
        
        if (problematicBets.length > 0) {
            console.log(`❌ 发现 ${problematicBets.length} 笔可能在开奖前就结算的投注:`);
            problematicBets.forEach(bet => {
                console.log(`\n  ID: ${bet.id}, 期号: ${bet.period}`);
                console.log(`  下注时间: ${bet.bet_time}`);
                console.log(`  开奖时间: ${bet.draw_time || '未开奖'}`);
                console.log(`  问题: 已结算但无开奖记录！`);
            });
        } else {
            console.log('✅ 没有发现在开奖前结算的投注');
        }
        
        await db.$pool.end();
        process.exit(0);
    } catch (error) {
        console.error('错误:', error);
        await db.$pool.end();
        process.exit(1);
    }
}

checkRecentBets();