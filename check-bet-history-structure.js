import db from './db/config.js';

async function checkBetHistoryStructure() {
    try {
        console.log('=== 檢查 bet_history 表結構 ===\n');

        // 檢查表結構
        const columns = await db.any(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'bet_history'
            ORDER BY ordinal_position
        `);

        console.log('bet_history 表的欄位：');
        for (const col of columns) {
            console.log(`- ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
        }

        // 檢查最近的幾筆投注記錄
        console.log('\n\n=== 最近的投注記錄 ===');
        const recentBets = await db.any(`
            SELECT * FROM bet_history 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        if (recentBets.length > 0) {
            console.log(`\n找到 ${recentBets.length} 筆記錄`);
            console.log('第一筆記錄的所有欄位：');
            console.log(Object.keys(recentBets[0]));
        }

    } catch (error) {
        console.error('錯誤:', error);
    } finally {
        process.exit(0);
    }
}

checkBetHistoryStructure();