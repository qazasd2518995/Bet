// check-recent-champion-bets.js - 检查最近的冠军大小投注结算情况
import db from './db/config.js';

async function checkRecentChampionBets() {
    console.log('=== 检查最近的冠军大小投注结算情况 ===\n');
    
    try {
        // 获取最近有冠军大小投注的期号
        const recentPeriods = await db.manyOrNone(`
            SELECT DISTINCT bh.period
            FROM bet_history bh
            WHERE (
                (bh.bet_type = '冠军' AND bh.bet_value IN ('大', '小'))
                OR (bh.bet_type = 'champion' AND bh.bet_value IN ('big', 'small'))
            )
            ORDER BY bh.period DESC
            LIMIT 20
        `);
        
        console.log(`找到 ${recentPeriods.length} 个有冠军大小投注的期号\n`);
        
        let errorCount = 0;
        
        for (const periodRow of recentPeriods) {
            const period = periodRow.period;
            
            // 获取开奖结果
            const result = await db.oneOrNone(`
                SELECT position_1
                FROM result_history
                WHERE period = $1
            `, [period]);
            
            if (!result) {
                console.log(`⚠️ 期号 ${period} 没有开奖结果`);
                continue;
            }
            
            const champion = parseInt(result.position_1);
            const isChampionBig = champion >= 6;
            
            // 获取该期的冠军大小投注
            const bets = await db.manyOrNone(`
                SELECT 
                    id, username, bet_type, bet_value, 
                    amount, win, win_amount, settled
                FROM bet_history
                WHERE period = $1
                AND (
                    (bet_type = '冠军' AND bet_value IN ('大', '小'))
                    OR (bet_type = 'champion' AND bet_value IN ('big', 'small'))
                )
            `, [period]);
            
            if (bets.length === 0) continue;
            
            let hasError = false;
            console.log(`\n期号 ${period} - 冠军: ${champion}号 (${isChampionBig ? '大' : '小'})`);
            
            for (const bet of bets) {
                const betIsBig = (bet.bet_value === '大' || bet.bet_value === 'big');
                const shouldWin = (betIsBig && isChampionBig) || (!betIsBig && !isChampionBig);
                
                if (bet.win !== shouldWin) {
                    hasError = true;
                    errorCount++;
                    console.log(`  ❌ 错误: ID ${bet.id}, 用户 ${bet.username}, 投注 ${bet.bet_value}, 应该${shouldWin ? '赢' : '输'}, 实际${bet.win ? '赢' : '输'}`);
                } else {
                    console.log(`  ✅ 正确: ID ${bet.id}, 用户 ${bet.username}, 投注 ${bet.bet_value}, ${bet.win ? '赢' : '输'}`);
                }
            }
            
            if (hasError) {
                console.log(`  ⚠️ 该期存在结算错误！`);
            }
        }
        
        console.log(`\n=== 总结 ===`);
        console.log(`检查了 ${recentPeriods.length} 个期号`);
        console.log(`发现 ${errorCount} 个结算错误`);
        
        // 检查是否有重复的开奖结果
        console.log('\n=== 检查重复开奖记录 ===');
        const duplicates = await db.manyOrNone(`
            SELECT period, COUNT(*) as count
            FROM result_history
            WHERE period IN (SELECT period FROM bet_history WHERE period LIKE '202507%')
            GROUP BY period
            HAVING COUNT(*) > 1
            ORDER BY period DESC
            LIMIT 10
        `);
        
        if (duplicates.length > 0) {
            console.log(`发现 ${duplicates.length} 个期号有重复开奖记录：`);
            for (const dup of duplicates) {
                console.log(`  期号 ${dup.period}: ${dup.count} 条记录`);
            }
        } else {
            console.log('没有发现重复的开奖记录');
        }
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        await db.$pool.end();
    }
}

checkRecentChampionBets();