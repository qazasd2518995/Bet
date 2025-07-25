import db from './db/config.js';

async function checkTransactionStructure() {
    try {
        console.log('=== 检查 transaction_records 表结构 ===\n');

        // 检查表结构
        const columns = await db.any(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'transaction_records'
            ORDER BY ordinal_position
        `);

        console.log('transaction_records 表的栏位：');
        for (const col of columns) {
            console.log(`- ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        }

        // 检查最近的几笔交易记录
        console.log('\n\n=== 最近的交易记录 ===');
        const recentTransactions = await db.any(`
            SELECT * FROM transaction_records 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        if (recentTransactions.length > 0) {
            console.log(`\n找到 ${recentTransactions.length} 笔记录`);
            console.log('第一笔记录的所有栏位：');
            console.log(Object.keys(recentTransactions[0]));
            
            console.log('\n最近的退水相关交易：');
            const rebateTransactions = await db.any(`
                SELECT * FROM transaction_records 
                WHERE type IN ('rebate', 'parent_rebate')
                ORDER BY created_at DESC 
                LIMIT 10
            `);
            
            for (const tx of rebateTransactions) {
                console.log(`\nID: ${tx.id}`);
                console.log(`类型: ${tx.type}`);
                console.log(`用户: ${tx.username}`);
                console.log(`金额: ${tx.amount}`);
                console.log(`期号: ${tx.period}`);
                console.log(`描述: ${tx.description}`);
                console.log(`时间: ${tx.created_at}`);
            }
        }

    } catch (error) {
        console.error('错误:', error);
    } finally {
        process.exit(0);
    }
}

checkTransactionStructure();