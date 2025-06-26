const axios = require('axios');

// 配置
const MAIN_API_URL = 'http://localhost:8080';
const AGENT_API_URL = 'http://localhost:3000/api';

// 測試場景配置
const testScenarios = [
  {
    name: '場景1：代理B全拿，代理A不退水（percentage 4.1%）',
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

// 模擬分配退水函數（當前邏輯）
function simulateRebateDistribution(agentChain, betAmount) {
  console.log('\n===== 模擬退水分配 =====');
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
      // 比例模式：從總退水中按比例分配（修復計算錯誤）
      const rebatePercentage = parseFloat(agent.rebate_percentage);
      if (isNaN(rebatePercentage) || rebatePercentage < 0) {
        console.warn(`代理 ${agent.username} 的退水比例無效: ${agent.rebate_percentage}，跳過`);
        agentRebateAmount = 0;
      } else {
        // 從總退水金額計算，而不是剩餘退水
        agentRebateAmount = totalRebateAmount * rebatePercentage;
        // 確保不超過剩餘退水
        agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
        // 四捨五入到小數點後2位
        agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
        remainingRebate -= agentRebateAmount;
        console.log(`${agent.username}: 比例模式 ${(rebatePercentage*100).toFixed(1)}%，從總金額計算 ${(totalRebateAmount * rebatePercentage).toFixed(2)}，實際分配 ${agentRebateAmount.toFixed(2)}`);
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

// 建議的改進退水分配函數（從剩餘退水分配）
function improvedRebateDistribution(agentChain, betAmount) {
  console.log('\n===== 改進的退水分配 =====');
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
      // 比例模式：從剩餘退水中按比例分配
      const rebatePercentage = parseFloat(agent.rebate_percentage);
      if (isNaN(rebatePercentage) || rebatePercentage < 0) {
        console.warn(`代理 ${agent.username} 的退水比例無效: ${agent.rebate_percentage}，跳過`);
        agentRebateAmount = 0;
      } else {
        // 從剩餘退水中按比例分配
        agentRebateAmount = remainingRebate * rebatePercentage / 0.041; // 按原始比例在剩餘退水中分配
        // 四捨五入到小數點後2位
        agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
        remainingRebate -= agentRebateAmount;
        console.log(`${agent.username}: 比例模式 ${(rebatePercentage*100).toFixed(1)}%，從剩餘 ${(remainingRebate + agentRebateAmount).toFixed(2)} 中分配 ${agentRebateAmount.toFixed(2)}`);
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

// 驗證退水邏輯
function validateRebateLogic() {
  console.log('='.repeat(60));
  console.log('退水邏輯驗證開始');
  console.log('='.repeat(60));
  
  for (const scenario of testScenarios) {
    console.log(`\n📋 ${scenario.name}`);
    console.log('-'.repeat(50));
    
    // 模擬分配（當前邏輯）
    const actualDistribution = simulateRebateDistribution(scenario.agentChain, scenario.betAmount);
    
    // 改進的分配邏輯
    const improvedDistribution = improvedRebateDistribution(scenario.agentChain, scenario.betAmount);
    
    // 驗證結果
    console.log('\n✅ 預期結果 vs 當前邏輯 vs 改進邏輯:');
    let allCorrect = true;
    
    for (const agentUsername in scenario.expected) {
      const expected = scenario.expected[agentUsername];
      const actual = actualDistribution[agentUsername] || 0;
      const improved = improvedDistribution[agentUsername] || 0;
      const isCorrect = Math.abs(expected - actual) < 0.01;
      
      console.log(`${agentUsername}: 預期 ${expected.toFixed(2)}, 當前 ${actual.toFixed(2)}, 改進 ${improved.toFixed(2)} ${isCorrect ? '✅' : '❌'}`);
      
      if (!isCorrect) {
        allCorrect = false;
      }
    }
    
    console.log(`\n結果: ${allCorrect ? '✅ 通過' : '❌ 失敗'}`);
  }
}

// 檢查當前系統的退水邏輯問題
function analyzeCurrentIssues() {
  console.log('\n' + '='.repeat(60));
  console.log('當前退水邏輯分析');
  console.log('='.repeat(60));
  
  console.log('\n🔍 發現的關鍵問題：');
  
  console.log('\n1. 【比例計算邏輯錯誤】');
  console.log('   ❌ 當前：從總退水金額按比例分配');
  console.log('   ⚠️  問題：如果總比例超過4.1%，會因為remainingRebate限制而導致後面的代理分配不足');
  console.log('   ✅ 建議：從剩餘退水中按比例分配');
  
  console.log('\n2. 【全拿模式的優先級】');
  console.log('   ✅ 當前：下級代理全拿會阻止上級代理分配');
  console.log('   💡 解釋：這是合理的，因為下級代理更接近會員');
  
  console.log('\n3. 【全退模式處理】');
  console.log('   ✅ 當前：全退代理不拿退水，退給上級');
  console.log('   💡 解釋：符合邏輯');
  
  console.log('\n4. 【代理鏈分配順序】');
  console.log('   ✅ 當前：從直屬代理開始，向上分配');
  console.log('   💡 解釋：符合商業邏輯，直屬代理獲得優先分配權');
  
  console.log('\n5. 【結算時機】');
  console.log('   ✅ 當前：每次下注結算後立即分配退水');
  console.log('   💡 解釋：正確，確保代理能即時收到退水');
  
  console.log('\n🚨 主要問題總結：');
  console.log('   當前邏輯在比例計算上有缺陷，可能導致分配不公平');
  console.log('   特別是當代理鏈中多個代理設定的比例總和超過4.1%時');
}

// 建議的修復方案
function recommendedFix() {
  console.log('\n' + '='.repeat(60));
  console.log('建議的修復方案');
  console.log('='.repeat(60));
  
  console.log('\n💡 方案：改進比例計算邏輯');
  
  console.log('\n修復內容：');
  console.log('1. 保持從下級代理開始分配的順序');
  console.log('2. 保持全拿、全退、比例三種模式');
  console.log('3. 修改比例模式的計算方式：');
  console.log('   - 舊邏輯：agentRebateAmount = totalRebateAmount * rebatePercentage');
  console.log('   - 新邏輯：agentRebateAmount = Math.min(totalRebateAmount * rebatePercentage, remainingRebate)');
  console.log('4. 確保總分配不超過總退水金額');
  
  console.log('\n修復代碼示例：');
  console.log(`
// 在 backend.js 的 distributeRebate 函數中
if (agent.rebate_mode === 'percentage') {
  const rebatePercentage = parseFloat(agent.rebate_percentage);
  if (!isNaN(rebatePercentage) && rebatePercentage >= 0) {
    // 計算該代理應得的退水金額
    const desiredAmount = totalRebateAmount * rebatePercentage;
    // 確保不超過剩餘退水
    agentRebateAmount = Math.min(desiredAmount, remainingRebate);
    agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
    remainingRebate -= agentRebateAmount;
  }
}
  `);
  
  console.log('\n5. 結算時機保持不變：每次下注結算後立即分配');
  console.log('6. 添加詳細的日誌記錄以便追蹤分配過程');
}

// 主函數
async function main() {
  console.log('🎯 極速賽車退水邏輯檢查工具');
  console.log('時間:', new Date().toLocaleString());
  
  // 1. 驗證退水邏輯
  validateRebateLogic();
  
  // 2. 分析當前問題
  analyzeCurrentIssues();
  
  // 3. 建議修復方案
  recommendedFix();
  
  console.log('\n' + '='.repeat(60));
  console.log('檢查完成');
  console.log('='.repeat(60));
}

// 執行檢查
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  simulateRebateDistribution,
  improvedRebateDistribution,
  validateRebateLogic,
  analyzeCurrentIssues
}; 