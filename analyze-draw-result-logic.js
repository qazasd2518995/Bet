// analyze-draw-result-logic.js - 分析開獎結果邏輯
import db from './db/config.js';

async function analyzeDrawResultLogic() {
    try {
        console.log('分析開獎結果邏輯...\n');
        
        // 原始生成的結果
        const generatedResult = [10, 5, 4, 7, 9, 2, 1, 3, 6, 8];
        console.log('生成的結果陣列:', generatedResult);
        console.log('\n這個陣列的含義應該是：');
        console.log('索引 0 (第1名/冠軍): 10號車');
        console.log('索引 1 (第2名/亞軍): 5號車');
        console.log('索引 2 (第3名/季軍): 4號車');
        console.log('以此類推...\n');
        
        // 但是看用戶報告的近期開獎顯示
        const userReportedDisplay = [1, 5, 8, 2, 10, 4, 3, 9, 7];
        console.log('用戶報告的近期開獎顯示:', userReportedDisplay);
        
        // 嘗試理解轉換邏輯
        console.log('\n分析可能的轉換邏輯：');
        
        // 方法1: 直接儲存（目前的做法）
        console.log('\n方法1 - 直接儲存（目前的做法）：');
        console.log('position_1 = generatedResult[0] = 10');
        console.log('position_2 = generatedResult[1] = 5');
        console.log('這樣儲存後，position_N 代表第N名是幾號車');
        
        // 方法2: 反向映射
        console.log('\n方法2 - 反向映射（可能是錯誤的理解）：');
        const reverseMapping = new Array(11).fill(0); // 索引0不用，1-10對應車號
        generatedResult.forEach((carNumber, position) => {
            reverseMapping[carNumber] = position + 1;
        });
        console.log('如果理解為"N號車在第幾名"：');
        for (let i = 1; i <= 10; i++) {
            console.log(`${i}號車在第${reverseMapping[i]}名`);
        }
        
        // 建立反向陣列
        const reverseArray = [];
        for (let i = 1; i <= 10; i++) {
            reverseArray.push(reverseMapping[i]);
        }
        console.log('\n反向陣列（每個車號的名次）:', reverseArray);
        
        // 查詢實際儲存的資料
        console.log('\n\n查詢最近的開獎結果...');
        const recentResults = await db.manyOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   result
            FROM result_history 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        for (const record of recentResults) {
            console.log(`\n期號 ${record.period}:`);
            const positionArray = [];
            for (let i = 1; i <= 10; i++) {
                positionArray.push(record[`position_${i}`]);
            }
            console.log('Position 陣列:', positionArray);
            const jsonResult = typeof record.result === 'string' ? JSON.parse(record.result) : record.result;
            console.log('JSON result:', jsonResult);
            console.log('兩者是否相同:', JSON.stringify(positionArray) === JSON.stringify(jsonResult));
        }
        
    } catch (error) {
        console.error('分析錯誤:', error);
    } finally {
        process.exit();
    }
}

analyzeDrawResultLogic();