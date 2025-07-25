// 測試維修時間和期號交接功能

// 測試用的時間函數
function testTimeScenarios() {
  console.log('🧪 開始測試維修時間和期號交接功能\n');
  
  // 備份原始的 Date
  const originalDate = Date;
  
  // 模擬 getGameDate 函數
  function getGameDate(testDate) {
    const hour = testDate.getHours();
    
    // 如果是凌晨0點到早上7點之前，算作前一天的遊戲日
    if (hour < 7) {
      const yesterday = new originalDate(testDate);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    
    return testDate;
  }
  
  // 模擬 isMaintenanceTime 函數
  function isMaintenanceTime(testDate) {
    const hour = testDate.getHours();
    return hour === 6; // 6點整到7點整為維修時間
  }
  
  // 模擬 canStartNewPeriod 函數
  function canStartNewPeriod(testDate) {
    const hour = testDate.getHours();
    const minute = testDate.getMinutes();
    
    // 如果是早上6點之後，不能開始新期
    if (hour === 6 || (hour === 5 && minute >= 58)) {
      return false;
    }
    
    return true;
  }
  
  // 模擬 getNextPeriod 函數
  function getNextPeriod(currentPeriod, testDate) {
    const hour = testDate.getHours();
    const currentPeriodStr = currentPeriod.toString();
    
    // 獲取遊戲日期
    const gameDate = getGameDate(testDate);
    const gameDateStr = `${gameDate.getFullYear()}${(gameDate.getMonth()+1).toString().padStart(2,'0')}${gameDate.getDate().toString().padStart(2,'0')}`;
    
    // 提取當前期號的日期部分
    const currentDatePart = currentPeriodStr.substring(0, 8);
    
    // 檢查是否需要開始新的遊戲日
    if (hour >= 7 && currentDatePart !== gameDateStr) {
      const yesterday = new originalDate(testDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}${(yesterday.getMonth()+1).toString().padStart(2,'0')}${yesterday.getDate().toString().padStart(2,'0')}`;
      
      if (currentDatePart === yesterdayStr) {
        const newPeriod = parseInt(`${gameDateStr}001`);
        return { 
          period: newPeriod, 
          action: '新的遊戲日開始，期號重置'
        };
      }
    }
    
    // 如果當前期號的日期部分等於遊戲日期，則遞增
    if (currentDatePart === gameDateStr) {
      const suffix = parseInt(currentPeriodStr.substring(8)) + 1;
      const newPeriod = parseInt(`${gameDateStr}${suffix.toString().padStart(3, '0')}`);
      return {
        period: newPeriod,
        action: '期號遞增'
      };
    } else {
      // 保持當前遊戲日期遞增
      const suffix = parseInt(currentPeriodStr.substring(8)) + 1;
      const currentGameDatePart = currentPeriodStr.substring(0, 8);
      const newPeriod = parseInt(`${currentGameDatePart}${suffix.toString().padStart(3, '0')}`);
      return {
        period: newPeriod,
        action: '期號遞增(保持遊戲日)'
      };
    }
  }
  
  // 測試場景
  const testScenarios = [
    { time: '2025-07-24 05:50:00', currentPeriod: 20250723999, desc: '5:50 AM - 接近維修時間' },
    { time: '2025-07-24 05:58:00', currentPeriod: 20250723999, desc: '5:58 AM - 應該停止開新期' },
    { time: '2025-07-24 06:00:00', currentPeriod: 20250723999, desc: '6:00 AM - 進入維修時間' },
    { time: '2025-07-24 06:30:00', currentPeriod: 20250723999, desc: '6:30 AM - 維修中' },
    { time: '2025-07-24 07:00:00', currentPeriod: 20250723999, desc: '7:00 AM - 維修結束，新的一天開始' },
    { time: '2025-07-24 07:01:00', currentPeriod: 20250724001, desc: '7:01 AM - 新一天第一期' },
    { time: '2025-07-24 23:59:00', currentPeriod: 20250724800, desc: '11:59 PM - 接近午夜' },
    { time: '2025-07-25 00:01:00', currentPeriod: 20250724801, desc: '00:01 AM - 跨過午夜但還是昨天的遊戲日' },
    { time: '2025-07-25 05:00:00', currentPeriod: 20250724950, desc: '5:00 AM - 早上5點' },
  ];
  
  console.log('📋 測試場景：\n');
  
  testScenarios.forEach(scenario => {
    const testDate = new originalDate(scenario.time);
    const gameDate = getGameDate(testDate);
    const gameDateStr = `${gameDate.getFullYear()}${(gameDate.getMonth()+1).toString().padStart(2,'0')}${gameDate.getDate().toString().padStart(2,'0')}`;
    const isMaintenance = isMaintenanceTime(testDate);
    const canStart = canStartNewPeriod(testDate);
    const nextPeriodInfo = getNextPeriod(scenario.currentPeriod, testDate);
    
    console.log(`時間: ${scenario.time} (${scenario.desc})`);
    console.log(`  當前期號: ${scenario.currentPeriod}`);
    console.log(`  遊戲日期: ${gameDateStr}`);
    console.log(`  維修狀態: ${isMaintenance ? '是（系統維修中）' : '否'}`);
    console.log(`  可開新期: ${canStart ? '是' : '否'}`);
    console.log(`  下一期號: ${nextPeriodInfo.period} (${nextPeriodInfo.action})`);
    console.log('---\n');
  });
  
  // 測試前端顯示邏輯
  console.log('📱 前端顯示測試：\n');
  
  const displayTests = [
    { status: 'maintenance', desc: '維修狀態' },
    { status: 'waiting', desc: '等待狀態' },
    { status: 'betting', desc: '下注狀態' },
    { status: 'drawing', desc: '開獎狀態' }
  ];
  
  displayTests.forEach(test => {
    console.log(`遊戲狀態: ${test.status} (${test.desc})`);
    console.log(`  顯示遮罩: ${test.status === 'maintenance' || test.status === 'waiting' ? '是' : '否'}`);
    console.log(`  顯示文字: ${test.status === 'maintenance' ? '系统维护中' : test.status === 'waiting' ? '等待下期开始' : '正常遊戲'}`);
    console.log(`  可否下注: ${test.status === 'betting' ? '是' : '否'}`);
    console.log('---\n');
  });
}

// 執行測試
testTimeScenarios();

console.log('✅ 測試完成！');
console.log('\n📌 重要結論：');
console.log('1. 期號格式：YYYYMMDDXXX (日期+3位序號)');
console.log('2. 遊戲日分界：早上7點');
console.log('3. 維修時間：6:00-7:00');
console.log('4. 5:58後停止開新期');
console.log('5. 跨過午夜但未到7點，仍算前一天的遊戲日');