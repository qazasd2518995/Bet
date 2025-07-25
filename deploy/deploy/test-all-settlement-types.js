// test-all-settlement-types.js - 測試所有投注類型的結算邏輯
import { checkWin, calculateWinAmount } from './improved-settlement-system.js';

async function testAllSettlementTypes() {
    console.log('🧪 測試所有投注類型的結算邏輯...\n');
    
    // 模擬開獎結果: [2,8,10,7,4,3,9,5,6,1]
    const mockWinResult = {
        positions: [2, 8, 10, 7, 4, 3, 9, 5, 6, 1]
    };
    
    console.log('模擬開獎結果:', mockWinResult.positions);
    console.log('冠軍:2(小,雙) 亞軍:8(大,雙) 第三名:10(大,雙) 第四名:7(大,單)');
    console.log('第五名:4(小,雙) 第六名:3(小,單) 第七名:9(大,單) 第八名:5(小,單)');
    console.log('第九名:6(大,雙) 第十名:1(小,單)');
    console.log('冠亞和: 2+8=10 (小,雙)\n');
    
    // 測試用例
    const testCases = [
        // 位置號碼投注
        { bet_type: 'champion', bet_value: '2', amount: 100, odds: 9.89, expected: true, description: '冠軍2號' },
        { bet_type: 'champion', bet_value: '1', amount: 100, odds: 9.89, expected: false, description: '冠軍1號' },
        
        // 位置大小投注
        { bet_type: 'champion', bet_value: 'small', amount: 100, odds: 1.98, expected: true, description: '冠軍小' },
        { bet_type: 'champion', bet_value: 'big', amount: 100, odds: 1.98, expected: false, description: '冠軍大' },
        { bet_type: 'runnerup', bet_value: 'big', amount: 100, odds: 1.98, expected: true, description: '亞軍大' },
        { bet_type: 'third', bet_value: 'big', amount: 100, odds: 1.98, expected: true, description: '第三名大' },
        { bet_type: 'fourth', bet_value: 'big', amount: 100, odds: 1.98, expected: true, description: '第四名大' },
        { bet_type: 'fifth', bet_value: 'small', amount: 100, odds: 1.98, expected: true, description: '第五名小' },
        { bet_type: 'sixth', bet_value: 'small', amount: 100, odds: 1.98, expected: true, description: '第六名小' },
        { bet_type: 'seventh', bet_value: 'big', amount: 100, odds: 1.98, expected: true, description: '第七名大' },
        { bet_type: 'eighth', bet_value: 'small', amount: 100, odds: 1.98, expected: true, description: '第八名小' },
        { bet_type: 'ninth', bet_value: 'big', amount: 100, odds: 1.98, expected: true, description: '第九名大' },
        { bet_type: 'tenth', bet_value: 'small', amount: 100, odds: 1.98, expected: true, description: '第十名小' },
        
        // 位置單雙投注
        { bet_type: 'champion', bet_value: 'even', amount: 100, odds: 1.98, expected: true, description: '冠軍雙' },
        { bet_type: 'champion', bet_value: 'odd', amount: 100, odds: 1.98, expected: false, description: '冠軍單' },
        { bet_type: 'runnerup', bet_value: 'even', amount: 100, odds: 1.98, expected: true, description: '亞軍雙' },
        { bet_type: 'third', bet_value: 'even', amount: 100, odds: 1.98, expected: true, description: '第三名雙' },
        { bet_type: 'fourth', bet_value: 'odd', amount: 100, odds: 1.98, expected: true, description: '第四名單' },
        { bet_type: 'fifth', bet_value: 'even', amount: 100, odds: 1.98, expected: true, description: '第五名雙' },
        { bet_type: 'sixth', bet_value: 'odd', amount: 100, odds: 1.98, expected: true, description: '第六名單' },
        { bet_type: 'seventh', bet_value: 'odd', amount: 100, odds: 1.98, expected: true, description: '第七名單' },
        { bet_type: 'eighth', bet_value: 'odd', amount: 100, odds: 1.98, expected: true, description: '第八名單' },
        { bet_type: 'ninth', bet_value: 'even', amount: 100, odds: 1.98, expected: true, description: '第九名雙' },
        { bet_type: 'tenth', bet_value: 'odd', amount: 100, odds: 1.98, expected: true, description: '第十名單' },
        
        // 冠亞和投注
        { bet_type: 'sumValue', bet_value: '10', amount: 100, odds: 5.637, expected: true, description: '冠亞和值10' },
        { bet_type: 'sumValue', bet_value: '7', amount: 100, odds: 8.901, expected: false, description: '冠亞和值7' },
        { bet_type: 'sumValue', bet_value: 'small', amount: 100, odds: 1.98, expected: true, description: '冠亞和小' },
        { bet_type: 'sumValue', bet_value: 'big', amount: 100, odds: 1.98, expected: false, description: '冠亞和大' },
        { bet_type: 'sumValue', bet_value: 'even', amount: 100, odds: 1.98, expected: true, description: '冠亞和雙' },
        { bet_type: 'sumValue', bet_value: 'odd', amount: 100, odds: 1.98, expected: false, description: '冠亞和單' },
        
        // 龍虎投注
        { bet_type: 'dragonTiger', bet_value: 'dragon_1_10', amount: 100, odds: 1.98, expected: true, description: '龍(冠軍vs第十名)' },
        { bet_type: 'dragonTiger', bet_value: 'dragon_3_8', amount: 100, odds: 1.98, expected: true, description: '龍(第三名vs第八名)' },
        { bet_type: 'dragonTiger', bet_value: 'dragon_5_6', amount: 100, odds: 1.98, expected: true, description: '龍(第五名vs第六名)' },
        { bet_type: 'dragonTiger', bet_value: 'tiger_2_9', amount: 100, odds: 1.98, expected: false, description: '虎(亞軍vs第九名)' },
        { bet_type: 'dragonTiger', bet_value: 'tiger_4_7', amount: 100, odds: 1.98, expected: true, description: '虎(第四名vs第七名)' },
        
        // 號碼投注
        { bet_type: 'number', bet_value: '7', position: 4, amount: 100, odds: 9.89, expected: true, description: '第四名7號' },
        { bet_type: 'number', bet_value: '5', position: 4, amount: 100, odds: 9.89, expected: false, description: '第四名5號' }
    ];
    
    console.log('開始測試...\n');
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const mockBet = {
            bet_type: testCase.bet_type,
            bet_value: testCase.bet_value,
            position: testCase.position,
            amount: testCase.amount.toString(),
            odds: testCase.odds.toString()
        };
        
        const actualWin = checkWin(mockBet, mockWinResult);
        const winAmount = actualWin ? calculateWinAmount(mockBet, mockWinResult) : 0;
        const expectedWinAmount = testCase.expected ? (testCase.amount * testCase.odds) : 0;
        
        const testPassed = actualWin === testCase.expected && 
                           (Math.abs(winAmount - expectedWinAmount) < 0.01);
        
        if (testPassed) {
            passedTests++;
        }
        
        console.log(`測試 ${i + 1}: ${testCase.description}`);
        console.log(`  預期: ${testCase.expected ? '中獎' : '未中獎'} ${testCase.expected ? `$${expectedWinAmount}` : ''}`);
        console.log(`  實際: ${actualWin ? '中獎' : '未中獎'} ${actualWin ? `$${winAmount}` : ''}`);
        console.log(`  結果: ${testPassed ? '✅ 通過' : '❌ 失敗'}`);
        console.log('');
    }
    
    console.log(`測試總結: ${passedTests}/${totalTests} 通過`);
    
    if (passedTests === totalTests) {
        console.log('🎉 所有測試通過！結算系統工作正常');
    } else {
        console.log(`⚠️ 有 ${totalTests - passedTests} 個測試失敗，需要檢查結算邏輯`);
    }
    
    // 額外測試：驗證期號268應該能正確結算
    console.log('\\n🔍 驗證期號268的投注類型...');
    
    const period268Bets = [
        { bet_type: 'fourth', bet_value: 'big', description: '第四名大' },
        { bet_type: 'runnerup', bet_value: 'big', description: '亞軍大' },
        { bet_type: 'champion', bet_value: 'even', description: '冠軍雙' },
        { bet_type: 'sumValue', bet_value: 'small', description: '冠亞和小' },
        { bet_type: 'sumValue', bet_value: 'even', description: '冠亞和雙' },
        { bet_type: 'dragonTiger', bet_value: 'dragon_1_10', description: '龍(冠軍vs第十名)' },
        { bet_type: 'dragonTiger', bet_value: 'tiger_4_7', description: '虎(第四名vs第七名)' }
    ];
    
    period268Bets.forEach(bet => {
        const mockBet = { 
            bet_type: bet.bet_type, 
            bet_value: bet.bet_value, 
            amount: '100', 
            odds: bet.bet_type.includes('dragon') || bet.bet_value === 'big' || bet.bet_value === 'small' || bet.bet_value === 'even' || bet.bet_value === 'odd' ? '1.98' : '9.89'
        };
        const shouldWin = checkWin(mockBet, mockWinResult);
        console.log(`${bet.description}: ${shouldWin ? '✅ 中獎' : '❌ 未中獎'}`);
    });
}

testAllSettlementTypes();