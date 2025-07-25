// 分析期号显示问题

// 测试 formatPeriodDisplay 函数逻辑
function formatPeriodDisplay(period, showFullPeriod = false) {
    if (!period) return '';
    const periodStr = period.toString();
    
    if (showFullPeriod) {
        return periodStr;
    }
    
    if (periodStr.length >= 8) {
        const year = periodStr.substring(0, 4);
        const month = periodStr.substring(4, 6);
        const day = periodStr.substring(6, 8);
        const num = periodStr.substring(8);
        
        return `${month}/${day} ${num}期`;
    }
    return periodStr;
}

// 测试案例
console.log('=== 期号格式化测试 ===\n');

const testPeriods = [
    '202507241372',  // 当前主画面显示的期号
    '202507250214',  // 可能的实际期号 (07/25 214期)
    '202507250213',
    '202507250212',
    '20250725214',   // 可能的短格式
    '214'            // 只有序号
];

testPeriods.forEach(period => {
    console.log(`原始期号: ${period}`);
    console.log(`格式化后: ${formatPeriodDisplay(period)}`);
    console.log(`完整显示: ${formatPeriodDisplay(period, true)}`);
    console.log('---');
});

// 分析问题
console.log('\n=== 问题分析 ===');
console.log('1. 如果主画面显示 202507241372，表示是 2025年07月24日 第1372期');
console.log('2. 如果近期开奖显示 07/25 214期，表示是 2025年07月25日 第214期');
console.log('3. 这两个日期不同，说明：');
console.log('   - 可能是跨日了，但期号没有正确重置');
console.log('   - 或者近期开奖的数据源有问题');
console.log('\n建议检查：');
console.log('1. 后端生成期号的逻辑是否正确处理跨日重置');
console.log('2. recent_draws 表中的数据是否正确');
console.log('3. 前端获取数据的 API 是否返回正确的期号');