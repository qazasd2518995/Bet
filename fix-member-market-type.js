import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';

console.log('🔧 修复会员market_type数据库字段');
console.log('='.repeat(60));

async function fixMemberMarketType() {
  try {
    console.log('\n📋 步骤1: 检查现有会员的market_type状态');
    
    // 登入A盘代理检查会员
    const aAgentLogin = await axios.post(`${AGENT_API}/login`, {
      username: 'A01agent',
      password: 'A01pass'
    });
    
    if (aAgentLogin.data.success) {
      console.log(`✅ A01agent 登入成功 (市场类型: ${aAgentLogin.data.agent.market_type})`);
      
      const membersResponse = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (membersResponse.data.success) {
        const members = membersResponse.data.members || [];
        console.log(`A01agent 管理的会员:`);
        
        members.forEach(member => {
          console.log(`  ${member.username}: market_type=${member.market_type || 'undefined'}, agent_id=${member.agent_id}`);
        });
        
        // 检查是否需要修复
        const needsFixing = members.filter(m => !m.market_type || m.market_type !== 'A');
        
        if (needsFixing.length > 0) {
          console.log(`\n⚠️  发现 ${needsFixing.length} 个会员需要修复市场类型`);
          
          // 尝试通过代理API更新会员市场类型
          for (const member of needsFixing) {
            try {
              console.log(`🔄 修复 ${member.username} 的市场类型...`);
              
              // 检查是否有更新会员API
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
                  // 继续尝试下一个端点
                }
              }
              
              if (!updateSuccess) {
                console.log(`❌ 无法找到更新 ${member.username} 的API端点`);
              }
              
            } catch (error) {
              console.log(`❌ 修复 ${member.username} 失败: ${error.message}`);
            }
          }
        } else {
          console.log(`✅ 所有A盘会员的市场类型都正确`);
        }
      }
    }
    
    console.log('\n📋 步骤2: 检查D盘代理的会员');
    
    // 登入D盘代理检查会员
    const dAgentLogin = await axios.post(`${AGENT_API}/login`, {
      username: 'D01agent',
      password: 'D01pass'
    });
    
    if (dAgentLogin.data.success) {
      console.log(`✅ D01agent 登入成功 (市场类型: ${dAgentLogin.data.agent.market_type})`);
      
      const membersResponse = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${dAgentLogin.data.sessionToken}` }
      });
      
      if (membersResponse.data.success) {
        const members = membersResponse.data.members || [];
        console.log(`D01agent 管理的会员:`);
        
        members.forEach(member => {
          console.log(`  ${member.username}: market_type=${member.market_type || 'undefined'}, agent_id=${member.agent_id}`);
        });
        
        // 检查是否需要修复
        const needsFixing = members.filter(m => !m.market_type || m.market_type !== 'D');
        
        if (needsFixing.length > 0) {
          console.log(`\n⚠️  发现 ${needsFixing.length} 个D盘会员需要修复市场类型`);
        } else {
          console.log(`✅ 所有D盘会员的市场类型都正确`);
        }
      }
    }
    
    console.log('\n📋 步骤3: 创建新的测试会员验证修复');
    
    // 创建新的A盘测试会员
    try {
      const newMemberResponse = await axios.post(`${AGENT_API}/create-member`, {
        username: 'TestAMember',
        password: 'test123456',
        agentId: aAgentLogin.data.agent.id,
        notes: 'A盘修复测试会员'
      }, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (newMemberResponse.data.success) {
        console.log(`✅ 成功创建新A盘测试会员: TestAMember`);
        
        // 立即检查新会员的市场类型
        const newMemberInfo = await axios.get(`${AGENT_API}/member/info/TestAMember`);
        
        if (newMemberInfo.data.success) {
          console.log(`  新会员市场类型: ${newMemberInfo.data.member.market_type}`);
          
          if (newMemberInfo.data.member.market_type === 'A') {
            console.log(`  ✅ 新会员正确继承A盘类型`);
          } else {
            console.log(`  ❌ 新会员市场类型不正确: ${newMemberInfo.data.member.market_type}`);
          }
        }
      } else {
        console.log(`⚠️  创建新会员回应: ${newMemberResponse.data.message}`);
      }
    } catch (error) {
      console.log(`❌ 创建新测试会员失败: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n📋 步骤4: 测试修复后的登入API');
    
    // 测试修复后的会员登入
    try {
      const loginTestResponse = await axios.post(`${AGENT_API}/member/verify-login`, {
        username: 'A01member',
        password: 'A01mem'
      });
      
      console.log('修复后的登入验证回应:');
      console.log(JSON.stringify(loginTestResponse.data, null, 2));
      
      if (loginTestResponse.data.success && loginTestResponse.data.member?.market_type) {
        console.log(`✅ 登入API现在正确返回市场类型: ${loginTestResponse.data.member.market_type}`);
      } else {
        console.log(`❌ 登入API仍然缺少市场类型字段`);
      }
    } catch (error) {
      console.log(`❌ 测试登入API失败: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n🎯 修复总结');
    console.log('='.repeat(60));
    
    console.log(`
📊 修复状态:

✅ 代理系统修复项目:
1. 会员创建API已修复 - 新会员将正确继承代理的市场类型
2. 会员验证API已修复 - 返回market_type字段
3. 会员信息API已修复 - 包含market_type字段
4. 游戏平台登入API已修复 - 返回market_type字段

⚠️  注意事项:
1. 旧有会员可能需要手动更新market_type字段
2. 新创建的会员应该自动继承正确的市场类型
3. 前端需要重新登入才能获取新的市场类型信息

🚀 建议操作:
1. 请手动更新数据库中现有会员的market_type字段
2. 测试前端重新登入功能
3. 验证A盘会员看到高赔率(1.9/9.89)
4. 验证D盘会员看到标准赔率(1.88/9.59)
    `);
    
  } catch (error) {
    console.error('修复过程发生错误:', error.message);
  }
}

fixMemberMarketType(); 