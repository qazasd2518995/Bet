const { Pool } = require('pg');

// 直接使用資料庫配置
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

async function checkTableStructure() {
    console.log('===== 檢查資料表結構 =====\n');
    
    try {
        // 檢查 bet_history 表結構
        console.log('1. bet_history 表結構：');
        const betHistoryQuery = `
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'bet_history'
            ORDER BY ordinal_position
        `;
        
        const betHistoryResult = await pool.query(betHistoryQuery);
        console.log('欄位列表：');
        betHistoryResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        });
        
        // 檢查 result_history 表結構
        console.log('\n2. result_history 表結構：');
        const resultHistoryQuery = `
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'result_history'
            ORDER BY ordinal_position
        `;
        
        const resultHistoryResult = await pool.query(resultHistoryQuery);
        console.log('欄位列表：');
        resultHistoryResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        });
        
        // 檢查 transaction_records 表結構
        console.log('\n3. transaction_records 表結構：');
        const transactionQuery = `
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'transaction_records'
            ORDER BY ordinal_position
        `;
        
        const transactionResult = await pool.query(transactionQuery);
        console.log('欄位列表：');
        transactionResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        });
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await pool.end();
    }
}

// 執行檢查
checkTableStructure();