// 測試退水精度問題
console.log('=== 測試 1.09% 退水精度 ===\n');

// 模擬儲存和讀取流程
const userInput = 1.09;
console.log(`1. 用戶輸入: ${userInput}%`);

// 轉換為小數（模擬前端發送）
const sentValue = userInput / 100;
console.log(`2. 發送到後端: ${sentValue}`);
console.log(`   精確值: ${sentValue.toFixed(20)}`);

// 使用 toFixed(10) 處理
const processedValue = parseFloat(sentValue.toFixed(10));
console.log(`3. 處理後: ${processedValue}`);

// 從資料庫讀取（假設儲存為 0.0109）
const dbValue = 0.0109;
console.log(`\n4. 資料庫儲存: ${dbValue}`);

// 轉換回百分比顯示
const displayValue = dbValue * 100;
console.log(`5. 顯示值: ${displayValue}%`);
console.log(`   精確值: ${displayValue.toFixed(20)}`);

// 使用 toFixed(10) 處理顯示
const finalDisplay = parseFloat((dbValue * 100).toFixed(10));
console.log(`6. 處理後顯示: ${finalDisplay}%`);

// 測試各種值
console.log('\n測試其他值:');
const testValues = [1.09, 1.1, 1.11, 0.89, 0.9];
testValues.forEach(val => {
    const decimal = val / 100;
    const backToPercent = decimal * 100;
    const processed = parseFloat(backToPercent.toFixed(10));
    console.log(`${val}% -> ${decimal} -> ${backToPercent}% -> ${processed}%`);
});