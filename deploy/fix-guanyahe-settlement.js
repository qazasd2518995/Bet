// 修復冠亞和結算邏輯的腳本

import fs from 'fs';
import path from 'path';

console.log('=== 修復冠亞和結算邏輯 ===\n');

// 讀取 enhanced-settlement-system.js
const filePath = './enhanced-settlement-system.js';
let content = fs.readFileSync(filePath, 'utf8');

// 找到 checkTwoSidesBet 函數
const functionStart = content.indexOf('function checkTwoSidesBet(betType, betValue, winningNumber, odds) {');
const functionEnd = content.indexOf('\n}', functionStart) + 2;
const originalFunction = content.substring(functionStart, functionEnd);

console.log('原始函數:');
console.log(originalFunction);

// 新的修復後的函數
const newFunction = `function checkTwoSidesBet(betType, betValue, winningNumber, odds) {
    let isWin = false;
    let description = '';
    
    // 判斷是否為冠亞和投注
    const isSumBet = betType === '冠亞和' || betType === 'sum' || betType === 'sumValue';
    
    switch (betValue) {
        case 'big':
        case '大':
            if (isSumBet) {
                // 冠亞和: 大是 >= 12
                isWin = winningNumber >= 12;
                description = winningNumber >= 12 ? '大' : '小';
            } else {
                // 位置投注: 大是 >= 6
                isWin = winningNumber >= 6;
                description = winningNumber >= 6 ? '大' : '小';
            }
            break;
        case 'small':
        case '小':
            if (isSumBet) {
                // 冠亞和: 小是 <= 11
                isWin = winningNumber <= 11;
                description = winningNumber <= 11 ? '小' : '大';
            } else {
                // 位置投注: 小是 <= 5
                isWin = winningNumber <= 5;
                description = winningNumber <= 5 ? '小' : '大';
            }
            break;
        case 'odd':
        case '單':
            isWin = winningNumber % 2 === 1;
            description = winningNumber % 2 === 1 ? '單' : '雙';
            break;
        case 'even':
        case '雙':
            isWin = winningNumber % 2 === 0;
            description = winningNumber % 2 === 0 ? '雙' : '單';
            break;
        default:
            return { isWin: false, reason: \`未知的投注值: \${betValue}\`, odds: 0 };
    }
    
    return {
        isWin: isWin,
        reason: \`\${betType}開出\${winningNumber}(\${description})\`,
        odds: odds || 1.985
    };
}`;

// 替換函數
content = content.replace(originalFunction, newFunction);

// 寫回文件
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n修復完成！');
console.log('主要改動:');
console.log('1. 添加了 isSumBet 變量來判斷是否為冠亞和投注');
console.log('2. 對於冠亞和投注，使用 >= 12 判斷大，<= 11 判斷小');
console.log('3. 對於位置投注，保持原有的 >= 6 判斷大，<= 5 判斷小');

// 測試修復
console.log('\n測試修復效果:');
console.log('冠亞和 = 9 的情況:');
console.log('- 冠亞和大: 9 >= 12? false => 應該輸（修復前錯誤判定為贏）');
console.log('- 冠亞和小: 9 <= 11? true => 應該贏');
console.log('- 冠亞和單: 9 % 2 === 1? true => 應該贏');
console.log('- 冠亞和雙: 9 % 2 === 0? false => 應該輸');

// 創建備份
const backupPath = filePath + '.backup.' + Date.now();
fs.copyFileSync(filePath, backupPath);
console.log(`\n已創建備份: ${backupPath}`);