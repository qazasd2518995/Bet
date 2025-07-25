// 測試退水計算邏輯

console.log('=== 測試退水計算邏輯 ===\n');

// 模擬代理鏈數據
const agentChain = [
  {
    id: 30,
    username: "justin2025A",
    level: 1,
    rebate_mode: "percentage",
    rebate_percentage: "0.0050",  // 0.5%
    max_rebate_percentage: "0.0110",
    market_type: "A"
  },
  {
    id: 28,
    username: "ti2025A",
    level: 0,
    rebate_mode: "percentage",
    rebate_percentage: "0.0110",  // 1.1%
    max_rebate_percentage: "0.0110",
    market_type: "A"
  }
];

// 測試參數
const betAmount = 1000;
const maxRebatePercentage = 0.011; // A盤 1.1%
const totalRebatePool = betAmount * maxRebatePercentage;

console.log(`下注金額: ${betAmount}`);
console.log(`最大退水比例: ${(maxRebatePercentage * 100).toFixed(1)}%`);
console.log(`總退水池: ${totalRebatePool} 元\n`);

// 模擬退水分配邏輯
let remainingRebate = totalRebatePool;
let distributedPercentage = 0;

console.log('開始分配退水：');
console.log('=' .repeat(50));

for (let i = 0; i < agentChain.length; i++) {
  const agent = agentChain[i];
  let agentRebateAmount = 0;
  
  // 檢查 rebate_percentage 的值
  console.log(`\n代理 ${agent.username}:`);
  console.log(`  原始 rebate_percentage: "${agent.rebate_percentage}"`);
  
  // 轉換為數字
  const rebatePercentage = parseFloat(agent.rebate_percentage);
  console.log(`  轉換後 rebatePercentage: ${rebatePercentage}`);
  console.log(`  百分比形式: ${(rebatePercentage * 100).toFixed(4)}%`);
  
  if (isNaN(rebatePercentage) || rebatePercentage <= 0) {
    console.log(`  退水比例為0，不拿退水`);
  } else {
    // 計算該代理實際能拿的退水比例
    const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
    console.log(`  實際退水比例: ${actualRebatePercentage} (${(actualRebatePercentage * 100).toFixed(4)}%)`);
    
    if (actualRebatePercentage <= 0) {
      console.log(`  退水比例已被下級分完`);
    } else {
      // 計算退水金額
      agentRebateAmount = betAmount * actualRebatePercentage;
      agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
      agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
      
      console.log(`  計算過程: ${betAmount} × ${actualRebatePercentage} = ${betAmount * actualRebatePercentage}`);
      console.log(`  退水金額: ${agentRebateAmount} 元`);
      
      remainingRebate -= agentRebateAmount;
      distributedPercentage += actualRebatePercentage;
      
      console.log(`  剩餘退水池: ${remainingRebate.toFixed(2)} 元`);
      console.log(`  已分配比例: ${(distributedPercentage * 100).toFixed(4)}%`);
    }
  }
}

console.log('\n' + '=' .repeat(50));
console.log('分配結果總結：');
console.log(`總退水池: ${totalRebatePool} 元`);
console.log(`已分配: ${(totalRebatePool - remainingRebate).toFixed(2)} 元`);
console.log(`剩餘: ${remainingRebate.toFixed(2)} 元`);

// 測試問題情況
console.log('\n\n=== 測試問題情況 ===');
console.log('如果 rebate_percentage 被錯誤地當作百分比處理：');

const wrongPercentage1 = 0.5 / 100;  // 0.5% 被當作 0.5 再除以 100
const wrongPercentage2 = 1.1 / 100;  // 1.1% 被當作 1.1 再除以 100

console.log(`justin2025A: ${betAmount} × ${wrongPercentage1} = ${(betAmount * wrongPercentage1).toFixed(2)} 元`);
console.log(`ti2025A: ${betAmount} × ${wrongPercentage2} = ${(betAmount * wrongPercentage2).toFixed(2)} 元`);
console.log(`總計: ${((betAmount * wrongPercentage1) + (betAmount * wrongPercentage2)).toFixed(2)} 元`);

console.log('\n這與實際發生的錯誤金額不符（0.05 + 0.11 = 0.16）');
console.log('實際錯誤可能是另一個計算問題');