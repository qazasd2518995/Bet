// 測試維護時間邏輯

// 原始函數（可能有問題）
function isMaintenanceTimeOld() {
  const now = new Date();
  const hour = now.getHours();
  return hour === 6;
}

// 修復後的函數（使用台北時間）
function isMaintenanceTimeNew() {
  const taipeiTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit'
  });
  const hour = parseInt(taipeiTime.split(':')[0]);
  return hour === 6;
}

console.log('=== 測試維護時間邏輯 ===\n');

const now = new Date();
console.log('當前時間資訊:');
console.log('- 本地時間:', now.toString());
console.log('- UTC 時間:', now.toUTCString());
console.log('- 台北時間:', now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }));
console.log('- 本地小時:', now.getHours());

const taipeiTime = new Date().toLocaleString('en-US', { 
  timeZone: 'Asia/Taipei',
  hour12: false,
  hour: '2-digit'
});
console.log('- 台北小時:', parseInt(taipeiTime.split(':')[0]));

console.log('\n維護時間檢查:');
console.log('- 原始函數結果:', isMaintenanceTimeOld() ? '是維護時間' : '不是維護時間');
console.log('- 修復函數結果:', isMaintenanceTimeNew() ? '是維護時間' : '不是維護時間');

console.log('\n結論:');
if (isMaintenanceTimeOld() && !isMaintenanceTimeNew()) {
  console.log('❌ 原始函數有問題！使用了錯誤的時區');
} else if (!isMaintenanceTimeOld() && !isMaintenanceTimeNew()) {
  console.log('✅ 兩個函數都正確，現在不是維護時間');
} else {
  console.log('⚠️ 可能有其他問題');
}