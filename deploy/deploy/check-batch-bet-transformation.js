// check-batch-bet-transformation.js - 檢查批量投注的參數轉換

// 模擬前端發送的數據
const frontendBets = [
  {
    betType: 'number',
    value: '5',
    position: 6,
    amount: 10
  },
  {
    betType: 'champion',
    value: 'big',
    position: null,
    amount: 20
  }
];

console.log('前端發送的數據格式:');
console.log(JSON.stringify(frontendBets, null, 2));

// 檢查 optimized-betting-system.js 中的處理
console.log('\n在 optimized-betting-system.js 中:');
frontendBets.forEach((bet, index) => {
  console.log(`\n投注 ${index + 1}:`);
  console.log(`  bet.betType = "${bet.betType}" (應該映射到 bet_type)`);
  console.log(`  bet.value = "${bet.value}" (應該映射到 bet_value)`);
  console.log(`  bet.position = ${bet.position}`);
  
  // 模擬 SQL 字符串插值
  const sqlValue = `('username', 20250718999, '${bet.betType}', '${bet.value}', ${bet.position || 'NULL'}, ${bet.amount}, 9.89, false, 0, false, NOW())`;
  console.log(`  SQL 插值結果: ${sqlValue}`);
  
  // 如果使用正確的欄位名稱
  const correctSqlValue = `('username', 20250718999, '${bet.bet_type || bet.betType}', '${bet.bet_value || bet.value}', ${bet.position || 'NULL'}, ${bet.amount}, 9.89, false, 0, false, NOW())`;
  console.log(`  正確的 SQL: ${correctSqlValue}`);
});

console.log('\n問題診斷:');
console.log('1. 前端發送: betType, value, position');
console.log('2. 資料庫欄位: bet_type, bet_value, position');
console.log('3. optimized-betting-system.js 直接使用 bet.betType 和 bet.value');
console.log('4. 這應該會導致 SQL 插入 "undefined" 值，但實際上沒有發生');
console.log('\n可能的原因:');
console.log('- 可能有其他地方在調用 optimizedBatchBet 之前進行了參數轉換');
console.log('- 或者系統沒有使用 optimized-betting-system.js，而是使用其他的批量投注邏輯');
console.log('- 或者 SQL 字符串插值時，undefined 被轉換成了正確的值');