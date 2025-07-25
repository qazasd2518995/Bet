// 修復期號數據問題

console.log('=== 修復期號數據問題 ===\n');

// 獲取台北時間的日期字符串
function getTaipeiDateString() {
    const taipeiTime = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false
    });
    
    const [date, time] = taipeiTime.split(', ');
    const [month, day, year] = date.split('/');
    const hour = parseInt(time.split(':')[0]);
    
    // 如果是凌晨0點到早上7點之前，算作前一天的遊戲日
    if (hour < 7) {
        const yesterday = new Date(year, month - 1, day - 1);
        const yesterdayYear = yesterday.getFullYear();
        const yesterdayMonth = (yesterday.getMonth() + 1).toString().padStart(2, '0');
        const yesterdayDay = yesterday.getDate().toString().padStart(2, '0');
        return `${yesterdayYear}${yesterdayMonth}${yesterdayDay}`;
    }
    
    // 7點之後算作當天
    return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
}

console.log('當前台北時間:', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
console.log('當前遊戲日期:', getTaipeiDateString());

console.log('\n問題分析:');
console.log('1. 主畫面顯示 202507241372 可能是昨天的期號');
console.log('2. 近期開獎顯示 07/25 214期 是今天的期號');
console.log('3. 系統可能在維護時間後沒有正確切換到新的一天');

console.log('\n修復建議:');
console.log('1. 重啟遊戲服務，讓系統重新初始化');
console.log('2. 清理 recent_draws 表中的錯誤數據');
console.log('3. 確保 game_state 表的 current_period 是正確的');

console.log('\nSQL 修復腳本:');
const gameDate = getTaipeiDateString();
console.log(`-- 更新 game_state 表的當前期號`);
console.log(`UPDATE game_state SET current_period = '${gameDate}001' WHERE id = 1;`);
console.log(`\n-- 清理今天的錯誤數據`);
console.log(`DELETE FROM recent_draws WHERE period::text LIKE '${gameDate}%';`);
console.log(`\n-- 檢查最新的期號`);
console.log(`SELECT current_period FROM game_state WHERE id = 1;`);