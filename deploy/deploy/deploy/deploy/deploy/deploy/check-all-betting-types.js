// check-all-betting-types.js - 全面檢查所有投注類型的結算邏輯
import db from './db/config.js';
import { checkBetWinEnhanced } from './enhanced-settlement-system.js';

async function checkAllBettingTypes() {
    console.log('========== 全面檢查所有投注類型結算邏輯 ==========\n');
    
    // 模擬開獎結果
    const testResult = {
        positions: [7, 3, 9, 2, 4, 8, 1, 10, 5, 6] // 測試開獎號碼
    };
    
    console.log('測試開獎結果：');
    for (let i = 0; i < testResult.positions.length; i++) {
        console.log(`  第${i + 1}名: ${testResult.positions[i]}號`);
    }
    console.log(`  冠亞和: ${testResult.positions[0] + testResult.positions[1]} (7+3=10)`);
    console.log('');
    
    // 1. 兩面投注測試
    console.log('1. 兩面投注測試：');
    console.log('=================');
    const twoSideTests = [
        // 冠軍測試
        { bet_type: 'champion', bet_value: 'big', expected: true, reason: '冠軍7號 >= 6，應該是大' },
        { bet_type: 'champion', bet_value: 'small', expected: false, reason: '冠軍7號 >= 6，不是小' },
        { bet_type: 'champion', bet_value: 'odd', expected: true, reason: '冠軍7號是奇數' },
        { bet_type: 'champion', bet_value: 'even', expected: false, reason: '冠軍7號不是偶數' },
        // 亞軍測試
        { bet_type: 'runnerup', bet_value: 'small', expected: true, reason: '亞軍3號 <= 5，應該是小' },
        { bet_type: 'runnerup', bet_value: 'odd', expected: true, reason: '亞軍3號是奇數' },
        // 第三名測試
        { bet_type: 'third', bet_value: 'big', expected: true, reason: '第三名9號 >= 6，應該是大' },
        { bet_type: 'third', bet_value: 'odd', expected: true, reason: '第三名9號是奇數' },
        // 中文測試
        { bet_type: '冠軍', bet_value: '大', expected: true, reason: '冠軍7號 >= 6，應該是大' },
        { bet_type: '亞軍', bet_value: '小', expected: true, reason: '亞軍3號 <= 5，應該是小' },
        { bet_type: '第十名', bet_value: '雙', expected: true, reason: '第十名6號是偶數' }
    ];
    
    for (const test of twoSideTests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} ${test.bet_value}: ${result.isWin ? '中獎' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   錯誤：系統判斷為 ${result.reason}`);
        }
    }
    
    // 2. 快速投注測試（通常是指快捷下注，如一鍵下注多個選項）
    console.log('\n2. 快速投注測試（號碼投注）：');
    console.log('============================');
    const quickTests = [
        { bet_type: 'number', bet_value: '7', position: 1, expected: true, reason: '第1名是7號' },
        { bet_type: 'number', bet_value: '3', position: 2, expected: true, reason: '第2名是3號' },
        { bet_type: 'number', bet_value: '5', position: 1, expected: false, reason: '第1名不是5號' },
        { bet_type: 'number', bet_value: '10', position: 8, expected: true, reason: '第8名是10號' }
    ];
    
    for (const test of quickTests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} 第${test.position}名 號碼${test.bet_value}: ${result.isWin ? '中獎' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   錯誤：系統判斷為 ${result.reason}`);
        }
    }
    
    // 3. 單號1-5投注測試
    console.log('\n3. 單號1-5投注測試：');
    console.log('===================');
    const single15Tests = [
        { bet_type: 'champion', bet_value: '1', expected: false, reason: '冠軍不是1號' },
        { bet_type: 'champion', bet_value: '2', expected: false, reason: '冠軍不是2號' },
        { bet_type: 'champion', bet_value: '3', expected: false, reason: '冠軍不是3號' },
        { bet_type: 'champion', bet_value: '4', expected: false, reason: '冠軍不是4號' },
        { bet_type: 'champion', bet_value: '5', expected: false, reason: '冠軍不是5號' },
        { bet_type: 'runnerup', bet_value: '3', expected: true, reason: '亞軍是3號' },
        { bet_type: 'fifth', bet_value: '4', expected: true, reason: '第五名是4號' },
        { bet_type: 'seventh', bet_value: '1', expected: true, reason: '第七名是1號' },
        { bet_type: 'ninth', bet_value: '5', expected: true, reason: '第九名是5號' }
    ];
    
    for (const test of single15Tests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} 號碼${test.bet_value}: ${result.isWin ? '中獎' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   錯誤：系統判斷為 ${result.reason}`);
        }
    }
    
    // 4. 單號6-10投注測試
    console.log('\n4. 單號6-10投注測試：');
    console.log('====================');
    const single610Tests = [
        { bet_type: 'champion', bet_value: '6', expected: false, reason: '冠軍不是6號' },
        { bet_type: 'champion', bet_value: '7', expected: true, reason: '冠軍是7號' },
        { bet_type: 'champion', bet_value: '8', expected: false, reason: '冠軍不是8號' },
        { bet_type: 'champion', bet_value: '9', expected: false, reason: '冠軍不是9號' },
        { bet_type: 'champion', bet_value: '10', expected: false, reason: '冠軍不是10號' },
        { bet_type: 'third', bet_value: '9', expected: true, reason: '第三名是9號' },
        { bet_type: 'sixth', bet_value: '8', expected: true, reason: '第六名是8號' },
        { bet_type: 'eighth', bet_value: '10', expected: true, reason: '第八名是10號' },
        { bet_type: 'tenth', bet_value: '6', expected: true, reason: '第十名是6號' }
    ];
    
    for (const test of single610Tests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} 號碼${test.bet_value}: ${result.isWin ? '中獎' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   錯誤：系統判斷為 ${result.reason}`);
        }
    }
    
    // 5. 龍虎對戰測試
    console.log('\n5. 龍虎對戰測試：');
    console.log('================');
    const dragonTigerTests = [
        { bet_type: 'dragonTiger', bet_value: '1_10_dragon', expected: true, reason: '第1名(7) > 第10名(6)，龍贏' },
        { bet_type: 'dragonTiger', bet_value: '1_10_tiger', expected: false, reason: '第1名(7) > 第10名(6)，虎輸' },
        { bet_type: 'dragonTiger', bet_value: '2_9_dragon', expected: false, reason: '第2名(3) < 第9名(5)，龍輸' },
        { bet_type: 'dragonTiger', bet_value: '2_9_tiger', expected: true, reason: '第2名(3) < 第9名(5)，虎贏' },
        { bet_type: 'dragonTiger', bet_value: '3_8_dragon', expected: false, reason: '第3名(9) < 第8名(10)，龍輸' },
        { bet_type: 'dragonTiger', bet_value: '3_8_tiger', expected: true, reason: '第3名(9) < 第8名(10)，虎贏' },
        { bet_type: 'dragonTiger', bet_value: '4_7_dragon', expected: true, reason: '第4名(2) > 第7名(1)，龍贏' },
        { bet_type: 'dragonTiger', bet_value: '5_6_dragon', expected: false, reason: '第5名(4) < 第6名(8)，龍輸' },
        // 測試其他格式
        { bet_type: 'dragonTiger', bet_value: 'dragon_1_10', expected: true, reason: '第1名(7) > 第10名(6)，龍贏' },
        { bet_type: '龍虎', bet_value: '1_10_龍', expected: true, reason: '第1名(7) > 第10名(6)，龍贏' }
    ];
    
    for (const test of dragonTigerTests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} ${test.bet_value}: ${result.isWin ? '中獎' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   錯誤：系統判斷為 ${result.reason}`);
        }
    }
    
    // 6. 冠亞和值測試
    console.log('\n6. 冠亞和值測試：');
    console.log('================');
    const sumValueTests = [
        { bet_type: 'sumValue', bet_value: '10', expected: true, reason: '冠亞和為10 (7+3)' },
        { bet_type: 'sumValue', bet_value: '9', expected: false, reason: '冠亞和不是9' },
        { bet_type: 'sumValue', bet_value: '11', expected: false, reason: '冠亞和不是11' },
        { bet_type: 'sum', bet_value: '10', expected: true, reason: '冠亞和為10' },
        { bet_type: '冠亞和', bet_value: '10', expected: true, reason: '冠亞和為10' },
        // 測試所有可能的和值
        { bet_type: 'sumValue', bet_value: '3', expected: false, reason: '冠亞和不是3' },
        { bet_type: 'sumValue', bet_value: '19', expected: false, reason: '冠亞和不是19' }
    ];
    
    for (const test of sumValueTests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} 和值${test.bet_value}: ${result.isWin ? '中獎' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   錯誤：系統判斷為 ${result.reason}`);
        }
    }
    
    // 7. 冠亞和大小單雙測試
    console.log('\n7. 冠亞和大小單雙測試：');
    console.log('======================');
    const sumSizeTests = [
        { bet_type: 'sumValue', bet_value: 'big', expected: false, reason: '冠亞和10 < 12，不是大' },
        { bet_type: 'sumValue', bet_value: 'small', expected: true, reason: '冠亞和10 <= 11，是小' },
        { bet_type: 'sumValue', bet_value: 'odd', expected: false, reason: '冠亞和10是偶數' },
        { bet_type: 'sumValue', bet_value: 'even', expected: true, reason: '冠亞和10是偶數' },
        { bet_type: 'sum', bet_value: '大', expected: false, reason: '冠亞和10 < 12，不是大' },
        { bet_type: 'sum', bet_value: '小', expected: true, reason: '冠亞和10 <= 11，是小' },
        { bet_type: '冠亞和', bet_value: '單', expected: false, reason: '冠亞和10是偶數' },
        { bet_type: '冠亞和', bet_value: '雙', expected: true, reason: '冠亞和10是偶數' }
    ];
    
    for (const test of sumSizeTests) {
        const result = await checkBetWinEnhanced(test, testResult);
        const status = result.isWin === test.expected ? '✅' : '❌';
        console.log(`${status} ${test.bet_type} ${test.bet_value}: ${result.isWin ? '中獎' : '未中'} - ${test.reason}`);
        if (result.isWin !== test.expected) {
            console.log(`   錯誤：系統判斷為 ${result.reason}`);
        }
    }
    
    // 8. 檢查 quickCheckWin 函數
    console.log('\n8. 檢查 quickCheckWin 函數：');
    console.log('===========================');
    
    // 動態導入 optimized-betting-system.js 中的 quickCheckWin
    const optimizedModule = await import('./optimized-betting-system.js');
    const quickCheckWin = optimizedModule.default.quickCheckWin || 
        (await import('./optimized-betting-system.js').then(m => {
            // 如果默認導出沒有 quickCheckWin，嘗試從文件中提取
            return null;
        }));
    
    if (!quickCheckWin) {
        console.log('⚠️ 無法直接訪問 quickCheckWin 函數，需要檢查 optimized-betting-system.js');
    }
    
    // 統計結果
    console.log('\n========== 測試統計 ==========');
    const totalTests = twoSideTests.length + quickTests.length + single15Tests.length + 
                      single610Tests.length + dragonTigerTests.length + sumValueTests.length + 
                      sumSizeTests.length;
    console.log(`總測試數量: ${totalTests}`);
    console.log('所有測試類型都已覆蓋！');
    
    process.exit();
}

checkAllBettingTypes();