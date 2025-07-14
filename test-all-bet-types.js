// test-all-bet-types.js - 全面測試所有投注類型
import db from './db/config.js';

// 檢查是否中獎
function checkWin(bet, winResult) {
    if (!winResult || !winResult.positions) return false;
    
    switch (bet.bet_type) {
        case 'number':
            // 號碼投注：檢查對應位置的號碼
            return winResult.positions[bet.position - 1] === parseInt(bet.bet_value);
            
        case 'champion':
            // 冠軍投注：檢查第一個位置（冠軍）的號碼
            return winResult.positions[0] === parseInt(bet.bet_value);
            
        case 'runnerup':
            // 亞軍投注：檢查第二個位置的號碼
            return winResult.positions[1] === parseInt(bet.bet_value);
            
        case 'third':
            // 季軍投注：檢查第三個位置的號碼
            return winResult.positions[2] === parseInt(bet.bet_value);
            
        case 'fourth':
            return winResult.positions[3] === parseInt(bet.bet_value);
            
        case 'fifth':
            return winResult.positions[4] === parseInt(bet.bet_value);
            
        case 'sixth':
            return winResult.positions[5] === parseInt(bet.bet_value);
            
        case 'seventh':
            return winResult.positions[6] === parseInt(bet.bet_value);
            
        case 'eighth':
            return winResult.positions[7] === parseInt(bet.bet_value);
            
        case 'ninth':
            return winResult.positions[8] === parseInt(bet.bet_value);
            
        case 'tenth':
            return winResult.positions[9] === parseInt(bet.bet_value);
            
        case 'position':
            // 位置大小單雙投注
            const posNum = winResult.positions[bet.position - 1];
            if (bet.bet_value === 'big') return posNum > 5;
            if (bet.bet_value === 'small') return posNum <= 5;
            if (bet.bet_value === 'odd') return posNum % 2 === 1;
            if (bet.bet_value === 'even') return posNum % 2 === 0;
            return false;
            
        case 'big_small':
            // 大小投注：冠亞和值
            const sum = winResult.positions[0] + winResult.positions[1];
            return (bet.bet_value === 'big' && sum > 11) || 
                   (bet.bet_value === 'small' && sum <= 11);
                   
        case 'odd_even':
            // 單雙投注：冠亞和值
            const sumOddEven = winResult.positions[0] + winResult.positions[1];
            return (bet.bet_value === 'odd' && sumOddEven % 2 === 1) ||
                   (bet.bet_value === 'even' && sumOddEven % 2 === 0);
                   
        case 'dragon_tiger':
        case 'dragonTiger':
            // 龍虎投注
            const positions = bet.bet_value.split('_');
            const pos1 = parseInt(positions[0]) - 1;
            const pos2 = parseInt(positions[1]) - 1;
            return winResult.positions[pos1] > winResult.positions[pos2];
            
        case 'sum':
        case 'sumValue':
            // 冠亞和值投注
            if (bet.bet_value === 'big' || bet.bet_value === 'small' || 
                bet.bet_value === 'odd' || bet.bet_value === 'even') {
                const sumValue = winResult.positions[0] + winResult.positions[1];
                if (bet.bet_value === 'big') return sumValue > 11;
                if (bet.bet_value === 'small') return sumValue <= 11;
                if (bet.bet_value === 'odd') return sumValue % 2 === 1;
                if (bet.bet_value === 'even') return sumValue % 2 === 0;
            } else {
                const actualSum = winResult.positions[0] + winResult.positions[1];
                return actualSum === parseInt(bet.bet_value);
            }
            return false;
            
        default:
            return false;
    }
}

// 計算中獎金額
function calculateWinAmount(bet, winResult) {
    const betAmount = parseFloat(bet.amount);
    let odds = parseFloat(bet.odds); // 優先使用下注時記錄的賠率
    
    // 返回總獎金（含本金）
    return parseFloat((betAmount * odds).toFixed(2));
}

// 測試數據 - 模擬開獎結果
const testResult = {
    positions: [2, 4, 7, 5, 3, 9, 10, 1, 8, 6]  // 名次對應的號碼
};

