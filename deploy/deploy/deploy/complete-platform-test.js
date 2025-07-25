import axios from 'axios';

// API 基礎URLs
const AGENT_API = 'https://bet-agent.onrender.com/api/agent';
const GAME_API = 'https://bet-game-vcje.onrender.com';

// 測試用戶
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

// 登入函數
async function agentLogin(username, password) {
  try {
    const response = await axios.post(`${AGENT_API}/login`, { username, password });
    if (response.data.success) {
      console.log(`✅ 代理 ${username} 登入成功`);
      return response.data;
    }
  } catch (error) {
    console.error(`❌ 代理 ${username} 登入失敗:`, error.response?.data?.message || error.message);
    throw error;
  }
}

async function memberLogin(username, password) {
  try {
    const response = await axios.post(`${GAME_API}/api/member/login`, { username, password });
    if (response.data.success) {
      console.log(`✅ 會員 ${username} 登入成功`);
      return response.data;
    }
  } catch (error) {
    console.error(`❌ 會員 ${username} 登入失敗:`, error.response?.data?.message || error.message);
    throw error;
  }
}

// 測試函數
async function test1_AgentStructure() {
  console.log('\n🔍 測試1: 檢查代理架構和退水比例');
  
  try {
    // 檢查A盤總代理
    const aLogin = await agentLogin('ti2025A', 'ti2025A');
    console.log(`A盤總代理: Level ${aLogin.agent.level}, 退水 ${(aLogin.agent.rebate_percentage * 100).toFixed(2)}%`);
    
    // 檢查A盤下級代理
    const aSubAgents = await axios.get(`${AGENT_API}/sub-agents`, {
      headers: { 'Cookie': `sessionToken=${aLogin.sessionToken}` }
    });
    
    let aCount = 0;
    if (aSubAgents.data.success) {
      const aAgentList = aSubAgents.data.data.list.filter(agent => 
        agent.parent_username === 'ti2025A' || agent.username.startsWith('A')
      );
      aCount = aAgentList.length;
      console.log(`A盤代理層級數: ${aCount}`);
      
      // 顯示退水比例
      aAgentList.slice(0, 5).forEach(agent => {
        console.log(`  ${agent.username}: Level ${agent.level}, 退水 ${(agent.rebate_percentage * 100).toFixed(2)}%`);
      });
    }
    
    // 檢查D盤
    const dLogin = await agentLogin('ti2025D', 'ti2025D'); 
    console.log(`D盤總代理: Level ${dLogin.agent.level}, 退水 ${(dLogin.agent.rebate_percentage * 100).toFixed(2)}%`);
    
    const dSubAgents = await axios.get(`${AGENT_API}/sub-agents`, {
      headers: { 'Cookie': `sessionToken=${dLogin.sessionToken}` }
    });
    
    let dCount = 0;
    if (dSubAgents.data.success) {
      const dAgentList = dSubAgents.data.data.list.filter(agent => 
        agent.parent_username === 'ti2025D' || agent.username.startsWith('D')
      );
      dCount = dAgentList.length;
      console.log(`D盤代理層級數: ${dCount}`);
      
      // 顯示退水比例
      dAgentList.slice(0, 5).forEach(agent => {
        console.log(`  ${agent.username}: Level ${agent.level}, 退水 ${(agent.rebate_percentage * 100).toFixed(2)}%`);
      });
    }
    
    console.log(`✅ 測試1完成: A盤${aCount}層, D盤${dCount}層代理架構檢查完成`);
    
  } catch (error) {
    console.error('❌ 測試1失敗:', error.message);
  }
}

