// 修复期号显示不一致的问题

console.log('=== 期号显示问题分析 ===\n');

// 问题总结
console.log('问题描述：');
console.log('1. 主画面显示: 202507241372 (07/24 第1372期)');
console.log('2. 近期开奖显示: 07/25 214期');
console.log('3. 日期和序号都不一致\n');

console.log('可能原因：');
console.log('1. 资料库中 recent_draws 表存储的期号格式不一致');
console.log('2. 前端 formatPeriodDisplay 函数没有正确处理所有格式');
console.log('3. 后端 API 返回的数据格式有问题\n');

console.log('解决方案：');
console.log('1. 确保所有期号都使用统一格式 YYYYMMDDXXXX');
console.log('2. 修改前端代码，正确处理不同长度的期号序号');
console.log('3. 检查并修复资料库中的错误数据\n');

// 修改后的 formatPeriodDisplay 函数
function improvedFormatPeriodDisplay(period, showFullPeriod = false) {
    if (!period) return '';
    const periodStr = period.toString();
    
    if (showFullPeriod) {
        return periodStr;
    }
    
    // 处理不同格式的期号
    if (periodStr.length >= 11) {
        // 格式：YYYYMMDDXXXX (4位序号)
        const month = periodStr.substring(4, 6);
        const day = periodStr.substring(6, 8);
        const num = periodStr.substring(8);
        return `${month}/${day} ${parseInt(num)}期`;
    } else if (periodStr.length >= 8) {
        // 格式：YYYYMMDDXXX (3位序号)
        const month = periodStr.substring(4, 6);
        const day = periodStr.substring(6, 8);
        const num = periodStr.substring(8);
        return `${month}/${day} ${parseInt(num)}期`;
    }
    
    // 如果格式不正确，返回原值
    return periodStr;
}

// 测试改进后的函数
console.log('测试改进后的格式化函数：');
const testCases = [
    '202507241372',  // 4位序号
    '202507250214',  // 正常3位序号
    '20250725001',   // 3位序号
    '2025072501234', // 5位序号
];

testCases.forEach(period => {
    console.log(`${period} → ${improvedFormatPeriodDisplay(period)}`);
});

console.log('\n建议修改 frontend/index.html 中的 formatPeriodDisplay 函数');
console.log('使用 parseInt(num) 来去除前导零，如 0214 → 214');