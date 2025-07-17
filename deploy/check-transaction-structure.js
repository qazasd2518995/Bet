import db from './db/config.js';

async function checkTransactionStructure() {
    try {
        console.log('=== 檢查 transaction_records 表結構 ===\n');

        // 檢查表結構
        const columns = await db.any(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'transaction_records'
            ORDER BY ordinal_position
        `);

        console.log('transaction_records 表的欄位：');
        for (const col of columns) {
            console.log(`- ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        }

        // 檢查最近的幾筆交易記錄
        console.log('\n\n=== 最近的交易記錄 ===');
        const recentTransactions = await db.any(`
            SELECT * FROM transaction_records 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        if (recentTransactions.length > 0) {
            console.log(`\n找到 ${recentTransactions.length} 筆記錄`);
            console.log('第一筆記錄的所有欄位：');
            console.log(Object.keys(recentTransactions[0]));
            
            console.log('\n最近的退水相關交易：');
            const rebateTransactions = await db.any(`
                SELECT * FROM transaction_records 
                WHERE type IN ('rebate', 'parent_rebate')
                ORDER BY created_at DESC 
                LIMIT 10
            `);
            
            for (const tx of rebateTransactions) {
                console.log(`\nID: ${tx.id}`);
                console.log(`類型: ${tx.type}`);
                console.log(`用戶: ${tx.username}`);
                console.log(`金額: ${tx.amount}`);
                console.log(`期號: ${tx.period}`);
                console.log(`描述: ${tx.description}`);
                console.log(`時間: ${tx.created_at}`);
            }
        }

    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkTransactionStructure();