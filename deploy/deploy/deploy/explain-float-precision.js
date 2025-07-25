console.log('=== 為什麼 1.1 不是 1.1？ ===\n');

// 直接輸入 1.1
console.log('直接輸入 1.1:');
console.log(1.1);  // 看起來是 1.1

// 但當我們做計算時...
console.log('\n計算 0.011 * 100:');
console.log(0.011 * 100);  // 1.0999999999999999

// 更多例子
console.log('\n更多浮點數精度問題的例子:');
console.log('0.1 + 0.2 =', 0.1 + 0.2);  // 0.30000000000000004
console.log('0.1 * 3 =', 0.1 * 3);      // 0.30000000000000004
console.log('1.1 - 1 =', 1.1 - 1);      // 0.09999999999999987

// 為什麼會這樣？
console.log('\n查看二進制表示:');
console.log('0.1 的二進制:', (0.1).toString(2));
console.log('0.011 的二進制:', (0.011).toString(2));

// 解決方案
console.log('\n解決方案:');
const result = 0.011 * 100;
console.log('原始結果:', result);
console.log('使用 toFixed(2):', result.toFixed(2));
console.log('使用 Math.round:', Math.round(result * 100) / 100);
console.log('使用 parseFloat(toFixed(10)):', parseFloat(result.toFixed(10)));