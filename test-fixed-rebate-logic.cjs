// 修復後的退水分配邏輯測試

// 測試場景配置
const testScenarios = [
  {
    name: '場景1：代理B全拿，代理A不退水',
    agentChain: [
      { username: 'agentB', rebate_mode: 'all', rebate_percentage: 0.021 },      // B代理：全拿所有退水
      { username: 'agentA', rebate_mode: 'percentage', rebate_percentage: 0.041 } // A代理：設定4.1%，但B已全拿
    ],
    betAmount: 100,
    expected: {
      'agentB': 4.1,  // 全拿所有4.1%退水
      'agentA': 0     // 沒有剩餘退水
    }
  },
  {
    name: '場景2：代理B全退（none），代理A拿退水（percentage 4.1%）',
    agentChain: [
      { username: 'agentB', rebate_mode: 'none', rebate_percentage: 0 },          // B代理：全退給上級
      { username: 'agentA', rebate_mode: 'percentage', rebate_percentage: 0.041 } // A代理：拿4.1%
    ],
    betAmount: 100,
    expected: {
      'agentB': 0,    // 全退，不拿退水
      'agentA': 4.1   // 拿到全部4.1%退水
    }
  },
  {
    name: '場景3：代理B設定2%，代理A全拿剩餘',
    agentChain: [
      { username: 'agentB', rebate_mode: 'percentage', rebate_percentage: 0.02 }, // B代理：拿2%
      { username: 'agentA', rebate_mode: 'all', rebate_percentage: 0.041 }        // A代理：全拿剩餘
    ],
    betAmount: 100,
    expected: {
      'agentB': 2.0,  // 拿2%退水
      'agentA': 2.1   // 拿剩餘2.1%退水
    }
  },
  {
    name: '場景4：三級代理鏈複雜分配',
    agentChain: [
      { username: 'agentC', rebate_mode: 'percentage', rebate_percentage: 0.01 }, // C代理：拿1%
      { username: 'agentB', rebate_mode: 'percentage', rebate_percentage: 0.015 }, // B代理：拿1.5%
      { username: 'agentA', rebate_mode: 'all', rebate_percentage: 0.041 }        // A代理：全拿剩餘
    ],
    betAmount: 100,
    expected: {
      'agentC': 1.0,  // 拿1%退水
      'agentB': 1.5,  // 拿1.5%退水
      'agentA': 1.6   // 拿剩餘1.6%退水
    }
  },
  {
    name: '場景5：問題場景 - 比例總和超過4.1%',
    agentChain: [
      { username: 'agentB', rebate_mode: 'percentage', rebate_percentage: 0.025 }, // B代理：拿2.5%
      { username: 'agentA', rebate_mode: 'percentage', rebate_percentage: 0.025 }  // A代理：拿2.5%，總共5% > 4.1%
    ],
    betAmount: 100,
    expected: {
      'agentB': 2.5,  // 拿2.5%退水
      'agentA': 1.6   // 只能拿到剩餘1.6%退水
    }
  }
];

// 修復後的退水分配函數
function fixedRebateDistribution(agentChain, betAmount) {
  console.log('\n===== 修復後的退水分配 =====');
  console.log('代理鏈:', agentChain.map(a => `${a.username}(${a.rebate_mode}:${(a.rebate_percentage*100).toFixed(1)}%)`));
  console.log('下注金額:', betAmount);
  
  const totalRebateAmount = parseFloat(betAmount) * 0.041;
  console.log(`總退水金額: ${totalRebateAmount.toFixed(2)}`);
  
  let remainingRebate = totalRebateAmount;
  const distribution = {};
  
  for (let i = 0; i < agentChain.length; i++) {
    const agent = agentChain[i];
    let agentRebateAmount = 0;
    
    // 如果沒有剩餘退水，結束分配
    if (remainingRebate <= 0.01) {
      console.log(`退水已全部分配完畢`);
      break;
    }
    
    if (agent.rebate_mode === 'all') {
      // 全拿模式：該代理拿走所有剩餘退水
      agentRebateAmount = remainingRebate;
      remainingRebate = 0;
      console.log(`${agent.username}: 全拿模式，拿到 ${agentRebateAmount.toFixed(2)}`);
    } else if (agent.rebate_mode === 'percentage') {
      // 比例模式：代理設定的比例就是要獲得的退水比例
      const rebatePercentage = parseFloat(agent.rebate_percentage);
      if (isNaN(rebatePercentage) || rebatePercentage < 0) {
        console.warn(`代理 ${agent.username} 的退水比例無效: ${agent.rebate_percentage}，跳過`);
        agentRebateAmount = 0;
      } else {
        // 代理的退水比例直接就是要從總下注金額中獲得的比例
        const desiredAmount = parseFloat(betAmount) * rebatePercentage;
        // 確保不超過剩餘退水
        agentRebateAmount = Math.min(desiredAmount, remainingRebate);
        // 四捨五入到小數點後2位
        agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
        remainingRebate -= agentRebateAmount;
        console.log(`${agent.username}: 比例模式 ${(rebatePercentage*100).toFixed(1)}%，想要 ${desiredAmount.toFixed(2)}，實際分配 ${agentRebateAmount.toFixed(2)}`);
      }
    } else if (agent.rebate_mode === 'none') {
      // 全退模式：該代理不拿退水，留給上級
      agentRebateAmount = 0;
      console.log(`${agent.username}: 全退模式，拿到 ${agentRebateAmount.toFixed(2)}`);
    }
    
    distribution[agent.username] = agentRebateAmount;
    
    // 如果是全拿模式，直接結束分配
    if (agent.rebate_mode === 'all') {
      break;
    }
  }
  
  // 剩餘退水歸平台所有
  if (remainingRebate > 0.01) {
    console.log(`剩餘退水 ${remainingRebate.toFixed(2)} 歸平台所有`);
  }
  
  return distribution;
}

