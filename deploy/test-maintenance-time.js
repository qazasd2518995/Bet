// 测试维护时间逻辑

// 原始函数（可能有问题）
function isMaintenanceTimeOld() {
  const now = new Date();
  const hour = now.getHours();
  return hour === 6;
}

// 修复后的函数（使用台北时间）
function isMaintenanceTimeNew() {
  const taipeiTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit'
  });
  const hour = parseInt(taipeiTime.split(':')[0]);
  return hour === 6;
}

console.log('=== 测试维护时间逻辑 ===\n');

const now = new Date();
console.log('当前时间资讯:');
console.log('- 本地时间:', now.toString());
console.log('- UTC 时间:', now.toUTCString());
console.log('- 台北时间:', now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
console.log('- 本地小时:', now.getHours());

const taipeiTime = new Date().toLocaleString('en-US', { 
  timeZone: 'Asia/Taipei',
  hour12: false,
  hour: '2-digit'
});
console.log('- 台北小时:', parseInt(taipeiTime.split(':')[0]));

console.log('\n维护时间检查:');
console.log('- 原始函数结果:', isMaintenanceTimeOld() ? '是维护时间' : '不是维护时间');
console.log('- 修复函数结果:', isMaintenanceTimeNew() ? '是维护时间' : '不是维护时间');

console.log('\n结论:');
if (isMaintenanceTimeOld() && !isMaintenanceTimeNew()) {
  console.log('❌ 原始函数有问题！使用了错误的时区');
} else if (!isMaintenanceTimeOld() && !isMaintenanceTimeNew()) {
  console.log('✅ 两个函数都正确，现在不是维护时间');
} else {
  console.log('⚠️ 可能有其他问题');
}