import axios from 'axios';

// 設定API基礎URL
const API_BASE = 'https://bet-agent.onrender.com/api/agent';

// 登入憑證
const A_CREDENTIALS = { username: 'ti2025A', password: 'ti2025A' };
const D_CREDENTIALS = { username: 'ti2025D', password: 'ti2025D' };

// 存儲登入狀態
let aToken = null;
let dToken = null;

// 登入函數
async function login(credentials) {
  try {
    const response = await axios.post(`${API_BASE}/login`, credentials);
    if (response.data.success) {
      console.log(`✅ ${credentials.username} 登入成功`);
      return {
        token: response.data.token,
        sessionToken: response.data.sessionToken,
        agent: response.data.agent
      };
    }
  } catch (error) {
    console.error(`❌ ${credentials.username} 登入失敗:`, error.response?.data || error.message);
    throw error;
  }
}

// 創建代理函數
async function createAgent(sessionToken, agentData) {
  try {
    const response = await axios.post(`${API_BASE}/create-agent`, agentData, {
      headers: {
        'Cookie': `sessionToken=${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      console.log(`✅ 創建代理成功: ${agentData.username} (Level ${agentData.level}, 退水比例: ${agentData.rebate_percentage})`);
      return response.data.agent;
    } else {
      console.error(`❌ 創建代理失敗: ${agentData.username}`, response.data.message);
      return null;
    }
  } catch (error) {
    console.error(`❌ 創建代理API錯誤: ${agentData.username}`, error.response?.data || error.message);
    return null;
  }
}

// 創建會員函數
async function createMember(sessionToken, memberData, agentId) {
  try {
    const payload = {
      ...memberData,
      agentId: agentId
    };
    
    const response = await axios.post(`${API_BASE}/create-member`, payload, {
      headers: {
        'Cookie': `sessionToken=${sessionToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.data.success) {
      console.log(`✅ 創建會員成功: ${memberData.username}`);
      return response.data.member;
    } else {
      console.error(`❌ 創建會員失敗: ${memberData.username}`, response.data.message);
      return null;
    }
  } catch (error) {
    console.error(`❌ 創建會員API錯誤: ${memberData.username}`, error.response?.data || error.message);
    return null;
  }
}

// 主測試函數
async function runCompleteTest() {
  console.log('🚀 開始進行完整平台測試...\n');
  
  // 步驟1: 登入總代理
  console.log('=== 步驟1: 總代理登入測試 ===');
  const aLogin = await login(A_CREDENTIALS);
  const dLogin = await login(D_CREDENTIALS);
  
  console.log(`A盤總代理 ID: ${aLogin.agent.id}, Level: ${aLogin.agent.level}, 退水比例: ${aLogin.agent.rebate_percentage}`);
  console.log(`D盤總代理 ID: ${dLogin.agent.id}, Level: ${dLogin.agent.level}, 退水比例: ${dLogin.agent.rebate_percentage}`);
  
  // 步驟2: 創建A盤15層代理架構 
  console.log('\n=== 步驟2: 創建A盤15層代理架構 ===');
  const aAgents = [aLogin.agent]; // 包含總代理
  let currentParentId = aLogin.agent.id;
  let currentSessionToken = aLogin.sessionToken;
  
  for (let level = 1; level <= 15; level++) {
    // 計算退水比例 (從A盤最大1.1%遞減)
    const maxRebate = 0.011; // 1.1% = 0.011
    const rebatePercentage = Math.max(0.001, maxRebate - (level - 1) * 0.0006).toFixed(4);
    
    const agentData = {
      username: `A${level.toString().padStart(2, '0')}agent`,
      password: `A${level.toString().padStart(2, '0')}pass`,
      level: level,
      parent: currentParentId,
      commission_rate: 0.05, // 5%佣金
      rebate_percentage: parseFloat(rebatePercentage),
      rebate_mode: 'percentage',
      notes: `A盤第${level}層代理，退水比例${(parseFloat(rebatePercentage) * 100).toFixed(2)}%`
    };
    
    const agent = await createAgent(currentSessionToken, agentData);
    if (agent) {
      aAgents.push(agent);
      currentParentId = agent.id;
      
      // 嘗試用新創建的代理登入來創建下一層
      try {
        const subLogin = await login({ username: agentData.username, password: agentData.password });
        currentSessionToken = subLogin.sessionToken;
      } catch (error) {
        console.error(`⚠️  無法登入 ${agentData.username}，使用原token繼續`);
      }
    } else {
      break; // 如果創建失敗，停止繼續創建
    }
    
    // 避免請求過於頻繁
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 步驟3: 創建D盤15層代理架構
  console.log('\n=== 步驟3: 創建D盤15層代理架構 ===');
  const dAgents = [dLogin.agent]; // 包含總代理
  currentParentId = dLogin.agent.id;
  currentSessionToken = dLogin.sessionToken;
  
  for (let level = 1; level <= 15; level++) {
    // 計算退水比例 (從D盤最大4.1%遞減)
    const maxRebate = 0.041; // 4.1% = 0.041
    const rebatePercentage = Math.max(0.005, maxRebate - (level - 1) * 0.002).toFixed(4);
    
    const agentData = {
      username: `D${level.toString().padStart(2, '0')}agent`,
      password: `D${level.toString().padStart(2, '0')}pass`,
      level: level,
      parent: currentParentId,
      commission_rate: 0.05, // 5%佣金
      rebate_percentage: parseFloat(rebatePercentage),
      rebate_mode: 'percentage', 
      notes: `D盤第${level}層代理，退水比例${(parseFloat(rebatePercentage) * 100).toFixed(2)}%`
    };
    
    const agent = await createAgent(currentSessionToken, agentData);
    if (agent) {
      dAgents.push(agent);
      currentParentId = agent.id;
      
      // 嘗試用新創建的代理登入來創建下一層
      try {
        const subLogin = await login({ username: agentData.username, password: agentData.password });
        currentSessionToken = subLogin.sessionToken;
      } catch (error) {
        console.error(`⚠️  無法登入 ${agentData.username}，使用原token繼續`);
      }
    } else {
      break; // 如果創建失敗，停止繼續創建
    }
    
    // 避免請求過於頻繁
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 步驟4: 為部分代理創建測試會員
  console.log('\n=== 步驟4: 創建測試會員 ===');
  
  // A盤會員 - 為前5層代理各創建1個會員
  for (let i = 1; i <= Math.min(5, aAgents.length - 1); i++) {
    const agent = aAgents[i];
    try {
      const subLogin = await login({ 
        username: agent.username || `A${i.toString().padStart(2, '0')}agent`, 
        password: `A${i.toString().padStart(2, '0')}pass` 
      });
      
      const memberData = {
        username: `A${i.toString().padStart(2, '0')}member`,
        password: `A${i.toString().padStart(2, '0')}mem`,
        notes: `A盤第${i}層代理的測試會員`
      };
      
      await createMember(subLogin.sessionToken, memberData, agent.id);
    } catch (error) {
      console.error(`⚠️  創建A盤會員失敗: Level ${i}`);
    }
  }
  
  // D盤會員 - 為前5層代理各創建1個會員
  for (let i = 1; i <= Math.min(5, dAgents.length - 1); i++) {
    const agent = dAgents[i];
    try {
      const subLogin = await login({ 
        username: agent.username || `D${i.toString().padStart(2, '0')}agent`, 
        password: `D${i.toString().padStart(2, '0')}pass` 
      });
      
      const memberData = {
        username: `D${i.toString().padStart(2, '0')}member`,
        password: `D${i.toString().padStart(2, '0')}mem`,
        notes: `D盤第${i}層代理的測試會員`
      };
      
      await createMember(subLogin.sessionToken, memberData, agent.id);
    } catch (error) {
      console.error(`⚠️  創建D盤會員失敗: Level ${i}`);
    }
  }
  
  console.log('\n📊 測試總結:');
  console.log(`A盤代理創建成功: ${aAgents.length - 1}/15 (不含總代理)`);
  console.log(`D盤代理創建成功: ${dAgents.length - 1}/15 (不含總代理)`);
  console.log('\n✅ 階段1測試完成！');
  
  return {
    aAgents,
    dAgents,
    aLogin,
    dLogin
  };
}

// 執行測試
runCompleteTest().catch(console.error);

export { runCompleteTest, login, createAgent, createMember }; 