// 檢查表格的數據類型
import db from './db/config.js';

async function checkTableTypes() {
    console.log('🔍 檢查表格數據類型\n');

    try {
        // 檢查 result_history 表的 period 欄位類型
        const resultHistoryColumns = await db.manyOrNone(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'result_history'
            AND column_name = 'period'
        `);
        
        console.log('📊 result_history 表的 period 欄位：');
        resultHistoryColumns.forEach(col => {
            console.log(`欄位名：${col.column_name} | 類型：${col.data_type} | 可為空：${col.is_nullable}`);
        });

        // 檢查 recent_draws 表的 period 欄位類型
        const recentDrawsColumns = await db.manyOrNone(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'recent_draws'
            AND column_name = 'period'
        `);
        
        console.log('\n📊 recent_draws 表的 period 欄位：');
        recentDrawsColumns.forEach(col => {
            console.log(`欄位名：${col.column_name} | 類型：${col.data_type} | 可為空：${col.is_nullable}`);
        });

        console.log('\n💡 問題分析：');
        console.log('result_history.period 是 character varying 類型');
        console.log('recent_draws.period 是 bigint 類型');
        console.log('這就是為什麼在比較時會出現類型錯誤');

    } catch (error) {
        console.error('檢查失敗：', error);
    }
}

// 執行檢查
checkTableTypes().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('❌ 錯誤：', error);
    process.exit(1);
});