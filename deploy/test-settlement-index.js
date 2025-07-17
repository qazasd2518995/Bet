// 測試結算系統的索引問題

// 模擬期號 546 的開獎結果
const drawResult546 = [2, 8, 4, 9, 1, 3, 7, 5, 6, 10];

console.log('=== 測試結算邏輯的索引問題 ===\n');
console.log('開獎結果:', drawResult546);
console.log('各名次:');
for (let i = 0; i < 10; i++) {
  console.log(`  第${i+1}名: ${drawResult546[i]}號`);
}

console.log('\n測試第2名的投注判定:');

// 模擬所有可能的投注
for (let betNumber = 1; betNumber <= 10; betNumber++) {
  const position = 2; // 第2名
  
  // 正確的判定方式：陣列索引 = 位置 - 1
  const winningNumber = drawResult546[position - 1];
  const isWin = betNumber === winningNumber;
  
  console.log(`投注${betNumber}號: ${isWin ? '中獎' : '未中'} (第${position}名開出${winningNumber})`);
}

console.log('\n\n=== 可能的錯誤原因 ===');
console.log('1. 如果使用了錯誤的索引（沒有 -1）:');
console.log(`   drawResult546[2] = ${drawResult546[2]} (應該是 ${drawResult546[1]})`);

console.log('\n2. 如果開獎結果的順序有問題:');
console.log('   檢查開獎結果是否真的代表 [第1名, 第2名, ..., 第10名]');

console.log('\n3. 如果結算時讀取了錯誤的值:');
console.log('   可能讀取了前一期或其他期的結果');

// 檢查號碼7在哪個位置
const position7 = drawResult546.indexOf(7) + 1;
console.log(`\n號碼7實際在第${position7}名`);
console.log('如果投注第2名號碼7中獎，可能是把號碼當成了位置');

process.exit(0);