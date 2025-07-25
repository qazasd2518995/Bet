// 調試維護狀態問題

console.log('=== 調試維護狀態 ===\n');

// 測試 isMaintenanceTime 函數
function isMaintenanceTime() {
  const taipeiTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit'
  });
  const hour = parseInt(taipeiTime.split(':')[0]);
  console.log(`台北時間小時: ${hour}`);
  return hour === 6;
}

// 測試維護恢復邏輯
const memoryGameState = {
  status: 'maintenance',
  current_period: 202507241377
};

console.log('當前狀態:', memoryGameState);
console.log('是否在維護時間:', isMaintenanceTime());

if (memoryGameState.status === 'maintenance' && !isMaintenanceTime()) {
  const taipeiTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit'
  });
  const hour = parseInt(taipeiTime.split(':')[0]);
  
  console.log('\n滿足維護恢復條件:');
  console.log('- 當前狀態是維護');
  console.log('- 不在維護時間內');
  console.log(`- 當前台北時間小時: ${hour}`);
  
  if (hour === 7) {
    console.log('✅ 應該執行恢復邏輯（7點）');
  } else {
    console.log(`❌ 不會執行恢復邏輯（需要正好 7 點，現在是 ${hour} 點）`);
    console.log('\n🔴 問題找到了！系統只在正好 7 點時恢復，錯過了就一直保持維護狀態！');
  }
}