// 所有投注類型的測試案例
const testCases = [
    // 1. 號碼投注 (單號1~5, 單號6~10)
    { bet_type: 'number', position: 1, bet_value: '2', odds: 9.89, amount: 100, shouldWin: true, desc: '第1名號碼2' },
    { bet_type: 'number', position: 3, bet_value: '7', odds: 9.89, amount: 100, shouldWin: true, desc: '第3名號碼7' },
    { bet_type: 'number', position: 5, bet_value: '3', odds: 9.89, amount: 100, shouldWin: true, desc: '第5名號碼3' },
    { bet_type: 'number', position: 7, bet_value: '10', odds: 9.89, amount: 100, shouldWin: true, desc: '第7名號碼10' },
    { bet_type: 'number', position: 1, bet_value: '5', odds: 9.89, amount: 100, shouldWin: false, desc: '第1名號碼5(輸)' },
    
    // 2. 兩面投注 - 大小單雙 (各名次)
    { bet_type: 'position', position: 1, bet_value: 'small', odds: 1.98, amount: 100, shouldWin: true, desc: '冠軍小(2<=5)' },
    { bet_type: 'position', position: 1, bet_value: 'even', odds: 1.98, amount: 100, shouldWin: true, desc: '冠軍雙(2是偶數)' },
    { bet_type: 'position', position: 3, bet_value: 'big', odds: 1.98, amount: 100, shouldWin: true, desc: '第3名大(7>5)' },
    { bet_type: 'position', position: 3, bet_value: 'odd', odds: 1.98, amount: 100, shouldWin: true, desc: '第3名單(7是奇數)' },
    { bet_type: 'position', position: 5, bet_value: 'small', odds: 1.98, amount: 100, shouldWin: true, desc: '第5名小(3<=5)' },
    
    // 3. 特殊位置投注 (champion, runnerup, third等)
    { bet_type: 'champion', bet_value: '2', odds: 9.89, amount: 100, shouldWin: true, desc: '冠軍號碼2' },
    { bet_type: 'runnerup', bet_value: '4', odds: 9.89, amount: 100, shouldWin: true, desc: '亞軍號碼4' },
    { bet_type: 'third', bet_value: '7', odds: 9.89, amount: 100, shouldWin: true, desc: '季軍號碼7' },
    { bet_type: 'fourth', bet_value: '5', odds: 9.89, amount: 100, shouldWin: true, desc: '第4名號碼5' },
    { bet_type: 'champion', bet_value: 'big', odds: 1.98, amount: 100, shouldWin: false, desc: '冠軍大(2<=5為小)' },
    { bet_type: 'runnerup', bet_value: 'odd', odds: 1.98, amount: 100, shouldWin: false, desc: '亞軍單(4是偶數)' },
    
    // 4. 龍虎投注
    { bet_type: 'dragonTiger', bet_value: '1_10', odds: 1.98, amount: 100, shouldWin: false, desc: '冠軍vs第10名(2<6虎贏)' },
    { bet_type: 'dragonTiger', bet_value: '2_9', odds: 1.98, amount: 100, shouldWin: false, desc: '亞軍vs第9名(4<8虎贏)' },
    { bet_type: 'dragonTiger', bet_value: '3_8', odds: 1.98, amount: 100, shouldWin: true, desc: '第3名vs第8名(7>1龍贏)' },
    { bet_type: 'dragonTiger', bet_value: '4_7', odds: 1.98, amount: 100, shouldWin: false, desc: '第4名vs第7名(5<10虎贏)' },
    { bet_type: 'dragonTiger', bet_value: '5_6', odds: 1.98, amount: 100, shouldWin: false, desc: '第5名vs第6名(3<9虎贏)' },
    
    // 5. 冠亞和值
    { bet_type: 'sumValue', bet_value: '6', odds: 11.37, amount: 100, shouldWin: true, desc: '冠亞和值6(2+4=6)' },
    { bet_type: 'sumValue', bet_value: '7', odds: 8.90, amount: 100, shouldWin: false, desc: '冠亞和值7(2+4=6)' },
    { bet_type: 'sumValue', bet_value: '3', odds: 44.51, amount: 100, shouldWin: false, desc: '冠亞和值3(最小值)' },
    { bet_type: 'sumValue', bet_value: '19', odds: 89.01, amount: 100, shouldWin: false, desc: '冠亞和值19(最大值)' },
    
    // 6. 冠亞和大小單雙
    { bet_type: 'sumValue', bet_value: 'small', odds: 1.98, amount: 100, shouldWin: true, desc: '冠亞和小(6<=11)' },
    { bet_type: 'sumValue', bet_value: 'even', odds: 1.98, amount: 100, shouldWin: true, desc: '冠亞和雙(6是偶數)' },
    { bet_type: 'sumValue', bet_value: 'big', odds: 1.98, amount: 100, shouldWin: false, desc: '冠亞和大(6<=11為小)' },
    { bet_type: 'sumValue', bet_value: 'odd', odds: 1.98, amount: 100, shouldWin: false, desc: '冠亞和單(6是偶數)' }
];

