import db from './db/config.js';

async function checkTimezoneIssue() {
    console.log('🔍 检查时区问题\n');
    
    try {
        // 1. 检查资料库时区设置
        console.log('📊 资料库时区设置:');
        const dbTimezone = await db.one("SHOW TIMEZONE");
        console.log(`资料库时区: ${dbTimezone.timezone}`);
        
        const currentDbTime = await db.one("SELECT NOW() as db_time, NOW() AT TIME ZONE 'Asia/Shanghai' as china_time");
        console.log(`资料库当前时间: ${currentDbTime.db_time}`);
        console.log(`中国时间: ${currentDbTime.china_time}`);
        
        // 2. 检查最新的 result_history 记录
        console.log('\n📊 检查 result_history 表的时间数据:');
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
        
        console.log('最新5笔记录:');
        latestResults.forEach((row, index) => {
            console.log(`\n${index + 1}. 期号: ${row.period}`);
            console.log(`   期号日期: ${row.period_date}, 期号序号: ${row.period_number}`);
            console.log(`   created_at (原始): ${row.created_at}`);
            console.log(`   created_at (中国): ${row.created_at_china}`);
            console.log(`   draw_time (原始): ${row.draw_time}`);
            console.log(`   draw_time (中国): ${row.draw_time_china}`);
            
            // 检查期号日期和实际时间是否匹配
            const periodDate = row.period_date;
            const actualDate = row.draw_time_china ? row.draw_time_china.substring(0, 10).replace(/-/g, '') : 'N/A';
            if (periodDate !== actualDate) {
                console.log(`   ⚠️  期号日期 (${periodDate}) 与实际时间 (${actualDate}) 不匹配!`);
            }
        });
        
        // 3. 检查今天应该有多少期
        console.log('\n📊 检查今天 (2025-07-24) 应该有的期数:');
        const currentTime = new Date();
        const taipeiTime = new Date(currentTime.toLocaleString("en-US", {timeZone: "Asia/Taipei"}));
        const hours = taipeiTime.getHours();
        const minutes = taipeiTime.getMinutes();
        const expectedPeriods = Math.floor((hours * 60 + minutes) / 1.5); // 每1.5分钟一期
        
        console.log(`台北时间: ${taipeiTime.toLocaleString('zh-TW')}`);
        console.log(`预计今天应该有约 ${expectedPeriods} 期`);
        
        // 4. 检查实际有多少期
        const todayPeriods = await db.one(`
            SELECT COUNT(*) as count
            FROM result_history
            WHERE period::text LIKE '20250724%'
            AND result IS NOT NULL
        `);
        
        console.log(`实际找到今天的期数: ${todayPeriods.count}`);
        
        // 5. 找出时间错误的原因
        console.log('\n📊 检查时间设置问题:');
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
            console.log(`\n期号: ${row.period}`);
            console.log(`draw_time: ${row.draw_time}`);
            console.log(`created_at: ${row.created_at}`);
            console.log(`时间差: ${Math.abs(row.time_diff_seconds)} 秒`);
        });
        
        console.log('\n✅ 检查完成');
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error);
    }
}

// 执行检查
checkTimezoneIssue().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('❌ 错误:', error);
    process.exit(1);
});