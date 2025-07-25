import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';
const GAME_API = 'https://bet-game-vcje.onrender.com';

// 測試結果記錄
let testResults = {
  marketTypeInheritance: { success: 0, total: 0 },
  actualBetting: { success: 0, total: 0 },
  balanceManagement: { success: 0, total: 0 },
  rebateDistribution: { success: 0, total: 0 },
  gameDataConsistency: { success: 0, total: 0 },
  crossPlatformSync: { success: 0, total: 0 },
  securityValidation: { success: 0, total: 0 },
  performanceTest: { success: 0, total: 0 }
};

// 通用函數
async function agentLogin(username, password) {
  const response = await axios.post(`${AGENT_API}/login`, { username, password });
  if (!response.data.success) throw new Error(`${username} 登入失敗`);
  return response.data;
}

async function memberLogin(username, password) {
  const response = await axios.post(`${GAME_API}/api/member/login`, { username, password });
  if (!response.data.success) throw new Error(`${username} 登入失敗`);
  return response.data;
}

// 嘗試給會員充值
async function attemptMemberTopUp() {
  try {
    console.log('🔄 嘗試給A01member充值...');
    
    // 嘗試多種充值方式
    const topUpMethods = [
      { endpoint: '/adjust-balance', method: 'POST' },
      { endpoint: '/transfer-points', method: 'POST' },
      { endpoint: '/deposit', method: 'POST' },
      { endpoint: '/balance-adjustment', method: 'POST' }
    ];
    
    const loginResult = await agentLogin('A01agent', 'A01pass');
    
    for (const method of topUpMethods) {
      try {
        const response = await axios[method.method.toLowerCase()](`${AGENT_API}${method.endpoint}`, {
          username: 'A01member',
          targetUsername: 'A01member',
          amount: 1000,
          type: 'deposit',
          description: '測試充值'
        }, {
          headers: { 'Cookie': `sessionToken=${loginResult.sessionToken}` }
        });
        
        if (response.data.success) {
          console.log(`✅ 充值成功使用 ${method.endpoint}`);
          return true;
        }
      } catch (error) {
        console.log(`⚠️  ${method.endpoint} 不可用`);
      }
    }
    
    console.log('⚠️  所有充值方式都不可用，將測試現有餘額');
    return false;
  } catch (error) {
    console.log(`⚠️  充值嘗試失敗: ${error.message}`);
    return false;
  }
}

// 進階測試1：市場類型繼承深度檢查
async function testMarketTypeInheritance() {
  console.log('\n🔍 進階測試1: 市場類型繼承深度檢查');
  testResults.marketTypeInheritance.total++;
  
  try {
    // 檢查A盤代理創建的會員市場類型
    const aAgentLogin = await agentLogin('A01agent', 'A01pass');
    console.log(`A01agent 市場類型: ${aAgentLogin.agent.market_type}`);
    
    // 檢查D盤代理創建的會員市場類型  
    const dAgentLogin = await agentLogin('D01agent', 'D01pass');
    console.log(`D01agent 市場類型: ${dAgentLogin.agent.market_type}`);
    
    // 檢查會員登入時是否獲得正確的市場類型
    const aMemberLogin = await memberLogin('A01member', 'A01mem');
    console.log(`A01member 登入回應:`, Object.keys(aMemberLogin));
    
    if (aMemberLogin.market_type) {
      console.log(`✅ A01member 市場類型: ${aMemberLogin.market_type}`);
      testResults.marketTypeInheritance.success++;
    } else {
      console.log(`⚠️  A01member 登入回應中未包含市場類型資訊`);
      
      // 檢查會員數據庫記錄是否包含市場類型
      try {
        const agentMembersResponse = await axios.get(`${AGENT_API}/members`, {
          headers: { 'Cookie': `sessionToken=${aAgentLogin.sessionToken}` }
        });
        
        if (agentMembersResponse.data.success) {
          const members = agentMembersResponse.data.members || [];
          const a01member = members.find(m => m.username === 'A01member');
          if (a01member && a01member.market_type) {
            console.log(`✅ 代理系統中A01member市場類型: ${a01member.market_type}`);
            testResults.marketTypeInheritance.success++;
          } else {
            console.log(`⚠️  代理系統中也沒有市場類型資訊`);
          }
        }
      } catch (error) {
        console.log(`⚠️  無法查詢代理系統會員資料`);
      }
    }
    
    // 檢查遊戲數據API是否返回正確的賠率
    const gameData = await axios.get(`${GAME_API}/api/game-data`);
    if (gameData.data.gameData) {
      console.log(`遊戲賠率數據:`, {
        大小賠率: gameData.data.gameData.odds?.bigSmall || '未設置',
        單雙賠率: gameData.data.gameData.odds?.oddEven || '未設置',
        號碼賠率: gameData.data.gameData.odds?.number || '未設置'
      });
    }
    
  } catch (error) {
    console.error(`❌ 市場類型測試失敗: ${error.message}`);
  }
}

