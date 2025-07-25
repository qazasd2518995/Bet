// 測試 JavaScript 浮點數精度問題
console.log('=== JavaScript 浮點數精度測試 ===\n');

const testValues = [
    0.011,   // 1.1%
    0.001,   // 0.1%
    0.0012,  // 0.12%
    0.0016,  // 0.16%
    0.041    // 4.1%
];

console.log('原始計算結果：');
testValues.forEach(val => {
    console.log(`${val} * 100 = ${val * 100}`);
});

console.log('\n使用 Number.parseFloat 和 toPrecision：');
testValues.forEach(val => {
    const percent = val * 100;
    const precision = Number.parseFloat(percent.toPrecision(12));
    console.log(`${val} * 100 = ${percent} -> toPrecision(12) = ${precision}`);
});

console.log('\n使用 Math.round 處理：');
testValues.forEach(val => {
    const percent = Math.round(val * 100 * 1000000) / 1000000;
    console.log(`${val} * 100 = ${percent}`);
});

console.log('\n最佳解決方案 - 使用 parseFloat(toFixed)：');
testValues.forEach(val => {
    const percent = val * 100;
    const fixed = parseFloat(percent.toFixed(10));
    console.log(`${val} * 100 = ${percent} -> parseFloat(toFixed(10)) = ${fixed}`);
});