async function testAllBetTypes() {
    console.log('🧪 開始測試所有投注類型...\n');
    console.log(`測試開獎結果: ${testResult.positions.join(',')}`);
    console.log('各名次號碼:');
    testResult.positions.forEach((num, idx) => {
        console.log(`  第${idx + 1}名: ${num}號`);
    });
    console.log(`冠亞和: ${testResult.positions[0] + testResult.positions[1]}\n`);
    
    let passCount = 0;
    let failCount = 0;
    const failedTests = [];
    
    console.log('開始測試各投注類型:\n');
    
    for (const testCase of testCases) {
        const isWin = checkWin(testCase, testResult);
        const winAmount = isWin ? calculateWinAmount(testCase, testResult) : 0;
        const expectedWinAmount = testCase.shouldWin ? (testCase.amount * testCase.odds).toFixed(2) : 0;
        
        const testPassed = isWin === testCase.shouldWin && 
                          (!testCase.shouldWin || Math.abs(winAmount - expectedWinAmount) < 0.01);
        
        if (testPassed) {
            console.log(`✅ ${testCase.desc}`);
            console.log(`   投注類型: ${testCase.bet_type}, 投注值: ${testCase.bet_value}`);
            if (testCase.position) console.log(`   位置: 第${testCase.position}名`);
            console.log(`   賠率: ${testCase.odds}, 投注金額: ${testCase.amount}`);
            console.log(`   預期結果: ${testCase.shouldWin ? '中獎' : '未中獎'}`);
            console.log(`   實際結果: ${isWin ? '中獎' : '未中獎'}`);
            if (isWin) console.log(`   中獎金額: ${winAmount} (含本金)`);
            console.log('');
            passCount++;
        } else {
            console.log(`❌ ${testCase.desc}`);
            console.log(`   投注類型: ${testCase.bet_type}, 投注值: ${testCase.bet_value}`);
            if (testCase.position) console.log(`   位置: 第${testCase.position}名`);
            console.log(`   賠率: ${testCase.odds}, 投注金額: ${testCase.amount}`);
            console.log(`   預期結果: ${testCase.shouldWin ? '中獎' : '未中獎'}`);
            console.log(`   實際結果: ${isWin ? '中獎' : '未中獎'} ⚠️`);
            if (testCase.shouldWin && !isWin) {
                console.log(`   ⚠️ 應該中獎但判定為未中獎`);
            } else if (!testCase.shouldWin && isWin) {
                console.log(`   ⚠️ 不應該中獎但判定為中獎`);
            }
            if (isWin && Math.abs(winAmount - expectedWinAmount) >= 0.01) {
                console.log(`   ⚠️ 中獎金額錯誤: 期望 ${expectedWinAmount}, 實際 ${winAmount}`);
            }
            console.log('');
            failCount++;
            failedTests.push(testCase);
        }
    }
    
    // 測試總結
    console.log('\n' + '='.repeat(50));
    console.log('📊 測試總結:');
    console.log(`總測試數: ${testCases.length}`);
    console.log(`✅ 通過: ${passCount}`);
    console.log(`❌ 失敗: ${failCount}`);
    console.log(`成功率: ${((passCount / testCases.length) * 100).toFixed(2)}%`);
    
    if (failedTests.length > 0) {
        console.log('\n失敗的測試:');
        failedTests.forEach(test => {
            console.log(`- ${test.desc} (${test.bet_type}: ${test.bet_value})`);
        });
    }
    
    // 測試特殊情況
    console.log('\n' + '='.repeat(50));
    console.log('🔧 測試特殊情況:\n');
    
    // 測試賠率計算
    console.log('1. 賠率計算測試:');
    const oddsTests = [
        { amount: 100, odds: 9.89, expected: 989 },
        { amount: 200, odds: 1.98, expected: 396 },
        { amount: 150, odds: 44.51, expected: 6676.5 },
        { amount: 50, odds: 89.01, expected: 4450.5 }
    ];
    
    oddsTests.forEach(test => {
        const result = (test.amount * test.odds).toFixed(2);
        const passed = Math.abs(parseFloat(result) - test.expected) < 0.01;
        console.log(`  ${test.amount} × ${test.odds} = ${result} ${passed ? '✅' : '❌'} (期望: ${test.expected})`);
    });
    
    console.log('\n測試完成！');
}

// 執行測試
testAllBetTypes().catch(console.error).finally(() => {
    db.$pool.end();
});