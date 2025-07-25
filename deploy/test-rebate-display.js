// 测试退水显示问题
const testValues = [
    { actual: 0.0012, percent: 0.12 },
    { actual: 0.001, percent: 0.1 },
    { actual: 0.01, percent: 1.0 },
    { actual: 0.012, percent: 1.2 }
];

console.log('测试 toFixed(1) 显示问题：\n');

testValues.forEach(({ actual, percent }) => {
    const displayPercent = (actual * 100).toFixed(1);
    console.log(`实际值: ${actual} (${percent}%)`);
    console.log(`toFixed(1) 显示: ${displayPercent}%`);
    console.log(`正确显示应该是: ${actual * 100}%`);
    console.log('---');
});

// 模拟级联更新的日志
console.log('\n模拟级联更新日志：');
const currentMaxRebate = 0.01;  // 1.0%
const newMaxRebate = 0.0012;    // 0.12%

console.log(`最大退水更新: ${(currentMaxRebate * 100).toFixed(1)}% -> ${(newMaxRebate * 100).toFixed(1)}%`);
console.log('这会显示为: 最大退水更新: 1.0% -> 0.1%');
console.log('但实际上是: 最大退水更新: 1.0% -> 0.12%');