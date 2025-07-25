// 分析336期的權重計算邏輯

console.log('🔍 分析336期權重計算邏輯\n');

// 模擬336期的情況
const control = {
    control_percentage: 90, // 90%輸控制
    loss_control: true,
    win_control: false
};

const userBets = [2, 3, 4, 5, 6, 7, 8, 9, 10]; // 用戶下注的號碼（第8名位置）
const notBetNumbers = [1]; // 用戶沒下注的號碼

console.log('📊 下注情況:');
console.log(`  下注號碼: ${userBets.join(', ')}`);
console.log(`  未下注號碼: ${notBetNumbers.join(', ')}`);
console.log(`  下注覆蓋率: ${userBets.length}/10 = ${userBets.length * 10}%\n`);

console.log('🎮 控制設定:');
console.log(`  控制模式: 輸控制`);
console.log(`  控制百分比: ${control.control_percentage}%`);
console.log(`  理論中獎率: ${100 - control.control_percentage}% = 10%\n`);

// 計算權重
console.log('📈 權重計算過程:');
const finalControlFactor = control.control_percentage / 100; // 0.9
const k = 6; // 指數放大係數
const exponentialFactor = Math.exp(-k * finalControlFactor); // e^(-5.4) ≈ 0.0045

const targetCount = userBets.length; // 9個目標號碼
const nonTargetCount = 10 - targetCount; // 1個非目標號碼
const winProbability = 1 - finalControlFactor; // 0.1 (10%中獎率)

console.log(`  最終控制係數: ${finalControlFactor}`);
console.log(`  指數因子: e^(-${k} * ${finalControlFactor}) = ${exponentialFactor.toFixed(4)}`);
console.log(`  目標號碼數: ${targetCount}`);
console.log(`  非目標號碼數: ${nonTargetCount}`);
console.log(`  理論中獎機率: ${(winProbability * 100).toFixed(1)}%\n`);

// 計算各號碼權重
const baseWeight = (winProbability * nonTargetCount) / ((1 - winProbability) * Math.max(targetCount, 1));
const targetWeight = baseWeight * exponentialFactor;

console.log('⚖️ 權重結果:');
console.log(`  基礎權重: ${baseWeight.toFixed(6)}`);
console.log(`  下注號碼權重: ${targetWeight.toFixed(6)}`);
console.log(`  未下注號碼權重: 1.0 (標準權重)\n`);

// 計算實際中獎機率
const totalWeight = targetWeight * targetCount + 1.0 * nonTargetCount;
const actualWinProbability = (targetWeight * targetCount) / totalWeight;
const actualLoseProbability = (1.0 * nonTargetCount) / totalWeight;

console.log('📊 實際機率計算:');
console.log(`  總權重: ${targetWeight.toFixed(6)} * ${targetCount} + 1.0 * ${nonTargetCount} = ${totalWeight.toFixed(6)}`);
console.log(`  實際中獎機率: ${(actualWinProbability * 100).toFixed(2)}%`);
console.log(`  實際輸機率: ${(actualLoseProbability * 100).toFixed(2)}%\n`);

console.log('💡 分析結論:');
console.log('1. 雖然設定90%輸控制，但用戶下注了9個號碼');
console.log('2. 系統將9個下注號碼的權重降到極低（0.000056）');
console.log('3. 未下注的1號權重保持1.0');
console.log('4. 但因為只有1個號碼可選，實際輸的機率仍然很低');
console.log('5. 這種情況下，控制系統效果有限\n');

console.log('🎯 實際開獎結果: 第8名開出3號（用戶下注的號碼）');
console.log('✅ 用戶中獎，獲利89元');
console.log('\n📝 建議: 要有效測試控制系統，應該下注較少的號碼（如1-3個），這樣系統才有足夠的空間執行控制');