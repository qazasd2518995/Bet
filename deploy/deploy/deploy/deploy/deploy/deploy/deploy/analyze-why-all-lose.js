// analyze-why-all-lose.js - 深入分析為什麼所有投注都顯示為輸
import db from './db/config.js';

async function analyzeWhyAllLose() {
    try {
        console.log('🔍 深入分析為什麼所有投注都顯示為輸...\n');
        
        // 1. 分析結算流程
        console.log('📋 分析結算流程:');
        console.log('1. backend.js 調用 settleBets(period, {positions: array})');
        console.log('2. settleBets 調用 improvedSettleBets(period, winResult)');
        console.log('3. improvedSettleBets 查詢未結算的注單');
        console.log('4. 對每筆注單調用 checkWin(bet, winResult)');
        console.log('5. checkWin 根據 bet_type 和 bet_value 判斷是否中獎\n');
        
        // 2. 檢查一個具體的錯誤案例
        console.log('🔍 檢查具體錯誤案例 - 期號291:');
        
        // 獲取期號291的結果和一些投注
        const period291Result = await db.one('SELECT result FROM result_history WHERE period = 20250714291');
        const period291Bets = await db.any(`
            SELECT id, bet_type, bet_value, win, win_amount
            FROM bet_history 
            WHERE period = 20250714291 AND username = 'justin111'
            AND bet_type = 'champion' AND bet_value IN ('big', 'even')
            LIMIT 2
        `);
        
        console.log('開獎結果:', period291Result.result);
        console.log('冠軍號碼:', period291Result.result[0]);
        console.log('投注案例:');
        period291Bets.forEach(bet => {
            console.log(`  ${bet.bet_type} ${bet.bet_value}: ${bet.win ? '中獎' : '輸'}`);
        });
        
        // 3. 分析所有期號的中獎率
        console.log('\n📊 分析各期號的中獎率:');
        const winRateAnalysis = await db.any(`
            SELECT 
                period,
                COUNT(*) as total_bets,
                SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as winning_bets,
                ROUND(SUM(CASE WHEN win = true THEN 1 ELSE 0 END)::numeric / COUNT(*)::numeric * 100, 2) as win_rate
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714280
                AND bet_value IN ('big', 'small', 'odd', 'even')
            GROUP BY period
            ORDER BY period DESC
            LIMIT 15
        `);
        
        winRateAnalysis.forEach(p => {
            const status = p.win_rate == 0 ? '❌' : p.win_rate > 40 ? '✅' : '⚠️';
            console.log(`${status} 期號 ${p.period}: ${p.total_bets}筆投注, ${p.winning_bets}筆中獎, 中獎率 ${p.win_rate}%`);
        });
        
        // 4. 檢查結算時的數據流
        console.log('\n🔍 檢查可能的問題點:');
        
        // 問題1：settled = true 但 win = false
        const suspiciousBets = await db.one(`
            SELECT COUNT(*) as count
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period >= 20250714290
                AND settled = true 
                AND win = false 
                AND win_amount = 0
                AND bet_value IN ('big', 'small', 'odd', 'even')
        `);
        
        console.log(`1. 已結算但顯示為輸的大小單雙投注: ${suspiciousBets.count}筆`);
        
        // 問題2：結算日誌顯示總中獎金額為0
        const zeroWinLogs = await db.any(`
            SELECT period, settled_count, total_win_amount
            FROM settlement_logs 
            WHERE total_win_amount = 0 
                AND settled_count >= 20
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        console.log(`2. 結算日誌顯示總中獎金額為0的期號: ${zeroWinLogs.length}個`);
        zeroWinLogs.forEach(log => {
            console.log(`   期號 ${log.period}: 結算${log.settled_count}筆, 總中獎$${log.total_win_amount}`);
        });
        
        // 5. 推測根本原因
        console.log('\n💡 可能的根本原因:');
        console.log('1. **初始結算邏輯錯誤**: 在創建bet_history記錄時就錯誤地設置了win=false');
        console.log('2. **結算執行時機問題**: 可能在投注還在處理中時就執行了結算');
        console.log('3. **checkWin函數邏輯問題**: 雖然測試通過，但實際運行時可能有其他條件');
        console.log('4. **數據格式不一致**: winResult的格式可能與預期不同');
        console.log('5. **並發問題**: 多個結算進程同時運行導致數據錯亂');
        
        // 6. 檢查初始投注創建
        console.log('\n🔍 檢查投注創建時的默認值:');
        const recentBetDefaults = await db.one(`
            SELECT 
                COUNT(CASE WHEN win = false THEN 1 END) as default_false,
                COUNT(CASE WHEN win = true THEN 1 END) as default_true,
                COUNT(CASE WHEN win IS NULL THEN 1 END) as default_null
            FROM bet_history 
            WHERE username = 'justin111' 
                AND created_at >= NOW() - INTERVAL '1 day'
        `);
        
        console.log(`win默認為false: ${recentBetDefaults.default_false}筆`);
        console.log(`win默認為true: ${recentBetDefaults.default_true}筆`);
        console.log(`win默認為null: ${recentBetDefaults.default_null}筆`);
        
        if (recentBetDefaults.default_false > 0 && recentBetDefaults.default_true === 0) {
            console.log('\n⚠️ 發現問題: 所有投注創建時win都默認為false');
            console.log('這可能導致如果結算邏輯沒有正確執行，所有投注都會保持為輸的狀態');
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('分析過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

analyzeWhyAllLose();