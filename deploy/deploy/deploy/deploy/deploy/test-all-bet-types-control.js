// test-all-bet-types-control.js - 測試所有投注類型的贏輸控制
import fixedDrawSystemManager from './fixed-draw-system.js';

console.log('測試所有投注類型的贏輸控制支援...\n');

// 測試1: 號碼投注控制
console.log('=== 測試1: 號碼投注控制 ===');
const numberBets = [
    { betType: 'number', betValue: '3', position: '1', amount: 100 },
    { betType: 'number', betValue: '7', position: '5', amount: 100 }
];

console.log('贏控制測試:');
const winResult1 = fixedDrawSystemManager.generateWinningResultFixed(numberBets, {});
console.log(`結果: ${winResult1.join(', ')}`);
console.log(`第1名是否為3: ${winResult1[0] === 3}`);
console.log(`第5名是否為7: ${winResult1[4] === 7}`);

console.log('\n輸控制測試:');
const loseResult1 = fixedDrawSystemManager.generateLosingResultFixed(numberBets, {});
console.log(`結果: ${loseResult1.join(', ')}`);
console.log(`第1名是否不為3: ${loseResult1[0] !== 3}`);
console.log(`第5名是否不為7: ${loseResult1[4] !== 7}`);

// 測試2: 位置大小單雙投注控制
console.log('\n=== 測試2: 位置大小單雙投注控制 ===');
const twoSidesBets = [
    { betType: 'champion', betValue: 'big', amount: 100 },
    { betType: 'champion', betValue: 'odd', amount: 100 },
    { betType: '亞軍', betValue: '小', amount: 100 },
    { betType: '亞軍', betValue: '雙', amount: 100 }
];

console.log('贏控制測試:');
const winResult2 = fixedDrawSystemManager.generateWinningResultFixed(twoSidesBets, {});
console.log(`結果: ${winResult2.join(', ')}`);
console.log(`冠軍${winResult2[0]}是否為大(≥6): ${winResult2[0] >= 6}`);
console.log(`冠軍${winResult2[0]}是否為單: ${winResult2[0] % 2 === 1}`);
console.log(`亞軍${winResult2[1]}是否為小(≤5): ${winResult2[1] <= 5}`);
console.log(`亞軍${winResult2[1]}是否為雙: ${winResult2[1] % 2 === 0}`);

console.log('\n輸控制測試:');
const loseResult2 = fixedDrawSystemManager.generateLosingResultFixed(twoSidesBets, {});
console.log(`結果: ${loseResult2.join(', ')}`);
console.log(`冠軍${loseResult2[0]}是否不符合大單: ${!(loseResult2[0] >= 6 && loseResult2[0] % 2 === 1)}`);
console.log(`亞軍${loseResult2[1]}是否不符合小雙: ${!(loseResult2[1] <= 5 && loseResult2[1] % 2 === 0)}`);

// 測試3: 冠亞和投注控制
console.log('\n=== 測試3: 冠亞和投注控制 ===');
const sumBets = [
    { betType: 'sum', betValue: '15', amount: 100 }, // 和值15
    { betType: '冠亞和', betValue: 'big', amount: 100 }, // 和值大
    { betType: '冠亞和', betValue: 'odd', amount: 100 }  // 和值單
];

console.log('贏控制測試:');
const winResult3 = fixedDrawSystemManager.generateWinningResultFixed(sumBets, {});
const sum3 = winResult3[0] + winResult3[1];
console.log(`結果: ${winResult3.join(', ')}`);
console.log(`冠亞和: ${winResult3[0]} + ${winResult3[1]} = ${sum3}`);
console.log(`和值是否為15: ${sum3 === 15}`);
console.log(`和值是否為大(≥12): ${sum3 >= 12}`);
console.log(`和值是否為單: ${sum3 % 2 === 1}`);

console.log('\n輸控制測試:');
const loseResult3 = fixedDrawSystemManager.generateLosingResultFixed(sumBets, {});
const loseSum3 = loseResult3[0] + loseResult3[1];
console.log(`結果: ${loseResult3.join(', ')}`);
console.log(`冠亞和: ${loseResult3[0]} + ${loseResult3[1]} = ${loseSum3}`);
console.log(`和值是否不為15: ${loseSum3 !== 15}`);

// 測試4: 龍虎投注控制
console.log('\n=== 測試4: 龍虎投注控制 ===');
const dragonTigerBets = [
    { betType: 'dragon_tiger', betValue: 'dragon_1_10', amount: 100 }, // 1位龍贏10位
    { betType: '龍虎', betValue: 'tiger_3_8', amount: 100 }  // 3位虎贏8位(即8位大於3位)
];

console.log('贏控制測試:');
const winResult4 = fixedDrawSystemManager.generateWinningResultFixed(dragonTigerBets, {});
console.log(`結果: ${winResult4.join(', ')}`);
console.log(`第1名(${winResult4[0]}) vs 第10名(${winResult4[9]}): 龍${winResult4[0] > winResult4[9] ? '贏' : '輸'}`);
console.log(`第3名(${winResult4[2]}) vs 第8名(${winResult4[7]}): 虎${winResult4[2] < winResult4[7] ? '贏' : '輸'}`);

console.log('\n輸控制測試:');
const loseResult4 = fixedDrawSystemManager.generateLosingResultFixed(dragonTigerBets, {});
console.log(`結果: ${loseResult4.join(', ')}`);
console.log(`第1名(${loseResult4[0]}) vs 第10名(${loseResult4[9]}): 龍${loseResult4[0] > loseResult4[9] ? '贏' : '輸'} (應該輸)`);
console.log(`第3名(${loseResult4[2]}) vs 第8名(${loseResult4[7]}): 虎${loseResult4[2] < loseResult4[7] ? '贏' : '輸'} (應該輸)`);

// 測試5: 混合投注控制
console.log('\n=== 測試5: 混合投注控制 ===');
const mixedBets = [
    { betType: 'champion', betValue: 'small', amount: 100 },
    { betType: 'number', betValue: '3', position: '2', amount: 100 },
    { betType: 'sum', betValue: 'small', amount: 100 },
    { betType: 'dragon_tiger', betValue: 'dragon_4_6', amount: 100 }
];

console.log('贏控制測試:');
const winResult5 = fixedDrawSystemManager.generateWinningResultFixed(mixedBets, {});
const sum5 = winResult5[0] + winResult5[1];
console.log(`結果: ${winResult5.join(', ')}`);
console.log(`冠軍${winResult5[0]}是否為小: ${winResult5[0] <= 5}`);
console.log(`第2名是否為3: ${winResult5[1] === 3}`);
console.log(`冠亞和${sum5}是否為小: ${sum5 <= 11}`);
console.log(`第4名(${winResult5[3]}) vs 第6名(${winResult5[5]}): 龍${winResult5[3] > winResult5[5] ? '贏' : '輸'}`);

console.log('\n輸控制測試:');
const loseResult5 = fixedDrawSystemManager.generateLosingResultFixed(mixedBets, {});
const loseSum5 = loseResult5[0] + loseResult5[1];
console.log(`結果: ${loseResult5.join(', ')}`);
console.log(`冠軍${loseResult5[0]}是否不為小: ${loseResult5[0] > 5}`);
console.log(`第2名是否不為3: ${loseResult5[1] !== 3}`);

console.log('\n✅ 測試完成！');