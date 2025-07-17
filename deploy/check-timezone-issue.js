// check-timezone-issue.js - 檢查時區問題
import db from './db/config.js';

async function checkTimezoneIssue() {
    try {
        console.log('🕐 檢查時區問題...\n');
        
        // 1. 檢查資料庫中的時間
        const recentBet = await db.oneOrNone(`
            SELECT id, created_at, created_at AT TIME ZONE 'Asia/Taipei' as taipei_time
            FROM bet_history 
            WHERE username = 'justin111'
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        if (recentBet) {
            console.log('最近一筆投注的時間:');
            console.log(`  資料庫原始時間: ${recentBet.created_at}`);
            console.log(`  台北時間: ${recentBet.taipei_time}`);
            console.log(`  JavaScript Date: ${new Date(recentBet.created_at).toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
        }
        
        // 2. 檢查系統時間
        console.log('\n系統時間檢查:');
        const now = new Date();
        console.log(`  系統當前時間 (UTC): ${now.toISOString()}`);
        console.log(`  系統當前時間 (Local): ${now.toString()}`);
        console.log(`  台北時間: ${now.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
        
        // 3. 檢查時區設定
        console.log('\n時區設定:');
        console.log(`  系統時區偏移: ${now.getTimezoneOffset()} 分鐘`);
        console.log(`  預期台北時間 (UTC+8): ${new Date().toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
        
        // 4. 檢查最近的投注記錄
        const recentBets = await db.any(`
            SELECT 
                id, 
                period, 
                created_at,
                created_at AT TIME ZONE 'Asia/Taipei' as taipei_time
            FROM bet_history 
            WHERE username = 'justin111'
                AND created_at >= NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log('\n最近一小時的投注記錄:');
        recentBets.forEach(bet => {
            const jsDate = new Date(bet.created_at);
            console.log(`\nID ${bet.id} - 期號 ${bet.period}:`);
            console.log(`  DB原始: ${bet.created_at}`);
            console.log(`  DB台北: ${bet.taipei_time}`);
            console.log(`  JS台北: ${jsDate.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
        });
        
        // 5. 建議修復方案
        console.log('\n💡 修復建議:');
        console.log('1. 前端顯示時應該使用 toLocaleString("zh-TW", {timeZone: "Asia/Taipei"})');
        console.log('2. 或在後端API返回時就轉換為台北時間');
        console.log('3. 確保所有時間顯示都統一使用台北時區');
        
        await db.$pool.end();
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

checkTimezoneIssue();