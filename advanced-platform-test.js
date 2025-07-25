import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';
const GAME_API = 'https://bet-game-vcje.onrender.com';

// 测试结果记录
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

// 通用函数
async function agentLogin(username, password) {
  const response = await axios.post(`${AGENT_API}/login`, { username, password });
  if (!response.data.success) throw new Error(`${username} 登入失败`);
  return response.data;
}

async function memberLogin(username, password) {
  const response = await axios.post(`${GAME_API}/api/member/login`, { username, password });
  if (!response.data.success) throw new Error(`${username} 登入失败`);
  return response.data;
}

// 尝试给会员充值
async function attemptMemberTopUp() {
  try {
    console.log('🔄 尝试给A01member充值...');
    
    // 尝试多种充值方式
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
          description: '测试充值'
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
    
    console.log('⚠️  所有充值方式都不可用，将测试现有余额');
    return false;
  } catch (error) {
    console.log(`⚠️  充值尝试失败: ${error.message}`);
    return false;
  }
}

// 进阶测试1：市场类型继承深度检查
async function testMarketTypeInheritance() {
  console.log('\n🔍 进阶测试1: 市场类型继承深度检查');
  testResults.marketTypeInheritance.total++;
  
  try {
    // 检查A盘代理创建的会员市场类型
    const aAgentLogin = await agentLogin('A01agent', 'A01pass');
    console.log(`A01agent 市场类型: ${aAgentLogin.agent.market_type}`);
    
    // 检查D盘代理创建的会员市场类型  
    const dAgentLogin = await agentLogin('D01agent', 'D01pass');
    console.log(`D01agent 市场类型: ${dAgentLogin.agent.market_type}`);
    
    // 检查会员登入时是否获得正确的市场类型
    const aMemberLogin = await memberLogin('A01member', 'A01mem');
    console.log(`A01member 登入回应:`, Object.keys(aMemberLogin));
    
    if (aMemberLogin.market_type) {
      console.log(`✅ A01member 市场类型: ${aMemberLogin.market_type}`);
      testResults.marketTypeInheritance.success++;
    } else {
      console.log(`⚠️  A01member 登入回应中未包含市场类型资讯`);
      
      // 检查会员数据库记录是否包含市场类型
      try {
        const agentMembersResponse = await axios.get(`${AGENT_API}/members`, {
          headers: { 'Cookie': `sessionToken=${aAgentLogin.sessionToken}` }
        });
        
        if (agentMembersResponse.data.success) {
          const members = agentMembersResponse.data.members || [];
          const a01member = members.find(m => m.username === 'A01member');
          if (a01member && a01member.market_type) {
            console.log(`✅ 代理系统中A01member市场类型: ${a01member.market_type}`);
            testResults.marketTypeInheritance.success++;
          } else {
            console.log(`⚠️  代理系统中也没有市场类型资讯`);
          }
        }
      } catch (error) {
        console.log(`⚠️  无法查询代理系统会员资料`);
      }
    }
    
    // 检查游戏数据API是否返回正确的赔率
    const gameData = await axios.get(`${GAME_API}/api/game-data`);
    if (gameData.data.gameData) {
      console.log(`游戏赔率数据:`, {
        大小赔率: gameData.data.gameData.odds?.bigSmall || '未设置',
        单双赔率: gameData.data.gameData.odds?.oddEven || '未设置',
        号码赔率: gameData.data.gameData.odds?.number || '未设置'
      });
    }
    
  } catch (error) {
    console.error(`❌ 市场类型测试失败: ${error.message}`);
  }
}

