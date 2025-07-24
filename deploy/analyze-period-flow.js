// analyze-period-flow.js - 分析期號流動和跳號問題
import db from './db/config.js';

async function analyzePeriodFlow() {
    console.log('🔍 分析期號流動和跳號問題\n');

    try {
        // 1. 檢查 result_history 表中的期號
        console.log('📊 檢查 result_history 表中的期號序列：');
        const resultHistory = await db.any(`
            SELECT period, created_at, 
                   LAG(period) OVER (ORDER BY period) as prev_period,
                   period - LAG(period) OVER (ORDER BY period) as gap
            FROM result_history
            WHERE period IS NOT NULL
            ORDER BY period DESC
            LIMIT 50
        `);

        console.log('\n最近50期的期號序列：');
        let jumpCount = 0;
        for (const record of resultHistory) {
            if (record.gap && record.gap > 1) {
                jumpCount++;
                console.log(`❌ 期號跳躍: ${record.prev_period} → ${record.period} (跳了 ${record.gap - 1} 期)`);
            } else if (record.prev_period) {
                console.log(`✅ 期號連續: ${record.prev_period} → ${record.period}`);
            }
        }
        console.log(`\n發現 ${jumpCount} 處期號跳躍`);

        // 2. 檢查 game_state 表的當前期號
        console.log('\n📊 檢查 game_state 表：');
        const gameState = await db.oneOrNone(`
            SELECT current_period, status, updated_at
            FROM game_state
            ORDER BY id DESC
            LIMIT 1
        `);
        if (gameState) {
            console.log(`當前期號: ${gameState.current_period}`);
            console.log(`遊戲狀態: ${gameState.status}`);
            console.log(`最後更新: ${gameState.updated_at}`);
        }

        // 3. 檢查 draw_records 表（代理系統）
        console.log('\n📊 檢查 draw_records 表（代理系統）：');
        const drawRecords = await db.any(`
            SELECT period, draw_time,
                   LAG(period) OVER (ORDER BY period::bigint) as prev_period
            FROM draw_records
            WHERE period ~ '^[0-9]+$'
            ORDER BY period::bigint DESC
            LIMIT 20
        `);

        console.log('\n代理系統最近20期：');
        for (const record of drawRecords) {
            if (record.prev_period) {
                const gap = parseInt(record.period) - parseInt(record.prev_period);
                if (gap > 1) {
                    console.log(`❌ 期號跳躍: ${record.prev_period} → ${record.period} (跳了 ${gap - 1} 期)`);
                } else {
                    console.log(`✅ 期號連續: ${record.prev_period} → ${record.period}`);
                }
            }
        }

        // 4. 比較兩個系統的期號
        console.log('\n📊 比較主系統和代理系統的期號：');
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

        console.log('\n期號對比（最近20期）：');
        for (const record of comparison) {
            if (!record.agent_period) {
                console.log(`⚠️  期號 ${record.main_period}: 只在主系統存在`);
            } else if (!record.main_period) {
                console.log(`⚠️  期號 ${record.agent_period}: 只在代理系統存在`);
            } else if (record.main_period.toString() === record.agent_period) {
                console.log(`✅ 期號 ${record.main_period}: 兩系統同步`);
            } else {
                console.log(`❌ 期號不匹配: 主系統=${record.main_period}, 代理系統=${record.agent_period}`);
            }
        }

        // 5. 分析期號生成模式
        console.log('\n📊 分析期號生成模式：');
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

        console.log('\n每日期號統計：');
        for (const day of periodPattern) {
            const missing = day.expected_count - day.count;
            console.log(`日期: ${day.date}`);
            console.log(`  首期: ${day.first_period}, 末期: ${day.last_period}`);
            console.log(`  實際期數: ${day.count}, 預期期數: ${day.expected_count}`);
            if (missing > 0) {
                console.log(`  ⚠️  缺失 ${missing} 期`);
            } else {
                console.log(`  ✅ 期號完整`);
            }
        }

        // 6. 檢查最近的期號跳躍細節
        console.log('\n📊 檢查最近的期號跳躍細節：');
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
            console.log('\n最近的期號跳躍：');
            for (const jump of recentJumps) {
                console.log(`\n期號跳躍: ${jump.prev_period} → ${jump.period}`);
                console.log(`  跳躍大小: ${jump.gap - 1} 期`);
                console.log(`  發生時間: ${jump.created_at}`);
                
                // 檢查跳躍期間的投注
                const missingBets = await db.any(`
                    SELECT period, COUNT(*) as bet_count
                    FROM bet_history
                    WHERE period > $1 AND period < $2
                    GROUP BY period
                    ORDER BY period
                `, [jump.prev_period, jump.period]);
                
                if (missingBets.length > 0) {
                    console.log(`  ⚠️  跳躍期間有 ${missingBets.length} 期有投注記錄`);
                    for (const bet of missingBets) {
                        console.log(`    - 期號 ${bet.period}: ${bet.bet_count} 筆投注`);
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ 分析失敗:', error);
    } finally {
        process.exit(0);
    }
}

// 執行分析
analyzePeriodFlow();