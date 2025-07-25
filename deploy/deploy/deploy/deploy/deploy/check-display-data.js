import pg from 'pg';
import config from './db/config.js';

const { Pool } = pg;

const pool = new Pool(config);

async function checkDisplayData() {
    console.log('🔍 檢查前端顯示的數據來源\n');
    
    try {
        // 1. 檢查當前遊戲狀態
        const gameState = await pool.query('SELECT * FROM game_state LIMIT 1');
        console.log('📊 當前遊戲狀態:');
        console.log('期號:', gameState.rows[0]?.current_period);
        console.log('狀態:', gameState.rows[0]?.state);
        console.log('最後結果:', gameState.rows[0]?.last_result);
        console.log();
        
        // 2. 檢查主畫面使用的 API (result_history)
        console.log('📊 主畫面數據 (result_history 表):');
        const mainResults = await pool.query(`
            SELECT period::text, result, created_at 
            FROM result_history 
            WHERE period IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        mainResults.rows.forEach(row => {
            console.log(`期號: ${row.period}, 結果: ${JSON.stringify(row.result)}`);
        });
        console.log();
        
        // 3. 檢查歷史記錄使用的 API (draw_records via v_api_recent_draws)
        console.log('📊 歷史記錄數據 (v_api_recent_draws 視圖):');
        const historyResults = await pool.query(`
            SELECT period, result 
            FROM v_api_recent_draws 
            ORDER BY period DESC
            LIMIT 5
        `);
        historyResults.rows.forEach(row => {
            console.log(`期號: ${row.period}, 結果: ${JSON.stringify(row.result)}`);
        });
        console.log();
        
        // 4. 檢查 draw_records 原始數據
        console.log('📊 draw_records 表原始數據:');
        const drawRecords = await pool.query(`
            SELECT period, result, draw_time
            FROM draw_records 
            WHERE LENGTH(period::text) = 11 
            AND position_1 IS NOT NULL 
            ORDER BY draw_time DESC 
            LIMIT 5
        `);
        drawRecords.rows.forEach(row => {
            console.log(`期號: ${row.period}, 結果: ${JSON.stringify(row.result)}`);
        });
        console.log();
        
        // 5. 檢查期號長度問題
        console.log('📊 期號長度分析:');
        const periodLengths = await pool.query(`
            SELECT 
                LENGTH(period::text) as len,
                COUNT(*) as count,
                MIN(period::text) as sample_min,
                MAX(period::text) as sample_max
            FROM draw_records
            GROUP BY LENGTH(period::text)
            ORDER BY len
        `);
        console.log('期號長度分佈:');
        periodLengths.rows.forEach(row => {
            console.log(`${row.len}位數: ${row.count}筆, 範例: ${row.sample_min} - ${row.sample_max}`);
        });
        console.log();
        
        // 6. 檢查同步延遲
        console.log('📊 檢查同步情況:');
        const syncCheck = await pool.query(`
            SELECT 
                rh.period::text as rh_period,
                rh.result as rh_result,
                dr.period as dr_period,
                dr.result as dr_result,
                CASE 
                    WHEN dr.period IS NULL THEN '未同步到代理系統'
                    WHEN rh.result::text != dr.result::text THEN '結果不一致'
                    ELSE '已同步'
                END as sync_status
            FROM result_history rh
            LEFT JOIN draw_records dr 
                ON rh.period::text = dr.period
                AND LENGTH(dr.period::text) = 11
            WHERE rh.period IS NOT NULL
            ORDER BY rh.created_at DESC
            LIMIT 10
        `);
        
        console.log('最近10期同步狀態:');
        syncCheck.rows.forEach(row => {
            if (row.sync_status !== '已同步') {
                console.log(`❌ 期號 ${row.rh_period}: ${row.sync_status}`);
                if (row.rh_result && row.dr_result) {
                    console.log(`  主系統: ${JSON.stringify(row.rh_result)}`);
                    console.log(`  代理系統: ${JSON.stringify(row.dr_result)}`);
                }
            } else {
                console.log(`✅ 期號 ${row.rh_period}: ${row.sync_status}`);
            }
        });
        
    } catch (error) {
        console.error('查詢錯誤:', error.message);
    } finally {
        await pool.end();
    }
}

checkDisplayData().catch(console.error);