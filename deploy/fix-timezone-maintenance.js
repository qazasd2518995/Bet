// 修复时区和维护时间问题

console.log('=== 修复时区和维护时间 ===\n');

// 测试当前时间
const now = new Date();
console.log('服务器本地时间:', now.toString());
console.log('UTC 时间:', now.toUTCString());
console.log('台北时间:', now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));

// 获取台北时间的小时
function getTaipeiHour() {
    const taipeiTime = new Date().toLocaleString('en-US', { 
        timeZone: 'Asia/Taipei',
        hour12: false,
        hour: '2-digit'
    });
    return parseInt(taipeiTime.split(':')[0]);
}

console.log('\n当前台北时间小时:', getTaipeiHour());

// 修正后的维护时间检查函数
function isMaintenanceTimeTaipei() {
    const taipeiHour = getTaipeiHour();
    return taipeiHour === 6; // 台北时间 6-7 点维护
}

// 修正后的游戏日期函数
function getGameDateTaipei() {
    // 获取台北时间
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
    
    // 创建台北时间的日期对象
    const gameDate = new Date(year, month - 1, day);
    
    // 如果是凌晨0点到早上7点之前，算作前一天的游戏日
    if (hour < 7) {
        gameDate.setDate(gameDate.getDate() - 1);
    }
    
    return gameDate;
}

console.log('\n测试维护时间检查:');
console.log('当前是否为维护时间 (原函数):', now.getHours() === 6);
console.log('当前是否为维护时间 (台北时间):', isMaintenanceTimeTaipei());

console.log('\n建议修改 backend.js 中的相关函数:');
console.log('1. isMaintenanceTime() - 使用台北时间判断');
console.log('2. getGameDate() - 使用台北时间计算游戏日期');
console.log('3. getNextPeriod() - 确保使用台北时间判断是否需要重置期号');