// 修復時區和維護時間問題

console.log('=== 修復時區和維護時間 ===\n');

// 測試當前時間
const now = new Date();
console.log('服務器本地時間:', now.toString());
console.log('UTC 時間:', now.toUTCString());
console.log('台北時間:', now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));

// 獲取台北時間的小時
function getTaipeiHour() {
    const taipeiTime = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Taipei',
        hour12: false,
        hour: '2-digit'
    });
    return parseInt(taipeiTime.split(':')[0]);
}

console.log('\n當前台北時間小時:', getTaipeiHour());

// 修正後的維護時間檢查函數
function isMaintenanceTimeTaipei() {
    const taipeiHour = getTaipeiHour();
    return taipeiHour === 6; // 台北時間 6-7 點維護
}

// 修正後的遊戲日期函數
function getGameDateTaipei() {
    // 獲取台北時間
    const taipeiDate = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false
    });
    
    const [date, time] = taipeiDate.split(', ');
    const [month, day, year] = date.split('/');
    const hour = parseInt(time.split(':')[0]);
    
    // 創建台北時間的日期對象
    const gameDate = new Date(year, month - 1, day);
    
    // 如果是凌晨0點到早上7點之前，算作前一天的遊戲日
    if (hour < 7) {
        gameDate.setDate(gameDate.getDate() - 1);
    }
    
    return gameDate;
}

console.log('\n測試維護時間檢查:');
console.log('當前是否為維護時間 (原函數):', now.getHours() === 6);
console.log('當前是否為維護時間 (台北時間):', isMaintenanceTimeTaipei());

console.log('\n建議修改 backend.js 中的相關函數:');
console.log('1. isMaintenanceTime() - 使用台北時間判斷');
console.log('2. getGameDate() - 使用台北時間計算遊戲日期');
console.log('3. getNextPeriod() - 確保使用台北時間判斷是否需要重置期號');