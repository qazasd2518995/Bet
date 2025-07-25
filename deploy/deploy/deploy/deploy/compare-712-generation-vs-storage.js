// compare-712-generation-vs-storage.js - 比較期號 712 生成與儲存的差異
import db from './db/config.js';

async function comparePeriod712() {
    try {
        console.log('比較期號 712 生成與儲存的差異...\n');
        
        // 從日誌中看到的生成結果
        const logGeneratedResult = [10, 5, 4, 7, 9, 2, 1, 3, 6, 8];
        console.log('日誌顯示的生成結果:', logGeneratedResult);
        
        // 查詢資料庫中的儲存結果
        const dbResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   result
            FROM result_history 
            WHERE period = $1
        `, ['20250717712']);
        
        if (dbResult) {
            const storedPositions = [];
            for (let i = 1; i <= 10; i++) {
                storedPositions.push(dbResult[`position_${i}`]);
            }
            console.log('資料庫儲存的結果:', storedPositions);
            
            // 比較差異
            console.log('\n比較差異：');
            console.log('位置 | 生成的 | 儲存的');
            console.log('-----|-------|-------');
            for (let i = 0; i < 10; i++) {
                const position = i + 1;
                const generated = logGeneratedResult[i];
                const stored = storedPositions[i];
                const match = generated === stored ? '✓' : '✗';
                console.log(`第${position}名 |   ${generated}   |   ${stored}   ${match}`);
            }
            
            // 分析可能的原因
            console.log('\n\n分析：');
            console.log('1. 生成的結果和儲存的結果完全不同');
            console.log('2. 這不是簡單的順序錯誤或映射問題');
            console.log('3. 可能的原因：');
            console.log('   - 在儲存前結果被其他邏輯修改了');
            console.log('   - 有並發問題，儲存了錯誤期號的結果');
            console.log('   - 日誌和實際執行的程式碼不一致');
            
            // 檢查其他期號是否也有類似問題
            console.log('\n\n檢查其他最近的期號...');
            const recentPeriods = await db.manyOrNone(`
                SELECT period, 
                       position_1, position_2, position_3, position_4, position_5,
                       position_6, position_7, position_8, position_9, position_10
                FROM result_history 
                WHERE period >= '20250717710' AND period <= '20250717715'
                ORDER BY period
            `);
            
            for (const record of recentPeriods) {
                const positions = [];
                for (let i = 1; i <= 10; i++) {
                    positions.push(record[`position_${i}`]);
                }
                console.log(`期號 ${record.period}: [${positions.join(', ')}]`);
            }
            
        } else {
            console.log('找不到期號 712 的資料');
        }
        
    } catch (error) {
        console.error('比較錯誤:', error);
    } finally {
        process.exit();
    }
}

comparePeriod712();