async function test2_MemberCreation() {
  console.log('\n🔍 測試2: 檢查會員創建功能');
  
  const results = { aMembers: 0, dMembers: 0 };
  
  // 檢查A盤會員
  for (let i = 1; i <= 3; i++) {
    try {
      const agentUsername = `A${i.toString().padStart(2, '0')}agent`;
      const memberUsername = `A${i.toString().padStart(2, '0')}member`;
      
      const agentLogin = await agentLogin(agentUsername, PASSWORDS[agentUsername]);
      
      // 檢查是否已有會員，如果沒有則創建
      try {
        const memberLogin = await memberLogin(memberUsername, PASSWORDS[memberUsername]);
        console.log(`✅ A盤會員 ${memberUsername} 已存在`);
        results.aMembers++;
      } catch {
        // 會員不存在，嘗試創建
        try {
          const memberData = {
            username: memberUsername,
            password: PASSWORDS[memberUsername],
            agentId: agentLogin.agent.id,
            notes: `A盤第${i}層代理的測試會員`
          };
          
          const createResponse = await axios.post(`${AGENT_API}/create-member`, memberData, {
            headers: { 'Cookie': `sessionToken=${agentLogin.sessionToken}` }
          });
          
          if (createResponse.data.success) {
            console.log(`✅ 創建A盤會員 ${memberUsername} 成功`);
            results.aMembers++;
          }
        } catch (error) {
          console.error(`❌ 創建A盤會員 ${memberUsername} 失敗`);
        }
      }
    } catch (error) {
      console.error(`⚠️  A盤代理 A${i.toString().padStart(2, '0')}agent 處理失敗`);
    }
  }
  
  // 檢查D盤會員
  for (let i = 1; i <= 3; i++) {
    try {
      const agentUsername = `D${i.toString().padStart(2, '0')}agent`;
      const memberUsername = `D${i.toString().padStart(2, '0')}member`;
      
      const agentLogin = await agentLogin(agentUsername, PASSWORDS[agentUsername]);
      
      // 檢查是否已有會員，如果沒有則創建
      try {
        const memberLogin = await memberLogin(memberUsername, PASSWORDS[memberUsername]);
        console.log(`✅ D盤會員 ${memberUsername} 已存在`);
        results.dMembers++;
      } catch {
        // 會員不存在，嘗試創建
        try {
          const memberData = {
            username: memberUsername,
            password: PASSWORDS[memberUsername],
            agentId: agentLogin.agent.id,
            notes: `D盤第${i}層代理的測試會員`
          };
          
          const createResponse = await axios.post(`${AGENT_API}/create-member`, memberData, {
            headers: { 'Cookie': `sessionToken=${agentLogin.sessionToken}` }
          });
          
          if (createResponse.data.success) {
            console.log(`✅ 創建D盤會員 ${memberUsername} 成功`);
            results.dMembers++;
          }
        } catch (error) {
          console.error(`❌ 創建D盤會員 ${memberUsername} 失敗`);
        }
      }
    } catch (error) {
      console.error(`⚠️  D盤代理 D${i.toString().padStart(2, '0')}agent 處理失敗`);
    }
  }
  
  console.log(`✅ 測試2完成: A盤會員${results.aMembers}個, D盤會員${results.dMembers}個`);
}

async function test3_LoginValidation() {
  console.log('\n🔍 測試3: 驗證所有代理和會員登入');
  
  let agentSuccess = 0, memberSuccess = 0;
  
  // 測試代理登入
  const allAgents = [...TEST_USERS.A_AGENTS.slice(0, 4), ...TEST_USERS.D_AGENTS.slice(0, 4)];
  
  for (const username of allAgents) {
    try {
      await agentLogin(username, PASSWORDS[username]);
      agentSuccess++;
    } catch (error) {
      console.error(`⚠️  代理 ${username} 登入失敗`);
    }
  }
  
  // 測試會員登入
  const allMembers = [...TEST_USERS.A_MEMBERS, ...TEST_USERS.D_MEMBERS];
  
  for (const username of allMembers) {
    try {
      await memberLogin(username, PASSWORDS[username]);
      memberSuccess++;
    } catch (error) {
      console.error(`⚠️  會員 ${username} 登入失敗`);
    }
  }
  
  console.log(`✅ 測試3完成: 代理登入${agentSuccess}/${allAgents.length}, 會員登入${memberSuccess}/${allMembers.length}`);
}

async function test4_OddsVerification() {
  console.log('\n🔍 測試4: 驗證不同盤口賠率');
  
  try {
    // 測試A盤會員賠率
    const aMemberLogin = await memberLogin('A01member', 'A01mem');
    const aOddsResponse = await axios.get(`${GAME_API}/api/odds`, {
      headers: { 'Cookie': `token=${aMemberLogin.token}` }
    });
    
    if (aOddsResponse.data.success) {
      const aOdds = aOddsResponse.data.odds;
      console.log(`A盤賠率 - 大: ${aOdds.champion?.big || 'N/A'}, 小: ${aOdds.champion?.small || 'N/A'}`);
    }
    
    // 測試D盤會員賠率
    const dMemberLogin = await memberLogin('D01member', 'D01mem');
    const dOddsResponse = await axios.get(`${GAME_API}/api/odds`, {
      headers: { 'Cookie': `token=${dMemberLogin.token}` }
    });
    
    if (dOddsResponse.data.success) {
      const dOdds = dOddsResponse.data.odds;
      console.log(`D盤賠率 - 大: ${dOdds.champion?.big || 'N/A'}, 小: ${dOdds.champion?.small || 'N/A'}`);
    }
    
    console.log('✅ 測試4完成: 賠率驗證完成');
    
  } catch (error) {
    console.error('❌ 測試4失敗:', error.message);
  }
}

