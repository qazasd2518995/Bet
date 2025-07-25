// 測試退水顯示問題
const testValues = [
    { actual: 0.0012, percent: 0.12 },
    { actual: 0.001, percent: 0.1 },
    { actual: 0.01, percent: 1.0 },
    { actual: 0.012, percent: 1.2 }
];

console.log('測試 toFixed(1) 顯示問題：\n');

testValues.forEach(({ actual, percent }) => {
    const displayPercent = (actual * 100).toFixed(1);
    console.log(`實際值: ${actual} (${percent}%)`);
    console.log(`toFixed(1) 顯示: ${displayPercent}%`);
    console.log(`正確顯示應該是: ${actual * 100}%`);
    console.log('---');
});

// 模擬級聯更新的日誌
console.log('\n模擬級聯更新日誌：');
const currentMaxRebate = 0.01;  // 1.0%
const newMaxRebate = 0.0012;    // 0.12%

console.log(`最大退水更新: ${(currentMaxRebate * 100).toFixed(1)}% -> ${(newMaxRebate * 100).toFixed(1)}%`);
console.log('這會顯示為: 最大退水更新: 1.0% -> 0.1%');
console.log('但實際上是: 最大退水更新: 1.0% -> 0.12%');