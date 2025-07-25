// 測試退水邏輯修正
console.log('=== 退水邏輯測試 ===');

// 模擬代理鏈數據
const agentChain = [
  { username: 'justin2025A', level: 1, rebate_percentage: 0.005, market_type: 'A' }, // 0.5%
  { username: 'ti2025A', level: 0, rebate_percentage: 0.010, market_type: 'A' }      // 1.0%
];

const betAmount = 1000; // 下注金額
const maxRebatePercentage = 0.011; // A盤1.1%
const totalRebatePool = betAmount * maxRebatePercentage; // 11元

console.log(`下注金額: ${betAmount}`);
console.log(`最大退水比例: ${(maxRebatePercentage*100).toFixed(1)}%`);
console.log(`總退水池: ${totalRebatePool.toFixed(2)} 元`);
console.log(`代理鏈: ${agentChain.map(a => `${a.username}(${(a.rebate_percentage*100).toFixed(1)}%)`).join(' -> ')}`);

// 模擬修正後的分配邏輯
let remainingRebate = totalRebatePool;
let distributedPercentage = 0;

console.log('\n=== 分配過程 ===');
for (let i = 0; i < agentChain.length; i++) {
  const agent = agentChain[i];
  let agentRebateAmount = 0;
  
  const rebatePercentage = parseFloat(agent.rebate_percentage);
  
  if (rebatePercentage <= 0) {
    console.log(`代理 ${agent.username} 退水比例為 ${(rebatePercentage*100).toFixed(1)}%，不拿任何退水`);
  } else {
    // 計算該代理實際能拿的退水比例（不能超過已分配的）
    const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
    
    if (actualRebatePercentage <= 0) {
      console.log(`代理 ${agent.username} 退水比例 ${(rebatePercentage*100).toFixed(1)}% 已被下級分完，不能再獲得退水`);
      agentRebateAmount = 0;
    } else {
      // 計算該代理實際獲得的退水金額
      agentRebateAmount = betAmount * actualRebatePercentage;
      // 確保不超過剩餘退水池
      agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
      // 四捨五入到小數點後2位
      agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
      remainingRebate -= agentRebateAmount;
      distributedPercentage += actualRebatePercentage;
      
      console.log(`代理 ${agent.username}:`);
      console.log(`  - 設定退水比例: ${(rebatePercentage*100).toFixed(1)}%`);
      console.log(`  - 實際可拿比例: ${(actualRebatePercentage*100).toFixed(1)}%`);
      console.log(`  - 獲得退水金額: ${agentRebateAmount.toFixed(2)} 元`);
      console.log(`  - 剩餘池額: ${remainingRebate.toFixed(2)} 元`);
    }
  }
}

console.log('\n=== 分配結果 ===');
console.log(`總池: ${totalRebatePool.toFixed(2)} 元`);
console.log(`已分配: ${(totalRebatePool - remainingRebate).toFixed(2)} 元`);
console.log(`平台保留: ${remainingRebate.toFixed(2)} 元`);

console.log('\n=== 期望結果 ===');
console.log('justin2025A 應該獲得: 1000 × 0.5% = 5.00 元');
console.log('ti2025A 應該獲得: 1000 × (1.0% - 0.5%) = 5.00 元');
console.log('平台保留: 11 - 5 - 5 = 1.00 元');
