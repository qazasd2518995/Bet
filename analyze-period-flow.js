// analyze-period-flow.js - 分析期号流动和跳号问题
import db from './db/config.js';

async function analyzePeriodFlow() {
    console.log('🔍 分析期号流动和跳号问题\n');

    try {
        // 1. 检查 result_history 表中的期号
        console.log('📊 检查 result_history 表中的期号序列：');
        const resultHistory = await db.any(`
            SELECT period, created_at, 
                   LAG(period) OVER (ORDER BY period) as prev_period,
                   period - LAG(period) OVER (ORDER BY period) as gap
            FROM result_history
            WHERE period IS NOT NULL
            ORDER BY period DESC
            LIMIT 50
        `);

        console.log('\n最近50期的期号序列：');
        let jumpCount = 0;
        for (const record of resultHistory) {
            if (record.gap && record.gap > 1) {
                jumpCount++;
                console.log(`❌ 期号跳跃: ${record.prev_period} → ${record.period} (跳了 ${record.gap - 1} 期)`);
            } else if (record.prev_period) {
                console.log(`✅ 期号连续: ${record.prev_period} → ${record.period}`);
            }
        }
        console.log(`\n发现 ${jumpCount} 处期号跳跃`);

        // 2. 检查 game_state 表的当前期号
        console.log('\n📊 检查 game_state 表：');
        const gameState = await db.oneOrNone(`
            SELECT current_period, status, updated_at
            FROM game_state
            ORDER BY id DESC
            LIMIT 1
        `);
        if (gameState) {
            console.log(`当前期号: ${gameState.current_period}`);
            console.log(`游戏状态: ${gameState.status}`);
            console.log(`最后更新: ${gameState.updated_at}`);
        }

        // 3. 检查 draw_records 表（代理系统）
        console.log('\n📊 检查 draw_records 表（代理系统）：');
        const drawRecords = await db.any(`
            SELECT period, draw_time,
                   LAG(period) OVER (ORDER BY period::bigint) as prev_period
            FROM draw_records
            WHERE period ~ '^[0-9]+$'
            ORDER BY period::bigint DESC
            LIMIT 20
        `);

        console.log('\n代理系统最近20期：');
        for (const record of drawRecords) {
            if (record.prev_period) {
                const gap = parseInt(record.period) - parseInt(record.prev_period);
                if (gap > 1) {
                    console.log(`❌ 期号跳跃: ${record.prev_period} → ${record.period} (跳了 ${gap - 1} 期)`);
                } else {
                    console.log(`✅ 期号连续: ${record.prev_period} → ${record.period}`);
                }
            }
        }

        // 4. 比较两个系统的期号
        console.log('\n📊 比较主系统和代理系统的期号：');
        const comparison = await db.any(`
            SELECT 
                rh.period as main_period,
                dr.period as agent_period,
                rh.created_at as main_time,
                dr.draw_time as agent_time
            FROM result_history rh
            FULL OUTER JOIN draw_records dr ON rh.period::text = dr.period
            WHERE rh.period IS NOT NULL OR dr.period IS NOT NULL
            ORDER BY COALESCE(rh.period, dr.period::bigint) DESC
            LIMIT 20
        `);

        console.log('\n期号对比（最近20期）：');
        for (const record of comparison) {
            if (!record.agent_period) {
                console.log(`⚠️  期号 ${record.main_period}: 只在主系统存在`);
            } else if (!record.main_period) {
                console.log(`⚠️  期号 ${record.agent_period}: 只在代理系统存在`);
            } else if (record.main_period.toString() === record.agent_period) {
                console.log(`✅ 期号 ${record.main_period}: 两系统同步`);
            } else {
                console.log(`❌ 期号不匹配: 主系统=${record.main_period}, 代理系统=${record.agent_period}`);
            }
        }

        // 5. 分析期号生成模式
        console.log('\n📊 分析期号生成模式：');
        const periodPattern = await db.any(`
            SELECT 
                DATE(created_at) as date,
                MIN(period) as first_period,
                MAX(period) as last_period,
                COUNT(*) as count,
                MAX(period) - MIN(period) + 1 as expected_count
            FROM result_history
            WHERE period IS NOT NULL
            GROUP BY DATE(created_at)
            ORDER BY date DESC
            LIMIT 10
        `);

        console.log('\n每日期号统计：');
        for (const day of periodPattern) {
            const missing = day.expected_count - day.count;
            console.log(`日期: ${day.date}`);
            console.log(`  首期: ${day.first_period}, 末期: ${day.last_period}`);
            console.log(`  实际期数: ${day.count}, 预期期数: ${day.expected_count}`);
            if (missing > 0) {
                console.log(`  ⚠️  缺失 ${missing} 期`);
            } else {
                console.log(`  ✅ 期号完整`);
            }
        }

        // 6. 检查最近的期号跳跃细节
        console.log('\n📊 检查最近的期号跳跃细节：');
        const recentJumps = await db.any(`
            WITH period_gaps AS (
                SELECT 
                    period,
                    created_at,
                    LAG(period) OVER (ORDER BY period) as prev_period,
                    period - LAG(period) OVER (ORDER BY period) as gap
                FROM result_history
                WHERE period IS NOT NULL
            )
            SELECT * FROM period_gaps
            WHERE gap > 1
            ORDER BY period DESC
            LIMIT 10
        `);

        if (recentJumps.length > 0) {
            console.log('\n最近的期号跳跃：');
            for (const jump of recentJumps) {
                console.log(`\n期号跳跃: ${jump.prev_period} → ${jump.period}`);
                console.log(`  跳跃大小: ${jump.gap - 1} 期`);
                console.log(`  发生时间: ${jump.created_at}`);
                
                // 检查跳跃期间的投注
                const missingBets = await db.any(`
                    SELECT period, COUNT(*) as bet_count
                    FROM bet_history
                    WHERE period > $1 AND period < $2
                    GROUP BY period
                    ORDER BY period
                `, [jump.prev_period, jump.period]);
                
                if (missingBets.length > 0) {
                    console.log(`  ⚠️  跳跃期间有 ${missingBets.length} 期有投注记录`);
                    for (const bet of missingBets) {
                        console.log(`    - 期号 ${bet.period}: ${bet.bet_count} 笔投注`);
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ 分析失败:', error);
    } finally {
        process.exit(0);
    }
}

// 执行分析
analyzePeriodFlow();