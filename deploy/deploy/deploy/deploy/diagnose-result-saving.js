// diagnose-result-saving.js - 診斷開獎結果保存問題
import db from './db/config.js';

async function diagnoseResultSaving() {
    console.log('========== 診斷開獎結果保存機制 ==========\n');
    
    try {
        // 1. 檢查最近的開獎結果
        const recentResults = await db.manyOrNone(`
            SELECT 
                period,
                result::text as result_json,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                draw_time
            FROM result_history
            ORDER BY draw_time DESC
            LIMIT 5
        `);
        
        console.log('檢查最近5期的開獎結果：\n');
        
        for (const result of recentResults) {
            console.log(`期號: ${result.period}`);
            console.log(`開獎時間: ${result.draw_time}`);
            
            // 解析 JSON 格式的結果
            let jsonResult = null;
            try {
                jsonResult = JSON.parse(result.result_json);
            } catch (e) {
                console.log('  ❌ 無法解析 result 欄位的 JSON');
            }
            
            // 從 position_* 欄位構建陣列
            const positionArray = [];
            for (let i = 1; i <= 10; i++) {
                positionArray.push(result[`position_${i}`]);
            }
            
            console.log(`  JSON result 欄位: ${jsonResult ? JSON.stringify(jsonResult) : 'null'}`);
            console.log(`  Position 欄位陣列: [${positionArray.join(', ')}]`);
            
            // 比較兩者是否一致
            if (jsonResult && Array.isArray(jsonResult)) {
                let isConsistent = true;
                for (let i = 0; i < 10; i++) {
                    if (jsonResult[i] !== positionArray[i]) {
                        isConsistent = false;
                        break;
                    }
                }
                console.log(`  一致性: ${isConsistent ? '✅ 一致' : '❌ 不一致'}`);
            }
            
            console.log('');
        }
        
        // 2. 檢查 game_state 表的最後結果
        const gameState = await db.oneOrNone(`
            SELECT 
                current_period,
                last_result::text as last_result_json,
                status,
                updated_at
            FROM game_state
            WHERE id = 1
        `);
        
        if (gameState) {
            console.log('game_state 表的狀態：');
            console.log(`  當前期號: ${gameState.current_period}`);
            console.log(`  最後結果: ${gameState.last_result_json}`);
            console.log(`  狀態: ${gameState.status}`);
            console.log(`  更新時間: ${gameState.updated_at}`);
            console.log('');
        }
        
        // 3. 檢查特定問題期號 20250718493
        console.log('特定檢查期號 20250718493：');
        const problem493 = await db.oneOrNone(`
            SELECT 
                result::text as result_json,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10
            FROM result_history
            WHERE period = '20250718493'
        `);
        
        if (problem493) {
            const jsonResult = problem493.result_json ? JSON.parse(problem493.result_json) : null;
            const positionArray = [];
            for (let i = 1; i <= 10; i++) {
                positionArray.push(problem493[`position_${i}`]);
            }
            
            console.log(`  JSON result: ${JSON.stringify(jsonResult)}`);
            console.log(`  Position array: [${positionArray.join(', ')}]`);
            console.log(`  現在兩者是否一致: ${JSON.stringify(jsonResult) === JSON.stringify(positionArray) ? '✅ 是' : '❌ 否'}`);
        }
        
        // 4. 結論和建議
        console.log('\n========== 診斷結論 ==========');
        console.log('1. result_history 表有兩種方式儲存開獎結果：');
        console.log('   - result 欄位（JSON 格式）');
        console.log('   - position_1 到 position_10 欄位（個別數字）');
        console.log('');
        console.log('2. 如果這兩種儲存方式不一致，可能會導致顯示問題');
        console.log('');
        console.log('3. 建議修改保存邏輯，確保兩種格式始終保持一致');
        console.log('');
        console.log('4. 前端顯示時應該統一使用其中一種來源');
        
    } catch (error) {
        console.error('診斷過程中發生錯誤:', error);
    }
    
    process.exit();
}

// 執行診斷
diagnoseResultSaving();