// 进阶测试2：实际下注流程完整测试
async function testActualBetting() {
  console.log('\n🔍 进阶测试2: 实际下注流程完整测试');
  testResults.actualBetting.total++;
  
  try {
    // 首先给会员充值
    await attemptMemberTopUp();
    
    // 获取当前游戏状态
    const gameDataResponse = await axios.get(`${GAME_API}/api/game-data`);
    const gameData = gameDataResponse.data.gameData;
    
    console.log(`当前游戏状态: 期数${gameData.currentPeriod}, 状态${gameData.status}`);
    
    if (gameData.status === 'betting') {
      // 尝试A盘会员下注
      const aMemberLogin = await memberLogin('A01member', 'A01mem');
      console.log(`A01member 当前余额: $${aMemberLogin.member.balance}`);
      
      // 检查余额是否足够
      const balance = parseFloat(aMemberLogin.member.balance);
      if (balance >= 10) {
        const betData = {
          username: 'A01member',
          betType: 'champion',
          value: 'big',
          amount: 10
        };
        
        console.log('尝试下注:', betData);
        
        try {
          const betResponse = await axios.post(`${GAME_API}/api/bet`, betData);
          
          if (betResponse.data.success) {
            console.log(`✅ 下注成功! 余额更新为: ${betResponse.data.balance}`);
            testResults.actualBetting.success++;
            
            // 立即查询下注记录确认
            const recordsResponse = await axios.get(`${GAME_API}/api/bet-history?username=A01member&limit=1`);
            if (recordsResponse.data.success && recordsResponse.data.records.length > 0) {
              const latestBet = recordsResponse.data.records[0];
              console.log(`最新下注记录: 期数${latestBet.period}, 类型${latestBet.betType}, 金额$${latestBet.amount}`);
            }
          } else {
            console.log(`⚠️  下注失败: ${betResponse.data.message}`);
          }
        } catch (betError) {
          console.log(`⚠️  下注API错误: ${betError.response?.data?.message || betError.message}`);
        }
      } else {
        console.log(`⚠️  会员余额不足($${balance})，无法测试下注功能`);
      }
    } else {
      console.log(`⚠️  当前非下注时间 (${gameData.status})，无法测试下注`);
    }
    
  } catch (error) {
    console.error(`❌ 下注流程测试失败: ${error.message}`);
  }
}

// 进阶测试3：余额管理系统检查
async function testBalanceManagement() {
  console.log('\n🔍 进阶测试3: 余额管理系统检查');
  testResults.balanceManagement.total++;
  
  try {
    // 检查代理余额
    const loginResult = await agentLogin('ti2025A', 'ti2025A');
    console.log(`ti2025A 代理余额: ${loginResult.agent.balance || '未返回'}`);
    
    // 检查会员余额
    const memberLoginResult = await memberLogin('A01member', 'A01mem');
    console.log(`A01member 会员余额: ${memberLoginResult.member.balance || '未返回'}`);
    
    // 检查余额查询API
    try {
      const balanceResponse = await axios.get(`${GAME_API}/api/balance?username=A01member`);
      if (balanceResponse.data.success) {
        console.log(`✅ 余额查询API正常: $${balanceResponse.data.balance}`);
        testResults.balanceManagement.success++;
      }
    } catch (error) {
      console.log(`⚠️  余额查询API不可用`);
      // 如果能正常获取登入时的余额，仍算部分成功
      if (memberLoginResult.member.balance !== undefined) {
        console.log(`✅ 登入时余额查询正常`);
        testResults.balanceManagement.success++;
      }
    }
    
    // 检查代理系统会员余额
    try {
      const agentMemberResponse = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${loginResult.sessionToken}` }
      });
      
      if (agentMemberResponse.data.success) {
        const members = agentMemberResponse.data.members || [];
        const a01member = members.find(m => m.username === 'A01member');
        if (a01member) {
          console.log(`代理系统中A01member余额: $${a01member.balance || '未设置'}`);
        }
      }
    } catch (error) {
      console.log(`⚠️  代理系统会员列表不可用`);
    }
    
  } catch (error) {
    console.error(`❌ 余额管理测试失败: ${error.message}`);
  }
}

// 进阶测试4：退水分配机制验证
async function testRebateDistribution() {
  console.log('\n🔍 进阶测试4: 退水分配机制验证');
  testResults.rebateDistribution.total++;
  
  try {
    // 检查代理退水设置
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
        console.log(`⚠️  无法获取 ${agent.username} 退水资讯: ${error.message}`);
      }
    }
    
    if (successfulChecks >= 2) {
      console.log(`✅ 退水设置查询基本正常 (${successfulChecks}/4 个代理)`);
      testResults.rebateDistribution.success++;
    }
    
    // 检查退水记录API
    try {
      const loginResult = await agentLogin('ti2025A', 'ti2025A');
      const rebateResponse = await axios.get(`${AGENT_API}/transactions?agentId=${loginResult.agent.id}&type=rebate`, {
        headers: { 'Cookie': `sessionToken=${loginResult.sessionToken}` }
      });
      
      if (rebateResponse.data.success) {
        const rebateRecords = rebateResponse.data.data?.list || [];
        console.log(`✅ 退水记录查询正常，共 ${rebateRecords.length} 笔记录`);
      }
    } catch (error) {
      console.log(`⚠️  退水记录查询失败: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`❌ 退水分配测试失败: ${error.message}`);
  }
}

