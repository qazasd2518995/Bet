import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';
const GAME_API = 'https://bet-game-vcje.onrender.com';

console.log('🚨 關鍵問題診斷：A盤D盤市場類型傳遞問題');
console.log('='.repeat(60));

// 1. 檢查代理系統中會員的市場類型設置
async function checkMemberMarketType() {
  console.log('\n🔍 步驟1: 檢查代理系統中會員的市場類型設置');
  
  try {
    // 檢查A盤代理的會員
    const aAgentLogin = await axios.post(`${AGENT_API}/login`, { 
      username: 'A01agent', 
      password: 'A01pass' 
    });
    
    if (aAgentLogin.data.success) {
      console.log(`✅ A01agent 登入成功，市場類型: ${aAgentLogin.data.agent.market_type}`);
      
      const membersResponse = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (membersResponse.data.success) {
        const members = membersResponse.data.members || [];
        console.log(`A01agent 管理的會員數量: ${members.length}`);
        
        const a01member = members.find(m => m.username === 'A01member');
        if (a01member) {
          console.log(`A01member 詳細資料:`, {
            id: a01member.id,
            username: a01member.username,
            market_type: a01member.market_type || '未設置',
            agent_id: a01member.agent_id,
            balance: a01member.balance
          });
        } else {
          console.log(`❌ 未找到 A01member`);
        }
      }
    }
    
    // 檢查D盤代理的會員
    const dAgentLogin = await axios.post(`${AGENT_API}/login`, { 
      username: 'D01agent', 
      password: 'D01pass' 
    });
    
    if (dAgentLogin.data.success) {
      console.log(`✅ D01agent 登入成功，市場類型: ${dAgentLogin.data.agent.market_type}`);
      
      const membersResponse = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${dAgentLogin.data.sessionToken}` }
      });
      
      if (membersResponse.data.success) {
        const members = membersResponse.data.members || [];
        console.log(`D01agent 管理的會員數量: ${members.length}`);
        
        const testMemberD01 = members.find(m => m.username === 'TestMemberD01');
        if (testMemberD01) {
          console.log(`TestMemberD01 詳細資料:`, {
            id: testMemberD01.id,
            username: testMemberD01.username,
            market_type: testMemberD01.market_type || '未設置',
            agent_id: testMemberD01.agent_id,
            balance: testMemberD01.balance
          });
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ 檢查失敗: ${error.message}`);
  }
}

// 2. 檢查會員登入API的回應內容
async function checkMemberLoginAPI() {
  console.log('\n🔍 步驟2: 檢查會員登入API的回應內容');
  
  try {
    // 測試A盤會員登入
    const aMemberLogin = await axios.post(`${GAME_API}/api/member/login`, {
      username: 'A01member',
      password: 'A01mem'
    });
    
    console.log('A01member 登入回應完整內容:');
    console.log(JSON.stringify(aMemberLogin.data, null, 2));
    
    // 測試D盤會員登入
    const dMemberLogin = await axios.post(`${GAME_API}/api/member/login`, {
      username: 'TestMemberD01', 
      password: 'D01mem'
    });
    
    console.log('\nTestMemberD01 登入回應完整內容:');
    console.log(JSON.stringify(dMemberLogin.data, null, 2));
    
  } catch (error) {
    console.error(`❌ 會員登入測試失敗: ${error.message}`);
  }
}

// 3. 檢查遊戲數據API的賠率設置
async function checkGameOddsAPI() {
  console.log('\n🔍 步驟3: 檢查遊戲數據API的賠率設置');
  
  try {
    const gameDataResponse = await axios.get(`${GAME_API}/api/game-data`);
    
    console.log('遊戲數據API完整回應:');
    console.log(JSON.stringify(gameDataResponse.data, null, 2));
    
    // 檢查是否有動態賠率設置
    const gameData = gameDataResponse.data.gameData;
    if (gameData) {
      console.log('\n賠率分析:');
      console.log(`當前期數: ${gameData.currentPeriod}`);
      console.log(`遊戲狀態: ${gameData.status}`);
      console.log(`賠率設置:`, gameData.odds || '無賠率設置');
      
      // 檢查是否有市場類型相關的賠率差異
      if (gameData.odds) {
        Object.entries(gameData.odds).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
    }
    
  } catch (error) {
    console.error(`❌ 遊戲數據檢查失敗: ${error.message}`);
  }
}

// 4. 檢查後端代碼中的會員登入API
async function checkBackendMemberAPI() {
  console.log('\n🔍 步驟4: 檢查後端API端點');
  
  const endpoints = [
    '/api/member/profile',
    '/api/member/info', 
    '/api/member/data',
    '/api/game-settings',
    '/api/odds-settings'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await axios.get(`${GAME_API}${endpoint}`);
      console.log(`✅ ${endpoint} 可用:`, Object.keys(response.data));
    } catch (error) {
      if (error.response?.status === 404) {
        console.log(`⚠️  ${endpoint} 不存在`);
      } else if (error.response?.status === 401) {
        console.log(`⚠️  ${endpoint} 需要授權`);
      } else {
        console.log(`❌ ${endpoint} 錯誤: ${error.message}`);
      }
    }
  }
}

// 5. 測試手動設置賠率
async function testManualOddsSet() {
  console.log('\n🔍 步驟5: 測試手動設置賠率');
  
  try {
    // 嘗試設置A盤賠率
    const aOddsData = {
      market_type: 'A',
      odds: {
        bigSmall: 1.9,
        oddEven: 1.9,
        number: 9.89
      }
    };
    
    console.log('嘗試設置A盤賠率:', aOddsData);
    
    try {
      const setOddsResponse = await axios.post(`${GAME_API}/api/set-odds`, aOddsData);
      console.log(`✅ 賠率設置成功:`, setOddsResponse.data);
    } catch (error) {
      console.log(`⚠️  賠率設置API不可用: ${error.response?.status || error.message}`);
    }
    
    // 嘗試獲取更新後的遊戲數據
    const updatedGameData = await axios.get(`${GAME_API}/api/game-data`);
    console.log('更新後的賠率:', updatedGameData.data.gameData?.odds || '無變化');
    
  } catch (error) {
    console.error(`❌ 手動賠率測試失敗: ${error.message}`);
  }
}

// 6. 生成修復建議
function generateFixSuggestions() {
  console.log('\n💡 修復建議:');
  console.log('='.repeat(60));
  
  console.log(`
1. 會員登入API修復 (${GAME_API}/api/member/login):
   - 需要在登入回應中添加 market_type 字段
   - 從會員記錄或其代理的 market_type 中獲取

2. 賠率動態顯示修復:
   - 前端需要根據會員的 market_type 顯示不同賠率
   - A盤：大小/單雙 1.9，號碼 9.89
   - D盤：大小/單雙 1.88，號碼 9.59

3. 市場類型繼承確認:
   - 確保會員創建時正確繼承代理的 market_type
   - 在數據庫中驗證會員表是否有 market_type 字段

4. 前端賠率更新邏輯:
   - 修改 updateOddsFromServer() 函數
   - 根據登入回應的 market_type 設置對應賠率
  `);
}

// 主執行函數
async function runCriticalDiagnosis() {
  await checkMemberMarketType();
  await checkMemberLoginAPI();
  await checkGameOddsAPI();
  await checkBackendMemberAPI();
  await testManualOddsSet();
  generateFixSuggestions();
  
  console.log('\n✅ 關鍵問題診斷完成！');
}

runCriticalDiagnosis().catch(console.error); 