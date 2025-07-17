import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';

console.log('🔧 更新舊會員的市場類型字段');
console.log('='.repeat(50));

async function updateOldMembers() {
  try {
    console.log('\n📋 步驟1: 登入代理查看現有會員');
    
    // 登入A盤代理
    const aAgentLogin = await axios.post(`${AGENT_API}/login`, {
      username: 'A01agent',
      password: 'A01pass'
    });
    
    if (aAgentLogin.data.success) {
      console.log(`✅ A01agent 登入成功，市場類型: ${aAgentLogin.data.agent.market_type}`);
      
      const aMembers = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (aMembers.data.success) {
        console.log(`A01agent 管理的會員:`);
        aMembers.data.members.forEach(member => {
          console.log(`  ${member.username}: market_type=${member.market_type || 'null'}, agent_id=${member.agent_id}`);
        });
        
        // 找到需要更新的會員
        const membersNeedUpdate = aMembers.data.members.filter(m => !m.market_type || m.market_type !== 'A');
        if (membersNeedUpdate.length > 0) {
          console.log(`\n⚠️  發現 ${membersNeedUpdate.length} 個A盤會員需要更新市場類型`);
          
          for (const member of membersNeedUpdate) {
            console.log(`🔄 更新會員 ${member.username} 的市場類型為 A...`);
            
            try {
              // 嘗試通過代理管理平台更新會員信息
              const updateResponse = await axios.put(`${AGENT_API}/member/${member.id}`, {
                market_type: 'A'
              }, {
                headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
              });
              
              if (updateResponse.data.success) {
                console.log(`  ✅ ${member.username} 市場類型更新成功`);
              } else {
                console.log(`  ❌ ${member.username} 更新失敗: ${updateResponse.data.message}`);
              }
            } catch (updateError) {
              console.log(`  ⚠️  ${member.username} 更新API不可用，嘗試其他方法`);
            }
          }
        } else {
          console.log(`✅ 所有A盤會員的市場類型都正確`);
        }
      }
    }
    
    // 登入D盤代理
    const dAgentLogin = await axios.post(`${AGENT_API}/login`, {
      username: 'D01agent',
      password: 'D01pass'
    });
    
    if (dAgentLogin.data.success) {
      console.log(`\n✅ D01agent 登入成功，市場類型: ${dAgentLogin.data.agent.market_type}`);
      
      const dMembers = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${dAgentLogin.data.sessionToken}` }
      });
      
      if (dMembers.data.success) {
        console.log(`D01agent 管理的會員:`);
        dMembers.data.members.forEach(member => {
          console.log(`  ${member.username}: market_type=${member.market_type || 'null'}, agent_id=${member.agent_id}`);
        });
        
        // 找到需要更新的會員
        const membersNeedUpdate = dMembers.data.members.filter(m => !m.market_type || m.market_type !== 'D');
        if (membersNeedUpdate.length > 0) {
          console.log(`\n⚠️  發現 ${membersNeedUpdate.length} 個D盤會員需要更新市場類型`);
          
          for (const member of membersNeedUpdate) {
            console.log(`🔄 更新會員 ${member.username} 的市場類型為 D...`);
            
            try {
              const updateResponse = await axios.put(`${AGENT_API}/member/${member.id}`, {
                market_type: 'D'
              }, {
                headers: { 'Cookie': `sessionToken=${dAgentLogin.data.sessionToken}` }
              });
              
              if (updateResponse.data.success) {
                console.log(`  ✅ ${member.username} 市場類型更新成功`);
              } else {
                console.log(`  ❌ ${member.username} 更新失敗: ${updateResponse.data.message}`);
              }
            } catch (updateError) {
              console.log(`  ⚠️  ${member.username} 更新API不可用，嘗試其他方法`);
            }
          }
        } else {
          console.log(`✅ 所有D盤會員的市場類型都正確`);
        }
      }
    }
    
    console.log('\n📋 步驟2: 驗證更新結果');
    
    // 重新檢查A盤會員
    const updatedAMembers = await axios.get(`${AGENT_API}/members`, {
      headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
    });
    
    if (updatedAMembers.data.success) {
      const a01member = updatedAMembers.data.members.find(m => m.username === 'A01member');
      if (a01member) {
        console.log(`A01member 更新後狀態: market_type=${a01member.market_type}`);
        
        if (a01member.market_type === 'A') {
          console.log(`✅ A01member 市場類型修復成功`);
        } else {
          console.log(`❌ A01member 市場類型仍需修復`);
        }
      }
    }
    
    // 重新檢查D盤會員
    const updatedDMembers = await axios.get(`${AGENT_API}/members`, {
      headers: { 'Cookie': `sessionToken=${dAgentLogin.data.sessionToken}` }
    });
    
    if (updatedDMembers.data.success) {
      const testMemberD01 = updatedDMembers.data.members.find(m => m.username === 'TestMemberD01');
      if (testMemberD01) {
        console.log(`TestMemberD01 更新後狀態: market_type=${testMemberD01.market_type}`);
        
        if (testMemberD01.market_type === 'D') {
          console.log(`✅ TestMemberD01 市場類型修復成功`);
        } else {
          console.log(`❌ TestMemberD01 市場類型仍需修復`);
        }
      }
    }
    
    console.log('\n🎯 結論');
    console.log('='.repeat(50));
    console.log(`
如果上述API更新方法不可用，可能需要：

1. 直接在數據庫中執行SQL更新:
   UPDATE members SET market_type = 'A' WHERE agent_id IN (SELECT id FROM agents WHERE market_type = 'A');
   UPDATE members SET market_type = 'D' WHERE agent_id IN (SELECT id FROM agents WHERE market_type = 'D');

2. 或者重新創建測試會員來驗證新功能

3. 舊會員可以繼續使用，但可能看不到正確的賠率差異
    `);
    
  } catch (error) {
    console.error('更新過程發生錯誤:', error.message);
  }
}

updateOldMembers(); 