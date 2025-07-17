import pkg from 'pg';
const { Pool } = pkg;
import dbConfig from './db/config.js';

const pool = new Pool(dbConfig);

async function fixResultHistoryColumns() {
    const client = await pool.connect();
    
    try {
        console.log('🔧 修復 result_history 表結構...\n');
        
        // 開始事務
        await client.query('BEGIN');
        
        // 檢查現有的列
        const checkColumns = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'result_history' 
            AND column_name LIKE 'position_%'
        `);
        
        const existingColumns = checkColumns.rows.map(row => row.column_name);
        console.log('現有的 position 列:', existingColumns);
        
        // 添加缺少的 position 列
        for (let i = 1; i <= 10; i++) {
            const columnName = `position_${i}`;
            if (!existingColumns.includes(columnName)) {
                console.log(`添加列: ${columnName}`);
                await client.query(`
                    ALTER TABLE result_history 
                    ADD COLUMN IF NOT EXISTS ${columnName} INTEGER
                `);
            }
        }
        
        // 如果有舊的數據，從 result 陣列中提取值
        console.log('\n更新現有記錄的 position 值...');
        const updateQuery = `
            UPDATE result_history 
            SET 
                position_1 = (result::integer[])[1],
                position_2 = (result::integer[])[2],
                position_3 = (result::integer[])[3],
                position_4 = (result::integer[])[4],
                position_5 = (result::integer[])[5],
                position_6 = (result::integer[])[6],
                position_7 = (result::integer[])[7],
                position_8 = (result::integer[])[8],
                position_9 = (result::integer[])[9],
                position_10 = (result::integer[])[10]
            WHERE result IS NOT NULL 
            AND array_length(result::integer[], 1) = 10
            AND position_1 IS NULL
        `;
        
        const updateResult = await client.query(updateQuery);
        console.log(`更新了 ${updateResult.rowCount} 筆記錄`);
        
        // 提交事務
        await client.query('COMMIT');
        console.log('\n✅ result_history 表結構修復完成！');
        
        // 驗證結構
        const verifyColumns = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'result_history' 
            AND column_name LIKE 'position_%'
            ORDER BY column_name
        `);
        
        console.log('\n當前 position 列結構:');
        verifyColumns.rows.forEach(col => {
            console.log(`- ${col.column_name}: ${col.data_type}`);
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ 修復失敗:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// 執行修復
fixResultHistoryColumns().catch(console.error);