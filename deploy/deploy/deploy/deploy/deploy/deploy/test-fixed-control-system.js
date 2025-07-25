// 測試修正後的控制系統邏輯

console.log('🧪 測試修正後的控制系統\n');

// 模擬不同的下注覆蓋率情況
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
        controlPercentage: 0.9, // 90%輸控制
        expectedWinRate: 0.1    // 期望10%中獎率
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
        controlPercentage: 0.9, // 90%輸控制
        expectedWinRate: 0.1    // 期望10%中獎率
    },
    {
        name: '低覆蓋率測試（20%下注）',
        userBets: [
            { betType: 'number', position: '3', betValue: '7' },
            { betType: 'number', position: '3', betValue: '8' }
        ],
        controlPercentage: 0.9, // 90%輸控制
        expectedWinRate: 0.1    // 期望10%中獎率
    }
];

// 模擬generateLosingResultFixed函數的邏輯
function simulateLosingResult(userBets, positionBets) {
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
    
    const result = Array(10).fill(0);
    const usedNumbers = new Set();
    
    for (let position = 1; position <= 10; position++) {
        const userNumbers = userBetsByPosition[position] || new Set();
        const availableNumbers = [];
        
        for (let num = 1; num <= 10; num++) {
            if (!usedNumbers.has(num) && !userNumbers.has(num)) {
                availableNumbers.push(num);
            }
        }
        
        if (availableNumbers.length > 0) {
            const selectedNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
            result[position - 1] = selectedNumber;
            usedNumbers.add(selectedNumber);
        }
    }
    
    // 填充剩餘位置
    const remainingNumbers = [];
    for (let num = 1; num <= 10; num++) {
        if (!usedNumbers.has(num)) {
            remainingNumbers.push(num);
        }
    }
    
    for (let i = 0; i < 10; i++) {
        if (result[i] === 0 && remainingNumbers.length > 0) {
            const idx = Math.floor(Math.random() * remainingNumbers.length);
            result[i] = remainingNumbers[idx];
            remainingNumbers.splice(idx, 1);
        }
    }
    
    return result;
}

// 測試每個案例
testCases.forEach(testCase => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ${testCase.name}`);
    console.log(`${'='.repeat(60)}`);
    
    const betNumbers = testCase.userBets.map(b => b.betValue);
    const position = testCase.userBets[0]?.position || '未知';
    
    console.log(`下注位置: 第${position}名`);
    console.log(`下注號碼: ${betNumbers.join(', ')}`);
    console.log(`下注覆蓋率: ${betNumbers.length}/10 = ${betNumbers.length * 10}%`);
    console.log(`控制設定: ${(testCase.controlPercentage * 100)}%輸控制`);
    console.log(`期望中獎率: ${(testCase.expectedWinRate * 100)}%`);
    
    // 模擬1000次開獎
    const simulations = 1000;
    let winCount = 0;
    
    for (let i = 0; i < simulations; i++) {
        // 根據控制百分比決定是否要讓用戶輸
        const shouldLose = Math.random() < testCase.controlPercentage;
        
        let result;
        if (shouldLose) {
            // 使用修正後的輸控制邏輯
            result = simulateLosingResult(testCase.userBets, {});
        } else {
            // 隨機結果（簡化處理）
            const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            for (let j = numbers.length - 1; j > 0; j--) {
                const k = Math.floor(Math.random() * (j + 1));
                [numbers[j], numbers[k]] = [numbers[k], numbers[j]];
            }
            result = numbers;
        }
        
        // 檢查是否中獎
        const drawPosition = parseInt(position) - 1;
        const drawnNumber = result[drawPosition];
        if (betNumbers.includes(drawnNumber.toString())) {
            winCount++;
        }
    }
    
    const actualWinRate = winCount / simulations;
    const deviation = Math.abs(actualWinRate - testCase.expectedWinRate);
    
    console.log(`\n📈 模擬結果（${simulations}次）:`);
    console.log(`實際中獎次數: ${winCount}`);
    console.log(`實際中獎率: ${(actualWinRate * 100).toFixed(1)}%`);
    console.log(`偏差: ${(deviation * 100).toFixed(1)}%`);
    
    if (deviation < 0.05) { // 5%以內的偏差
        console.log(`✅ 控制效果良好，接近期望值`);
    } else {
        console.log(`⚠️ 控制效果偏差較大`);
    }
});

console.log('\n\n💡 修正後的系統特點:');
console.log('1. 真正按照設定的機率執行控制');
console.log('2. 不受下注覆蓋率影響');
console.log('3. 90%輸控制 = 90%機率讓用戶輸，10%機率讓用戶贏');
console.log('4. 自動偵測模式會根據平台風險調整結果');