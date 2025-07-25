// check-period-697-result.js - 檢查期號 697 的開獎結果問題
import db from './db/config.js';

async function checkPeriod697() {
    try {
        console.log('檢查期號 20250717697 的開獎結果...\n');
        
        // 1. 查詢資料庫中的開獎結果
        const dbResult = await db.oneOrNone(`
            SELECT period, 
                   position_1, position_2, position_3, position_4, position_5,
                   position_6, position_7, position_8, position_9, position_10,
                   result,
                   draw_time
            FROM result_history 
            WHERE period = $1
        `, ['20250717697']);
        
        if (dbResult) {
            console.log('資料庫中的開獎結果：');
            console.log('期號:', dbResult.period);
            console.log('開獎時間:', dbResult.draw_time);
            console.log('\n各位置的號碼：');
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
                console.log('\n解析後的 JSON 陣列:', jsonResult);
                
                // 比較兩種儲存方式
                console.log('\n比較 position_N 和 JSON 陣列：');
                const positionArray = [];
                for (let i = 1; i <= 10; i++) {
                    positionArray.push(dbResult[`position_${i}`]);
                }
                console.log('Position 陣列:', positionArray);
                console.log('JSON 陣列:', jsonResult);
                
                // 檢查是否一致
                const isConsistent = positionArray.every((val, idx) => val === jsonResult[idx]);
                console.log('\n兩種儲存方式是否一致:', isConsistent ? '✅ 一致' : '❌ 不一致');
            }
        } else {
            console.log('❌ 找不到期號 20250717697 的開獎結果');
        }
        
        // 2. 檢查遊戲狀態表中的 last_result
        const gameState = await db.oneOrNone(`
            SELECT last_result, current_period
            FROM game_state
            WHERE id = 1
        `);
        
        if (gameState) {
            console.log('\n\n遊戲狀態表資訊：');
            console.log('當前期號:', gameState.current_period);
            console.log('最後開獎結果 (last_result):', gameState.last_result);
            
            if (gameState.last_result) {
                const lastResult = typeof gameState.last_result === 'string' ? JSON.parse(gameState.last_result) : gameState.last_result;
                console.log('解析後的陣列:', lastResult);
            }
        }
        
        // 3. 檢查相關的下注記錄
        const bets = await db.manyOrNone(`
            SELECT id, username, bet_type, bet_value, position, amount, win, win_amount
            FROM bet_history
            WHERE period = $1
            ORDER BY id
        `, ['20250717697']);
        
        if (bets && bets.length > 0) {
            console.log(`\n\n找到 ${bets.length} 筆下注記錄：`);
            bets.forEach((bet, idx) => {
                console.log(`${idx + 1}. ID:${bet.id}, 用戶:${bet.username}, ` +
                           `類型:${bet.bet_type}, 值:${bet.bet_value}, ` +
                           `位置:${bet.position || 'N/A'}, 金額:${bet.amount}, ` +
                           `中獎:${bet.win ? '是' : '否'}, 派彩:${bet.win_amount || 0}`);
            });
        }
        
        // 4. 分析問題
        console.log('\n\n問題分析：');
        console.log('1. 資料庫儲存的開獎結果應該是按照位置順序 (position_1 到 position_10)');
        console.log('2. 前端顯示時需要確保正確讀取各位置的號碼');
        console.log('3. 可能是前端顯示邏輯或資料傳輸時的順序問題');
        
    } catch (error) {
        console.error('檢查錯誤:', error);
    } finally {
        process.exit();
    }
}

checkPeriod697();