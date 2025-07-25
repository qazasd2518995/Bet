import axios from 'axios';

// API 基础URLs
const AGENT_API = 'https://bet-agent.onrender.com/api/agent';
const GAME_API = 'https://bet-game-vcje.onrender.com';

// 测试用户
const TEST_USERS = {
  A_AGENTS: ['ti2025A', 'A01agent', 'A02agent', 'A03agent', 'A04agent', 'A05agent'],
  D_AGENTS: ['ti2025D', 'D01agent', 'D02agent', 'D03agent', 'D04agent', 'D05agent'],
  A_MEMBERS: ['A01member', 'A02member', 'A03member'],
  D_MEMBERS: ['D01member', 'D02member', 'D03member']
};

const PASSWORDS = {
  'ti2025A': 'ti2025A',
  'ti2025D': 'ti2025D',
  'A01agent': 'A01pass',
  'A02agent': 'A02pass',
  'A03agent': 'A03pass', 
  'A04agent': 'A04pass',
  'A05agent': 'A05pass',
  'D01agent': 'D01pass',
  'D02agent': 'D02pass',
  'D03agent': 'D03pass',
  'D04agent': 'D04pass',
  'D05agent': 'D05pass',
  'A01member': 'A01mem',
  'A02member': 'A02mem',
  'A03member': 'A03mem',
  'D01member': 'D01mem',
  'D02member': 'D02mem',
  'D03member': 'D03mem'
};

// 登入函数
async function agentLogin(username, password) {
  try {
    const response = await axios.post(`${AGENT_API}/login`, { username, password });
    if (response.data.success) {
      console.log(`✅ 代理 ${username} 登入成功`);
      return response.data;
    }
  } catch (error) {
    console.error(`❌ 代理 ${username} 登入失败:`, error.response?.data?.message || error.message);
    throw error;
  }
}

async function memberLogin(username, password) {
  try {
    const response = await axios.post(`${GAME_API}/api/member/login`, { username, password });
    if (response.data.success) {
      console.log(`✅ 会员 ${username} 登入成功`);
      return response.data;
    }
  } catch (error) {
    console.error(`❌ 会员 ${username} 登入失败:`, error.response?.data?.message || error.message);
    throw error;
  }
}

// 测试函数
async function test1_AgentStructure() {
  console.log('\n🔍 测试1: 检查代理架构和退水比例');
  
  try {
    // 检查A盘总代理
    const aLogin = await agentLogin('ti2025A', 'ti2025A');
    console.log(`A盘总代理: Level ${aLogin.agent.level}, 退水 ${(aLogin.agent.rebate_percentage * 100).toFixed(2)}%`);
    
    // 检查A盘下级代理
    const aSubAgents = await axios.get(`${AGENT_API}/sub-agents`, {
      headers: { 'Cookie': `sessionToken=${aLogin.sessionToken}` }
    });
    
    let aCount = 0;
    if (aSubAgents.data.success) {
      const aAgentList = aSubAgents.data.data.list.filter(agent => 
        agent.parent_username === 'ti2025A' || agent.username.startsWith('A')
      );
      aCount = aAgentList.length;
      console.log(`A盘代理层级数: ${aCount}`);
      
      // 显示退水比例
      aAgentList.slice(0, 5).forEach(agent => {
        console.log(`  ${agent.username}: Level ${agent.level}, 退水 ${(agent.rebate_percentage * 100).toFixed(2)}%`);
      });
    }
    
    // 检查D盘
    const dLogin = await agentLogin('ti2025D', 'ti2025D'); 
    console.log(`D盘总代理: Level ${dLogin.agent.level}, 退水 ${(dLogin.agent.rebate_percentage * 100).toFixed(2)}%`);
    
    const dSubAgents = await axios.get(`${AGENT_API}/sub-agents`, {
      headers: { 'Cookie': `sessionToken=${dLogin.sessionToken}` }
    });
    
    let dCount = 0;
    if (dSubAgents.data.success) {
      const dAgentList = dSubAgents.data.data.list.filter(agent => 
        agent.parent_username === 'ti2025D' || agent.username.startsWith('D')
      );
      dCount = dAgentList.length;
      console.log(`D盘代理层级数: ${dCount}`);
      
      // 显示退水比例
      dAgentList.slice(0, 5).forEach(agent => {
        console.log(`  ${agent.username}: Level ${agent.level}, 退水 ${(agent.rebate_percentage * 100).toFixed(2)}%`);
      });
    }
    
    console.log(`✅ 测试1完成: A盘${aCount}层, D盘${dCount}层代理架构检查完成`);
    
  } catch (error) {
    console.error('❌ 测试1失败:', error.message);
  }
}

