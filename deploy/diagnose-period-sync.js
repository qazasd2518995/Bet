// 诊断期号同步问题

console.log('=== 期号同步问题诊断 ===\n');

console.log('问题症状：');
console.log('- 主画面显示: 202507241372 (07/24 第1372期)');
console.log('- 近期开奖显示: 07/25 214期');
console.log('- 日期相差一天，序号相差很大\n');

console.log('可能的原因：');
console.log('1. 时区问题：');
console.log('   - 伺服器可能使用 UTC 时间');
console.log('   - 前端使用本地时间（台北时间 UTC+8）');
console.log('   - 导致在台北时间凌晨到早上7点之间，日期不一致\n');

console.log('2. 期号重置逻辑问题：');
console.log('   - 后端 getNextPeriod 函数在早上7点重置期号');
console.log('   - 但 recent_draws 表可能没有正确同步\n');

console.log('3. 数据同步问题：');
console.log('   - game_state 表的 current_period 是正确的');
console.log('   - 但 recent_draws 表可能存储了错误的期号\n');

console.log('解决方案：');
console.log('1. 检查并统一时区处理');
console.log('2. 确保 recent_draws 表与 game_state 表同步');
console.log('3. 修复任何数据不一致的问题\n');

console.log('建议的检查步骤：');
console.log('1. 检查伺服器时间和时区设置');
console.log('2. 检查 recent_draws 表的数据插入逻辑');
console.log('3. 检查是否有触发器或其他机制在修改期号');
console.log('4. 查看最近的开奖记录，确认期号序列是否连续');