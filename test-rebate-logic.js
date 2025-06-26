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
  }
];

// 模擬分配退水函數
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
      // 比例模式：從總退水中按比例分配
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
        console.log(`${agent.username}: 比例模式 ${(rebatePercentage*100).toFixed(1)}%，拿到 ${agentRebateAmount.toFixed(2)}`);
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
    
    // 模擬分配
    const actualDistribution = simulateRebateDistribution(scenario.agentChain, scenario.betAmount);
    
    // 驗證結果
    console.log('\n✅ 預期結果 vs 實際結果:');
    let allCorrect = true;
    
    for (const agentUsername in scenario.expected) {
      const expected = scenario.expected[agentUsername];
      const actual = actualDistribution[agentUsername] || 0;
      const isCorrect = Math.abs(expected - actual) < 0.01;
      
      console.log(`${agentUsername}: 預期 ${expected.toFixed(2)}, 實際 ${actual.toFixed(2)} ${isCorrect ? '✅' : '❌'}`);
      
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
  
  console.log('\n🔍 潛在問題分析：');
  
  console.log('\n1. 【比例計算問題】');
  console.log('   - 當前邏輯：從總退水金額計算比例');
  console.log('   - 問題：可能導致總分配超過總退水金額');
  console.log('   - 範例：代理A設2%，代理B設3%，總共5% > 4.1%');
  
  console.log('\n2. 【全拿模式影響】');
  console.log('   - 當前邏輯：全拿模式拿走所有剩餘退水');
  console.log('   - 正確：會阻止上級代理獲得退水');
  console.log('   - 問題：如果上級也設定全拿，應該是上級優先？');
  
  console.log('\n3. 【全退模式處理】');
  console.log('   - 當前邏輯：全退模式不拿退水，留給上級');
  console.log('   - 正確：符合邏輯');
  
  console.log('\n4. 【代理鏈順序】');
  console.log('   - 當前邏輯：從最下級代理開始分配');
  console.log('   - 問題：下級代理優先，可能不符合期望');
  console.log('   - 建議：應該從上級開始分配，還是從下級？');
  
  console.log('\n💡 建議改進方案：');
  console.log('\n方案A【下級優先】（當前邏輯）：');
  console.log('   1. 從直屬代理開始，依次向上分配');
  console.log('   2. 全拿模式：該代理拿走所有剩餘退水，停止向上分配');
  console.log('   3. 比例模式：按比例從剩餘退水中分配');
  console.log('   4. 全退模式：跳過該代理，繼續向上分配');
  
  console.log('\n方案B【上級優先】：');
  console.log('   1. 從總代理開始，依次向下分配');
  console.log('   2. 全拿模式：該代理拿走所有剩餘退水，停止向下分配');
  console.log('   3. 比例模式：按比例從剩餘退水中分配');
  console.log('   4. 全退模式：跳過該代理，繼續向下分配');
  
  console.log('\n方案C【固定比例】：');
  console.log('   1. 所有代理都設定固定比例（不允許全拿模式）');
  console.log('   2. 每個代理按設定比例從總退水金額分配');
  console.log('   3. 總分配不能超過總退水金額');
  console.log('   4. 剩餘退水歸平台所有');
}

// 測試實際系統
async function testActualSystem() {
  console.log('\n' + '='.repeat(60));
  console.log('測試實際系統退水分配');
  console.log('='.repeat(60));
  
  try {
    // 這裡可以調用實際的API來測試
    console.log('⚠️  注意：實際系統測試需要：');
    console.log('   1. 創建測試代理帳戶');
    console.log('   2. 創建測試會員帳戶');
    console.log('   3. 模擬下注和結算');
    console.log('   4. 檢查代理餘額變化');
    console.log('\n   建議在開發環境中進行測試');
    
  } catch (error) {
    console.error('測試實際系統時發生錯誤:', error);
  }
}

// 主函數
async function main() {
  console.log('🎯 極速賽車退水邏輯檢查工具');
  console.log('時間:', new Date().toLocaleString());
  
  // 1. 驗證退水邏輯
  validateRebateLogic();
  
  // 2. 分析當前問題
  analyzeCurrentIssues();
  
  // 3. 測試實際系統（可選）
  // await testActualSystem();
  
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
  validateRebateLogic,
  analyzeCurrentIssues
}; 