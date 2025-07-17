// test-settlement-logic-debug.js - 調試結算邏輯
import { checkWin, calculateWinAmount } from './improved-settlement-system.js';

async function testSettlementLogicDebug() {
    console.log('🔧 調試結算邏輯...\n');
    
    // 使用期號291的實際開獎結果
    const mockWinResult = {
        positions: [10, 6, 3, 5, 7, 8, 1, 4, 2, 9]
    };
    
    console.log('模擬開獎結果:', mockWinResult.positions);
    console.log('冠軍:10(大,雙) 亞軍:6(大,雙) 第三名:3(小,單) 第四名:5(小,單)');
    console.log('第五名:7(大,單) 第六名:8(大,雙) 第七名:1(小,單) 第八名:4(小,雙)');
    console.log('第九名:2(小,雙) 第十名:9(大,單)\n');
    
    // 測試一些應該中獎的投注
    const testCases = [
        // 冠軍投注
        { bet_type: 'champion', bet_value: 'big', amount: '100', odds: '1.98', expected: true, description: '冠軍大(10號)' },
        { bet_type: 'champion', bet_value: 'even', amount: '100', odds: '1.98', expected: true, description: '冠軍雙(10號)' },
        { bet_type: 'champion', bet_value: 'small', amount: '100', odds: '1.98', expected: false, description: '冠軍小(10號)' },
        { bet_type: 'champion', bet_value: 'odd', amount: '100', odds: '1.98', expected: false, description: '冠軍單(10號)' },
        
        // 第九名投注
        { bet_type: 'ninth', bet_value: 'small', amount: '100', odds: '1.98', expected: true, description: '第九名小(2號)' },
        { bet_type: 'ninth', bet_value: 'even', amount: '100', odds: '1.98', expected: true, description: '第九名雙(2號)' },
        { bet_type: 'ninth', bet_value: 'big', amount: '100', odds: '1.98', expected: false, description: '第九名大(2號)' },
        { bet_type: 'ninth', bet_value: 'odd', amount: '100', odds: '1.98', expected: false, description: '第九名單(2號)' },
        
        // 第十名投注
        { bet_type: 'tenth', bet_value: 'big', amount: '100', odds: '1.98', expected: true, description: '第十名大(9號)' },
        { bet_type: 'tenth', bet_value: 'odd', amount: '100', odds: '1.98', expected: true, description: '第十名單(9號)' },
        { bet_type: 'tenth', bet_value: 'small', amount: '100', odds: '1.98', expected: false, description: '第十名小(9號)' },
        { bet_type: 'tenth', bet_value: 'even', amount: '100', odds: '1.98', expected: false, description: '第十名雙(9號)' }
    ];
    
    console.log('開始測試結算邏輯...\n');
    
    let passedTests = 0;
    let totalTests = testCases.length;
    
    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const mockBet = {
            bet_type: testCase.bet_type,
            bet_value: testCase.bet_value,
            amount: testCase.amount,
            odds: testCase.odds
        };
        
        console.log(`測試 ${i + 1}: ${testCase.description}`);
        
        try {
            const actualWin = checkWin(mockBet, mockWinResult);
            const winAmount = actualWin ? calculateWinAmount(mockBet, mockWinResult) : 0;
            const expectedWinAmount = testCase.expected ? (100 * 1.98) : 0;
            
            const testPassed = actualWin === testCase.expected && 
                               (Math.abs(winAmount - expectedWinAmount) < 0.01);
            
            if (testPassed) {
                passedTests++;
            }
            
            console.log(`  預期: ${testCase.expected ? '中獎' : '未中獎'} ${testCase.expected ? `$${expectedWinAmount}` : ''}`);
            console.log(`  實際: ${actualWin ? '中獎' : '未中獎'} ${actualWin ? `$${winAmount}` : ''}`);
            console.log(`  結果: ${testPassed ? '✅ 通過' : '❌ 失敗'}`);
            
            // 如果失敗，提供詳細信息
            if (!testPassed) {
                console.log(`  💡 調試信息:`);
                console.log(`    bet_type: ${mockBet.bet_type}`);
                console.log(`    bet_value: ${mockBet.bet_value}`);
                console.log(`    checkWin返回: ${actualWin}`);
                console.log(`    預期結果: ${testCase.expected}`);
            }
            
        } catch (error) {
            console.log(`  ❌ 測試錯誤: ${error.message}`);
            console.log(`  調試: checkWin函數可能有問題`);
        }
        
        console.log('');
    }
    
    console.log(`測試總結: ${passedTests}/${totalTests} 通過`);
    
    if (passedTests === totalTests) {
        console.log('🎉 結算邏輯測試全部通過！');
        console.log('問題可能在於後端沒有使用修復的結算系統。');
    } else {
        console.log(`⚠️ 有 ${totalTests - passedTests} 個測試失敗`);
        console.log('結算邏輯本身有問題，需要進一步調試。');
    }
}

testSettlementLogicDebug();