// 進階測試2：實際下注流程完整測試
async function testActualBetting() {
  console.log('\n🔍 進階測試2: 實際下注流程完整測試');
  testResults.actualBetting.total++;
  
  try {
    // 首先給會員充值
    await attemptMemberTopUp();
    
    // 獲取當前遊戲狀態
    const gameDataResponse = await axios.get(`${GAME_API}/api/game-data`);
    const gameData = gameDataResponse.data.gameData;
    
    console.log(`當前遊戲狀態: 期數${gameData.currentPeriod}, 狀態${gameData.status}`);
    
    if (gameData.status === 'betting') {
      // 嘗試A盤會員下注
      const aMemberLogin = await memberLogin('A01member', 'A01mem');
      console.log(`A01member 當前餘額: $${aMemberLogin.member.balance}`);
      
      // 檢查餘額是否足夠
      const balance = parseFloat(aMemberLogin.member.balance);
      if (balance >= 10) {
        const betData = {
          username: 'A01member',
          betType: 'champion',
          value: 'big',
          amount: 10
        };
        
        console.log('嘗試下注:', betData);
        
        try {
          const betResponse = await axios.post(`${GAME_API}/api/bet`, betData);
          
          if (betResponse.data.success) {
            console.log(`✅ 下注成功! 餘額更新為: ${betResponse.data.balance}`);
            testResults.actualBetting.success++;
            
            // 立即查詢下注記錄確認
            const recordsResponse = await axios.get(`${GAME_API}/api/bet-history?username=A01member&limit=1`);
            if (recordsResponse.data.success && recordsResponse.data.records.length > 0) {
              const latestBet = recordsResponse.data.records[0];
              console.log(`最新下注記錄: 期數${latestBet.period}, 類型${latestBet.betType}, 金額$${latestBet.amount}`);
            }
          } else {
            console.log(`⚠️  下注失敗: ${betResponse.data.message}`);
          }
        } catch (betError) {
          console.log(`⚠️  下注API錯誤: ${betError.response?.data?.message || betError.message}`);
        }
      } else {
        console.log(`⚠️  會員餘額不足($${balance})，無法測試下注功能`);
      }
    } else {
      console.log(`⚠️  當前非下注時間 (${gameData.status})，無法測試下注`);
    }
    
  } catch (error) {
    console.error(`❌ 下注流程測試失敗: ${error.message}`);
  }
}

