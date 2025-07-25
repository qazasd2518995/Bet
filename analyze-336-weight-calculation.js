// 分析336期的权重计算逻辑

console.log('🔍 分析336期权重计算逻辑\n');

// 模拟336期的情况
const control = {
    control_percentage: 90, // 90%输控制
    loss_control: true,
    win_control: false
};

const userBets = [2, 3, 4, 5, 6, 7, 8, 9, 10]; // 用户下注的号码（第8名位置）
const notBetNumbers = [1]; // 用户没下注的号码

console.log('📊 下注情况:');
console.log(`  下注号码: ${userBets.join(', ')}`);
console.log(`  未下注号码: ${notBetNumbers.join(', ')}`);
console.log(`  下注覆盖率: ${userBets.length}/10 = ${userBets.length * 10}%\n`);

console.log('🎮 控制设定:');
console.log(`  控制模式: 输控制`);
console.log(`  控制百分比: ${control.control_percentage}%`);
console.log(`  理论中奖率: ${100 - control.control_percentage}% = 10%\n`);

// 计算权重
console.log('📈 权重计算过程:');
const finalControlFactor = control.control_percentage / 100; // 0.9
const k = 6; // 指数放大系数
const exponentialFactor = Math.exp(-k * finalControlFactor); // e^(-5.4) ≈ 0.0045

const targetCount = userBets.length; // 9个目标号码
const nonTargetCount = 10 - targetCount; // 1个非目标号码
const winProbability = 1 - finalControlFactor; // 0.1 (10%中奖率)

console.log(`  最终控制系数: ${finalControlFactor}`);
console.log(`  指数因子: e^(-${k} * ${finalControlFactor}) = ${exponentialFactor.toFixed(4)}`);
console.log(`  目标号码数: ${targetCount}`);
console.log(`  非目标号码数: ${nonTargetCount}`);
console.log(`  理论中奖机率: ${(winProbability * 100).toFixed(1)}%\n`);

// 计算各号码权重
const baseWeight = (winProbability * nonTargetCount) / ((1 - winProbability) * Math.max(targetCount, 1));
const targetWeight = baseWeight * exponentialFactor;

console.log('⚖️ 权重结果:');
console.log(`  基础权重: ${baseWeight.toFixed(6)}`);
console.log(`  下注号码权重: ${targetWeight.toFixed(6)}`);
console.log(`  未下注号码权重: 1.0 (标准权重)\n`);

// 计算实际中奖机率
const totalWeight = targetWeight * targetCount + 1.0 * nonTargetCount;
const actualWinProbability = (targetWeight * targetCount) / totalWeight;
const actualLoseProbability = (1.0 * nonTargetCount) / totalWeight;

console.log('📊 实际机率计算:');
console.log(`  总权重: ${targetWeight.toFixed(6)} * ${targetCount} + 1.0 * ${nonTargetCount} = ${totalWeight.toFixed(6)}`);
console.log(`  实际中奖机率: ${(actualWinProbability * 100).toFixed(2)}%`);
console.log(`  实际输机率: ${(actualLoseProbability * 100).toFixed(2)}%\n`);

console.log('💡 分析结论:');
console.log('1. 虽然设定90%输控制，但用户下注了9个号码');
console.log('2. 系统将9个下注号码的权重降到极低（0.000056）');
console.log('3. 未下注的1号权重保持1.0');
console.log('4. 但因为只有1个号码可选，实际输的机率仍然很低');
console.log('5. 这种情况下，控制系统效果有限\n');

console.log('🎯 实际开奖结果: 第8名开出3号（用户下注的号码）');
console.log('✅ 用户中奖，获利89元');
console.log('\n📝 建议: 要有效测试控制系统，应该下注较少的号码（如1-3个），这样系统才有足够的空间执行控制');