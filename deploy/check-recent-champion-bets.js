// check-recent-champion-bets.js - 檢查最近的冠軍大小投注結算情況
import db from './db/config.js';

async function checkRecentChampionBets() {
    console.log('=== 檢查最近的冠軍大小投注結算情況 ===\n');
    
    try {
        // 獲取最近有冠軍大小投注的期號
        const recentPeriods = await db.manyOrNone(`
            SELECT DISTINCT bh.period
            FROM bet_history bh
            WHERE (
                (bh.bet_type = '冠軍' AND bh.bet_value IN ('大', '小'))
                OR (bh.bet_type = 'champion' AND bh.bet_value IN ('big', 'small'))
            )
            ORDER BY bh.period DESC
            LIMIT 20
        `);
        
        console.log(`找到 ${recentPeriods.length} 個有冠軍大小投注的期號\n`);
        
        let errorCount = 0;
        
        for (const periodRow of recentPeriods) {
            const period = periodRow.period;
            
            // 獲取開獎結果
            const result = await db.oneOrNone(`
                SELECT position_1
                FROM result_history
                WHERE period = $1
            `, [period]);
            
            if (!result) {
                console.log(`⚠️ 期號 ${period} 沒有開獎結果`);
                continue;
            }
            
            const champion = parseInt(result.position_1);
            const isChampionBig = champion >= 6;
            
            // 獲取該期的冠軍大小投注
            const bets = await db.manyOrNone(`
                SELECT 
                    id, username, bet_type, bet_value, 
                    amount, win, win_amount, settled
                FROM bet_history
                WHERE period = $1
                AND (
                    (bet_type = '冠軍' AND bet_value IN ('大', '小'))
                    OR (bet_type = 'champion' AND bet_value IN ('big', 'small'))
                )
            `, [period]);
            
            if (bets.length === 0) continue;
            
            let hasError = false;
            console.log(`\n期號 ${period} - 冠軍: ${champion}號 (${isChampionBig ? '大' : '小'})`);
            
            for (const bet of bets) {
                const betIsBig = (bet.bet_value === '大' || bet.bet_value === 'big');
                const shouldWin = (betIsBig && isChampionBig) || (!betIsBig && !isChampionBig);
                
                if (bet.win !== shouldWin) {
                    hasError = true;
                    errorCount++;
                    console.log(`  ❌ 錯誤: ID ${bet.id}, 用戶 ${bet.username}, 投注 ${bet.bet_value}, 應該${shouldWin ? '贏' : '輸'}, 實際${bet.win ? '贏' : '輸'}`);
                } else {
                    console.log(`  ✅ 正確: ID ${bet.id}, 用戶 ${bet.username}, 投注 ${bet.bet_value}, ${bet.win ? '贏' : '輸'}`);
                }
            }
            
            if (hasError) {
                console.log(`  ⚠️ 該期存在結算錯誤！`);
            }
        }
        
        console.log(`\n=== 總結 ===`);
        console.log(`檢查了 ${recentPeriods.length} 個期號`);
        console.log(`發現 ${errorCount} 個結算錯誤`);
        
        // 檢查是否有重複的開獎結果
        console.log('\n=== 檢查重複開獎記錄 ===');
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
            console.log(`發現 ${duplicates.length} 個期號有重複開獎記錄：`);
            for (const dup of duplicates) {
                console.log(`  期號 ${dup.period}: ${dup.count} 條記錄`);
            }
        } else {
            console.log('沒有發現重複的開獎記錄');
        }
        
    } catch (error) {
        console.error('檢查失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

checkRecentChampionBets();