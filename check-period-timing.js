// check-period-timing.js - 检查期号时序问题
import db from './db/config.js';

async function checkPeriodTiming() {
    console.log('🕒 检查期号时序问题\n');

    try {
        // 1. 检查开奖时间间隔
        console.log('📊 分析开奖时间间隔：');
        const drawIntervals = await db.any(`
            WITH draw_times AS (
                SELECT 
                    period,
                    created_at,
                    LAG(created_at) OVER (ORDER BY period) as prev_time,
                    EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY period))) as interval_seconds
                FROM result_history
                WHERE period IS NOT NULL
                ORDER BY period DESC
                LIMIT 100
            )
            SELECT 
                period,
                created_at,
                interval_seconds,
                CASE 
                    WHEN interval_seconds < 60 THEN '过快'
                    WHEN interval_seconds > 180 THEN '过慢'
                    ELSE '正常'
                END as status
            FROM draw_times
            WHERE interval_seconds IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 20
        `);

        console.log('\n最近20期开奖间隔：');
        let tooFast = 0, tooSlow = 0;
        for (const record of drawIntervals) {
            const minutes = Math.floor(record.interval_seconds / 60);
            const seconds = Math.floor(record.interval_seconds % 60);
            console.log(`期号 ${record.period}: ${minutes}分${seconds}秒 - ${record.status}`);
            if (record.status === '过快') tooFast++;
            if (record.status === '过慢') tooSlow++;
        }
        console.log(`\n统计: ${tooFast} 次过快, ${tooSlow} 次过慢`);

        // 2. 检查并发开奖问题
        console.log('\n📊 检查可能的并发开奖：');
        const concurrentDraws = await db.any(`
            SELECT 
                a.period as period1,
                b.period as period2,
                a.created_at as time1,
                b.created_at as time2,
                ABS(EXTRACT(EPOCH FROM (a.created_at - b.created_at))) as time_diff
            FROM result_history a
            JOIN result_history b ON a.period < b.period
            WHERE ABS(EXTRACT(EPOCH FROM (a.created_at - b.created_at))) < 10
            AND a.period != b.period
            ORDER BY a.created_at DESC
            LIMIT 10
        `);

        if (concurrentDraws.length > 0) {
            console.log('\n发现可能的并发开奖：');
            for (const record of concurrentDraws) {
                console.log(`⚠️  期号 ${record.period1} 和 ${record.period2} 几乎同时开奖 (相差 ${record.time_diff.toFixed(1)} 秒)`);
            }
        } else {
            console.log('✅ 未发现并发开奖问题');
        }

        // 3. 检查期号与时间的对应关系
        console.log('\n📊 检查期号与时间的对应关系：');
        const periodTimeCheck = await db.any(`
            WITH period_analysis AS (
                SELECT 
                    period,
                    created_at,
                    TO_CHAR(created_at, 'YYYYMMDD') as actual_date,
                    SUBSTRING(period::text, 1, 8) as period_date,
                    SUBSTRING(period::text, 9, 3) as period_suffix
                FROM result_history
                WHERE LENGTH(period::text) = 11
                ORDER BY created_at DESC
                LIMIT 50
            )
            SELECT *,
                   CASE 
                       WHEN actual_date != period_date THEN '日期不匹配'
                       ELSE '正常'
                   END as status
            FROM period_analysis
            WHERE actual_date != period_date
        `);

        if (periodTimeCheck.length > 0) {
            console.log('\n发现日期不匹配的期号：');
            for (const record of periodTimeCheck) {
                console.log(`❌ 期号 ${record.period}: 期号日期=${record.period_date}, 实际日期=${record.actual_date}`);
            }
        } else {
            console.log('✅ 所有期号日期都与实际开奖日期匹配');
        }

        // 4. 检查跨日期号重置问题
        console.log('\n📊 检查跨日期号重置：');
        const crossDayPeriods = await db.any(`
            WITH daily_periods AS (
                SELECT 
                    DATE(created_at) as date,
                    MIN(period) as first_period,
                    MAX(period) as last_period,
                    MIN(SUBSTRING(period::text, 9, 3)) as first_suffix,
                    MAX(SUBSTRING(period::text, 9, 3)) as last_suffix
                FROM result_history
                WHERE LENGTH(period::text) = 11
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                LIMIT 10
            )
            SELECT *,
                   CASE 
                       WHEN first_suffix != '001' THEN '未从001开始'
                       ELSE '正常'
                   END as status
            FROM daily_periods
        `);

        console.log('\n每日首末期号：');
        for (const day of crossDayPeriods) {
            console.log(`日期 ${day.date}:`);
            console.log(`  首期: ${day.first_period} (后缀: ${day.first_suffix})`);
            console.log(`  末期: ${day.last_period} (后缀: ${day.last_suffix})`);
            if (day.status !== '正常') {
                console.log(`  ⚠️  ${day.status}`);
            }
        }

        // 5. 检查内存状态与数据库不一致
        console.log('\n📊 检查最新期号的一致性：');
        const latestPeriods = await db.one(`
            SELECT 
                (SELECT current_period FROM game_state ORDER BY id DESC LIMIT 1) as game_state_period,
                (SELECT MAX(period) FROM result_history) as max_result_period,
                (SELECT MAX(period::bigint) FROM draw_records WHERE period ~ '^[0-9]+$') as max_draw_period
        `);

        console.log('\n各表最新期号：');
        console.log(`game_state 当前期号: ${latestPeriods.game_state_period || '无'}`);
        console.log(`result_history 最大期号: ${latestPeriods.max_result_period || '无'}`);
        console.log(`draw_records 最大期号: ${latestPeriods.max_draw_period || '无'}`);

        // 检查差异
        const periods = [
            latestPeriods.game_state_period,
            latestPeriods.max_result_period,
            latestPeriods.max_draw_period
        ].filter(p => p != null).map(p => parseInt(p));

        if (periods.length > 1) {
            const maxDiff = Math.max(...periods) - Math.min(...periods);
            if (maxDiff > 1) {
                console.log(`\n⚠️  期号不一致，最大差异: ${maxDiff} 期`);
            } else {
                console.log('\n✅ 各表期号基本一致');
            }
        }

        // 6. 检查系统重启导致的期号问题
        console.log('\n📊 检查可能的系统重启点：');
        const restartPoints = await db.any(`
            WITH period_gaps AS (
                SELECT 
                    period,
                    created_at,
                    LAG(period) OVER (ORDER BY period) as prev_period,
                    period - LAG(period) OVER (ORDER BY period) as gap,
                    EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY period))) as time_gap
                FROM result_history
                WHERE period IS NOT NULL
            )
            SELECT * FROM period_gaps
            WHERE gap > 10 OR time_gap > 600
            ORDER BY created_at DESC
            LIMIT 10
        `);

        if (restartPoints.length > 0) {
            console.log('\n可能的系统重启点：');
            for (const point of restartPoints) {
                const timeGapMin = Math.floor(point.time_gap / 60);
                console.log(`\n时间: ${point.created_at}`);
                console.log(`期号跳跃: ${point.prev_period} → ${point.period} (跳 ${point.gap - 1} 期)`);
                console.log(`时间间隔: ${timeGapMin} 分钟`);
            }
        }

    } catch (error) {
        console.error('❌ 检查失败:', error);
    } finally {
        process.exit(0);
    }
}

// 执行检查
checkPeriodTiming();