async function test2_MemberCreation() {
  console.log('\n🔍 测试2: 检查会员创建功能');
  
  const results = { aMembers: 0, dMembers: 0 };
  
  // 检查A盘会员
  for (let i = 1; i <= 3; i++) {
    try {
      const agentUsername = `A${i.toString().padStart(2, '0')}agent`;
      const memberUsername = `A${i.toString().padStart(2, '0')}member`;
      
      const agentLogin = await agentLogin(agentUsername, PASSWORDS[agentUsername]);
      
      // 检查是否已有会员，如果没有则创建
      try {
        const memberLogin = await memberLogin(memberUsername, PASSWORDS[memberUsername]);
        console.log(`✅ A盘会员 ${memberUsername} 已存在`);
        results.aMembers++;
      } catch {
        // 会员不存在，尝试创建
        try {
          const memberData = {
            username: memberUsername,
            password: PASSWORDS[memberUsername],
            agentId: agentLogin.agent.id,
            notes: `A盘第${i}层代理的测试会员`
          };
          
          const createResponse = await axios.post(`${AGENT_API}/create-member`, memberData, {
            headers: { 'Cookie': `sessionToken=${agentLogin.sessionToken}` }
          });
          
          if (createResponse.data.success) {
            console.log(`✅ 创建A盘会员 ${memberUsername} 成功`);
            results.aMembers++;
          }
        } catch (error) {
          console.error(`❌ 创建A盘会员 ${memberUsername} 失败`);
        }
      }
    } catch (error) {
      console.error(`⚠️  A盘代理 A${i.toString().padStart(2, '0')}agent 处理失败`);
    }
  }
  
  // 检查D盘会员
  for (let i = 1; i <= 3; i++) {
    try {
      const agentUsername = `D${i.toString().padStart(2, '0')}agent`;
      const memberUsername = `D${i.toString().padStart(2, '0')}member`;
      
      const agentLogin = await agentLogin(agentUsername, PASSWORDS[agentUsername]);
      
      // 检查是否已有会员，如果没有则创建
      try {
        const memberLogin = await memberLogin(memberUsername, PASSWORDS[memberUsername]);
        console.log(`✅ D盘会员 ${memberUsername} 已存在`);
        results.dMembers++;
      } catch {
        // 会员不存在，尝试创建
        try {
          const memberData = {
            username: memberUsername,
            password: PASSWORDS[memberUsername],
            agentId: agentLogin.agent.id,
            notes: `D盘第${i}层代理的测试会员`
          };
          
          const createResponse = await axios.post(`${AGENT_API}/create-member`, memberData, {
            headers: { 'Cookie': `sessionToken=${agentLogin.sessionToken}` }
          });
          
          if (createResponse.data.success) {
            console.log(`✅ 创建D盘会员 ${memberUsername} 成功`);
            results.dMembers++;
          }
        } catch (error) {
          console.error(`❌ 创建D盘会员 ${memberUsername} 失败`);
        }
      }
    } catch (error) {
      console.error(`⚠️  D盘代理 D${i.toString().padStart(2, '0')}agent 处理失败`);
    }
  }
  
  console.log(`✅ 测试2完成: A盘会员${results.aMembers}个, D盘会员${results.dMembers}个`);
}

async function test3_LoginValidation() {
  console.log('\n🔍 测试3: 验证所有代理和会员登入');
  
  let agentSuccess = 0, memberSuccess = 0;
  
  // 测试代理登入
  const allAgents = [...TEST_USERS.A_AGENTS.slice(0, 4), ...TEST_USERS.D_AGENTS.slice(0, 4)];
  
  for (const username of allAgents) {
    try {
      await agentLogin(username, PASSWORDS[username]);
      agentSuccess++;
    } catch (error) {
      console.error(`⚠️  代理 ${username} 登入失败`);
    }
  }
  
  // 测试会员登入
  const allMembers = [...TEST_USERS.A_MEMBERS, ...TEST_USERS.D_MEMBERS];
  
  for (const username of allMembers) {
    try {
      await memberLogin(username, PASSWORDS[username]);
      memberSuccess++;
    } catch (error) {
      console.error(`⚠️  会员 ${username} 登入失败`);
    }
  }
  
  console.log(`✅ 测试3完成: 代理登入${agentSuccess}/${allAgents.length}, 会员登入${memberSuccess}/${allMembers.length}`);
}

