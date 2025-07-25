import db from './db/config.js';

async function checkRecentSettlement() {
    try {
        // 查询最近的期号
        const recentPeriod = await db.oneOrNone(`
            SELECT period, created_at
            FROM result_history 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        if (recentPeriod) {
            console.log('最近期号:', recentPeriod.period);
            console.log('开奖时间:', recentPeriod.created_at);
            
            // 查询该期的结算日志
            const logs = await db.manyOrNone(`
                SELECT * FROM settlement_logs 
                WHERE period = $1 
                ORDER BY created_at DESC
            `, [recentPeriod.period]);
            
            if (logs && logs.length > 0) {
                console.log('\n结算日志:');
                logs.forEach(log => {
                    console.log(`  ${log.created_at}: ${log.status} - ${log.message}`);
                    if (log.details) {
                        try {
                            const details = JSON.parse(log.details);
                            if (details.positions) {
                                console.log(`    开奖结果: [${details.positions.join(', ')}]`);
                            }
                            if (details.settledCount !== undefined) {
                                console.log(`    结算统计: ${details.settledCount}笔结算, ${details.winCount}笔中奖, 总派彩${details.totalWinAmount}`);
                            }
                        } catch (e) {
                            // 忽略JSON解析错误
                        }
                    }
                });
            } else {
                console.log('该期还没有结算日志');
            }
            
            // 查询该期的开奖结果
            const result = await db.oneOrNone(`
                SELECT position_1, position_2, position_3, position_4, position_5,
                       position_6, position_7, position_8, position_9, position_10
                FROM result_history
                WHERE period = $1
            `, [recentPeriod.period]);
            
            if (result) {
                console.log('\n开奖结果:');
                for (let i = 1; i <= 10; i++) {
                    console.log(`  第${i}名: ${result[`position_${i}`]}号`);
                }
            }
            
            // 查询该期的投注和结算情况
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
                console.log('\n投注统计:');
                console.log(`  总投注数: ${betStats.total_bets}`);
                console.log(`  已结算数: ${betStats.settled_bets}`);
                console.log(`  中奖数: ${betStats.win_bets}`);
                console.log(`  总投注额: ${betStats.total_bet_amount || 0}`);
                console.log(`  总派彩额: ${betStats.total_win_amount || 0}`);
            }
        } else {
            console.log('没有找到任何开奖记录');
        }
        
    } catch (error) {
        console.error('查询失败:', error);
    } finally {
        process.exit(0);
    }
}

checkRecentSettlement();