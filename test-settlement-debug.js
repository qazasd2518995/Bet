import db from './db/config.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';

async function testSettlementDebug() {
    try {
        // Test with period 689 where we know the issue
        const period = '20250718689';
        
        console.log('='.repeat(80));
        console.log(`測試結算調試 - 期號: ${period}`);
        console.log('='.repeat(80));
        
        // Get the draw result
        const drawResult = await db.oneOrNone(
            'SELECT * FROM result_history WHERE period = $1',
            [period]
        );
        
        if (!drawResult) {
            console.log('找不到開獎結果');
            return;
        }
        
        // Format draw result for settlement
        const winResult = {
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
        };
        
        console.log('開獎結果:', winResult.positions.join(','));
        console.log('\n');
        
        // Get specific bets we're interested in
        const testBets = await db.manyOrNone(`
            SELECT * FROM bet_history 
            WHERE period = $1 
            AND bet_type = 'number' 
            AND position = '10'
            AND bet_value IN ('4', '10')
            ORDER BY id
        `, [period]);
        
        console.log(`找到 ${testBets.length} 筆測試投注\n`);
        
        // Manually check each bet
        for (const bet of testBets) {
            console.log('='.repeat(60));
            console.log(`測試投注 ID: ${bet.id}`);
            console.log(`投注詳情: 第${bet.position}名 號碼${bet.bet_value}`);
            console.log(`當前狀態: 已結算=${bet.settled}, 派彩=${bet.win_amount}`);
            
            // Test the settlement logic
            console.log('\n執行結算邏輯檢查...');
            
            // Enhanced debugging
            const position = parseInt(bet.position);
            const betNumber = parseInt(bet.bet_value);
            const winningNumber = winResult.positions[position - 1];
            
            console.log(`\n詳細調試信息:`);
            console.log(`- 原始 bet.position: "${bet.position}" (類型: ${typeof bet.position})`);
            console.log(`- 原始 bet.bet_value: "${bet.bet_value}" (類型: ${typeof bet.bet_value})`);
            console.log(`- 轉換後 position: ${position}`);
            console.log(`- 轉換後 betNumber: ${betNumber}`);
            console.log(`- 陣列索引: positions[${position - 1}]`);
            console.log(`- 開獎號碼: ${winningNumber}`);
            console.log(`- 比較: ${betNumber} === ${winningNumber} = ${betNumber === winningNumber}`);
            
            // Check if there might be any string/number comparison issues
            console.log(`\n字串比較檢查:`);
            console.log(`- String(${betNumber}) === String(${winningNumber}) = ${String(betNumber) === String(winningNumber)}`);
            console.log(`- bet.bet_value === String(winningNumber) = ${bet.bet_value === String(winningNumber)}`);
            console.log(`- parseInt(bet.bet_value) === winningNumber = ${parseInt(bet.bet_value) === winningNumber}`);
            
            const shouldWin = winningNumber === betNumber;
            const actuallyWon = bet.win_amount > 0;
            
            console.log(`\n結果分析:`);
            console.log(`- 應該贏: ${shouldWin}`);
            console.log(`- 實際贏: ${actuallyWon}`);
            console.log(`- 結算正確: ${shouldWin === actuallyWon ? '✅' : '❌'}`);
            
            if (shouldWin !== actuallyWon) {
                console.log(`\n❌ 結算錯誤！`);
                if (shouldWin && !actuallyWon) {
                    console.log(`錯誤類型: 應該贏但標記為輸`);
                } else {
                    console.log(`錯誤類型: 應該輸但標記為贏`);
                }
            }
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('測試完成');
        
        await db.$pool.end();
        process.exit(0);
    } catch (error) {
        console.error('錯誤:', error);
        await db.$pool.end();
        process.exit(1);
    }
}

testSettlementDebug();