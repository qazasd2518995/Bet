// 診斷期號同步問題

console.log('=== 期號同步問題診斷 ===\n');

console.log('問題症狀：');
console.log('- 主畫面顯示: 202507241372 (07/24 第1372期)');
console.log('- 近期開獎顯示: 07/25 214期');
console.log('- 日期相差一天，序號相差很大\n');

console.log('可能的原因：');
console.log('1. 時區問題：');
console.log('   - 伺服器可能使用 UTC 時間');
console.log('   - 前端使用本地時間（台北時間 UTC+8）');
console.log('   - 導致在台北時間凌晨到早上7點之間，日期不一致\n');

console.log('2. 期號重置邏輯問題：');
console.log('   - 後端 getNextPeriod 函數在早上7點重置期號');
console.log('   - 但 recent_draws 表可能沒有正確同步\n');

console.log('3. 數據同步問題：');
console.log('   - game_state 表的 current_period 是正確的');
console.log('   - 但 recent_draws 表可能存儲了錯誤的期號\n');

console.log('解決方案：');
console.log('1. 檢查並統一時區處理');
console.log('2. 確保 recent_draws 表與 game_state 表同步');
console.log('3. 修復任何數據不一致的問題\n');

console.log('建議的檢查步驟：');
console.log('1. 檢查伺服器時間和時區設置');
console.log('2. 檢查 recent_draws 表的數據插入邏輯');
console.log('3. 檢查是否有觸發器或其他機制在修改期號');
console.log('4. 查看最近的開獎記錄，確認期號序列是否連續');