// 驗證修復後的退水邏輯
function validateFixedRebateLogic() {
  console.log('='.repeat(60));
  console.log('修復後退水邏輯驗證');
  console.log('='.repeat(60));
  
  let allScenariosPass = true;
  
  for (const scenario of testScenarios) {
    console.log(`\n📋 ${scenario.name}`);
    console.log('-'.repeat(50));
    
    // 修復後的分配邏輯
    const actualDistribution = fixedRebateDistribution(scenario.agentChain, scenario.betAmount);
    
    // 驗證結果
    console.log('\n✅ 預期結果 vs 修復後結果:');
    let scenarioPass = true;
    
    for (const agentUsername in scenario.expected) {
      const expected = scenario.expected[agentUsername];
      const actual = actualDistribution[agentUsername] || 0;
      const isCorrect = Math.abs(expected - actual) < 0.01;
      
      console.log(`${agentUsername}: 預期 ${expected.toFixed(2)}, 實際 ${actual.toFixed(2)} ${isCorrect ? '✅' : '❌'}`);
      
      if (!isCorrect) {
        scenarioPass = false;
        allScenariosPass = false;
      }
    }
    
    console.log(`\n結果: ${scenarioPass ? '✅ 通過' : '❌ 失敗'}`);
  }
  
  return allScenariosPass;
}

// 分析修復效果
function analyzeFixedLogic() {
  console.log('\n' + '='.repeat(60));
  console.log('修復效果分析');
  console.log('='.repeat(60));
  
  console.log('\n🔧 修復內容：');
  console.log('1. ✅ 修正比例計算邏輯：');
  console.log('   - 舊邏輯：agentRebateAmount = totalRebateAmount * rebatePercentage');
  console.log('   - 新邏輯：agentRebateAmount = betAmount * rebatePercentage');
  console.log('   - 解釋：代理設定2%就是從下注金額中獲得2%，而不是從4.1%退水中獲得2%');
  
  console.log('\n2. ✅ 保持下級優先的分配順序');
  console.log('3. ✅ 保持全拿、全退、比例三種模式');
  console.log('4. ✅ 確保總分配不超過總退水金額');
  console.log('5. ✅ 添加詳細的日誌記錄');
  
  console.log('\n🎯 修復後的優勢：');
  console.log('- 代理退水比例設定直觀明確');
  console.log('- 分配邏輯公平合理');
  console.log('- 不會出現分配異常的情況');
  console.log('- 支援靈活的代理層級結構');
  
  console.log('\n⚠️  注意事項：');
  console.log('- 如果代理鏈中所有代理的比例總和超過4.1%，後面的代理可能分配不足');
  console.log('- 建議在代理設定時進行比例總和驗證');
  console.log('- 全拿模式會阻止上級代理獲得退水');
}

// 建議的配套改進
function suggestImprovements() {
  console.log('\n' + '='.repeat(60));
  console.log('建議的配套改進');
  console.log('='.repeat(60));
  
  console.log('\n💡 代理設定驗證：');
  console.log('在創建或修改代理退水設定時，應該驗證：');
  console.log('1. 代理鏈中所有代理的退水比例總和不超過4.1%');
  console.log('2. 下級代理的退水比例不能超過上級代理的剩餘可分配退水');
  console.log('3. 提供退水分配預覽功能');
  
  console.log('\n💡 監控和報表：');
  console.log('1. 增加退水分配詳細記錄');
  console.log('2. 提供代理退水統計報表');
  console.log('3. 監控異常的退水分配情況');
  
  console.log('\n💡 用戶界面改進：');
  console.log('1. 在代理管理界面顯示退水分配預覽');
  console.log('2. 提供退水比例計算工具');
  console.log('3. 顯示代理鏈的退水分配流程圖');
}

// 主函數
async function main() {
  console.log('🎯 修復後退水邏輯驗證工具');
  console.log('時間:', new Date().toLocaleString());
  
  // 1. 驗證修復後的退水邏輯
  const allPass = validateFixedRebateLogic();
  
  // 2. 分析修復效果
  analyzeFixedLogic();
  
  // 3. 建議配套改進
  suggestImprovements();
  
  console.log('\n' + '='.repeat(60));
  console.log(`驗證完成 - ${allPass ? '✅ 所有測試通過' : '❌ 部分測試失敗'}`);
  console.log('='.repeat(60));
  
  return allPass;
}

// 執行檢查
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  fixedRebateDistribution,
  validateFixedRebateLogic,
  analyzeFixedLogic
}; 