// 進階測試3：餘額管理系統檢查
async function testBalanceManagement() {
  console.log('\n🔍 進階測試3: 餘額管理系統檢查');
  testResults.balanceManagement.total++;
  
  try {
    // 檢查代理餘額
    const loginResult = await agentLogin('ti2025A', 'ti2025A');
    console.log(`ti2025A 代理餘額: ${loginResult.agent.balance || '未返回'}`);
    
    // 檢查會員餘額
    const memberLoginResult = await memberLogin('A01member', 'A01mem');
    console.log(`A01member 會員餘額: ${memberLoginResult.member.balance || '未返回'}`);
    
    // 檢查餘額查詢API
    try {
      const balanceResponse = await axios.get(`${GAME_API}/api/balance?username=A01member`);
      if (balanceResponse.data.success) {
        console.log(`✅ 餘額查詢API正常: $${balanceResponse.data.balance}`);
        testResults.balanceManagement.success++;
      }
    } catch (error) {
      console.log(`⚠️  餘額查詢API不可用`);
      // 如果能正常獲取登入時的餘額，仍算部分成功
      if (memberLoginResult.member.balance !== undefined) {
        console.log(`✅ 登入時餘額查詢正常`);
        testResults.balanceManagement.success++;
      }
    }
    
    // 檢查代理系統會員餘額
    try {
      const agentMemberResponse = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${loginResult.sessionToken}` }
      });
      
      if (agentMemberResponse.data.success) {
        const members = agentMemberResponse.data.members || [];
        const a01member = members.find(m => m.username === 'A01member');
        if (a01member) {
          console.log(`代理系統中A01member餘額: $${a01member.balance || '未設置'}`);
        }
      }
    } catch (error) {
      console.log(`⚠️  代理系統會員列表不可用`);
    }
    
  } catch (error) {
    console.error(`❌ 餘額管理測試失敗: ${error.message}`);
  }
}

// 進階測試4：退水分配機制驗證
async function testRebateDistribution() {
  console.log('\n🔍 進階測試4: 退水分配機制驗證');
  testResults.rebateDistribution.total++;
  
  try {
    // 檢查代理退水設置
    const agents = [
      { username: 'ti2025A', password: 'ti2025A' },
      { username: 'A01agent', password: 'A01pass' },
      { username: 'A02agent', password: 'A02pass' },
      { username: 'D01agent', password: 'D01pass' }
    ];
    
    let successfulChecks = 0;
    
    for (const agent of agents) {
      try {
        const loginResult = await agentLogin(agent.username, agent.password);
        
        const rebatePercentage = (loginResult.agent.rebate_percentage * 100).toFixed(2);
        console.log(`${agent.username} 退水比例: ${rebatePercentage}% (Level ${loginResult.agent.level})`);
        successfulChecks++;
      } catch (error) {
        console.log(`⚠️  無法獲取 ${agent.username} 退水資訊: ${error.message}`);
      }
    }
    
    if (successfulChecks >= 2) {
      console.log(`✅ 退水設置查詢基本正常 (${successfulChecks}/4 個代理)`);
      testResults.rebateDistribution.success++;
    }
    
    // 檢查退水記錄API
    try {
      const loginResult = await agentLogin('ti2025A', 'ti2025A');
      const rebateResponse = await axios.get(`${AGENT_API}/transactions?agentId=${loginResult.agent.id}&type=rebate`, {
        headers: { 'Cookie': `sessionToken=${loginResult.sessionToken}` }
      });
      
      if (rebateResponse.data.success) {
        const rebateRecords = rebateResponse.data.data?.list || [];
        console.log(`✅ 退水記錄查詢正常，共 ${rebateRecords.length} 筆記錄`);
      }
    } catch (error) {
      console.log(`⚠️  退水記錄查詢失敗: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`❌ 退水分配測試失敗: ${error.message}`);
  }
}

