// test-sum-bet-fix.js - 測試冠亞和結算修復
import db from './db/config.js';
import { checkBetWinEnhanced } from './enhanced-settlement-system.js';

async function testSumBetFix() {
    console.log('測試冠亞和結算邏輯修復...\n');
    
    // 測試案例：期號 20250718406
    const drawResult = {
        positions: [3, 6, 7, 8, 5, 4, 9, 10, 2, 1]
    };
    
    const sum = drawResult.positions[0] + drawResult.positions[1];
    console.log(`開獎結果：第1名=${drawResult.positions[0]}號，第2名=${drawResult.positions[1]}號`);
    console.log(`冠亞和 = ${drawResult.positions[0]} + ${drawResult.positions[1]} = ${sum}`);
    console.log('');
    
    // 測試各種冠亞和投注
    const testBets = [
        { bet_type: 'sumValue', bet_value: 'big', amount: 1, odds: 1.98 },
        { bet_type: 'sumValue', bet_value: 'small', amount: 1, odds: 1.98 },
        { bet_type: 'sumValue', bet_value: 'odd', amount: 1, odds: 1.98 },
        { bet_type: 'sumValue', bet_value: 'even', amount: 1, odds: 1.98 }
    ];
    
    console.log('測試結果：');
    for (const bet of testBets) {
        const result = await checkBetWinEnhanced(bet, drawResult);
        console.log(`冠亞和${bet.bet_value}：${result.isWin ? '✓ 中獎' : '✗ 未中'} - ${result.reason}`);
    }
    
    console.log('\n分析：');
    console.log(`- 冠亞和 = ${sum}`);
    console.log(`- 是否為大（≥12）：${sum >= 12 ? '是' : '否'}`);
    console.log(`- 是否為小（≤11）：${sum <= 11 ? '是' : '否'}`);
    console.log(`- 是否為單（奇數）：${sum % 2 === 1 ? '是' : '否'}`);
    console.log(`- 是否為雙（偶數）：${sum % 2 === 0 ? '是' : '否'}`);
    
    // 測試其他和值
    console.log('\n其他和值測試：');
    const testSums = [3, 7, 11, 12, 15, 19];
    for (const testSum of testSums) {
        console.log(`\n和值 ${testSum}：`);
        console.log(`- 大（≥12）：${testSum >= 12 ? '✓' : '✗'}`);
        console.log(`- 小（≤11）：${testSum <= 11 ? '✓' : '✗'}`);
        console.log(`- 單（奇數）：${testSum % 2 === 1 ? '✓' : '✗'}`);
        console.log(`- 雙（偶數）：${testSum % 2 === 0 ? '✓' : '✗'}`);
    }
    
    process.exit(0);
}

testSumBetFix().catch(error => {
    console.error('測試失敗:', error);
    process.exit(1);
});