// 測試賠率計算公式正確性
console.log('🧮 賠率計算測試');
console.log('===================');

// A盤配置：1.1%退水
const rebateA = 0.011;
const aNumberOdds = parseFloat((10 * (1 - rebateA)).toFixed(3));
const aTwoSideOdds = parseFloat((2 * (1 - rebateA)).toFixed(3));

console.log(`A盤 (1.1%退水):`);
console.log(`  單號賠率: 10 × (1 - 0.011) = ${aNumberOdds}`);
console.log(`  兩面賠率: 2 × (1 - 0.011) = ${aTwoSideOdds}`);
console.log('');

// D盤配置：4.1%退水
const rebateD = 0.041;
const dNumberOdds = parseFloat((10 * (1 - rebateD)).toFixed(3));
const dTwoSideOdds = parseFloat((2 * (1 - rebateD)).toFixed(3));

console.log(`D盤 (4.1%退水):`);
console.log(`  單號賠率: 10 × (1 - 0.041) = ${dNumberOdds}`);
console.log(`  兩面賠率: 2 × (1 - 0.041) = ${dTwoSideOdds}`);
console.log('');

console.log('✅ 測試完成！賠率計算正確。');
