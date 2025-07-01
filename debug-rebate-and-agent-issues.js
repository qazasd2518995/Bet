import axios from 'axios';

// 設定API端點
const GAME_API = 'http://localhost:3000';
const AGENT_API = 'http://localhost:3001/api/agent';

async function debugRebateAndAgentIssues() {
  console.log('🔍 開始調試退水分配和代理層級顯示問題...\n');
  
  try {
    // 1. 檢查ti2025A創建的代理
    console.log('1. 檢查ti2025A創建的代理...');
    const agentResponse = await axios.get(`${AGENT_API}/agents`, {
      params: {
        parentId: 1, // ti2025A的ID應該是1
        page: 1,
        limit: 50
      }
    });
    
    if (agentResponse.data.success) {
      const agents = agentResponse.data.data?.list || [];
      console.log(`✅ 找到 ${agents.length} 個下級代理:`);
      agents.forEach(agent => {
        console.log(`  - ${agent.username} (ID: ${agent.id}, Level: ${agent.level}, 退水模式: ${agent.rebate_mode}, 退水比例: ${agent.rebate_percentage})`);
      });
      
      // 2. 檢查這些代理創建的會員
      if (agents.length > 0) {
        console.log('\n2. 檢查這些代理創建的會員...');
        for (const agent of agents) {
          const memberResponse = await axios.get(`${AGENT_API}/members`, {
            params: {
              agentId: agent.id,
              status: '-1',
              page: 1,
              limit: 50
            }
          });
          
          if (memberResponse.data.success) {
            const members = memberResponse.data.data?.list || [];
            console.log(`  代理 ${agent.username} 有 ${members.length} 個會員:`);
            members.forEach(member => {
              console.log(`    - ${member.username} (ID: ${member.id}, 餘額: ${member.balance}, agent_id: ${member.agent_id})`);
            });
          }
        }
      }
    } else {
      console.log('❌ 獲取代理列表失敗:', agentResponse.data.message);
    }
    
    // 3. 測試退水分配機制
    console.log('\n3. 測試退水分配機制...');
    
    // 首先獲取一個測試會員的代理鏈
    const testUsername = 'test123'; // 假設這是一個測試會員
    console.log(`測試會員: ${testUsername}`);
    
    const chainResponse = await axios.get(`${AGENT_API}/member-agent-chain`, {
      params: { username: testUsername }
    });
    
    if (chainResponse.data.success) {
      console.log('✅ 代理鏈獲取成功:');
      chainResponse.data.agentChain.forEach((agent, index) => {
        console.log(`  Level ${index}: ${agent.username} (ID: ${agent.id}, 退水模式: ${agent.rebate_mode}, 退水比例: ${agent.rebate_percentage})`);
      });
    } else {
      console.log('❌ 代理鏈獲取失敗:', chainResponse.data.message);
    }
    
    // 4. 檢查代理層級分析報表
    console.log('\n4. 檢查代理層級分析報表...');
    const reportResponse = await axios.get(`${AGENT_API}/reports/agent-analysis`, {
      params: {
        agentId: 1, // ti2025A
        viewType: 'agents'
      }
    });
    
    if (reportResponse.data.success) {
      console.log('✅ 代理層級分析報表:');
      const reportData = reportResponse.data.reportData || [];
      reportData.forEach(agent => {
        console.log(`  - ${agent.username} (Level: ${agent.level}, 下注數: ${agent.betCount}, 退水: ${agent.rebate})`);
      });
    } else {
      console.log('❌ 代理層級分析報表失敗:', reportResponse.data.message);
    }
    
    // 5. 檢查所有會員的代理歸屬
    console.log('\n5. 檢查所有會員的代理歸屬...');
    const allMembersResponse = await axios.get(`${AGENT_API}/downline-members`, {
      params: {
        rootAgentId: 1 // ti2025A
      }
    });
    
    if (allMembersResponse.data.success) {
      const allMembers = allMembersResponse.data.members || [];
      console.log(`✅ 整條代理線共有 ${allMembers.length} 個會員:`);
      allMembers.forEach(member => {
        console.log(`  - ${member.username} (代理: ${member.agentUsername}, 代理ID: ${member.agentId})`);
      });
    } else {
      console.log('❌ 獲取整條代理線會員失敗:', allMembersResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ 調試過程出錯:', error.message);
    if (error.response) {
      console.error('錯誤響應:', error.response.data);
    }
  }
}

// 執行調試
debugRebateAndAgentIssues().then(() => {
  console.log('\n🔚 調試完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 調試失敗:', error);
  process.exit(1);
}); 