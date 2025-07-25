// check-period-431-sum.js - 檢查期號 431 的冠亞和結算
import db from './db/config.js';
import { checkBetWinEnhanced } from './enhanced-settlement-system.js';

async function checkPeriod431() {
    const period = '20250718431';
    
    try {
        console.log(`檢查期號 ${period} 的冠亞和結算問題...`);
        
        // 1. 查詢開獎結果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            console.error('找不到開獎結果');
            return;
        }
        
        console.log('\n開獎結果：');
        console.log(`冠軍: ${drawResult.position_1}號`);
        console.log(`亞軍: ${drawResult.position_2}號`);
        const sum = drawResult.position_1 + drawResult.position_2;
        console.log(`冠亞和: ${drawResult.position_1} + ${drawResult.position_2} = ${sum}`);
        console.log(`冠亞和單雙: ${sum % 2 === 1 ? '單' : '雙'}`);
        
        // 2. 查詢冠亞和投注
        const sumBets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = $1 
            AND (bet_type = 'sum' OR bet_type = 'sumValue' OR bet_type = '冠亞和')
            AND (bet_value = '單' OR bet_value = 'odd')
            ORDER BY id
        `, [period]);
        
        console.log(`\n找到 ${sumBets.length} 筆冠亞和單的投注`);
        
        // 3. 顯示每筆投注的結算結果
        console.log('\n投注詳情：');
        for (const bet of sumBets) {
            console.log(`\nID ${bet.id}:`);
            console.log(`  用戶: ${bet.username}`);
            console.log(`  投注類型: ${bet.bet_type}`);
            console.log(`  投注值: ${bet.bet_value}`);
            console.log(`  金額: $${bet.amount}`);
            console.log(`  系統結算: ${bet.win ? '✓贏' : '✗輸'}, 派彩$${bet.win_amount || 0}`);
            
            // 重新檢查結算邏輯
            const positions = [
                drawResult.position_1,
                drawResult.position_2,
                drawResult.position_3,
                drawResult.position_4,
                drawResult.position_5,
                drawResult.position_6,
                drawResult.position_7,
                drawResult.position_8,
                drawResult.position_9,
                drawResult.position_10
            ];
            
            const winCheck = await checkBetWinEnhanced(bet, { positions });
            console.log(`  重新檢查: ${winCheck.isWin ? '✓應該贏' : '✗應該輸'}`);
            console.log(`  原因: ${winCheck.reason}`);
            
            if (bet.win !== winCheck.isWin) {
                console.log(`  ⚠️ 結算錯誤！系統判定${bet.win ? '贏' : '輸'}，但應該${winCheck.isWin ? '贏' : '輸'}`);
            }
        }
        
        // 4. 分析問題
        console.log('\n\n問題分析：');
        console.log(`冠亞和 = ${sum} (${sum % 2 === 1 ? '單' : '雙'})`);
        console.log(`- 投注「單」應該${sum % 2 === 1 ? '中獎' : '不中'}`);
        console.log(`- 投注「雙」應該${sum % 2 === 0 ? '中獎' : '不中'}`);
        
        // 5. 查看 checkTwoSidesBet 函數的邏輯
        console.log('\n\n檢查 checkTwoSidesBet 函數邏輯：');
        console.log('當 betType = "冠亞和" 且 betValue = "單" 時：');
        console.log(`- isSumBet = true (因為 betType === '冠亞和')`);
        console.log(`- 執行: isWin = winningNumber % 2 === 1`);
        console.log(`- 冠亞和${sum} % 2 = ${sum % 2}`);
        console.log(`- 應該返回: ${sum % 2 === 1 ? 'true (贏)' : 'false (輸)'}`);
        
    } catch (error) {
        console.error('檢查失敗:', error);
    } finally {
        process.exit();
    }
}

checkPeriod431();