// test-new-betting-limits.js - 測試新的限紅邏輯
import db from './db/config.js';

// 模擬測試新的限紅邏輯
async function testNewBettingLimits() {
    console.log('測試新的限紅邏輯...\n');
    
    // 測試案例
    const testCases = [
        {
            name: '測試1：冠軍1號下注多次',
            username: 'testuser',
            bets: [
                { betType: 'champion', value: '1', amount: 5000, position: null },
                { betType: 'champion', value: '1', amount: 5000, position: null },
                { betType: 'champion', value: '1', amount: 1000, position: null }
            ],
            expectedResults: [
                { valid: true, message: '第一筆應該成功' },
                { valid: false, message: '第二筆應該失敗（超過單期限額10000）' },
                { valid: false, message: '第三筆應該失敗（已達單期限額）' }
            ]
        },
        {
            name: '測試2：不同位置不同號碼',
            username: 'testuser',
            bets: [
                { betType: 'champion', value: '1', amount: 5000, position: null },
                { betType: 'runnerup', value: '2', amount: 5000, position: null },
                { betType: 'third', value: '3', amount: 5000, position: null }
            ],
            expectedResults: [
                { valid: true, message: '冠軍1號應該成功' },
                { valid: true, message: '亞軍2號應該成功' },
                { valid: true, message: '季軍3號應該成功' }
            ]
        },
        {
            name: '測試3：同位置不同號碼',
            username: 'testuser',
            bets: [
                { betType: 'champion', value: '1', amount: 5000, position: null },
                { betType: 'champion', value: '2', amount: 5000, position: null },
                { betType: 'champion', value: '3', amount: 5000, position: null }
            ],
            expectedResults: [
                { valid: true, message: '冠軍1號應該成功' },
                { valid: true, message: '冠軍2號應該成功' },
                { valid: true, message: '冠軍3號應該成功' }
            ]
        },
        {
            name: '測試4：大小單雙各自獨立',
            username: 'testuser',
            bets: [
                { betType: 'champion', value: 'big', amount: 5000, position: null },
                { betType: 'champion', value: 'small', amount: 5000, position: null },
                { betType: 'champion', value: 'odd', amount: 5000, position: null },
                { betType: 'champion', value: 'even', amount: 5000, position: null }
            ],
            expectedResults: [
                { valid: true, message: '冠軍大應該成功' },
                { valid: true, message: '冠軍小應該成功' },
                { valid: true, message: '冠軍單應該成功' },
                { valid: true, message: '冠軍雙應該成功' }
            ]
        },
        {
            name: '測試5：冠亞和值各自獨立',
            username: 'testuser',
            bets: [
                { betType: 'sumValue', value: '10', amount: 2000, position: null },
                { betType: 'sumValue', value: '11', amount: 2000, position: null },
                { betType: 'sumValue', value: 'big', amount: 5000, position: null },
                { betType: 'sumValue', value: 'odd', amount: 5000, position: null }
            ],
            expectedResults: [
                { valid: true, message: '冠亞和10應該成功' },
                { valid: true, message: '冠亞和11應該成功' },
                { valid: true, message: '冠亞和大應該成功' },
                { valid: true, message: '冠亞和單應該成功' }
            ]
        }
    ];
    
    // 導入驗證函數
    const { validateBetLimits } = await import('./backend.js');
    
    // 執行測試
    for (const testCase of testCases) {
        console.log(`\n=== ${testCase.name} ===`);
        const userBets = [];
        
        for (let i = 0; i < testCase.bets.length; i++) {
            const bet = testCase.bets[i];
            const expected = testCase.expectedResults[i];
            
            // 調用驗證函數
            const result = await validateBetLimits(
                bet.betType,
                bet.value,
                bet.amount,
                userBets,
                testCase.username,
                bet.position
            );
            
            // 顯示結果
            console.log(`\n投注 ${i + 1}: ${bet.betType} ${bet.value} $${bet.amount}`);
            console.log(`預期: ${expected.valid ? '✓通過' : '✗拒絕'} - ${expected.message}`);
            console.log(`實際: ${result.valid ? '✓通過' : '✗拒絕'} ${result.message ? `- ${result.message}` : ''}`);
            
            if (result.valid !== expected.valid) {
                console.log(`❌ 測試失敗！結果不符合預期`);
            } else {
                console.log(`✅ 測試通過`);
            }
            
            // 如果投注成功，加入到已投注列表
            if (result.valid) {
                userBets.push({
                    betType: bet.betType,
                    value: bet.value,
                    amount: bet.amount,
                    position: bet.position
                });
            }
        }
    }
    
    console.log('\n\n測試完成！');
}

// 執行測試
testNewBettingLimits().catch(console.error).finally(() => process.exit());