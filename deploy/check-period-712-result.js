// check-period-712-result.js - 檢查期號 712 的開獎結果
import db from './db/config.js';

async function checkPeriod712() {
    try {
        console.log('檢查期號 20250717712 的開獎結果...\n');
        
        // 1. 查詢資料庫中的開獎結果
        const dbResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   result,
                   draw_time
            FROM result_history 
            WHERE period = $1
        `, ['20250717712']);
        
        if (dbResult) {
            console.log('資料庫中的開獎結果：');
            console.log('期號:', dbResult.period);
            console.log('開獎時間:', dbResult.draw_time);
            console.log('\n各位置的號碼（這是正確的開獎結果）：');
            console.log(`第1名(冠軍): ${dbResult.position_1}號`);
            console.log(`第2名(亞軍): ${dbResult.position_2}號`);
            console.log(`第3名(季軍): ${dbResult.position_3}號`);
            console.log(`第4名: ${dbResult.position_4}號`);
            console.log(`第5名: ${dbResult.position_5}號`);
            console.log(`第6名: ${dbResult.position_6}號`);
            console.log(`第7名: ${dbResult.position_7}號`);
            console.log(`第8名: ${dbResult.position_8}號`);
            console.log(`第9名: ${dbResult.position_9}號`);
            console.log(`第10名: ${dbResult.position_10}號`);
            
            console.log('\nJSON result 欄位:', dbResult.result);
            
            // 解析 JSON 結果
            if (dbResult.result) {
                const jsonResult = typeof dbResult.result === 'string' ? JSON.parse(dbResult.result) : dbResult.result;
                console.log('\n解析後的 JSON 陣列（這是錯誤的順序）:', jsonResult);
                
                // 比較兩種儲存方式
                console.log('\n比較 position_N 和 JSON 陣列：');
                const positionArray = [];
                for (let i = 1; i <= 10; i++) {
                    positionArray.push(dbResult[`position_${i}`]);
                }
                console.log('Position 陣列（正確）:', positionArray);
                console.log('JSON 陣列（錯誤）:', jsonResult);
                
                console.log('\n主畫面應該顯示:', positionArray);
                console.log('近期開獎如果顯示:', jsonResult, '就是錯誤的');
            }
        } else {
            console.log('❌ 找不到期號 20250717712 的開獎結果');
        }
        
        // 2. 模擬 /api/history API 查詢
        console.log('\n\n模擬 /api/history API 查詢：');
        const historyResult = await db.oneOrNone(`
            SELECT period, result, created_at,
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10
            FROM result_history 
            WHERE period = $1
        `, ['20250717712']);
        
        if (historyResult) {
            // 模擬 API 返回的格式
            const positionArray = [];
            for (let i = 1; i <= 10; i++) {
                positionArray.push(historyResult[`position_${i}`]);
            }
            
            console.log('API 應該返回的正確結果:', {
                period: historyResult.period,
                result: positionArray,
                time: historyResult.created_at
            });
        }
        
    } catch (error) {
        console.error('檢查錯誤:', error);
    } finally {
        process.exit();
    }
}

checkPeriod712();