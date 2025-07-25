import pg from 'pg';
import config from './db/config.js';

const { Pool } = pg;
const pool = new Pool(config);

async function fixPeriodIssues() {
    console.log('🔧 修復期號問題\n');
    
    try {
        // 1. 檢查並刪除異常長度的期號
        console.log('📊 檢查異常期號:');
        const abnormalPeriods = await pool.query(`
            SELECT period, draw_time, LENGTH(period::text) as len
            FROM draw_records
            WHERE LENGTH(period::text) != 11
            ORDER BY draw_time DESC
            LIMIT 20
        `);
        
        if (abnormalPeriods.rows.length > 0) {
            console.log(`發現 ${abnormalPeriods.rows.length} 筆異常期號:`);
            abnormalPeriods.rows.forEach(row => {
                console.log(`- 期號: ${row.period} (長度: ${row.len})`);
            });
            
            // 刪除異常期號
            const deleteResult = await pool.query(`
                DELETE FROM draw_records
                WHERE LENGTH(period::text) != 11
            `);
            console.log(`✅ 已刪除 ${deleteResult.rowCount} 筆異常期號記錄\n`);
        } else {
            console.log('✅ 沒有發現異常期號\n');
        }
        
        // 2. 檢查最新的同步狀態
        console.log('📊 檢查最新同步狀態:');
        const syncStatus = await pool.query(`
            SELECT 
                rh.period::text as main_period,
                rh.result as main_result,
                dr.period as agent_period,
                dr.result as agent_result,
                rh.created_at
            FROM result_history rh
            LEFT JOIN draw_records dr ON rh.period::text = dr.period
            WHERE rh.period IS NOT NULL
            ORDER BY rh.created_at DESC
            LIMIT 10
        `);
        
        let unsyncedCount = 0;
        syncStatus.rows.forEach(row => {
            if (!row.agent_period) {
                console.log(`❌ 期號 ${row.main_period}: 未同步到代理系統`);
                unsyncedCount++;
            } else if (JSON.stringify(row.main_result) !== JSON.stringify(row.agent_result)) {
                console.log(`❌ 期號 ${row.main_period}: 結果不一致`);
                unsyncedCount++;
            } else {
                console.log(`✅ 期號 ${row.main_period}: 已同步`);
            }
        });
        
        if (unsyncedCount > 0) {
            console.log(`\n⚠️  發現 ${unsyncedCount} 筆未同步或不一致的記錄`);
            console.log('建議重啟遊戲服務以確保同步機制正常運作');
        } else {
            console.log('\n✅ 所有記錄都已正確同步');
        }
        
        // 3. 驗證 v_api_recent_draws 視圖
        console.log('\n📊 驗證 API 視圖資料:');
        const apiView = await pool.query(`
            SELECT period, result
            FROM v_api_recent_draws
            LIMIT 5
        `);
        
        console.log('API 視圖返回的最新5筆資料:');
        apiView.rows.forEach(row => {
            console.log(`期號: ${row.period}, 結果: [${row.result.join(',')}]`);
        });
        
        // 4. 總結
        console.log('\n📊 資料總結:');
        const summary = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM result_history WHERE period IS NOT NULL) as main_count,
                (SELECT COUNT(*) FROM draw_records WHERE LENGTH(period::text) = 11) as agent_count,
                (SELECT MAX(period::text) FROM result_history WHERE period IS NOT NULL) as latest_period
        `);
        
        const row = summary.rows[0];
        console.log(`主系統記錄數: ${row.main_count}`);
        console.log(`代理系統記錄數: ${row.agent_count}`);
        console.log(`最新期號: ${row.latest_period}`);
        console.log(`同步差異: ${row.main_count - row.agent_count} 筆`);
        
    } catch (error) {
        console.error('修復過程發生錯誤:', error.message);
    } finally {
        await pool.end();
    }
}

fixPeriodIssues().catch(console.error);