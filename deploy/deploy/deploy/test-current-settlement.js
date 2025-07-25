// test-current-settlement.js - 測試當前結算系統
import db from './db/config.js';

async function testCurrentSettlement() {
    try {
        console.log('🧪 測試當前結算系統是否正常工作...\n');
        
        // 1. 檢查最近幾期的結算狀況
        const recentPeriods = await db.any(`
            SELECT sl.period, sl.settled_count, sl.win_count, sl.total_win_amount,
                   rh.result, sl.created_at
            FROM settlement_logs sl
            LEFT JOIN result_history rh ON sl.period = rh.period
            WHERE sl.period >= 20250714400
            ORDER BY sl.period DESC
            LIMIT 5
        `);
        
        console.log('最近5期結算狀況:');
        recentPeriods.forEach(period => {
            console.log(`期號 ${period.period}:`);
            console.log(`  結算數量: ${period.settled_count}`);
            console.log(`  中獎數量: ${period.win_count || 0}`);
            console.log(`  總派彩: ${period.total_win_amount}`);
            console.log(`  開獎結果: ${period.result ? period.result.slice(0,3).join(',') + '...' : '無'}`);
            console.log(`  結算時間: ${period.created_at}`);
            console.log('');
        });
        
        // 2. 檢查是否有未結算的投注
        const unsettledCount = await db.one(`
            SELECT COUNT(*) as count FROM bet_history WHERE settled = false
        `);
        
        console.log(`未結算投注數量: ${unsettledCount.count}`);
        
        // 3. 檢查最近的投注中獎率
        const recentBets = await db.any(`
            SELECT period, 
                   COUNT(*) as total_bets,
                   SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as winning_bets,
                   SUM(win_amount) as total_winnings
            FROM bet_history 
            WHERE period >= 20250714400 AND settled = true
            GROUP BY period 
            ORDER BY period DESC
            LIMIT 5
        `);
        
        console.log('\n最近5期投注統計:');
        recentBets.forEach(stats => {
            const winRate = stats.total_bets > 0 ? (stats.winning_bets / stats.total_bets * 100).toFixed(1) : 0;
            console.log(`期號 ${stats.period}: ${stats.total_bets}筆投注, ${stats.winning_bets}筆中獎 (${winRate}%), 總派彩 ${stats.total_winnings}`);
        });
        
        // 4. 檢查特定投注類型的中獎情況
        const numberBets = await db.any(`
            SELECT b.period, b.bet_type, b.bet_value, b.position, b.win, 
                   rh.result
            FROM bet_history b
            LEFT JOIN result_history rh ON b.period = rh.period
            WHERE b.bet_type = 'number' 
                AND b.period >= 20250714400 
                AND b.settled = true
            ORDER BY b.period DESC, b.position, b.bet_value
            LIMIT 10
        `);
        
        console.log('\n最近號碼投注檢查:');
        numberBets.forEach(bet => {
            if (bet.result && Array.isArray(bet.result) && bet.position) {
                const positionIndex = parseInt(bet.position) - 1;
                const actualNumber = bet.result[positionIndex];
                const betNumber = parseInt(bet.bet_value);
                const shouldWin = actualNumber === betNumber;
                const status = bet.win === shouldWin ? '✅ 正確' : '❌ 錯誤';
                
                console.log(`期號 ${bet.period}, 位置${bet.position}, 投注${betNumber}, 開出${actualNumber}, 結果${bet.win ? '中' : '未中'} ${status}`);
            }
        });
        
        await db.$pool.end();
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

testCurrentSettlement();