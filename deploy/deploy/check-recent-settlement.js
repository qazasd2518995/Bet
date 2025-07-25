import db from './db/config.js';

async function checkRecentSettlement() {
    try {
        // 查詢最近的期號
        const recentPeriod = await db.oneOrNone(`
            SELECT period, created_at
            FROM result_history 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        if (recentPeriod) {
            console.log('最近期號:', recentPeriod.period);
            console.log('開獎時間:', recentPeriod.created_at);
            
            // 查詢該期的結算日誌
            const logs = await db.manyOrNone(`
                SELECT * FROM settlement_logs 
                WHERE period = $1 
                ORDER BY created_at DESC
            `, [recentPeriod.period]);
            
            if (logs && logs.length > 0) {
                console.log('\n結算日誌:');
                logs.forEach(log => {
                    console.log(`  ${log.created_at}: ${log.status} - ${log.message}`);
                    if (log.details) {
                        try {
                            const details = JSON.parse(log.details);
                            if (details.positions) {
                                console.log(`    開獎結果: [${details.positions.join(', ')}]`);
                            }
                            if (details.settledCount !== undefined) {
                                console.log(`    結算統計: ${details.settledCount}筆結算, ${details.winCount}筆中獎, 總派彩${details.totalWinAmount}`);
                            }
                        } catch (e) {
                            // 忽略JSON解析錯誤
                        }
                    }
                });
            } else {
                console.log('該期還沒有結算日誌');
            }
            
            // 查詢該期的開獎結果
            const result = await db.oneOrNone(`
                SELECT position_1, position_2, position_3, position_4, position_5,
                       position_6, position_7, position_8, position_9, position_10
                FROM result_history
                WHERE period = $1
            `, [recentPeriod.period]);
            
            if (result) {
                console.log('\n開獎結果:');
                for (let i = 1; i <= 10; i++) {
                    console.log(`  第${i}名: ${result[`position_${i}`]}號`);
                }
            }
            
            // 查詢該期的投注和結算情況
            const betStats = await db.oneOrNone(`
                SELECT 
                    COUNT(*) as total_bets,
                    COUNT(CASE WHEN settled = true THEN 1 END) as settled_bets,
                    COUNT(CASE WHEN win = true THEN 1 END) as win_bets,
                    SUM(amount) as total_bet_amount,
                    SUM(CASE WHEN win = true THEN win_amount ELSE 0 END) as total_win_amount
                FROM bet_history
                WHERE period = $1
            `, [recentPeriod.period]);
            
            if (betStats) {
                console.log('\n投注統計:');
                console.log(`  總投注數: ${betStats.total_bets}`);
                console.log(`  已結算數: ${betStats.settled_bets}`);
                console.log(`  中獎數: ${betStats.win_bets}`);
                console.log(`  總投注額: ${betStats.total_bet_amount || 0}`);
                console.log(`  總派彩額: ${betStats.total_win_amount || 0}`);
            }
        } else {
            console.log('沒有找到任何開獎記錄');
        }
        
    } catch (error) {
        console.error('查詢失敗:', error);
    } finally {
        process.exit(0);
    }
}

checkRecentSettlement();