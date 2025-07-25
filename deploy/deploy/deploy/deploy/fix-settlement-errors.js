// fix-settlement-errors.js - 修復結算錯誤
import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function fixSettlementErrors() {
    // 需要修復的期號
    const periodsToFix = [
        '20250718477', // 大小結算錯誤
        '20250718478', // 號碼結算錯誤
        '20250718479'  // 龍虎結算錯誤
    ];
    
    for (const period of periodsToFix) {
        console.log(`\n========== 修復期號 ${period} ==========`);
        
        try {
            // 1. 查詢開獎結果
            const drawResult = await db.oneOrNone(`
                SELECT * FROM result_history WHERE period = $1
            `, [period]);
            
            if (!drawResult) {
                console.error(`找不到期號 ${period} 的開獎結果`);
                continue;
            }
            
            console.log('開獎結果：');
            const positions = [];
            for (let i = 1; i <= 10; i++) {
                const pos = drawResult[`position_${i}`];
                positions.push(pos);
                console.log(`  第${i}名: ${pos}號`);
            }
            
            // 2. 查詢該期所有投注
            const bets = await db.manyOrNone(`
                SELECT * FROM bet_history 
                WHERE period = $1
                ORDER BY id
            `, [period]);
            
            console.log(`\n找到 ${bets.length} 筆投注，開始重新結算...`);
            
            // 3. 先將所有投注標記為未結算
            await db.none(`
                UPDATE bet_history 
                SET settled = false, win = false, win_amount = 0
                WHERE period = $1
            `, [period]);
            
            // 4. 執行增強結算
            const result = await enhancedSettlement(period, { positions });
            
            if (result.success) {
                console.log('\n結算完成：');
                console.log(`  結算筆數: ${result.settledCount}`);
                console.log(`  中獎筆數: ${result.winCount}`);
                console.log(`  總派彩: $${result.totalWinAmount}`);
                
                // 5. 顯示結算後的結果
                const updatedBets = await db.manyOrNone(`
                    SELECT id, username, bet_type, bet_value, position, amount, win, win_amount
                    FROM bet_history 
                    WHERE period = $1
                    ORDER BY id
                `, [period]);
                
                console.log('\n結算詳情：');
                for (const bet of updatedBets) {
                    console.log(`  ID ${bet.id}: ${bet.bet_type} ${bet.bet_value}${bet.position ? ` (位置${bet.position})` : ''}, $${bet.amount} → ${bet.win ? `✓贏 $${bet.win_amount}` : '✗輸'}`);
                }
            } else {
                console.error(`結算失敗: ${result.error}`);
            }
            
        } catch (error) {
            console.error(`處理期號 ${period} 時出錯:`, error);
        }
    }
    
    console.log('\n\n修復完成！');
    process.exit();
}

// 執行修復
fixSettlementErrors();