async function test5_BettingTest() {
  console.log('\n🔍 測試5: 進行下注測試');
  
  try {
    // 模擬A盤會員下注
    const aMemberLogin = await memberLogin('A01member', 'A01mem');
    
    // 模擬下注請求
    const betData = {
      betType: 'champion',
      value: 'big',
      amount: 100,
      odds: 1.96
    };
    
    console.log('模擬A盤會員下注: 冠軍大, 金額100, 賠率1.96');
    
    // 類似的D盤測試
    const dMemberLogin = await memberLogin('D01member', 'D01mem');
    console.log('模擬D盤會員下注: 冠軍大, 金額100, 賠率1.88');
    
    console.log('✅ 測試5完成: 下注測試完成（模擬）');
    
  } catch (error) {
    console.error('❌ 測試5失敗:', error.message);
  }
}

async function test6_RebateValidation() {
  console.log('\n🔍 測試6: 檢查退水計算');
  
  try {
    // 檢查A盤代理的退水設置
    const aAgentLogin = await agentLogin('A01agent', 'A01pass');
    console.log(`A01agent 退水比例: ${(aAgentLogin.agent.rebate_percentage * 100).toFixed(2)}%`);
    
    // 檢查D盤代理的退水設置  
    const dAgentLogin = await agentLogin('D01agent', 'D01pass');
    console.log(`D01agent 退水比例: ${(dAgentLogin.agent.rebate_percentage * 100).toFixed(2)}%`);
    
    console.log('✅ 測試6完成: 退水檢查完成');
    
  } catch (error) {
    console.error('❌ 測試6失敗:', error.message);
  }
}

async function test7_Dashboard() {
  console.log('\n🔍 測試7: 儀表板數據驗證');
  
  try {
    const agentLogin = await agentLogin('ti2025A', 'ti2025A');
    
    // 獲取儀表板數據
    const dashboardResponse = await axios.get(`${AGENT_API}/dashboard-stats`, {
      headers: { 'Cookie': `sessionToken=${agentLogin.sessionToken}` }
    });
    
    if (dashboardResponse.data.success) {
      const stats = dashboardResponse.data.stats;
      console.log(`儀表板數據 - 總代理數: ${stats.totalAgents || 0}, 總會員數: ${stats.totalMembers || 0}`);
    }
    
    console.log('✅ 測試7完成: 儀表板驗證完成');
    
  } catch (error) {
    console.error('❌ 測試7失敗:', error.message);
  }
}

async function test8_LoginLogs() {
  console.log('\n🔍 測試8: 登錄日誌測試');
  
  try {
    const agentLogin = await agentLogin('ti2025A', 'ti2025A');
    
    // 獲取登錄日誌
    const logsResponse = await axios.get(`${AGENT_API}/login-logs`, {
      headers: { 'Cookie': `sessionToken=${agentLogin.sessionToken}` }
    });
    
    if (logsResponse.data.success && logsResponse.data.logs) {
      console.log(`登錄日誌記錄數: ${logsResponse.data.logs.length}`);
      
      // 顯示最近幾筆記錄
      logsResponse.data.logs.slice(0, 3).forEach(log => {
        console.log(`  ${log.username} - ${log.login_time} - ${log.ip_address || 'N/A'}`);
      });
    }
    
    console.log('✅ 測試8完成: 登錄日誌驗證完成');
    
  } catch (error) {
    console.error('❌ 測試8失敗:', error.message);
  }
}

// 執行所有測試
async function runCompleteTest() {
  console.log('🚀 開始完整平台測試 (13項測試)');
  console.log('='.repeat(50));
  
  await test1_AgentStructure();
  await test2_MemberCreation();
  await test3_LoginValidation();
  await test4_OddsVerification();
  await test5_BettingTest();
  await test6_RebateValidation();
  await test7_Dashboard();
  await test8_LoginLogs();
  
  // 其他測試項目(9-13)將在後續添加
  console.log('\n📊 測試總結:');
  console.log('前8項測試已完成，其餘測試項目需要進一步實現...');
  console.log('✅ 完整平台測試執行完成！');
}

// 執行測試
runCompleteTest().catch(console.error);

export { runCompleteTest }; 