// 修復期號顯示不一致的問題

console.log('=== 期號顯示問題分析 ===\n');

// 問題總結
console.log('問題描述：');
console.log('1. 主畫面顯示: 202507241372 (07/24 第1372期)');
console.log('2. 近期開獎顯示: 07/25 214期');
console.log('3. 日期和序號都不一致\n');

console.log('可能原因：');
console.log('1. 資料庫中 recent_draws 表存儲的期號格式不一致');
console.log('2. 前端 formatPeriodDisplay 函數沒有正確處理所有格式');
console.log('3. 後端 API 返回的數據格式有問題\n');

console.log('解決方案：');
console.log('1. 確保所有期號都使用統一格式 YYYYMMDDXXXX');
console.log('2. 修改前端代碼，正確處理不同長度的期號序號');
console.log('3. 檢查並修復資料庫中的錯誤數據\n');

// 修改後的 formatPeriodDisplay 函數
function improvedFormatPeriodDisplay(period, showFullPeriod = false) {
    if (!period) return '';
    const periodStr = period.toString();
    
    if (showFullPeriod) {
        return periodStr;
    }
    
    // 處理不同格式的期號
    if (periodStr.length >= 11) {
        // 格式：YYYYMMDDXXXX (4位序號)
        const month = periodStr.substring(4, 6);
        const day = periodStr.substring(6, 8);
        const num = periodStr.substring(8);
        return `${month}/${day} ${parseInt(num)}期`;
    } else if (periodStr.length >= 8) {
        // 格式：YYYYMMDDXXX (3位序號)
        const month = periodStr.substring(4, 6);
        const day = periodStr.substring(6, 8);
        const num = periodStr.substring(8);
        return `${month}/${day} ${parseInt(num)}期`;
    }
    
    // 如果格式不正確，返回原值
    return periodStr;
}

// 測試改進後的函數
console.log('測試改進後的格式化函數：');
const testCases = [
    '202507241372',  // 4位序號
    '202507250214',  // 正常3位序號
    '20250725001',   // 3位序號
    '2025072501234', // 5位序號
];

testCases.forEach(period => {
    console.log(`${period} → ${improvedFormatPeriodDisplay(period)}`);
});

console.log('\n建議修改 frontend/index.html 中的 formatPeriodDisplay 函數');
console.log('使用 parseInt(num) 來去除前導零，如 0214 → 214');