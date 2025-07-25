// 修复期号数据问题

console.log('=== 修复期号数据问题 ===\n');

// 获取台北时间的日期字符串
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
    
    // 如果是凌晨0点到早上7点之前，算作前一天的游戏日
    if (hour < 7) {
        const yesterday = new Date(year, month - 1, day - 1);
        const yesterdayYear = yesterday.getFullYear();
        const yesterdayMonth = (yesterday.getMonth() + 1).toString().padStart(2, '0');
        const yesterdayDay = yesterday.getDate().toString().padStart(2, '0');
        return `${yesterdayYear}${yesterdayMonth}${yesterdayDay}`;
    }
    
    // 7点之后算作当天
    return `${year}${month.padStart(2, '0')}${day.padStart(2, '0')}`;
}

console.log('当前台北时间:', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
console.log('当前游戏日期:', getTaipeiDateString());

console.log('\n问题分析:');
console.log('1. 主画面显示 202507241372 可能是昨天的期号');
console.log('2. 近期开奖显示 07/25 214期 是今天的期号');
console.log('3. 系统可能在维护时间后没有正确切换到新的一天');

console.log('\n修复建议:');
console.log('1. 重启游戏服务，让系统重新初始化');
console.log('2. 清理 recent_draws 表中的错误数据');
console.log('3. 确保 game_state 表的 current_period 是正确的');

console.log('\nSQL 修复脚本:');
const gameDate = getTaipeiDateString();
console.log(`-- 更新 game_state 表的当前期号`);
console.log(`UPDATE game_state SET current_period = '${gameDate}001' WHERE id = 1;`);
console.log(`\n-- 清理今天的错误数据`);
console.log(`DELETE FROM recent_draws WHERE period::text LIKE '${gameDate}%';`);
console.log(`\n-- 检查最新的期号`);
console.log(`SELECT current_period FROM game_state WHERE id = 1;`);