// 測試輸入轉換問題
console.log('=== 測試退水輸入轉換 ===\n');

// 模擬用戶輸入 0.12
const userInput = "0.12";
console.log(`用戶輸入: ${userInput}%`);

// 前端轉換邏輯
const percentage = parseFloat(userInput) / 100;
console.log(`轉換後 (除以100): ${percentage}`);
console.log(`精確值: ${percentage}`);

// 使用 toFixed(6)
const fixed6 = parseFloat(percentage.toFixed(6));
console.log(`toFixed(6) 後: ${fixed6}`);

// 顯示百分比
console.log(`\n顯示百分比:`);
console.log(`${percentage * 100}% (原始)`);
console.log(`${fixed6 * 100}% (toFixed 後)`);

// 檢查 0.16 的來源
console.log(`\n檢查 0.16 的可能來源:`);
const test016 = 0.0016;
console.log(`0.0016 * 100 = ${test016 * 100}%`);

// 測試各種可能的值
console.log(`\n測試各種輸入值:`);
const testInputs = ["0.12", "0.16", "1.2", "1.6"];
testInputs.forEach(input => {
    const converted = parseFloat(input) / 100;
    console.log(`輸入 ${input}% -> ${converted} -> 顯示 ${converted * 100}%`);
});