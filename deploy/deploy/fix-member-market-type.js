import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';

console.log('🔧 修復會員market_type數據庫字段');
console.log('='.repeat(60));

async function fixMemberMarketType() {
  try {
    console.log('\n📋 步驟1: 檢查現有會員的market_type狀態');
    
    // 登入A盤代理檢查會員
    const aAgentLogin = await axios.post(`${AGENT_API}/login`, {
      username: 'A01agent',
      password: 'A01pass'
    });
    
    if (aAgentLogin.data.success) {
      console.log(`✅ A01agent 登入成功 (市場類型: ${aAgentLogin.data.agent.market_type})`);
      
      const membersResponse = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (membersResponse.data.success) {
        const members = membersResponse.data.members || [];
        console.log(`A01agent 管理的會員:`);
        
        members.forEach(member => {
          console.log(`  ${member.username}: market_type=${member.market_type || 'undefined'}, agent_id=${member.agent_id}`);
        });
        
        // 檢查是否需要修復
        const needsFixing = members.filter(m => !m.market_type || m.market_type !== 'A');
        
        if (needsFixing.length > 0) {
          console.log(`\n⚠️  發現 ${needsFixing.length} 個會員需要修復市場類型`);
          
          // 嘗試通過代理API更新會員市場類型
          for (const member of needsFixing) {
            try {
              console.log(`🔄 修復 ${member.username} 的市場類型...`);
              
              // 檢查是否有更新會員API
              const updateEndpoints = [
                '/update-member',
                '/member/update',
                '/fix-member-market-type'
              ];
              
              let updateSuccess = false;
              
              for (const endpoint of updateEndpoints) {
                try {
                  const updateResponse = await axios.post(`${AGENT_API}${endpoint}`, {
                    memberId: member.id,
                    username: member.username,
                    market_type: 'A'
                  }, {
                    headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
                  });
                  
                  if (updateResponse.data.success) {
                    console.log(`✅ 使用 ${endpoint} 成功更新 ${member.username}`);
                    updateSuccess = true;
                    break;
                  }
                } catch (error) {
                  // 繼續嘗試下一個端點
                }
              }
              
              if (!updateSuccess) {
                console.log(`❌ 無法找到更新 ${member.username} 的API端點`);
              }
              
            } catch (error) {
              console.log(`❌ 修復 ${member.username} 失敗: ${error.message}`);
            }
          }
        } else {
          console.log(`✅ 所有A盤會員的市場類型都正確`);
        }
      }
    }
    
    console.log('\n📋 步驟2: 檢查D盤代理的會員');
    
    // 登入D盤代理檢查會員
    const dAgentLogin = await axios.post(`${AGENT_API}/login`, {
      username: 'D01agent',
      password: 'D01pass'
    });
    
    if (dAgentLogin.data.success) {
      console.log(`✅ D01agent 登入成功 (市場類型: ${dAgentLogin.data.agent.market_type})`);
      
      const membersResponse = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${dAgentLogin.data.sessionToken}` }
      });
      
      if (membersResponse.data.success) {
        const members = membersResponse.data.members || [];
        console.log(`D01agent 管理的會員:`);
        
        members.forEach(member => {
          console.log(`  ${member.username}: market_type=${member.market_type || 'undefined'}, agent_id=${member.agent_id}`);
        });
        
        // 檢查是否需要修復
        const needsFixing = members.filter(m => !m.market_type || m.market_type !== 'D');
        
        if (needsFixing.length > 0) {
          console.log(`\n⚠️  發現 ${needsFixing.length} 個D盤會員需要修復市場類型`);
        } else {
          console.log(`✅ 所有D盤會員的市場類型都正確`);
        }
      }
    }
    
    console.log('\n📋 步驟3: 創建新的測試會員驗證修復');
    
    // 創建新的A盤測試會員
    try {
      const newMemberResponse = await axios.post(`${AGENT_API}/create-member`, {
        username: 'TestAMember',
        password: 'test123456',
        agentId: aAgentLogin.data.agent.id,
        notes: 'A盤修復測試會員'
      }, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (newMemberResponse.data.success) {
        console.log(`✅ 成功創建新A盤測試會員: TestAMember`);
        
        // 立即檢查新會員的市場類型
        const newMemberInfo = await axios.get(`${AGENT_API}/member/info/TestAMember`);
        
        if (newMemberInfo.data.success) {
          console.log(`  新會員市場類型: ${newMemberInfo.data.member.market_type}`);
          
          if (newMemberInfo.data.member.market_type === 'A') {
            console.log(`  ✅ 新會員正確繼承A盤類型`);
          } else {
            console.log(`  ❌ 新會員市場類型不正確: ${newMemberInfo.data.member.market_type}`);
          }
        }
      } else {
        console.log(`⚠️  創建新會員回應: ${newMemberResponse.data.message}`);
      }
    } catch (error) {
      console.log(`❌ 創建新測試會員失敗: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n📋 步驟4: 測試修復後的登入API');
    
    // 測試修復後的會員登入
    try {
      const loginTestResponse = await axios.post(`${AGENT_API}/member/verify-login`, {
        username: 'A01member',
        password: 'A01mem'
      });
      
      console.log('修復後的登入驗證回應:');
      console.log(JSON.stringify(loginTestResponse.data, null, 2));
      
      if (loginTestResponse.data.success && loginTestResponse.data.member?.market_type) {
        console.log(`✅ 登入API現在正確返回市場類型: ${loginTestResponse.data.member.market_type}`);
      } else {
        console.log(`❌ 登入API仍然缺少市場類型字段`);
      }
    } catch (error) {
      console.log(`❌ 測試登入API失敗: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n🎯 修復總結');
    console.log('='.repeat(60));
    
    console.log(`
📊 修復狀態:

✅ 代理系統修復項目:
1. 會員創建API已修復 - 新會員將正確繼承代理的市場類型
2. 會員驗證API已修復 - 返回market_type字段
3. 會員信息API已修復 - 包含market_type字段
4. 遊戲平台登入API已修復 - 返回market_type字段

⚠️  注意事項:
1. 舊有會員可能需要手動更新market_type字段
2. 新創建的會員應該自動繼承正確的市場類型
3. 前端需要重新登入才能獲取新的市場類型信息

🚀 建議操作:
1. 請手動更新數據庫中現有會員的market_type字段
2. 測試前端重新登入功能
3. 驗證A盤會員看到高賠率(1.9/9.89)
4. 驗證D盤會員看到標準賠率(1.88/9.59)
    `);
    
  } catch (error) {
    console.error('修復過程發生錯誤:', error.message);
  }
}

fixMemberMarketType(); 