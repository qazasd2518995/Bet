// check-settlement-before-draw.js - 检查结算早于开奖的情况
import db from './db/config.js';

async function checkSettlementBeforeDraw() {
    console.log('=== 检查结算早于开奖的情况 ===\n');
    
    try {
        // 检查所有结算时间早于开奖时间的投注
        const problematicBets = await db.manyOrNone(`
            SELECT 
                bh.id,
                bh.period,
                bh.username,
                bh.bet_type,
                bh.bet_value,
                bh.amount,
                bh.win,
                bh.win_amount,
                bh.created_at as bet_time,
                bh.settled_at,
                rh.draw_time,
                rh.position_1,
                EXTRACT(EPOCH FROM (bh.settled_at - rh.draw_time)) as time_diff_seconds
            FROM bet_history bh
            INNER JOIN result_history rh ON bh.period = rh.period
            WHERE bh.settled = true
            AND bh.settled_at < rh.draw_time
            AND bh.period::text LIKE '202507%'
            ORDER BY bh.period DESC, bh.settled_at DESC
            LIMIT 50
        `);
        
        if (problematicBets.length > 0) {
            console.log(`发现 ${problematicBets.length} 笔结算早于开奖的投注:\n`);
            
            // 按期号分组
            const byPeriod = {};
            for (const bet of problematicBets) {
                if (!byPeriod[bet.period]) {
                    byPeriod[bet.period] = [];
                }
                byPeriod[bet.period].push(bet);
            }
            
            for (const [period, bets] of Object.entries(byPeriod)) {
                console.log(`\n期号 ${period}:`);
                console.log(`  开奖时间: ${bets[0].draw_time}`);
                console.log(`  冠军号码: ${bets[0].position_1}号`);
                console.log(`  问题投注:`);
                
                for (const bet of bets) {
                    const timeDiff = Math.abs(parseFloat(bet.time_diff_seconds));
                    console.log(`    ID ${bet.id}: ${bet.username} - ${bet.bet_type} ${bet.bet_value}`);
                    console.log(`      结算时间: ${bet.settled_at} (早了 ${timeDiff.toFixed(1)} 秒)`);
                    console.log(`      结果: ${bet.win ? '赢' : '输'}, 派彩: ${bet.win_amount}`);
                }
            }
        } else {
            console.log('没有发现结算早于开奖的情况');
        }
        
        // 检查特定期号的详细情况
        console.log('\n\n=== 检查期号 20250717449 的详细情况 ===');
        
        // 获取该期所有投注的结算时间分布
        const settlementTimes = await db.manyOrNone(`
            SELECT 
                MIN(settled_at) as first_settlement,
                MAX(settled_at) as last_settlement,
                COUNT(DISTINCT settled_at) as unique_times,
                COUNT(*) as total_bets
            FROM bet_history
            WHERE period = '20250717449'
            AND settled = true
        `);
        
        if (settlementTimes[0]) {
            const st = settlementTimes[0];
            console.log(`首次结算时间: ${st.first_settlement}`);
            console.log(`最后结算时间: ${st.last_settlement}`);
            console.log(`不同结算时间数: ${st.unique_times}`);
            console.log(`总结算投注数: ${st.total_bets}`);
        }
        
        // 检查是否有多个开奖结果版本
        console.log('\n=== 检查开奖结果历史 ===');
        const resultHistory = await db.manyOrNone(`
            SELECT 
                id,
                period,
                position_1,
                draw_time,
                created_at,
                CASE 
                    WHEN created_at > draw_time THEN '异常：创建时间晚于开奖时间'
                    ELSE '正常'
                END as status
            FROM result_history
            WHERE period = '20250717449'
            ORDER BY created_at
        `);
        
        if (resultHistory.length > 0) {
            console.log(`找到 ${resultHistory.length} 条开奖记录:`);
            for (const rec of resultHistory) {
                console.log(`\nID: ${rec.id}`);
                console.log(`  冠军: ${rec.position_1}号`);
                console.log(`  开奖时间: ${rec.draw_time}`);
                console.log(`  创建时间: ${rec.created_at}`);
                console.log(`  状态: ${rec.status}`);
            }
        }
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        await db.$pool.end();
    }
}

checkSettlementBeforeDraw();