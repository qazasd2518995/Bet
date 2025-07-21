import db from './db/config.js';

async function checkRecentBets() {
    try {
        console.log('查詢最近的下注和結算情況...\n');
        
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
        
        console.log(`找到 ${recentBets.length} 筆最近的下注\n`);
        
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
            console.log(`期號: ${period}`);
            console.log(`開獎結果: ${data.drawResult ? data.drawResult.join(',') : '尚未開獎'}`);
            console.log(`開獎時間: ${data.drawTime || '尚未開獎'}`);
            console.log(`\n該期的下注:`);
            
            data.bets.forEach(bet => {
                console.log(`\n  ID: ${bet.id}`);
                console.log(`  下注: ${bet.bet_type} - ${bet.position ? `第${bet.position}名` : ''} ${bet.bet_value}`);
                console.log(`  金額: $${bet.amount}`);
                console.log(`  下注時間: ${bet.created_at}`);
                console.log(`  已結算: ${bet.settled}`);
                console.log(`  派彩: $${bet.win_amount}`);
                
                // Check if settled before draw
                if (bet.settled && !data.drawResult) {
                    console.log(`  ⚠️ 警告: 已結算但還沒有開獎結果！`);
                }
                
                // Verify settlement correctness for number bets
                if (bet.bet_type === 'number' && bet.position && data.drawResult) {
                    const position = parseInt(bet.position);
                    const betNumber = parseInt(bet.bet_value);
                    const winningNumber = data.drawResult[position - 1];
                    const shouldWin = winningNumber === betNumber;
                    const actuallyWon = bet.win_amount > 0;
                    
                    console.log(`  驗證: 第${position}名開出${winningNumber}，投注${betNumber}`);
                    console.log(`  結果: ${shouldWin === actuallyWon ? '✅ 正確' : '❌ 錯誤'}`);
                    if (shouldWin !== actuallyWon) {
                        console.log(`  錯誤類型: ${shouldWin ? '應該贏但沒贏' : '應該輸但贏了'}`);
                    }
                }
            });
        }
        
        // Check for any bets that were settled without draw results
        console.log('\n' + '='.repeat(70));
        console.log('檢查是否有在開獎前就結算的投注...\n');
        
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
            console.log(`❌ 發現 ${problematicBets.length} 筆可能在開獎前就結算的投注:`);
            problematicBets.forEach(bet => {
                console.log(`\n  ID: ${bet.id}, 期號: ${bet.period}`);
                console.log(`  下注時間: ${bet.bet_time}`);
                console.log(`  開獎時間: ${bet.draw_time || '未開獎'}`);
                console.log(`  問題: 已結算但無開獎記錄！`);
            });
        } else {
            console.log('✅ 沒有發現在開獎前結算的投注');
        }
        
        await db.$pool.end();
        process.exit(0);
    } catch (error) {
        console.error('錯誤:', error);
        await db.$pool.end();
        process.exit(1);
    }
}

checkRecentBets();