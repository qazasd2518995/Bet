// check-api-time-format.js - 檢查API返回的時間格式
import db from './db/config.js';

async function checkApiTimeFormat() {
    try {
        console.log('🔍 檢查API返回的時間格式...\n');
        
        // 1. 直接從資料庫查詢一筆最近的投注
        const recentBet = await db.oneOrNone(`
            SELECT 
                id, 
                period,
                created_at,
                created_at::text as created_at_text,
                created_at AT TIME ZONE 'UTC' as utc_time,
                created_at AT TIME ZONE 'Asia/Taipei' as taipei_time
            FROM bet_history 
            WHERE username = 'justin111'
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        
        if (recentBet) {
            console.log('資料庫中的時間格式:');
            console.log(`  ID: ${recentBet.id}, 期號: ${recentBet.period}`);
            console.log(`  created_at (原始): ${recentBet.created_at}`);
            console.log(`  created_at (文字): ${recentBet.created_at_text}`);
            console.log(`  UTC時間: ${recentBet.utc_time}`);
            console.log(`  台北時間: ${recentBet.taipei_time}`);
            
            // 2. 測試JavaScript Date解析
            console.log('\nJavaScript解析測試:');
            const jsDate = new Date(recentBet.created_at);
            console.log(`  new Date(): ${jsDate}`);
            console.log(`  toISOString(): ${jsDate.toISOString()}`);
            console.log(`  getTimezoneOffset(): ${jsDate.getTimezoneOffset()} 分鐘`);
            
            // 3. 測試不同的轉換方法
            console.log('\n轉換方法比較:');
            
            // 方法1: 手動加8小時
            const manualTaipei = new Date(jsDate.getTime() + 8 * 60 * 60 * 1000);
            console.log(`  手動+8小時: ${manualTaipei.getHours()}:${manualTaipei.getMinutes()}`);
            
            // 方法2: toLocaleString
            const localeString = jsDate.toLocaleString('en-US', {
                timeZone: 'Asia/Taipei',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            console.log(`  toLocaleString: ${localeString}`);
            
            // 方法3: 直接使用getHours
            console.log(`  直接getHours: ${jsDate.getHours()}:${jsDate.getMinutes()}`);
        }
        
        // 4. 檢查day-detail API的時間格式
        console.log('\n檢查day-detail API返回格式:');
        const dayResult = await db.oneOrNone(`
            SELECT 
                bh.created_at,
                TO_CHAR(bh.created_at, 'YYYY-MM-DD HH24:MI:SS') as formatted_time,
                TO_CHAR(bh.created_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD HH24:MI:SS') as taipei_formatted
            FROM bet_history bh
            WHERE bh.username = 'justin111'
            ORDER BY bh.created_at DESC
            LIMIT 1
        `);
        
        if (dayResult) {
            console.log(`  資料庫時間: ${dayResult.created_at}`);
            console.log(`  格式化時間: ${dayResult.formatted_time}`);
            console.log(`  台北格式化: ${dayResult.taipei_formatted}`);
        }
        
        await db.$pool.end();
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
        await db.$pool.end();
    }
}

checkApiTimeFormat();