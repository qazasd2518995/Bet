// check-bet-display-logic.js - 檢查投注記錄顯示邏輯
import db from './db/config.js';

async function checkBetDisplayLogic() {
    try {
        console.log('🔍 檢查投注記錄顯示邏輯...\n');
        
        // 1. 檢查今日所有投注記錄
        const today = new Date().toISOString().split('T')[0]; // 2025-07-14
        
        const allTodayBets = await db.any(`
            SELECT period, COUNT(*) as count, 
                   MIN(created_at) as first_bet, 
                   MAX(created_at) as last_bet
            FROM bet_history 
            WHERE username = 'justin111' 
                AND DATE(created_at) = $1
            GROUP BY period
            ORDER BY period DESC
        `, [today]);
        
        console.log(`📅 今日 (${today}) 投注統計:\n`);
        
        let totalBetsToday = 0;
        allTodayBets.forEach(period => {
            totalBetsToday += parseInt(period.count);
            console.log(`期號 ${period.period}: ${period.count} 筆投注`);
            console.log(`  時間範圍: ${new Date(period.first_bet).toLocaleString('zh-TW')} - ${new Date(period.last_bet).toLocaleString('zh-TW')}`);
        });
        
        console.log(`\n今日總投注數: ${totalBetsToday} 筆`);
        
        // 2. 檢查期號299的詳細投注
        console.log('\n📊 期號299投注詳情:');
        
        const period299Bets = await db.any(`
            SELECT id, bet_type, bet_value, amount, win, win_amount, created_at
            FROM bet_history 
            WHERE username = 'justin111' 
                AND period = 20250714299
            ORDER BY id
        `);
        
        console.log(`期號299總投注數: ${period299Bets.length} 筆`);
        
        // 顯示前10筆和後10筆
        if (period299Bets.length > 20) {
            console.log('\n前10筆投注:');
            period299Bets.slice(0, 10).forEach(bet => {
                console.log(`  ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${bet.win ? '中獎' : '輸'}`);
            });
            
            console.log('\n...(中間省略)...\n');
            
            console.log('後10筆投注:');
            period299Bets.slice(-10).forEach(bet => {
                console.log(`  ID ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${bet.win ? '中獎' : '輸'}`);
            });
        }
        
        // 3. 檢查前端API限制
        console.log('\n🔍 檢查前端API查詢邏輯:');
        
        // 模擬前端查詢
        const queryWithLimit = await db.any(`
            SELECT id, period, bet_type, bet_value, amount, win, win_amount
            FROM bet_history 
            WHERE username = 'justin111' 
                AND DATE(created_at) = $1
            ORDER BY created_at DESC 
            LIMIT 20
        `, [today]);
        
        console.log(`\n使用 LIMIT 20 查詢結果: ${queryWithLimit.length} 筆`);
        
        // 查看是否有分頁
        const queryWithOffset = await db.any(`
            SELECT id, period, bet_type, bet_value, amount, win, win_amount
            FROM bet_history 
            WHERE username = 'justin111' 
                AND DATE(created_at) = $1
            ORDER BY created_at DESC 
            LIMIT 20 OFFSET 20
        `, [today]);
        
        console.log(`第二頁 (OFFSET 20) 查詢結果: ${queryWithOffset.length} 筆`);
        
        // 4. 查看backend.js的查詢邏輯
        console.log('\n📝 Backend.js 查詢邏輯分析:');
        console.log('根據之前的日誌，backend.js 使用了:');
        console.log('- LIMIT 20 OFFSET 0 (第一頁只顯示20筆)');
        console.log('- 這解釋了為什麼只看到20筆投注記錄');
        
        // 5. 建議修復方案
        console.log('\n💡 修復建議:');
        console.log('1. 修改前端顯示邏輯，支援分頁或一次顯示更多記錄');
        console.log('2. 或修改backend.js，增加每頁顯示數量 (如 LIMIT 100)');
        console.log('3. 添加"載入更多"或分頁按鈕功能');
        
        // 6. 實際應顯示的記錄數
        const shouldDisplay = await db.one(`
            SELECT COUNT(*) as total
            FROM bet_history 
            WHERE username = 'justin111' 
                AND DATE(created_at) = $1
        `, [today]);
        
        console.log(`\n📊 總結:`);
        console.log(`今日實際投注總數: ${shouldDisplay.total} 筆`);
        console.log(`前端目前只顯示: 20 筆 (第一頁)`);
        console.log(`缺少顯示: ${shouldDisplay.total - 20} 筆`);
        
        await db.$pool.end();
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

checkBetDisplayLogic();