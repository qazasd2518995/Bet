// check-wrong-settlement.js - 檢查錯誤的結算
import db from './db/config.js';

async function checkWrongSettlement() {
    console.log('🔍 檢查投注結算問題...\n');
    
    try {
        // 1. 查詢期號 20250714203 的開獎結果
        const result = await db.oneOrNone(`
            SELECT period, result, created_at
            FROM result_history
            WHERE period = 20250714203
        `);
        
        if (!result) {
            console.log('找不到期號 20250714203 的開獎結果');
            return;
        }
        
        console.log(`期號: ${result.period}`);
        console.log(`開獎時間: ${result.created_at}`);
        
        // 解析開獎結果
        let positions = [];
        try {
            const resultObj = JSON.parse(result.result);
            positions = resultObj.positions || resultObj;
        } catch (e) {
            // 嘗試其他解析方式
            if (result.result.includes('positions')) {
                const match = result.result.match(/"positions":\s*\[([^\]]+)\]/);
                if (match) {
                    positions = match[1].split(',').map(n => parseInt(n.trim()));
                }
            }
        }
        
        if (positions.length > 0) {
            console.log('\n開獎結果（各名次號碼）：');
            positions.forEach((num, idx) => {
                console.log(`第${idx + 1}名: ${num}${idx === 2 && num === 7 ? ' ✅ (第3名是7號!)' : ''}`);
            });
        }
        
        // 2. 查詢該期的投注記錄
        const bet = await db.oneOrNone(`
            SELECT *
            FROM bet_history
            WHERE period = 20250714203
            AND username = 'justin111'
            AND bet_type = 'number'
            AND bet_value = '7'
            AND position = 3
        `);
        
        if (bet) {
            console.log('\n投注資訊：');
            console.log(`投注ID: ${bet.id}`);
            console.log(`投注內容: 第${bet.position}名 = ${bet.bet_value}號`);
            console.log(`投注金額: ${bet.amount} 元`);
            console.log(`賠率: ${bet.odds}`);
            console.log(`結算狀態: ${bet.settled ? '已結算' : '未結算'}`);
            console.log(`中獎狀態: ${bet.win ? '✅ 中獎' : '❌ 未中獎'}`);
            console.log(`中獎金額: ${bet.win_amount || 0} 元`);
            
            // 檢查是否應該中獎
            if (positions.length > 2 && positions[2] === 7 && !bet.win) {
                console.log('\n⚠️ 發現問題！');
                console.log('第3名確實開出7號，但系統判定為未中獎');
                console.log('這是一個結算錯誤，需要修正');
                
                // 檢查結算邏輯
                console.log('\n可能的原因：');
                console.log('1. 結算系統的位置索引可能有誤（0-based vs 1-based）');
                console.log('2. 號碼比對邏輯可能有問題');
                console.log('3. 數據類型不匹配（字串 vs 數字）');
            }
        } else {
            console.log('\n找不到符合的投注記錄');
        }
        
        // 3. 檢查該期所有中獎的投注
        const winners = await db.any(`
            SELECT bet_type, bet_value, position, amount, win_amount
            FROM bet_history
            WHERE period = 20250714203
            AND win = true
            ORDER BY win_amount DESC
        `);
        
        if (winners.length > 0) {
            console.log(`\n該期共有 ${winners.length} 注中獎：`);
            winners.forEach(w => {
                if (w.position) {
                    console.log(`- ${w.bet_type}: 第${w.position}名=${w.bet_value}, 中獎${w.win_amount}元`);
                } else {
                    console.log(`- ${w.bet_type}: ${w.bet_value}, 中獎${w.win_amount}元`);
                }
            });
        }
        
    } catch (error) {
        console.error('檢查過程中發生錯誤:', error);
    } finally {
        await db.$pool.end();
    }
}

// 執行檢查
checkWrongSettlement();