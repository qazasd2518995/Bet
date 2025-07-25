// check-batch-bet-transformation.js - 检查批量投注的参数转换

// 模拟前端发送的数据
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

console.log('前端发送的数据格式:');
console.log(JSON.stringify(frontendBets, null, 2));

// 检查 optimized-betting-system.js 中的处理
console.log('\n在 optimized-betting-system.js 中:');
frontendBets.forEach((bet, index) => {
  console.log(`\n投注 ${index + 1}:`);
  console.log(`  bet.betType = "${bet.betType}" (应该映射到 bet_type)`);
  console.log(`  bet.value = "${bet.value}" (应该映射到 bet_value)`);
  console.log(`  bet.position = ${bet.position}`);
  
  // 模拟 SQL 字符串插值
  const sqlValue = `('username', 20250718999, '${bet.betType}', '${bet.value}', ${bet.position || 'NULL'}, ${bet.amount}, 9.89, false, 0, false, NOW())`;
  console.log(`  SQL 插值结果: ${sqlValue}`);
  
  // 如果使用正确的栏位名称
  const correctSqlValue = `('username', 20250718999, '${bet.bet_type || bet.betType}', '${bet.bet_value || bet.value}', ${bet.position || 'NULL'}, ${bet.amount}, 9.89, false, 0, false, NOW())`;
  console.log(`  正确的 SQL: ${correctSqlValue}`);
});

console.log('\n问题诊断:');
console.log('1. 前端发送: betType, value, position');
console.log('2. 资料库栏位: bet_type, bet_value, position');
console.log('3. optimized-betting-system.js 直接使用 bet.betType 和 bet.value');
console.log('4. 这应该会导致 SQL 插入 "undefined" 值，但实际上没有发生');
console.log('\n可能的原因:');
console.log('- 可能有其他地方在调用 optimizedBatchBet 之前进行了参数转换');
console.log('- 或者系统没有使用 optimized-betting-system.js，而是使用其他的批量投注逻辑');
console.log('- 或者 SQL 字符串插值时，undefined 被转换成了正确的值');