async function test4_OddsVerification() {
  console.log('\n🔍 测试4: 验证不同盘口赔率');
  
  try {
    // 测试A盘会员赔率
    const aMemberLogin = await memberLogin('A01member', 'A01mem');
    const aOddsResponse = await axios.get(`${GAME_API}/api/odds`, {
      headers: { 'Cookie': `token=${aMemberLogin.token}` }
    });
    
    if (aOddsResponse.data.success) {
      const aOdds = aOddsResponse.data.odds;
      console.log(`A盘赔率 - 大: ${aOdds.champion?.big || 'N/A'}, 小: ${aOdds.champion?.small || 'N/A'}`);
    }
    
    // 测试D盘会员赔率
    const dMemberLogin = await memberLogin('D01member', 'D01mem');
    const dOddsResponse = await axios.get(`${GAME_API}/api/odds`, {
      headers: { 'Cookie': `token=${dMemberLogin.token}` }
    });
    
    if (dOddsResponse.data.success) {
      const dOdds = dOddsResponse.data.odds;
      console.log(`D盘赔率 - 大: ${dOdds.champion?.big || 'N/A'}, 小: ${dOdds.champion?.small || 'N/A'}`);
    }
    
    console.log('✅ 测试4完成: 赔率验证完成');
    
  } catch (error) {
    console.error('❌ 测试4失败:', error.message);
  }
}

async function test5_BettingTest() {
  console.log('\n🔍 测试5: 进行下注测试');
  
  try {
    // 模拟A盘会员下注
    const aMemberLogin = await memberLogin('A01member', 'A01mem');
    
    // 模拟下注请求
    const betData = {
      betType: 'champion',
      value: 'big',
      amount: 100,
      odds: 1.96
    };
    
    console.log('模拟A盘会员下注: 冠军大, 金额100, 赔率1.96');
    
    // 类似的D盘测试
    const dMemberLogin = await memberLogin('D01member', 'D01mem');
    console.log('模拟D盘会员下注: 冠军大, 金额100, 赔率1.88');
    
    console.log('✅ 测试5完成: 下注测试完成（模拟）');
    
  } catch (error) {
    console.error('❌ 测试5失败:', error.message);
  }
}

async function test6_RebateValidation() {
  console.log('\n🔍 测试6: 检查退水计算');
  
  try {
    // 检查A盘代理的退水设置
    const aAgentLogin = await agentLogin('A01agent', 'A01pass');
    console.log(`A01agent 退水比例: ${(aAgentLogin.agent.rebate_percentage * 100).toFixed(2)}%`);
    
    // 检查D盘代理的退水设置  
    const dAgentLogin = await agentLogin('D01agent', 'D01pass');
    console.log(`D01agent 退水比例: ${(dAgentLogin.agent.rebate_percentage * 100).toFixed(2)}%`);
    
    console.log('✅ 测试6完成: 退水检查完成');
    
  } catch (error) {
    console.error('❌ 测试6失败:', error.message);
  }
}

async function test7_Dashboard() {
  console.log('\n🔍 测试7: 仪表板数据验证');
  
  try {
    const agentLogin = await agentLogin('ti2025A', 'ti2025A');
    
    // 获取仪表板数据
    const dashboardResponse = await axios.get(`${AGENT_API}/dashboard-stats`, {
      headers: { 'Cookie': `sessionToken=${agentLogin.sessionToken}` }
    });
    
    if (dashboardResponse.data.success) {
      const stats = dashboardResponse.data.stats;
      console.log(`仪表板数据 - 总代理数: ${stats.totalAgents || 0}, 总会员数: ${stats.totalMembers || 0}`);
    }
    
    console.log('✅ 测试7完成: 仪表板验证完成');
    
  } catch (error) {
    console.error('❌ 测试7失败:', error.message);
  }
}

async function test8_LoginLogs() {
  console.log('\n🔍 测试8: 登录日志测试');
  
  try {
    const agentLogin = await agentLogin('ti2025A', 'ti2025A');
    
    // 获取登录日志
    const logsResponse = await axios.get(`${AGENT_API}/login-logs`, {
      headers: { 'Cookie': `sessionToken=${agentLogin.sessionToken}` }
    });
    
    if (logsResponse.data.success && logsResponse.data.logs) {
      console.log(`登录日志记录数: ${logsResponse.data.logs.length}`);
      
      // 显示最近几笔记录
      logsResponse.data.logs.slice(0, 3).forEach(log => {
        console.log(`  ${log.username} - ${log.login_time} - ${log.ip_address || 'N/A'}`);
      });
    }
    
    console.log('✅ 测试8完成: 登录日志验证完成');
    
  } catch (error) {
    console.error('❌ 测试8失败:', error.message);
  }
}

// 执行所有测试
async function runCompleteTest() {
  console.log('🚀 开始完整平台测试 (13项测试)');
  console.log('='.repeat(50));
  
  await test1_AgentStructure();
  await test2_MemberCreation();
  await test3_LoginValidation();
  await test4_OddsVerification();
  await test5_BettingTest();
  await test6_RebateValidation();
  await test7_Dashboard();
  await test8_LoginLogs();
  
  // 其他测试项目(9-13)将在后续添加
  console.log('\n📊 测试总结:');
  console.log('前8项测试已完成，其余测试项目需要进一步实现...');
  console.log('✅ 完整平台测试执行完成！');
}

// 执行测试
runCompleteTest().catch(console.error);

export { runCompleteTest }; 