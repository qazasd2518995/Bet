// 测试输入转换问题
console.log('=== 测试退水输入转换 ===\n');

// 模拟用户输入 0.12
const userInput = "0.12";
console.log(`用户输入: ${userInput}%`);

// 前端转换逻辑
const percentage = parseFloat(userInput) / 100;
console.log(`转换后 (除以100): ${percentage}`);
console.log(`精确值: ${percentage}`);

// 使用 toFixed(6)
const fixed6 = parseFloat(percentage.toFixed(6));
console.log(`toFixed(6) 后: ${fixed6}`);

// 显示百分比
console.log(`\n显示百分比:`);
console.log(`${percentage * 100}% (原始)`);
console.log(`${fixed6 * 100}% (toFixed 后)`);

// 检查 0.16 的来源
console.log(`\n检查 0.16 的可能来源:`);
const test016 = 0.0016;
console.log(`0.0016 * 100 = ${test016 * 100}%`);

// 测试各种可能的值
console.log(`\n测试各种输入值:`);
const testInputs = ["0.12", "0.16", "1.2", "1.6"];
testInputs.forEach(input => {
    const converted = parseFloat(input) / 100;
    console.log(`输入 ${input}% -> ${converted} -> 显示 ${converted * 100}%`);
});