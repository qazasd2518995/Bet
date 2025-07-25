// 调试维护状态问题

console.log('=== 调试维护状态 ===\n');

// 测试 isMaintenanceTime 函数
function isMaintenanceTime() {
  const taipeiTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit'
  });
  const hour = parseInt(taipeiTime.split(':')[0]);
  console.log(`台北时间小时: ${hour}`);
  return hour === 6;
}

// 测试维护恢复逻辑
const memoryGameState = {
  status: 'maintenance',
  current_period: 202507241377
};

console.log('当前状态:', memoryGameState);
console.log('是否在维护时间:', isMaintenanceTime());

if (memoryGameState.status === 'maintenance' && !isMaintenanceTime()) {
  const taipeiTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit'
  });
  const hour = parseInt(taipeiTime.split(':')[0]);
  
  console.log('\n满足维护恢复条件:');
  console.log('- 当前状态是维护');
  console.log('- 不在维护时间内');
  console.log(`- 当前台北时间小时: ${hour}`);
  
  if (hour === 7) {
    console.log('✅ 应该执行恢复逻辑（7点）');
  } else {
    console.log(`❌ 不会执行恢复逻辑（需要正好 7 点，现在是 ${hour} 点）`);
    console.log('\n🔴 问题找到了！系统只在正好 7 点时恢复，错过了就一直保持维护状态！');
  }
}