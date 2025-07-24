import db from './db/config.js';

async function checkTimezoneIssue() {
    console.log('🔍 檢查時區問題\n');
    
    try {
        // 1. 檢查資料庫時區設置
        console.log('📊 資料庫時區設置:');
        const dbTimezone = await db.one("SHOW TIMEZONE");
        console.log(`資料庫時區: ${dbTimezone.timezone}`);
        
        const currentDbTime = await db.one("SELECT NOW() as db_time, NOW() AT TIME ZONE 'Asia/Shanghai' as china_time");
        console.log(`資料庫當前時間: ${currentDbTime.db_time}`);
        console.log(`中國時間: ${currentDbTime.china_time}`);
        
        // 2. 檢查最新的 result_history 記錄
        console.log('\n📊 檢查 result_history 表的時間數據:');
        const latestResults = await db.manyOrNone(`
            SELECT 
                period::text as period,
                created_at,
                draw_time,
                TO_CHAR(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI:SS') as created_at_china,
                TO_CHAR(draw_time AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI:SS') as draw_time_china,
                SUBSTRING(period::text, 1, 8) as period_date,
                SUBSTRING(period::text, 9, 3) as period_number
            FROM result_history
            WHERE result IS NOT NULL
            ORDER BY period DESC
            LIMIT 5
        `);
        
        console.log('最新5筆記錄:');
        latestResults.forEach((row, index) => {
            console.log(`\n${index + 1}. 期號: ${row.period}`);
            console.log(`   期號日期: ${row.period_date}, 期號序號: ${row.period_number}`);
            console.log(`   created_at (原始): ${row.created_at}`);
            console.log(`   created_at (中國): ${row.created_at_china}`);
            console.log(`   draw_time (原始): ${row.draw_time}`);
            console.log(`   draw_time (中國): ${row.draw_time_china}`);
            
            // 檢查期號日期和實際時間是否匹配
            const periodDate = row.period_date;
            const actualDate = row.draw_time_china ? row.draw_time_china.substring(0, 10).replace(/-/g, '') : 'N/A';
            if (periodDate !== actualDate) {
                console.log(`   ⚠️  期號日期 (${periodDate}) 與實際時間 (${actualDate}) 不匹配!`);
            }
        });
        
        // 3. 檢查今天應該有多少期
        console.log('\n📊 檢查今天 (2025-07-24) 應該有的期數:');
        const currentTime = new Date();
        const taipeiTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
        const hours = taipeiTime.getHours();
        const minutes = taipeiTime.getMinutes();
        const expectedPeriods = Math.floor((hours * 60 + minutes) / 1.5); // 每1.5分鐘一期
        
        console.log(`台北時間: ${taipeiTime.toLocaleString('zh-TW')}`);
        console.log(`預計今天應該有約 ${expectedPeriods} 期`);
        
        // 4. 檢查實際有多少期
        const todayPeriods = await db.one(`
            SELECT COUNT(*) as count
            FROM result_history
            WHERE period::text LIKE '20250724%'
            AND result IS NOT NULL
        `);
        
        console.log(`實際找到今天的期數: ${todayPeriods.count}`);
        
        // 5. 找出時間錯誤的原因
        console.log('\n📊 檢查時間設置問題:');
        const problemPeriods = await db.manyOrNone(`
            SELECT 
                period::text as period,
                draw_time,
                created_at,
                EXTRACT(EPOCH FROM (created_at - draw_time)) as time_diff_seconds
            FROM result_history
            WHERE period::text LIKE '20250724%'
            AND draw_time IS NOT NULL
            ORDER BY period DESC
            LIMIT 5
        `);
        
        problemPeriods.forEach((row) => {
            console.log(`\n期號: ${row.period}`);
            console.log(`draw_time: ${row.draw_time}`);
            console.log(`created_at: ${row.created_at}`);
            console.log(`時間差: ${Math.abs(row.time_diff_seconds)} 秒`);
        });
        
        console.log('\n✅ 檢查完成');
        
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
        console.error(error);
    }
}

// 執行檢查
checkTimezoneIssue().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤:', error);
    process.exit(1);
});