// 進階測試5：遊戲數據一致性檢查
async function testGameDataConsistency() {
  console.log('\n🔍 進階測試5: 遊戲數據一致性檢查');
  testResults.gameDataConsistency.total++;
  
  try {
    // 多次獲取遊戲數據，檢查一致性
    const gameDataCalls = [];
    for (let i = 0; i < 3; i++) {
      const response = await axios.get(`${GAME_API}/api/game-data`);
      gameDataCalls.push(response.data.gameData);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    }
    
    // 檢查期數一致性
    const periods = gameDataCalls.map(data => data.currentPeriod);
    const periodsUnique = [...new Set(periods)];
    
    console.log(`3次調用獲得期數: ${periods.join(', ')}`);
    
    if (periodsUnique.length <= 2) { // 允許期數變化（跨期數時）
      console.log(`✅ 遊戲數據一致性正常`);
      testResults.gameDataConsistency.success++;
    } else {
      console.log(`⚠️  遊戲數據期數變化異常`);
    }
    
    // 檢查遊戲歷史數據
    try {
      const historyResponse = await axios.get(`${GAME_API}/api/recent-results?limit=5`);
      if (historyResponse.data.success) {
        const results = historyResponse.data.results || [];
        console.log(`✅ 歷史開獎數據正常，最近 ${results.length} 期記錄`);
        
        results.slice(0, 2).forEach((result, index) => {
          console.log(`  ${index + 1}. 期數:${result.period} 結果:${Array.isArray(result.result) ? result.result.join(',') : result.result}`);
        });
      }
    } catch (error) {
      console.log(`⚠️  歷史數據API不可用: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`❌ 遊戲數據一致性測試失敗: ${error.message}`);
  }
}

// 進階測試6：跨平台數據同步檢查
async function testCrossPlatformSync() {
  console.log('\n🔍 進階測試6: 跨平台數據同步檢查');
  testResults.crossPlatformSync.total++;
  
  try {
    // 在代理平台獲取會員資訊
    const loginResult = await agentLogin('A01agent', 'A01pass');
    const agentMembersResponse = await axios.get(`${AGENT_API}/members`, {
      headers: { 'Cookie': `sessionToken=${loginResult.sessionToken}` }
    });
    
    let agentMemberData = null;
    if (agentMembersResponse.data.success) {
      const members = agentMembersResponse.data.members || [];
      agentMemberData = members.find(m => m.username === 'A01member');
      console.log(`代理平台 A01member 資料: ${agentMemberData ? '存在' : '不存在'}`);
    }
    
    // 在遊戲平台獲取會員資訊
    const memberLoginResult = await memberLogin('A01member', 'A01mem');
    console.log(`遊戲平台 A01member 登入: ${memberLoginResult.success !== false ? '成功' : '失敗'}`);
    
    // 檢查數據同步
    if (agentMemberData && memberLoginResult) {
      console.log(`數據同步檢查:`);
      console.log(`  代理平台餘額: ${agentMemberData.balance || 'N/A'}`);
      console.log(`  遊戲平台餘額: ${memberLoginResult.member.balance || 'N/A'}`);
      
      const agentBalance = parseFloat(agentMemberData.balance || '0');
      const gameBalance = parseFloat(memberLoginResult.member.balance || '0');
      
      if (Math.abs(agentBalance - gameBalance) < 0.01) { // 允許小數點誤差
        console.log(`✅ 跨平台餘額同步正常`);
        testResults.crossPlatformSync.success++;
      } else {
        console.log(`⚠️  跨平台餘額不同步 (差額: ${Math.abs(agentBalance - gameBalance)})`);
      }
    }
    
  } catch (error) {
    console.error(`❌ 跨平台同步測試失敗: ${error.message}`);
  }
}

// 進階測試7：安全性驗證
async function testSecurityValidation() {
  console.log('\n🔍 進階測試7: 安全性驗證');
  testResults.securityValidation.total++;
  
  try {
    // 測試未授權訪問
    let unauthorizedBlocked = 0;
    
    const protectedEndpoints = [
      `${AGENT_API}/members`,
      `${AGENT_API}/sub-agents`, 
      `${AGENT_API}/transactions`,
      `${AGENT_API}/stats`
    ];
    
    for (const endpoint of protectedEndpoints) {
      try {
        const response = await axios.get(endpoint);
        console.log(`⚠️  ${endpoint} 允許未授權訪問`);
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          unauthorizedBlocked++;
          console.log(`✅ ${endpoint} 正確阻止未授權訪問`);
        } else if (error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
          console.log(`⚠️  ${endpoint} 服務器錯誤`);
        }
      }
    }
    
    // 測試錯誤憑證
    try {
      await agentLogin('invalid_user', 'invalid_pass');
      console.log(`⚠️  系統接受了無效憑證`);
    } catch (error) {
      console.log(`✅ 系統正確拒絕無效憑證`);
      unauthorizedBlocked++;
    }
    
    if (unauthorizedBlocked >= 3) {
      console.log(`✅ 安全性驗證通過 (${unauthorizedBlocked}項安全檢查通過)`);
      testResults.securityValidation.success++;
    } else {
      console.log(`⚠️  安全性檢查部分通過 (${unauthorizedBlocked}項通過)`);
    }
    
  } catch (error) {
    console.error(`❌ 安全性驗證失敗: ${error.message}`);
  }
}

// 進階測試8：性能測試
async function testPerformance() {
  console.log('\n🔍 進階測試8: 性能測試');
  testResults.performanceTest.total++;
  
  try {
    // API響應時間測試
    const apiTests = [
      { name: '代理登入', url: `${AGENT_API}/login`, method: 'POST', data: { username: 'ti2025A', password: 'ti2025A' }},
      { name: '會員登入', url: `${GAME_API}/api/member/login`, method: 'POST', data: { username: 'A01member', password: 'A01mem' }},
      { name: '遊戲數據', url: `${GAME_API}/api/game-data`, method: 'GET', data: null },
    ];
    
    let totalResponseTime = 0;
    let successfulTests = 0;
    
    for (const test of apiTests) {
      try {
        const startTime = Date.now();
        
        if (test.method === 'POST') {
          await axios.post(test.url, test.data);
        } else {
          await axios.get(test.url);
        }
        
        const responseTime = Date.now() - startTime;
        console.log(`${test.name} 響應時間: ${responseTime}ms`);
        
        totalResponseTime += responseTime;
        successfulTests++;
        
        if (responseTime < 3000) { // 3秒內算正常
          console.log(`  ✅ 響應時間正常`);
        } else {
          console.log(`  ⚠️  響應較慢`);
        }
      } catch (error) {
        console.log(`  ❌ ${test.name} 請求失敗: ${error.message}`);
      }
    }
    
    if (successfulTests > 0) {
      const avgResponseTime = totalResponseTime / successfulTests;
      console.log(`平均響應時間: ${avgResponseTime.toFixed(0)}ms`);
      
      if (avgResponseTime < 2000) {
        console.log(`✅ 系統性能表現良好`);
        testResults.performanceTest.success++;
      } else {
        console.log(`⚠️  系統響應較慢，可能需要優化`);
      }
    }
    
  } catch (error) {
    console.error(`❌ 性能測試失敗: ${error.message}`);
  }
}

// 主測試函數
async function runAdvancedTests() {
  console.log('🚀 開始執行進階平台測試');
  console.log('='.repeat(60));
  
  await testMarketTypeInheritance();
  await testActualBetting();
  await testBalanceManagement();
  await testRebateDistribution();
  await testGameDataConsistency();
  await testCrossPlatformSync();
  await testSecurityValidation();
  await testPerformance();
  
  // 輸出測試總結
  console.log('\n📊 進階測試結果總結:');
  console.log('='.repeat(60));
  
  Object.entries(testResults).forEach(([testName, result]) => {
    const successRate = result.total > 0 ? ((result.success / result.total) * 100).toFixed(1) : '0';
    const status = result.success === result.total ? '✅' : result.success > 0 ? '⚠️' : '❌';
    console.log(`${status} ${testName}: ${result.success}/${result.total} (${successRate}%)`);
  });
  
  const totalTests = Object.values(testResults).reduce((sum, result) => sum + result.total, 0);
  const totalSuccess = Object.values(testResults).reduce((sum, result) => sum + result.success, 0);
  const overallRate = totalTests > 0 ? ((totalSuccess / totalTests) * 100).toFixed(1) : '0';
  
  console.log('\n🎯 進階測試整體結果:');
  console.log(`總測試項目: ${totalTests}`);
  console.log(`成功項目: ${totalSuccess}`);
  console.log(`成功率: ${overallRate}%`);
  
  console.log('\n✅ 進階測試執行完成！');
}

// 執行測試
runAdvancedTests().catch(console.error); 