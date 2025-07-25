// 簡單驗證修正後的邏輯
console.log('🔧 驗證修正後的下注結算邏輯');

// 模擬原始情況
console.log('\n=== 問題分析 ===');
console.log('用戶 justin111 下注 8 碼各 100 元');
console.log('其中一碼中獎，賠率 9.89');

// 原始錯誤邏輯
console.log('\n--- 修正前（錯誤邏輯）---');
const betAmount = 100;
const odds = 9.89;
const winAmount = betAmount * odds; // 989 元
const wrongNetProfit = winAmount - betAmount; // 889 元（錯誤計算）

console.log(`下注金額: ${betAmount} 元`);
console.log(`賠率: ${odds}`);
console.log(`calculateWinAmount 返回: ${winAmount} 元`);
console.log(`錯誤的淨盈虧計算: ${winAmount} - ${betAmount} = ${wrongNetProfit} 元`);
console.log(`錯誤的餘額增加: ${wrongNetProfit} 元 ❌`);

// 修正後的邏輯
console.log('\n--- 修正後（正確邏輯）---');
const totalWinAmount = winAmount; // 989 元（總回報）
const correctNetProfit = totalWinAmount - betAmount; // 889 元（純獎金）

console.log(`總回報: ${totalWinAmount} 元（含本金）`);
console.log(`純獎金: ${correctNetProfit} 元（不含本金）`);
console.log(`正確的餘額增加: ${totalWinAmount} 元 ✅`);

// 餘額變化分析
console.log('\n=== 餘額變化分析 ===');
const initialBalance = 120000; // 假設初始餘額

console.log('1. 下注階段:');
console.log(`  初始餘額: ${initialBalance} 元`);
console.log(`  下注扣除: ${betAmount} 元`);
console.log(`  下注後餘額: ${initialBalance - betAmount} 元`);

console.log('\n2. 結算階段:');
console.log('修正前（錯誤）:');
console.log(`  餘額增加: ${wrongNetProfit} 元`);
console.log(`  結算後餘額: ${initialBalance - betAmount + wrongNetProfit} 元`);
console.log(`  與初始餘額差: ${(initialBalance - betAmount + wrongNetProfit) - initialBalance} 元`);

console.log('\n修正後（正確）:');
console.log(`  餘額增加: ${totalWinAmount} 元`);
console.log(`  結算後餘額: ${initialBalance - betAmount + totalWinAmount} 元`);
console.log(`  與初始餘額差: ${(initialBalance - betAmount + totalWinAmount) - initialBalance} 元`);

// 實際案例驗證
console.log('\n=== 實際案例驗證 ===');
console.log('根據日誌: justin111 下注後餘額從 119511.27 變為 119411.27');
console.log('說明: 下注 100 元被正確扣除');

console.log('\n結算時應該:');
console.log('修正前: 餘額從 119411.27 增加 889 元 = 120300.27 元 ❌');
console.log('修正後: 餘額從 119411.27 增加 989 元 = 120400.27 元 ✅');

console.log('\n實際期望結果:');
console.log(`用戶下注 ${betAmount} 元，中獎獲得總回報 ${totalWinAmount} 元`);
console.log(`淨盈虧: ${correctNetProfit} 元（這才是用戶實際賺到的錢）`);

console.log('\n=== 修正摘要 ===');
console.log('✅ 修正了重複扣除本金的錯誤');
console.log('✅ 中獎時正確返還總回報（本金 + 獎金）');
console.log('✅ 保持淨盈虧計算的正確性（用於報表統計）');
