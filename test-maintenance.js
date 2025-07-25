// 测试维修时间和期号交接功能

// 测试用的时间函数
function testTimeScenarios() {
  console.log('🧪 开始测试维修时间和期号交接功能\n');
  
  // 备份原始的 Date
  const originalDate = Date;
  
  // 模拟 getGameDate 函数
  function getGameDate(testDate) {
    const hour = testDate.getHours();
    
    // 如果是凌晨0点到早上7点之前，算作前一天的游戏日
    if (hour < 7) {
      const yesterday = new originalDate(testDate);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    
    return testDate;
  }
  
  // 模拟 isMaintenanceTime 函数
  function isMaintenanceTime(testDate) {
    const hour = testDate.getHours();
    return hour === 6; // 6点整到7点整为维修时间
  }
  
  // 模拟 canStartNewPeriod 函数
  function canStartNewPeriod(testDate) {
    const hour = testDate.getHours();
    const minute = testDate.getMinutes();
    
    // 如果是早上6点之后，不能开始新期
    if (hour === 6 || (hour === 5 && minute >= 58)) {
      return false;
    }
    
    return true;
  }
  
  // 模拟 getNextPeriod 函数
  function getNextPeriod(currentPeriod, testDate) {
    const hour = testDate.getHours();
    const currentPeriodStr = currentPeriod.toString();
    
    // 获取游戏日期
    const gameDate = getGameDate(testDate);
    const gameDateStr = `${gameDate.getFullYear()}${(gameDate.getMonth()+1).toString().padStart(2,'0')}${gameDate.getDate().toString().padStart(2,'0')}`;
    
    // 提取当前期号的日期部分
    const currentDatePart = currentPeriodStr.substring(0, 8);
    
    // 检查是否需要开始新的游戏日
    if (hour >= 7 && currentDatePart !== gameDateStr) {
      const yesterday = new originalDate(testDate);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}${(yesterday.getMonth()+1).toString().padStart(2,'0')}${yesterday.getDate().toString().padStart(2,'0')}`;
      
      if (currentDatePart === yesterdayStr) {
        const newPeriod = parseInt(`${gameDateStr}001`);
        return { 
          period: newPeriod, 
          action: '新的游戏日开始，期号重置'
        };
      }
    }
    
    // 如果当前期号的日期部分等于游戏日期，则递增
    if (currentDatePart === gameDateStr) {
      const suffix = parseInt(currentPeriodStr.substring(8)) + 1;
      const newPeriod = parseInt(`${gameDateStr}${suffix.toString().padStart(3, '0')}`);
      return {
        period: newPeriod,
        action: '期号递增'
      };
    } else {
      // 保持当前游戏日期递增
      const suffix = parseInt(currentPeriodStr.substring(8)) + 1;
      const currentGameDatePart = currentPeriodStr.substring(0, 8);
      const newPeriod = parseInt(`${currentGameDatePart}${suffix.toString().padStart(3, '0')}`);
      return {
        period: newPeriod,
        action: '期号递增(保持游戏日)'
      };
    }
  }
  
  // 测试场景
  const testScenarios = [
    { time: '2025-07-24 05:50:00', currentPeriod: 20250723999, desc: '5:50 AM - 接近维修时间' },
    { time: '2025-07-24 05:58:00', currentPeriod: 20250723999, desc: '5:58 AM - 应该停止开新期' },
    { time: '2025-07-24 06:00:00', currentPeriod: 20250723999, desc: '6:00 AM - 进入维修时间' },
    { time: '2025-07-24 06:30:00', currentPeriod: 20250723999, desc: '6:30 AM - 维修中' },
    { time: '2025-07-24 07:00:00', currentPeriod: 20250723999, desc: '7:00 AM - 维修结束，新的一天开始' },
    { time: '2025-07-24 07:01:00', currentPeriod: 20250724001, desc: '7:01 AM - 新一天第一期' },
    { time: '2025-07-24 23:59:00', currentPeriod: 20250724800, desc: '11:59 PM - 接近午夜' },
    { time: '2025-07-25 00:01:00', currentPeriod: 20250724801, desc: '00:01 AM - 跨过午夜但还是昨天的游戏日' },
    { time: '2025-07-25 05:00:00', currentPeriod: 20250724950, desc: '5:00 AM - 早上5点' },
  ];
  
  console.log('📋 测试场景：\n');
  
  testScenarios.forEach(scenario => {
    const testDate = new originalDate(scenario.time);
    const gameDate = getGameDate(testDate);
    const gameDateStr = `${gameDate.getFullYear()}${(gameDate.getMonth()+1).toString().padStart(2,'0')}${gameDate.getDate().toString().padStart(2,'0')}`;
    const isMaintenance = isMaintenanceTime(testDate);
    const canStart = canStartNewPeriod(testDate);
    const nextPeriodInfo = getNextPeriod(scenario.currentPeriod, testDate);
    
    console.log(`时间: ${scenario.time} (${scenario.desc})`);
    console.log(`  当前期号: ${scenario.currentPeriod}`);
    console.log(`  游戏日期: ${gameDateStr}`);
    console.log(`  维修状态: ${isMaintenance ? '是（系统维修中）' : '否'}`);
    console.log(`  可开新期: ${canStart ? '是' : '否'}`);
    console.log(`  下一期号: ${nextPeriodInfo.period} (${nextPeriodInfo.action})`);
    console.log('---\n');
  });
  
  // 测试前端显示逻辑
  console.log('📱 前端显示测试：\n');
  
  const displayTests = [
    { status: 'maintenance', desc: '维修状态' },
    { status: 'waiting', desc: '等待状态' },
    { status: 'betting', desc: '下注状态' },
    { status: 'drawing', desc: '开奖状态' }
  ];
  
  displayTests.forEach(test => {
    console.log(`游戏状态: ${test.status} (${test.desc})`);
    console.log(`  显示遮罩: ${test.status === 'maintenance' || test.status === 'waiting' ? '是' : '否'}`);
    console.log(`  显示文字: ${test.status === 'maintenance' ? '系统维护中' : test.status === 'waiting' ? '等待下期开始' : '正常游戏'}`);
    console.log(`  可否下注: ${test.status === 'betting' ? '是' : '否'}`);
    console.log('---\n');
  });
}

// 执行测试
testTimeScenarios();

console.log('✅ 测试完成！');
console.log('\n📌 重要结论：');
console.log('1. 期号格式：YYYYMMDDXXX (日期+3位序号)');
console.log('2. 游戏日分界：早上7点');
console.log('3. 维修时间：6:00-7:00');
console.log('4. 5:58后停止开新期');
console.log('5. 跨过午夜但未到7点，仍算前一天的游戏日');