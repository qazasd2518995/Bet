// fix-period-406-settlement.js - 修復期號 406 的結算
import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function fixPeriod406() {
    const period = '20250718406';
    
    try {
        console.log(`開始修復期號 ${period} 的結算...`);
        
        // 1. 查詢開獎結果
        const drawResult = await db.oneOrNone(`
            SELECT * FROM result_history WHERE period = $1
        `, [period]);
        
        if (!drawResult) {
            console.error('找不到開獎結果');
            return;
        }
        
        console.log('\n開獎結果：');
        console.log(`第1名: ${drawResult.position_1}號`);
        console.log(`第2名: ${drawResult.position_2}號`);
        console.log(`冠亞和: ${drawResult.position_1} + ${drawResult.position_2} = ${drawResult.position_1 + drawResult.position_2}`);
        
        // 2. 查詢該期所有投注
        const bets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = $1 AND username = 'justin111'
            ORDER BY id
        `, [period]);
        
        console.log(`\n找到 ${bets.length} 筆投注`);
        
        // 3. 顯示原始結算結果
        console.log('\n原始結算結果：');
        for (const bet of bets) {
            console.log(`ID ${bet.id}: ${bet.bet_type} ${bet.bet_value}, 金額$${bet.amount}, ${bet.win ? '贏' : '輸'}, 派彩$${bet.win_amount || 0}`);
        }
        
        // 4. 重新結算
        console.log('\n開始重新結算...');
        
        // 先將所有投注標記為未結算
        await db.none(`
            UPDATE bet_history 
            SET settled = false, win = false, win_amount = 0
            WHERE period = $1
        `, [period]);
        
        // 執行增強結算
        const result = await enhancedSettlement(period, {
            positions: [
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
            ]
        });
        
        if (result.success) {
            console.log('\n結算完成！');
            console.log(`結算筆數: ${result.settledCount}`);
            console.log(`中獎筆數: ${result.winCount}`);
            console.log(`總派彩: $${result.totalWinAmount}`);
            
            // 5. 顯示新的結算結果
            const newBets = await db.manyOrNone(`
                SELECT * FROM bet_history 
                WHERE period = $1 AND username = 'justin111'
                ORDER BY id
            `, [period]);
            
            console.log('\n新的結算結果：');
            for (const bet of newBets) {
                console.log(`ID ${bet.id}: ${bet.bet_type} ${bet.bet_value}, 金額$${bet.amount}, ${bet.win ? '✓贏' : '✗輸'}, 派彩$${bet.win_amount || 0}`);
            }
            
            // 分析變化
            console.log('\n結算變化：');
            const sum = drawResult.position_1 + drawResult.position_2;
            console.log(`冠亞和 = ${sum}`);
            console.log(`- 冠亞和大（${sum} >= 12）：${sum >= 12 ? '中獎' : '未中'}`);
            console.log(`- 冠亞和單（${sum} % 2 = ${sum % 2}）：${sum % 2 === 1 ? '中獎' : '未中'}`);
            
        } else {
            console.error('結算失敗:', result.error);
        }
        
    } catch (error) {
        console.error('修復失敗:', error);
    } finally {
        process.exit();
    }
}

fixPeriod406();