// 测试退水精度问题
console.log('=== 测试 1.09% 退水精度 ===\n');

// 模拟储存和读取流程
const userInput = 1.09;
console.log(`1. 用户输入: ${userInput}%`);

// 转换为小数（模拟前端发送）
const sentValue = userInput / 100;
console.log(`2. 发送到后端: ${sentValue}`);
console.log(`   精确值: ${sentValue.toFixed(20)}`);

// 使用 toFixed(10) 处理
const processedValue = parseFloat(sentValue.toFixed(10));
console.log(`3. 处理后: ${processedValue}`);

// 从资料库读取（假设储存为 0.0109）
const dbValue = 0.0109;
console.log(`\n4. 资料库储存: ${dbValue}`);

// 转换回百分比显示
const displayValue = dbValue * 100;
console.log(`5. 显示值: ${displayValue}%`);
console.log(`   精确值: ${displayValue.toFixed(20)}`);

// 使用 toFixed(10) 处理显示
const finalDisplay = parseFloat((dbValue * 100).toFixed(10));
console.log(`6. 处理后显示: ${finalDisplay}%`);

// 测试各种值
console.log('\n测试其他值:');
const testValues = [1.09, 1.1, 1.11, 0.89, 0.9];
testValues.forEach(val => {
    const decimal = val / 100;
    const backToPercent = decimal * 100;
    const processed = parseFloat(backToPercent.toFixed(10));
    console.log(`${val}% -> ${decimal} -> ${backToPercent}% -> ${processed}%`);
});