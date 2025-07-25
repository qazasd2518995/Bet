// diagnose-result-saving.js - 诊断开奖结果保存问题
import db from './db/config.js';

async function diagnoseResultSaving() {
    console.log('========== 诊断开奖结果保存机制 ==========\n');
    
    try {
        // 1. 检查最近的开奖结果
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
        
        console.log('检查最近5期的开奖结果：\n');
        
        for (const result of recentResults) {
            console.log(`期号: ${result.period}`);
            console.log(`开奖时间: ${result.draw_time}`);
            
            // 解析 JSON 格式的结果
            let jsonResult = null;
            try {
                jsonResult = JSON.parse(result.result_json);
            } catch (e) {
                console.log('  ❌ 无法解析 result 栏位的 JSON');
            }
            
            // 从 position_* 栏位构建阵列
            const positionArray = [];
            for (let i = 1; i <= 10; i++) {
                positionArray.push(result[`position_${i}`]);
            }
            
            console.log(`  JSON result 栏位: ${jsonResult ? JSON.stringify(jsonResult) : 'null'}`);
            console.log(`  Position 栏位阵列: [${positionArray.join(', ')}]`);
            
            // 比较两者是否一致
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
        
        // 2. 检查 game_state 表的最后结果
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
            console.log('game_state 表的状态：');
            console.log(`  当前期号: ${gameState.current_period}`);
            console.log(`  最后结果: ${gameState.last_result_json}`);
            console.log(`  状态: ${gameState.status}`);
            console.log(`  更新时间: ${gameState.updated_at}`);
            console.log('');
        }
        
        // 3. 检查特定问题期号 20250718493
        console.log('特定检查期号 20250718493：');
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
            console.log(`  现在两者是否一致: ${JSON.stringify(jsonResult) === JSON.stringify(positionArray) ? '✅ 是' : '❌ 否'}`);
        }
        
        // 4. 结论和建议
        console.log('\n========== 诊断结论 ==========');
        console.log('1. result_history 表有两种方式储存开奖结果：');
        console.log('   - result 栏位（JSON 格式）');
        console.log('   - position_1 到 position_10 栏位（个别数字）');
        console.log('');
        console.log('2. 如果这两种储存方式不一致，可能会导致显示问题');
        console.log('');
        console.log('3. 建议修改保存逻辑，确保两种格式始终保持一致');
        console.log('');
        console.log('4. 前端显示时应该统一使用其中一种来源');
        
    } catch (error) {
        console.error('诊断过程中发生错误:', error);
    }
    
    process.exit();
}

// 执行诊断
diagnoseResultSaving();