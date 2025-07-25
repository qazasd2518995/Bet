// check-settlement-before-draw.js - 檢查結算早於開獎的情況
import db from './db/config.js';

async function checkSettlementBeforeDraw() {
    console.log('=== 檢查結算早於開獎的情況 ===\n');
    
    try {
        // 檢查所有結算時間早於開獎時間的投注
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
            console.log(`發現 ${problematicBets.length} 筆結算早於開獎的投注:\n`);
            
            // 按期號分組
            const byPeriod = {};
            for (const bet of problematicBets) {
                if (!byPeriod[bet.period]) {
                    byPeriod[bet.period] = [];
                }
                byPeriod[bet.period].push(bet);
            }
            
            for (const [period, bets] of Object.entries(byPeriod)) {
                console.log(`\n期號 ${period}:`);
                console.log(`  開獎時間: ${bets[0].draw_time}`);
                console.log(`  冠軍號碼: ${bets[0].position_1}號`);
                console.log(`  問題投注:`);
                
                for (const bet of bets) {
                    const timeDiff = Math.abs(parseFloat(bet.time_diff_seconds));
                    console.log(`    ID ${bet.id}: ${bet.username} - ${bet.bet_type} ${bet.bet_value}`);
                    console.log(`      結算時間: ${bet.settled_at} (早了 ${timeDiff.toFixed(1)} 秒)`);
                    console.log(`      結果: ${bet.win ? '贏' : '輸'}, 派彩: ${bet.win_amount}`);
                }
            }
        } else {
            console.log('沒有發現結算早於開獎的情況');
        }
        
        // 檢查特定期號的詳細情況
        console.log('\n\n=== 檢查期號 20250717449 的詳細情況 ===');
        
        // 獲取該期所有投注的結算時間分佈
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
            console.log(`首次結算時間: ${st.first_settlement}`);
            console.log(`最後結算時間: ${st.last_settlement}`);
            console.log(`不同結算時間數: ${st.unique_times}`);
            console.log(`總結算投注數: ${st.total_bets}`);
        }
        
        // 檢查是否有多個開獎結果版本
        console.log('\n=== 檢查開獎結果歷史 ===');
        const resultHistory = await db.manyOrNone(`
            SELECT 
                id,
                period,
                position_1,
                draw_time,
                created_at,
                CASE 
                    WHEN created_at > draw_time THEN '異常：創建時間晚於開獎時間'
                    ELSE '正常'
                END as status
            FROM result_history
            WHERE period = '20250717449'
            ORDER BY created_at
        `);
        
        if (resultHistory.length > 0) {
            console.log(`找到 ${resultHistory.length} 條開獎記錄:`);
            for (const rec of resultHistory) {
                console.log(`\nID: ${rec.id}`);
                console.log(`  冠軍: ${rec.position_1}號`);
                console.log(`  開獎時間: ${rec.draw_time}`);
                console.log(`  創建時間: ${rec.created_at}`);
                console.log(`  狀態: ${rec.status}`);
            }
        }
        
    } catch (error) {
        console.error('檢查失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

checkSettlementBeforeDraw();