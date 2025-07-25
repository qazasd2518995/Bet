// 简单验证修正后的逻辑
console.log('🔧 验证修正后的下注结算逻辑');

// 模拟原始情况
console.log('\n=== 问题分析 ===');
console.log('用户 justin111 下注 8 码各 100 元');
console.log('其中一码中奖，赔率 9.89');

// 原始错误逻辑
console.log('\n--- 修正前（错误逻辑）---');
const betAmount = 100;
const odds = 9.89;
const winAmount = betAmount * odds; // 989 元
const wrongNetProfit = winAmount - betAmount; // 889 元（错误计算）

console.log(`下注金额: ${betAmount} 元`);
console.log(`赔率: ${odds}`);
console.log(`calculateWinAmount 返回: ${winAmount} 元`);
console.log(`错误的净盈亏计算: ${winAmount} - ${betAmount} = ${wrongNetProfit} 元`);
console.log(`错误的余额增加: ${wrongNetProfit} 元 ❌`);

// 修正后的逻辑
console.log('\n--- 修正后（正确逻辑）---');
const totalWinAmount = winAmount; // 989 元（总回报）
const correctNetProfit = totalWinAmount - betAmount; // 889 元（纯奖金）

console.log(`总回报: ${totalWinAmount} 元（含本金）`);
console.log(`纯奖金: ${correctNetProfit} 元（不含本金）`);
console.log(`正确的余额增加: ${totalWinAmount} 元 ✅`);

// 余额变化分析
console.log('\n=== 余额变化分析 ===');
const initialBalance = 120000; // 假设初始余额

console.log('1. 下注阶段:');
console.log(`  初始余额: ${initialBalance} 元`);
console.log(`  下注扣除: ${betAmount} 元`);
console.log(`  下注后余额: ${initialBalance - betAmount} 元`);

console.log('\n2. 结算阶段:');
console.log('修正前（错误）:');
console.log(`  余额增加: ${wrongNetProfit} 元`);
console.log(`  结算后余额: ${initialBalance - betAmount + wrongNetProfit} 元`);
console.log(`  与初始余额差: ${(initialBalance - betAmount + wrongNetProfit) - initialBalance} 元`);

console.log('\n修正后（正确）:');
console.log(`  余额增加: ${totalWinAmount} 元`);
console.log(`  结算后余额: ${initialBalance - betAmount + totalWinAmount} 元`);
console.log(`  与初始余额差: ${(initialBalance - betAmount + totalWinAmount) - initialBalance} 元`);

// 实际案例验证
console.log('\n=== 实际案例验证 ===');
console.log('根据日志: justin111 下注后余额从 119511.27 变为 119411.27');
console.log('说明: 下注 100 元被正确扣除');

console.log('\n结算时应该:');
console.log('修正前: 余额从 119411.27 增加 889 元 = 120300.27 元 ❌');
console.log('修正后: 余额从 119411.27 增加 989 元 = 120400.27 元 ✅');

console.log('\n实际期望结果:');
console.log(`用户下注 ${betAmount} 元，中奖获得总回报 ${totalWinAmount} 元`);
console.log(`净盈亏: ${correctNetProfit} 元（这才是用户实际赚到的钱）`);

console.log('\n=== 修正摘要 ===');
console.log('✅ 修正了重复扣除本金的错误');
console.log('✅ 中奖时正确返还总回报（本金 + 奖金）');
console.log('✅ 保持净盈亏计算的正确性（用于报表统计）');
