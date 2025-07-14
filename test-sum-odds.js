// test-sum-odds.js - 測試冠亞和值賠率
import { calculateWinAmount } from './improved-settlement-system.js';

async function testSumOdds() {
    console.log('🧪 測試冠亞和值賠率...\n');
    
    // 測試所有和值的賠率
    const sumValues = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const expectedOdds = {
        3: 44.51, 4: 22.75, 5: 14.84, 6: 11.37, 7: 8.90,
        8: 7.42, 9: 6.43, 10: 5.64, 11: 5.64, 12: 6.43,
        13: 7.42, 14: 8.90, 15: 11.37, 16: 14.84, 17: 22.75,
        18: 44.51, 19: 89.02
    };
    
    console.log('冠亞和值賠率測試:');
    
    for (const sumValue of sumValues) {
        const mockBet = {
            bet_type: 'sumValue',
            bet_value: sumValue.toString(),
            amount: '100',
            odds: '0' // 強制使用計算的賠率
        };
        
        const winAmount = calculateWinAmount(mockBet, null);
        const actualOdds = winAmount / 100;
        const expectedOdd = expectedOdds[sumValue];
        const correct = Math.abs(actualOdds - expectedOdd) < 0.01;
        
        console.log(`和值 ${sumValue}: 預期賠率 ${expectedOdd}, 實際賠率 ${actualOdds}, ${correct ? '✅ 正確' : '❌ 錯誤'}`);
    }
    
    // 測試冠亞和大小單雙賠率
    console.log('\n冠亞和大小單雙賠率測試:');
    const bigSmallOddEven = ['big', 'small', 'odd', 'even'];
    
    for (const value of bigSmallOddEven) {
        const mockBet = {
            bet_type: 'sumValue',
            bet_value: value,
            amount: '100',
            odds: '0' // 強制使用計算的賠率
        };
        
        const winAmount = calculateWinAmount(mockBet, null);
        const actualOdds = winAmount / 100;
        const correct = Math.abs(actualOdds - 1.98) < 0.01;
        
        console.log(`冠亞和${value}: 預期賠率 1.98, 實際賠率 ${actualOdds}, ${correct ? '✅ 正確' : '❌ 錯誤'}`);
    }
    
    console.log('\n✅ 冠亞和值賠率測試完成！');
}

testSumOdds();