import pg from 'pg';
import config from './db/config.js';

const { Pool } = pg;
const pool = new Pool(config);

async function checkPeriod544() {
    console.log('🔍 檢查期號 544 的數據\n');
    
    try {
        // 1. 查找包含 544 的期號
        console.log('📊 查找所有包含 544 的期號:');
        const period544Query = await pool.query(`
            SELECT period::text, result, created_at
            FROM result_history
            WHERE period::text LIKE '%544'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (period544Query.rows.length > 0) {
            console.log('在 result_history 表中找到:');
            period544Query.rows.forEach(row => {
                console.log(`期號: ${row.period}, 結果: ${JSON.stringify(row.result)}`);
                console.log(`時間: ${row.created_at}\n`);
            });
        } else {
            console.log('❌ 在 result_history 表中沒有找到包含 544 的期號\n');
        }
        
        // 2. 檢查當前期號
        const currentPeriod = await pool.query(`
            SELECT current_period, last_result
            FROM game_state
            LIMIT 1
        `);
        
        console.log('📊 當前遊戲狀態:');
        console.log(`當前期號: ${currentPeriod.rows[0]?.current_period}`);
        console.log(`最後結果: ${JSON.stringify(currentPeriod.rows[0]?.last_result)}\n`);
        
        // 3. 查找第544期（可能是某天的第544期）
        console.log('📊 查找今天的第544期:');
        const today544 = await pool.query(`
            SELECT period::text, result, created_at
            FROM result_history
            WHERE period::text = '20250723544'
            OR period::text = '20250722544'
            OR period::text = '20250721544'
            ORDER BY created_at DESC
        `);
        
        if (today544.rows.length > 0) {
            today544.rows.forEach(row => {
                console.log(`找到期號: ${row.period}`);
                console.log(`結果: ${JSON.stringify(row.result)}`);
                console.log(`時間: ${row.created_at}\n`);
            });
        } else {
            console.log('❌ 沒有找到第544期\n');
        }
        
        // 4. 檢查最近的期號範圍
        console.log('📊 最近20期的期號:');
        const recentPeriods = await pool.query(`
            SELECT period::text, result
            FROM result_history
            WHERE period IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 20
        `);
        
        console.log('期號列表:');
        recentPeriods.rows.forEach((row, index) => {
            const periodStr = row.period;
            const suffix = periodStr.substring(8);
            console.log(`${index + 1}. ${periodStr} (第${suffix}期) - 結果: [${row.result.join(',')}]`);
        });
        
        // 5. 比對主畫面顯示的 3,9,1,7
        console.log('\n📊 查找結果為 [3,9,1,7] 的期號:');
        const targetResult = await pool.query(`
            SELECT period::text, result, created_at
            FROM result_history
            WHERE result::text = '[3,9,1,7]'
            OR (result->>0 = '3' AND result->>1 = '9' AND result->>2 = '1' AND result->>3 = '7')
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        if (targetResult.rows.length > 0) {
            console.log('找到結果為 [3,9,1,7] 的期號:');
            targetResult.rows.forEach(row => {
                console.log(`期號: ${row.period}, 完整結果: ${JSON.stringify(row.result)}`);
            });
        } else {
            console.log('❌ 沒有找到結果為 [3,9,1,7] 的期號');
        }
        
        // 6. 檢查 API 視圖返回的數據
        console.log('\n📊 檢查 API 視圖 (v_api_recent_draws):');
        const apiView = await pool.query(`
            SELECT period, result
            FROM v_api_recent_draws
            WHERE period LIKE '%544'
            LIMIT 5
        `);
        
        if (apiView.rows.length > 0) {
            apiView.rows.forEach(row => {
                console.log(`API 返回期號: ${row.period}, 結果: [${row.result.join(',')}]`);
            });
        } else {
            console.log('❌ API 視圖中沒有包含 544 的期號');
        }
        
    } catch (error) {
        console.error('查詢錯誤:', error.message);
    } finally {
        await pool.end();
    }
}

checkPeriod544().catch(console.error);