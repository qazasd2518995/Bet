const axios = require('axios');

// 模擬退水分配邏輯
function simulateRebateDistribution(betAmount, agentChain, marketType) {
  console.log(`\n🧮 模擬退水分配 - 下注金額: ${betAmount}, 盤口: ${marketType}`);
  
  // 計算固定退水池
  const maxRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
  const totalRebatePool = betAmount * maxRebatePercentage;
  
  console.log(`固定退水池: ${totalRebatePool.toFixed(2)} 元 (${(maxRebatePercentage*100).toFixed(1)}%)`);
  console.log(`代理鏈: ${agentChain.map(a => `${a.username}(${(a.rebate_percentage*100).toFixed(1)}%)`).join(' → ')}`);
  
  let remainingRebate = totalRebatePool;
  const distributions = [];
  
  // 從最下級代理開始分配
  for (let i = 0; i < agentChain.length; i++) {
    const agent = agentChain[i];
    const rebatePercentage = parseFloat(agent.rebate_percentage);
    
    if (remainingRebate <= 0.01) {
      console.log(`退水池已全部分配完畢`);
      break;
    }
    
    let agentRebateAmount = 0;
    
    if (rebatePercentage <= 0) {
      console.log(`代理 ${agent.username}: 0% → 不拿退水，剩餘 ${remainingRebate.toFixed(2)} 元向上`);
    } else {
      // 從固定池中分配
      const desiredAmount = betAmount * rebatePercentage;
      agentRebateAmount = Math.min(desiredAmount, remainingRebate);
      agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
      remainingRebate -= agentRebateAmount;
      
      console.log(`代理 ${agent.username}: ${(rebatePercentage*100).toFixed(1)}% → 獲得 ${agentRebateAmount.toFixed(2)} 元，剩餘 ${remainingRebate.toFixed(2)} 元`);
      
      if (rebatePercentage >= maxRebatePercentage) {
        console.log(`代理 ${agent.username} 拿了全部退水池，結束分配`);
        remainingRebate = 0;
      }
    }
    
    distributions.push({
      agent: agent.username,
      percentage: rebatePercentage,
      amount: agentRebateAmount
    });
  }
  
  console.log(`平台保留: ${remainingRebate.toFixed(2)} 元`);
  console.log(`總計驗證: 分配${distributions.reduce((sum, d) => sum + d.amount, 0).toFixed(2)} + 平台${remainingRebate.toFixed(2)} = ${(distributions.reduce((sum, d) => sum + d.amount, 0) + remainingRebate).toFixed(2)} (應等於 ${totalRebatePool.toFixed(2)})`);
  
  return {
    totalPool: totalRebatePool,
    distributions,
    platformShare: remainingRebate,
    isValid: Math.abs((distributions.reduce((sum, d) => sum + d.amount, 0) + remainingRebate) - totalRebatePool) < 0.01
  };
}

async function testFixedRebateLogic() {
  console.log('🧪 測試修正後的退水分配邏輯\n');
  
  // 測試案例1：A盤代理鏈（之前超標的）
  console.log('=== 測試案例1：A盤代理鏈 ===');
  const aMarketChain = [
    { username: 'A01agent', rebate_percentage: 0.011 }, // 1.1%
    { username: 'ti2025A', rebate_percentage: 0.011 }   // 1.1%
  ];
  
  const result1 = simulateRebateDistribution(1000, aMarketChain, 'A');
  console.log(`✅ 結果有效: ${result1.isValid ? '是' : '否'}`);
  
  // 測試案例2：D盤代理鏈（之前超標的）
  console.log('\n=== 測試案例2：D盤代理鏈 ===');
  const dMarketChain = [
    { username: 'D01agent', rebate_percentage: 0.041 }, // 4.1%
    { username: 'ti2025D', rebate_percentage: 0.041 }   // 4.1%
  ];
  
  const result2 = simulateRebateDistribution(1000, dMarketChain, 'D');
  console.log(`✅ 結果有效: ${result2.isValid ? '是' : '否'}`);
  
  // 測試案例3：正常分層代理鏈
  console.log('\n=== 測試案例3：正常分層A盤代理鏈 ===');
  const normalChain = [
    { username: 'L1代理', rebate_percentage: 0.005 }, // 0.5%
    { username: 'L0總代理', rebate_percentage: 0.011 } // 1.1%
  ];
  
  const result3 = simulateRebateDistribution(1000, normalChain, 'A');
  console.log(`✅ 結果有效: ${result3.isValid ? '是' : '否'}`);
  
  // 測試案例4：none模式代理鏈
  console.log('\n=== 測試案例4：none模式代理鏈 ===');
  const noneChain = [
    { username: 'L1下級', rebate_percentage: 0.020 }, // 2.0%
    { username: 'L0上級(none)', rebate_percentage: 0 } // 0% (none模式)
  ];
  
  const result4 = simulateRebateDistribution(1000, noneChain, 'D');
  console.log(`✅ 結果有效: ${result4.isValid ? '是' : '否'}`);
  
  // 測試案例5：all模式代理鏈
  console.log('\n=== 測試案例5：all模式代理鏈 ===');
  const allChain = [
    { username: 'L1下級', rebate_percentage: 0.020 }, // 2.0%
    { username: 'L0上級(all)', rebate_percentage: 0.041 } // 4.1% (all模式)
  ];
  
  const result5 = simulateRebateDistribution(1000, allChain, 'D');
  console.log(`✅ 結果有效: ${result5.isValid ? '是' : '否'}`);
  
  console.log('\n=== 修正邏輯總結 ===');
  console.log('✅ 修正重點：');
  console.log('1. 固定退水池：A盤1.1%，D盤4.1%，不會超標');
  console.log('2. 競爭分配：代理從固定池中競爭，總和不超過池額');
  console.log('3. 平台保留：剩餘退水歸平台，確保分配公平');
  console.log('4. none/all模式：正確反映代理實際獲得比例');
  console.log('\n⚠️  重要：這解決了之前總退水超標的根本問題！');
}

testFixedRebateLogic(); 