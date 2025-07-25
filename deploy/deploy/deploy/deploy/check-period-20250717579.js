// check-period-20250717579.js - 檢查期號 20250717579 的結算錯誤
import db from './db/config.js';

async function checkPeriod579() {
    console.log('=== 檢查期號 20250717579 ===\n');
    
    try {
        // 1. 檢查開獎結果
        console.log('1. 開獎結果:');
        const result = await db.oneOrNone(`
            SELECT 
                period,
                position_1, position_2, position_3, position_4, position_5,
                position_6, position_7, position_8, position_9, position_10,
                result,
                draw_time
            FROM result_history
            WHERE period = '20250717579'
        `);
        
        if (result) {
            console.log(`期號: ${result.period}`);
            console.log(`開獎時間: ${result.draw_time}`);
            console.log(`開獎結果:`);
            for (let i = 1; i <= 10; i++) {
                const pos = result[`position_${i}`];
                console.log(`  第${i}名: ${pos}號`);
            }
            console.log(`JSON結果: ${result.result}`);
            console.log(`\n冠軍號碼: ${result.position_1} (${result.position_1 >= 6 ? '大' : '小'})`);
        } else {
            console.log('找不到該期開獎結果！');
        }
        
        // 2. 檢查相關投注
        console.log('\n2. 相關投注記錄:');
        const bets = await db.manyOrNone(`
            SELECT 
                id, username, bet_type, bet_value, position,
                amount, odds, win, win_amount, settled,
                created_at, settled_at
            FROM bet_history
            WHERE period = '20250717579'
            AND (
                (bet_type = '冠軍' AND bet_value IN ('大', '小'))
                OR (bet_type = 'champion' AND bet_value IN ('big', 'small'))
                OR (bet_type = 'number' AND position = '1')
            )
            ORDER BY created_at
        `);
        
        if (bets && bets.length > 0) {
            console.log(`找到 ${bets.length} 筆相關投注：`);
            for (const bet of bets) {
                console.log(`\n投注ID: ${bet.id}`);
                console.log(`  用戶: ${bet.username}`);
                console.log(`  類型: ${bet.bet_type}`);
                console.log(`  內容: ${bet.bet_value}`);
                console.log(`  位置: ${bet.position || 'N/A'}`);
                console.log(`  金額: ${bet.amount}`);
                console.log(`  賠率: ${bet.odds}`);
                console.log(`  已結算: ${bet.settled ? '是' : '否'}`);
                console.log(`  中獎: ${bet.win ? '是' : '否'}`);
                console.log(`  派彩: ${bet.win_amount || 0}`);
                console.log(`  下注時間: ${bet.created_at}`);
                console.log(`  結算時間: ${bet.settled_at || 'N/A'}`);
            }
        } else {
            console.log('沒有找到相關投注記錄');
        }
        
        // 3. 檢查結算日誌
        console.log('\n3. 結算日誌:');
        const logs = await db.manyOrNone(`
            SELECT 
                id, status, message, details, created_at
            FROM settlement_logs
            WHERE period = '20250717579'
            ORDER BY created_at
        `);
        
        if (logs && logs.length > 0) {
            console.log(`找到 ${logs.length} 筆結算日誌：`);
            for (const log of logs) {
                console.log(`\n日誌ID: ${log.id}`);
                console.log(`  狀態: ${log.status}`);
                console.log(`  訊息: ${log.message}`);
                console.log(`  詳情: ${log.details}`);
                console.log(`  時間: ${log.created_at}`);
            }
        } else {
            console.log('沒有找到結算日誌');
        }
        
        // 4. 檢查所有"冠軍小"的投注
        console.log('\n4. 所有"冠軍小"的投注:');
        const smallBets = await db.manyOrNone(`
            SELECT 
                id, username, amount, win, win_amount, settled_at
            FROM bet_history
            WHERE period = '20250717579'
            AND ((bet_type = '冠軍' AND bet_value = '小') 
                 OR (bet_type = 'champion' AND bet_value = 'small'))
        `);
        
        if (smallBets && smallBets.length > 0) {
            console.log(`找到 ${smallBets.length} 筆"冠軍小"投注：`);
            let totalWrong = 0;
            for (const bet of smallBets) {
                if (bet.win) {
                    totalWrong++;
                    console.log(`❌ 錯誤結算 - ID: ${bet.id}, 用戶: ${bet.username}, 金額: ${bet.amount}, 派彩: ${bet.win_amount}`);
                } else {
                    console.log(`✅ 正確結算 - ID: ${bet.id}, 用戶: ${bet.username}, 金額: ${bet.amount}`);
                }
            }
            if (totalWrong > 0) {
                console.log(`\n⚠️ 發現 ${totalWrong} 筆錯誤結算！`);
            }
        }
        
        // 5. 檢查結算時的系統狀態
        console.log('\n5. 檢查開獎和結算時序:');
        
        // 獲取開獎時間
        if (result) {
            const drawTime = new Date(result.draw_time);
            console.log(`開獎時間: ${drawTime.toISOString()}`);
            
            // 獲取第一筆結算時間
            const firstSettlement = await db.oneOrNone(`
                SELECT MIN(settled_at) as first_settled
                FROM bet_history
                WHERE period = '20250717579' AND settled = true
            `);
            
            if (firstSettlement?.first_settled) {
                const settlementTime = new Date(firstSettlement.first_settled);
                console.log(`首次結算時間: ${settlementTime.toISOString()}`);
                
                const timeDiff = (settlementTime - drawTime) / 1000;
                console.log(`時間差: ${timeDiff.toFixed(1)} 秒`);
            }
        }
        
    } catch (error) {
        console.error('檢查失敗:', error);
    } finally {
        await db.$pool.end();
    }
}

checkPeriod579();