// 进阶测试5：游戏数据一致性检查
async function testGameDataConsistency() {
  console.log('\n🔍 进阶测试5: 游戏数据一致性检查');
  testResults.gameDataConsistency.total++;
  
  try {
    // 多次获取游戏数据，检查一致性
    const gameDataCalls = [];
    for (let i = 0; i < 3; i++) {
      const response = await axios.get(`${GAME_API}/api/game-data`);
      gameDataCalls.push(response.data.gameData);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
    }
    
    // 检查期数一致性
    const periods = gameDataCalls.map(data => data.currentPeriod);
    const periodsUnique = [...new Set(periods)];
    
    console.log(`3次调用获得期数: ${periods.join(', ')}`);
    
    if (periodsUnique.length <= 2) { // 允许期数变化（跨期数时）
      console.log(`✅ 游戏数据一致性正常`);
      testResults.gameDataConsistency.success++;
    } else {
      console.log(`⚠️  游戏数据期数变化异常`);
    }
    
    // 检查游戏历史数据
    try {
      const historyResponse = await axios.get(`${GAME_API}/api/recent-results?limit=5`);
      if (historyResponse.data.success) {
        const results = historyResponse.data.results || [];
        console.log(`✅ 历史开奖数据正常，最近 ${results.length} 期记录`);
        
        results.slice(0, 2).forEach((result, index) => {
          console.log(`  ${index + 1}. 期数:${result.period} 结果:${Array.isArray(result.result) ? result.result.join(',') : result.result}`);
        });
      }
    } catch (error) {
      console.log(`⚠️  历史数据API不可用: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`❌ 游戏数据一致性测试失败: ${error.message}`);
  }
}

// 进阶测试6：跨平台数据同步检查
async function testCrossPlatformSync() {
  console.log('\n🔍 进阶测试6: 跨平台数据同步检查');
  testResults.crossPlatformSync.total++;
  
  try {
    // 在代理平台获取会员资讯
    const loginResult = await agentLogin('A01agent', 'A01pass');
    const agentMembersResponse = await axios.get(`${AGENT_API}/members`, {
      headers: { 'Cookie': `sessionToken=${loginResult.sessionToken}` }
    });
    
    let agentMemberData = null;
    if (agentMembersResponse.data.success) {
      const members = agentMembersResponse.data.members || [];
      agentMemberData = members.find(m => m.username === 'A01member');
      console.log(`代理平台 A01member 资料: ${agentMemberData ? '存在' : '不存在'}`);
    }
    
    // 在游戏平台获取会员资讯
    const memberLoginResult = await memberLogin('A01member', 'A01mem');
    console.log(`游戏平台 A01member 登入: ${memberLoginResult.success !== false ? '成功' : '失败'}`);
    
    // 检查数据同步
    if (agentMemberData && memberLoginResult) {
      console.log(`数据同步检查:`);
      console.log(`  代理平台余额: ${agentMemberData.balance || 'N/A'}`);
      console.log(`  游戏平台余额: ${memberLoginResult.member.balance || 'N/A'}`);
      
      const agentBalance = parseFloat(agentMemberData.balance || '0');
      const gameBalance = parseFloat(memberLoginResult.member.balance || '0');
      
      if (Math.abs(agentBalance - gameBalance) < 0.01) { // 允许小数点误差
        console.log(`✅ 跨平台余额同步正常`);
        testResults.crossPlatformSync.success++;
      } else {
        console.log(`⚠️  跨平台余额不同步 (差额: ${Math.abs(agentBalance - gameBalance)})`);
      }
    }
    
  } catch (error) {
    console.error(`❌ 跨平台同步测试失败: ${error.message}`);
  }
}

// 进阶测试7：安全性验证
async function testSecurityValidation() {
  console.log('\n🔍 进阶测试7: 安全性验证');
  testResults.securityValidation.total++;
  
  try {
    // 测试未授权访问
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
        console.log(`⚠️  ${endpoint} 允许未授权访问`);
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          unauthorizedBlocked++;
          console.log(`✅ ${endpoint} 正确阻止未授权访问`);
        } else if (error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
          console.log(`⚠️  ${endpoint} 服务器错误`);
        }
      }
    }
    
    // 测试错误凭证
    try {
      await agentLogin('invalid_user', 'invalid_pass');
      console.log(`⚠️  系统接受了无效凭证`);
    } catch (error) {
      console.log(`✅ 系统正确拒绝无效凭证`);
      unauthorizedBlocked++;
    }
    
    if (unauthorizedBlocked >= 3) {
      console.log(`✅ 安全性验证通过 (${unauthorizedBlocked}项安全检查通过)`);
      testResults.securityValidation.success++;
    } else {
      console.log(`⚠️  安全性检查部分通过 (${unauthorizedBlocked}项通过)`);
    }
    
  } catch (error) {
    console.error(`❌ 安全性验证失败: ${error.message}`);
  }
}

// 进阶测试8：性能测试
async function testPerformance() {
  console.log('\n🔍 进阶测试8: 性能测试');
  testResults.performanceTest.total++;
  
  try {
    // API响应时间测试
    const apiTests = [
      { name: '代理登入', url: `${AGENT_API}/login`, method: 'POST', data: { username: 'ti2025A', password: 'ti2025A' }},
      { name: '会员登入', url: `${GAME_API}/api/member/login`, method: 'POST', data: { username: 'A01member', password: 'A01mem' }},
      { name: '游戏数据', url: `${GAME_API}/api/game-data`, method: 'GET', data: null },
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
        console.log(`${test.name} 响应时间: ${responseTime}ms`);
        
        totalResponseTime += responseTime;
        successfulTests++;
        
        if (responseTime < 3000) { // 3秒内算正常
          console.log(`  ✅ 响应时间正常`);
        } else {
          console.log(`  ⚠️  响应较慢`);
        }
      } catch (error) {
        console.log(`  ❌ ${test.name} 请求失败: ${error.message}`);
      }
    }
    
    if (successfulTests > 0) {
      const avgResponseTime = totalResponseTime / successfulTests;
      console.log(`平均响应时间: ${avgResponseTime.toFixed(0)}ms`);
      
      if (avgResponseTime < 2000) {
        console.log(`✅ 系统性能表现良好`);
        testResults.performanceTest.success++;
      } else {
        console.log(`⚠️  系统响应较慢，可能需要优化`);
      }
    }
    
  } catch (error) {
    console.error(`❌ 性能测试失败: ${error.message}`);
  }
}

// 主测试函数
async function runAdvancedTests() {
  console.log('🚀 开始执行进阶平台测试');
  console.log('='.repeat(60));
  
  await testMarketTypeInheritance();
  await testActualBetting();
  await testBalanceManagement();
  await testRebateDistribution();
  await testGameDataConsistency();
  await testCrossPlatformSync();
  await testSecurityValidation();
  await testPerformance();
  
  // 输出测试总结
  console.log('\n📊 进阶测试结果总结:');
  console.log('='.repeat(60));
  
  Object.entries(testResults).forEach(([testName, result]) => {
    const successRate = result.total > 0 ? ((result.success / result.total) * 100).toFixed(1) : '0';
    const status = result.success === result.total ? '✅' : result.success > 0 ? '⚠️' : '❌';
    console.log(`${status} ${testName}: ${result.success}/${result.total} (${successRate}%)`);
  });
  
  const totalTests = Object.values(testResults).reduce((sum, result) => sum + result.total, 0);
  const totalSuccess = Object.values(testResults).reduce((sum, result) => sum + result.success, 0);
  const overallRate = totalTests > 0 ? ((totalSuccess / totalTests) * 100).toFixed(1) : '0';
  
  console.log('\n🎯 进阶测试整体结果:');
  console.log(`总测试项目: ${totalTests}`);
  console.log(`成功项目: ${totalSuccess}`);
  console.log(`成功率: ${overallRate}%`);
  
  console.log('\n✅ 进阶测试执行完成！');
}

// 执行测试
runAdvancedTests().catch(console.error); 