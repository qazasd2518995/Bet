import pg from 'pg';
import config from './db/config.js';

const { Pool } = pg;
const pool = new Pool(config);

async function compareSamePeriod() {
    console.log('🔍 比對同一期在不同地方顯示的結果\n');
    
    try {
        // 1. 獲取當前遊戲狀態
        const gameState = await pool.query(`
            SELECT current_period, last_result, state
            FROM game_state
            LIMIT 1
        `);
        
        const currentPeriod = gameState.rows[0]?.current_period;
        const lastResult = gameState.rows[0]?.last_result;
        
        console.log('📊 當前遊戲狀態:');
        console.log(`當前期號: ${currentPeriod}`);
        console.log(`遊戲狀態: ${gameState.rows[0]?.state}`);
        console.log(`最後結果 (game_state.last_result): ${JSON.stringify(lastResult)}\n`);
        
        // 2. 查找包含544的期號
        console.log('📊 查找所有包含 "544" 的期號:');
        
        // 在 result_history 表中查找
        const resultHistory544 = await pool.query(`
            SELECT period::text, result, created_at
            FROM result_history
            WHERE period::text LIKE '%544'
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        if (resultHistory544.rows.length > 0) {
            console.log('\n在 result_history 表中找到:');
            resultHistory544.rows.forEach(row => {
                const periodStr = row.period;
                const suffix = periodStr.substring(8);
                console.log(`期號: ${periodStr} (第${suffix}期)`);
                console.log(`結果: ${JSON.stringify(row.result)}`);
                console.log(`時間: ${row.created_at}\n`);
            });
        }
        
        // 在 draw_records 表中查找
        const drawRecords544 = await pool.query(`
            SELECT period, result, draw_time
            FROM draw_records
            WHERE period LIKE '%544'
            AND LENGTH(period::text) = 11
            ORDER BY draw_time DESC
            LIMIT 5
        `);
        
        if (drawRecords544.rows.length > 0) {
            console.log('在 draw_records 表中找到:');
            drawRecords544.rows.forEach(row => {
                const periodStr = row.period;
                const suffix = periodStr.substring(8);
                console.log(`期號: ${periodStr} (第${suffix}期)`);
                console.log(`結果: ${JSON.stringify(row.result)}`);
                console.log(`時間: ${row.draw_time}\n`);
            });
        }
        
        // 3. 比對同一期號在兩個表中的結果
        console.log('📊 比對同一期號在不同表中的結果:');
        
        const comparison = await pool.query(`
            SELECT 
                rh.period::text as period,
                rh.result as rh_result,
                dr.result as dr_result,
                rh.created_at,
                dr.draw_time,
                CASE 
                    WHEN dr.result IS NULL THEN '未同步到draw_records'
                    WHEN rh.result::text = dr.result::text THEN '結果一致'
                    ELSE '結果不同！'
                END as status
            FROM result_history rh
            LEFT JOIN draw_records dr ON rh.period::text = dr.period
            WHERE rh.period::text LIKE '%544'
            ORDER BY rh.created_at DESC
            LIMIT 5
        `);
        
        comparison.rows.forEach(row => {
            console.log(`\n期號: ${row.period}`);
            console.log(`狀態: ${row.status}`);
            if (row.status === '結果不同！') {
                console.log(`❌ result_history: ${JSON.stringify(row.rh_result)}`);
                console.log(`❌ draw_records: ${JSON.stringify(row.dr_result)}`);
            } else if (row.status === '結果一致') {
                console.log(`✅ 兩表結果相同: ${JSON.stringify(row.rh_result)}`);
            }
        });
        
        // 4. 檢查 API 視圖返回的數據
        console.log('\n📊 檢查 API 視圖 (v_api_recent_draws) 返回的544期:');
        const apiView544 = await pool.query(`
            SELECT period, result
            FROM v_api_recent_draws
            WHERE period LIKE '%544'
            LIMIT 5
        `);
        
        if (apiView544.rows.length > 0) {
            apiView544.rows.forEach(row => {
                console.log(`API視圖 - 期號: ${row.period}`);
                console.log(`API視圖 - 結果: [${row.result.join(',')}]\n`);
            });
        }
        
        // 5. 檢查最新的幾期，看看是否有數據不一致
        console.log('📊 檢查最新5期的數據一致性:');
        const latestCheck = await pool.query(`
            SELECT 
                rh.period::text as period,
                rh.result as rh_result,
                dr.result as dr_result,
                gs.last_result as gs_result,
                CASE 
                    WHEN rh.period::text = gs.current_period::text 
                    THEN '當前期' 
                    ELSE '歷史期' 
                END as period_type
            FROM result_history rh
            LEFT JOIN draw_records dr ON rh.period::text = dr.period
            CROSS JOIN game_state gs
            WHERE rh.period IS NOT NULL
            ORDER BY rh.created_at DESC
            LIMIT 5
        `);
        
        latestCheck.rows.forEach(row => {
            console.log(`\n期號: ${row.period} (${row.period_type})`);
            console.log(`result_history: ${JSON.stringify(row.rh_result)}`);
            console.log(`draw_records: ${JSON.stringify(row.dr_result)}`);
            if (row.period_type === '當前期') {
                console.log(`game_state.last_result: ${JSON.stringify(row.gs_result)}`);
            }
            
            // 檢查是否一致
            if (row.rh_result && row.dr_result) {
                if (JSON.stringify(row.rh_result) !== JSON.stringify(row.dr_result)) {
                    console.log('❌ 結果不一致！');
                } else {
                    console.log('✅ 結果一致');
                }
            }
        });
        
    } catch (error) {
        console.error('查詢錯誤:', error);
    } finally {
        await pool.end();
    }
}

compareSamePeriod().catch(console.error);