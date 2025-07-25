console.log('=== 为什么 1.1 不是 1.1？ ===\n');

// 直接输入 1.1
console.log('直接输入 1.1:');
console.log(1.1);  // 看起来是 1.1

// 但当我们做计算时...
console.log('\n计算 0.011 * 100:');
console.log(0.011 * 100);  // 1.0999999999999999

// 更多例子
console.log('\n更多浮点数精度问题的例子:');
console.log('0.1 + 0.2 =', 0.1 + 0.2);  // 0.30000000000000004
console.log('0.1 * 3 =', 0.1 * 3);      // 0.30000000000000004
console.log('1.1 - 1 =', 1.1 - 1);      // 0.09999999999999987

// 为什么会这样？
console.log('\n查看二进制表示:');
console.log('0.1 的二进制:', (0.1).toString(2));
console.log('0.011 的二进制:', (0.011).toString(2));

// 解决方案
console.log('\n解决方案:');
const result = 0.011 * 100;
console.log('原始结果:', result);
console.log('使用 toFixed(2):', result.toFixed(2));
console.log('使用 Math.round:', Math.round(result * 100) / 100);
console.log('使用 parseFloat(toFixed(10)):', parseFloat(result.toFixed(10)));