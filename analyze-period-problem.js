// 分析期號顯示問題

// 測試 formatPeriodDisplay 函數邏輯
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

// 測試案例
console.log('=== 期號格式化測試 ===\n');

const testPeriods = [
    '202507241372',  // 當前主畫面顯示的期號
    '202507250214',  // 可能的實際期號 (07/25 214期)
    '202507250213',
    '202507250212',
    '20250725214',   // 可能的短格式
    '214'            // 只有序號
];

testPeriods.forEach(period => {
    console.log(`原始期號: ${period}`);
    console.log(`格式化後: ${formatPeriodDisplay(period)}`);
    console.log(`完整顯示: ${formatPeriodDisplay(period, true)}`);
    console.log('---');
});

// 分析問題
console.log('\n=== 問題分析 ===');
console.log('1. 如果主畫面顯示 202507241372，表示是 2025年07月24日 第1372期');
console.log('2. 如果近期開獎顯示 07/25 214期，表示是 2025年07月25日 第214期');
console.log('3. 這兩個日期不同，說明：');
console.log('   - 可能是跨日了，但期號沒有正確重置');
console.log('   - 或者近期開獎的數據源有問題');
console.log('\n建議檢查：');
console.log('1. 後端生成期號的邏輯是否正確處理跨日重置');
console.log('2. recent_draws 表中的數據是否正確');
console.log('3. 前端獲取數據的 API 是否返回正確的期號');