// 測試改進後的控制邏輯

console.log('🧪 測試改進後的控制系統\n');

// 改進的輸控制邏輯
function generateControlledResult(userBets, controlPercentage) {
    // 決定這次是否要讓用戶輸
    const shouldLose = Math.random() < controlPercentage;
    
    // 收集用戶的下注信息
    const userBetsByPosition = {};
    userBets.forEach(bet => {
        if (bet.betType === 'number' && bet.position) {
            const pos = parseInt(bet.position);
            if (!userBetsByPosition[pos]) {
                userBetsByPosition[pos] = new Set();
            }
            userBetsByPosition[pos].add(parseInt(bet.betValue));
        }
    });
    
    // 生成隨機結果
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    for (let i = numbers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    
    // 如果要讓用戶輸，調整結果
    if (shouldLose) {
        // 對於用戶有下注的每個位置
        for (const [position, userNumbers] of Object.entries(userBetsByPosition)) {
            const pos = parseInt(position) - 1;
            const currentNumber = numbers[pos];
            
            // 如果當前號碼是用戶下注的，嘗試換成沒下注的
            if (userNumbers.has(currentNumber)) {
                // 找一個用戶沒下注的號碼
                for (let i = 0; i < 10; i++) {
                    if (!userNumbers.has(numbers[i])) {
                        // 交換位置
                        [numbers[pos], numbers[i]] = [numbers[i], numbers[pos]];
                        break;
                    }
                }
            }
        }
    } else {
        // 如果要讓用戶贏，調整結果
        for (const [position, userNumbers] of Object.entries(userBetsByPosition)) {
            const pos = parseInt(position) - 1;
            const currentNumber = numbers[pos];
            
            // 如果當前號碼不是用戶下注的，嘗試換成下注的
            if (!userNumbers.has(currentNumber)) {
                // 找一個用戶下注的號碼
                for (let i = 0; i < 10; i++) {
                    if (userNumbers.has(numbers[i])) {
                        // 交換位置
                        [numbers[pos], numbers[i]] = [numbers[i], numbers[pos]];
                        break;
                    }
                }
            }
        }
    }
    
    return {
        result: numbers,
        intendedOutcome: shouldLose ? 'lose' : 'win'
    };
}

// 測試案例
const testCases = [
    {
        name: '高覆蓋率測試（90%下注）',
        userBets: [
            { betType: 'number', position: '8', betValue: '2' },
            { betType: 'number', position: '8', betValue: '3' },
            { betType: 'number', position: '8', betValue: '4' },
            { betType: 'number', position: '8', betValue: '5' },
            { betType: 'number', position: '8', betValue: '6' },
            { betType: 'number', position: '8', betValue: '7' },
            { betType: 'number', position: '8', betValue: '8' },
            { betType: 'number', position: '8', betValue: '9' },
            { betType: 'number', position: '8', betValue: '10' }
        ],
        controlPercentage: 0.9,
        position: 8
    },
    {
        name: '中覆蓋率測試（50%下注）',
        userBets: [
            { betType: 'number', position: '5', betValue: '1' },
            { betType: 'number', position: '5', betValue: '2' },
            { betType: 'number', position: '5', betValue: '3' },
            { betType: 'number', position: '5', betValue: '4' },
            { betType: 'number', position: '5', betValue: '5' }
        ],
        controlPercentage: 0.9,
        position: 5
    },
    {
        name: '低覆蓋率測試（20%下注）',
        userBets: [
            { betType: 'number', position: '3', betValue: '7' },
            { betType: 'number', position: '3', betValue: '8' }
        ],
        controlPercentage: 0.9,
        position: 3
    },
    {
        name: '極限測試（100%下注）',
        userBets: Array.from({length: 10}, (_, i) => ({
            betType: 'number',
            position: '1',
            betValue: (i + 1).toString()
        })),
        controlPercentage: 0.9,
        position: 1
    }
];

// 執行測試
testCases.forEach(testCase => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ${testCase.name}`);
    console.log(`${'='.repeat(60)}`);
    
    const betNumbers = testCase.userBets.map(b => b.betValue);
    console.log(`下注位置: 第${testCase.position}名`);
    console.log(`下注號碼: ${betNumbers.join(', ')}`);
    console.log(`下注覆蓋率: ${betNumbers.length}/10 = ${betNumbers.length * 10}%`);
    console.log(`控制設定: ${(testCase.controlPercentage * 100)}%輸控制`);
    
    // 模擬1000次
    const simulations = 1000;
    let winCount = 0;
    let intendedLoseCount = 0;
    let actualLoseWhenIntendedCount = 0;
    
    for (let i = 0; i < simulations; i++) {
        const { result, intendedOutcome } = generateControlledResult(testCase.userBets, testCase.controlPercentage);
        
        // 檢查實際結果
        const drawnNumber = result[testCase.position - 1];
        const isWin = betNumbers.includes(drawnNumber.toString());
        
        if (isWin) winCount++;
        if (intendedOutcome === 'lose') {
            intendedLoseCount++;
            if (!isWin) actualLoseWhenIntendedCount++;
        }
    }
    
    const actualWinRate = winCount / simulations;
    const controlEffectiveness = intendedLoseCount > 0 ? 
        actualLoseWhenIntendedCount / intendedLoseCount : 0;
    
    console.log(`\n📈 模擬結果（${simulations}次）:`);
    console.log(`預期輸的次數: ${intendedLoseCount}`);
    console.log(`實際輸的次數: ${simulations - winCount}`);
    console.log(`實際中獎率: ${(actualWinRate * 100).toFixed(1)}%`);
    console.log(`控制有效性: ${(controlEffectiveness * 100).toFixed(1)}%（當系統想讓用戶輸時的成功率）`);
    
    if (betNumbers.length === 10) {
        console.log(`⚠️ 注意：用戶下注了所有號碼，無法執行輸控制`);
    } else if (betNumbers.length >= 9) {
        console.log(`⚠️ 注意：用戶下注覆蓋率過高，控制效果有限`);
    }
});

console.log('\n\n💡 系統分析:');
console.log('1. 當用戶下注覆蓋率低時，控制系統可以有效運作');
console.log('2. 當用戶下注覆蓋率高（如90%）時，系統很難找到讓用戶輸的號碼');
console.log('3. 當用戶下注100%號碼時，控制系統完全無效');
console.log('\n建議的解決方案:');
console.log('1. 對高覆蓋率下注設置限制（如最多下注5-6個號碼）');
console.log('2. 或者接受高覆蓋率下注時控制效果有限的事實');
console.log('3. 調整賠率來平衡風險（高覆蓋率時降低賠率）');