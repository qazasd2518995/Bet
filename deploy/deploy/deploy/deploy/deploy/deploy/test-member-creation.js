import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';
const GAME_API = 'https://bet-game-vcje.onrender.com';

// 測試會員創建和登入
async function testMemberManagement() {
  console.log('🔍 詳細測試會員創建和登入功能');
  
  try {
    // 1. 登入A01agent
    console.log('\n1. 測試A盤代理登入...');
    const agentResponse = await axios.post(`${AGENT_API}/login`, {
      username: 'A01agent',
      password: 'A01pass'
    });
    
    if (!agentResponse.data.success) {
      throw new Error('A01agent登入失敗');
    }
    
    const agentData = agentResponse.data;
    console.log(`✅ A01agent 登入成功，ID: ${agentData.agent.id}`);
    
    // 2. 檢查現有會員
    console.log('\n2. 檢查A01agent的現有會員...');
    const membersResponse = await axios.get(`${AGENT_API}/members`, {
      headers: { 'Cookie': `sessionToken=${agentData.sessionToken}` }
    });
    
    if (membersResponse.data.success) {
      console.log(`現有會員數: ${membersResponse.data.members?.length || 0}`);
      membersResponse.data.members?.forEach(member => {
        console.log(`  - ${member.username} (ID: ${member.id})`);
      });
    }
    
    // 3. 創建新會員（如果不存在）
    console.log('\n3. 嘗試創建新會員...');
    const memberUsername = 'TestMemberA01';
    const memberPassword = 'test123456';
    
    try {
      const createMemberResponse = await axios.post(`${AGENT_API}/create-member`, {
        username: memberUsername,
        password: memberPassword,
        agentId: agentData.agent.id,
        notes: '測試會員'
      }, {
        headers: { 'Cookie': `sessionToken=${agentData.sessionToken}` }
      });
      
      if (createMemberResponse.data.success) {
        console.log(`✅ 創建會員成功: ${memberUsername}`);
      } else {
        console.log(`⚠️  創建會員回應: ${createMemberResponse.data.message}`);
      }
    } catch (error) {
      console.error(`❌ 創建會員失敗:`, error.response?.data || error.message);
    }
    
    // 4. 測試會員登入遊戲平台
    console.log('\n4. 測試會員登入遊戲平台...');
    
    // 先測試已知存在的會員
    try {
      const memberLoginResponse = await axios.post(`${GAME_API}/api/member/login`, {
        username: 'A01member',
        password: 'A01mem'
      });
      
      if (memberLoginResponse.data.success) {
        console.log(`✅ A01member 遊戲平台登入成功`);
        console.log(`會員資料:`, {
          username: memberLoginResponse.data.member?.username,
          balance: memberLoginResponse.data.member?.balance,
          market_type: memberLoginResponse.data.member?.market_type
        });
      }
    } catch (error) {
      console.error(`❌ A01member 遊戲平台登入失敗:`, error.response?.data?.message);
    }
    
    // 5. 測試賠率API
    console.log('\n5. 測試賠率API...');
    try {
      const memberLoginResponse = await axios.post(`${GAME_API}/api/member/login`, {
        username: 'A01member',
        password: 'A01mem'
      });
      
      if (memberLoginResponse.data.success) {
        const token = memberLoginResponse.data.token;
        
        // 測試不同的賠率API端點
        const endpoints = [
          '/api/odds',
          '/api/game/odds', 
          '/api/current-odds',
          '/odds'
        ];
        
        for (const endpoint of endpoints) {
          try {
            const oddsResponse = await axios.get(`${GAME_API}${endpoint}`, {
              headers: { 
                'Cookie': `token=${token}`,
                'Authorization': `Bearer ${token}`
              }
            });
            
            console.log(`✅ ${endpoint} 成功返回數據`);
            if (oddsResponse.data.odds) {
              console.log(`  冠軍大: ${oddsResponse.data.odds.champion?.big || 'N/A'}`);
              console.log(`  冠軍小: ${oddsResponse.data.odds.champion?.small || 'N/A'}`);
            }
            break;
          } catch (error) {
            console.log(`❌ ${endpoint} 失敗: ${error.response?.status}`);
          }
        }
      }
    } catch (error) {
      console.error('賠率測試失敗:', error.message);
    }
    
    // 6. 測試D盤
    console.log('\n6. 測試D盤會員...');
    
    // 登入D01agent並嘗試創建會員
    try {
      const dAgentResponse = await axios.post(`${AGENT_API}/login`, {
        username: 'D01agent',
        password: 'D01pass'
      });
      
      if (dAgentResponse.data.success) {
        console.log(`✅ D01agent 登入成功`);
        
        const dMemberUsername = 'TestMemberD01';
        const dMemberPassword = 'test123456';
        
        const createDMemberResponse = await axios.post(`${AGENT_API}/create-member`, {
          username: dMemberUsername,
          password: dMemberPassword,
          agentId: dAgentResponse.data.agent.id,
          notes: 'D盤測試會員'
        }, {
          headers: { 'Cookie': `sessionToken=${dAgentResponse.data.sessionToken}` }
        });
        
        if (createDMemberResponse.data.success) {
          console.log(`✅ 創建D盤會員成功: ${dMemberUsername}`);
          
          // 測試D盤會員登入
          const dMemberLogin = await axios.post(`${GAME_API}/api/member/login`, {
            username: dMemberUsername,
            password: dMemberPassword
          });
          
          if (dMemberLogin.data.success) {
            console.log(`✅ D盤會員登入遊戲平台成功`);
            console.log(`D盤會員市場類型: ${dMemberLogin.data.member?.market_type}`);
          }
        } else {
          console.log(`⚠️  創建D盤會員回應: ${createDMemberResponse.data.message}`);
        }
      }
    } catch (error) {
      console.error('D盤測試失敗:', error.response?.data?.message || error.message);
    }
    
  } catch (error) {
    console.error('測試整體失敗:', error.message);
  }
}

// 執行測試
testMemberManagement().catch(console.error); 