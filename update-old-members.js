import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';

console.log('🔧 更新旧会员的市场类型字段');
console.log('='.repeat(50));

async function updateOldMembers() {
  try {
    console.log('\n📋 步骤1: 登入代理查看现有会员');
    
    // 登入A盘代理
    const aAgentLogin = await axios.post(`${AGENT_API}/login`, {
      username: 'A01agent',
      password: 'A01pass'
    });
    
    if (aAgentLogin.data.success) {
      console.log(`✅ A01agent 登入成功，市场类型: ${aAgentLogin.data.agent.market_type}`);
      
      const aMembers = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (aMembers.data.success) {
        console.log(`A01agent 管理的会员:`);
        aMembers.data.members.forEach(member => {
          console.log(`  ${member.username}: market_type=${member.market_type || 'null'}, agent_id=${member.agent_id}`);
        });
        
        // 找到需要更新的会员
        const membersNeedUpdate = aMembers.data.members.filter(m => !m.market_type || m.market_type !== 'A');
        if (membersNeedUpdate.length > 0) {
          console.log(`\n⚠️  发现 ${membersNeedUpdate.length} 个A盘会员需要更新市场类型`);
          
          for (const member of membersNeedUpdate) {
            console.log(`🔄 更新会员 ${member.username} 的市场类型为 A...`);
            
            try {
              // 尝试通过代理管理平台更新会员信息
              const updateResponse = await axios.put(`${AGENT_API}/member/${member.id}`, {
                market_type: 'A'
              }, {
                headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
              });
              
              if (updateResponse.data.success) {
                console.log(`  ✅ ${member.username} 市场类型更新成功`);
              } else {
                console.log(`  ❌ ${member.username} 更新失败: ${updateResponse.data.message}`);
              }
            } catch (updateError) {
              console.log(`  ⚠️  ${member.username} 更新API不可用，尝试其他方法`);
            }
          }
        } else {
          console.log(`✅ 所有A盘会员的市场类型都正确`);
        }
      }
    }
    
    // 登入D盘代理
    const dAgentLogin = await axios.post(`${AGENT_API}/login`, {
      username: 'D01agent',
      password: 'D01pass'
    });
    
    if (dAgentLogin.data.success) {
      console.log(`\n✅ D01agent 登入成功，市场类型: ${dAgentLogin.data.agent.market_type}`);
      
      const dMembers = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${dAgentLogin.data.sessionToken}` }
      });
      
      if (dMembers.data.success) {
        console.log(`D01agent 管理的会员:`);
        dMembers.data.members.forEach(member => {
          console.log(`  ${member.username}: market_type=${member.market_type || 'null'}, agent_id=${member.agent_id}`);
        });
        
        // 找到需要更新的会员
        const membersNeedUpdate = dMembers.data.members.filter(m => !m.market_type || m.market_type !== 'D');
        if (membersNeedUpdate.length > 0) {
          console.log(`\n⚠️  发现 ${membersNeedUpdate.length} 个D盘会员需要更新市场类型`);
          
          for (const member of membersNeedUpdate) {
            console.log(`🔄 更新会员 ${member.username} 的市场类型为 D...`);
            
            try {
              const updateResponse = await axios.put(`${AGENT_API}/member/${member.id}`, {
                market_type: 'D'
              }, {
                headers: { 'Cookie': `sessionToken=${dAgentLogin.data.sessionToken}` }
              });
              
              if (updateResponse.data.success) {
                console.log(`  ✅ ${member.username} 市场类型更新成功`);
              } else {
                console.log(`  ❌ ${member.username} 更新失败: ${updateResponse.data.message}`);
              }
            } catch (updateError) {
              console.log(`  ⚠️  ${member.username} 更新API不可用，尝试其他方法`);
            }
          }
        } else {
          console.log(`✅ 所有D盘会员的市场类型都正确`);
        }
      }
    }
    
    console.log('\n📋 步骤2: 验证更新结果');
    
    // 重新检查A盘会员
    const updatedAMembers = await axios.get(`${AGENT_API}/members`, {
      headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
    });
    
    if (updatedAMembers.data.success) {
      const a01member = updatedAMembers.data.members.find(m => m.username === 'A01member');
      if (a01member) {
        console.log(`A01member 更新后状态: market_type=${a01member.market_type}`);
        
        if (a01member.market_type === 'A') {
          console.log(`✅ A01member 市场类型修复成功`);
        } else {
          console.log(`❌ A01member 市场类型仍需修复`);
        }
      }
    }
    
    // 重新检查D盘会员
    const updatedDMembers = await axios.get(`${AGENT_API}/members`, {
      headers: { 'Cookie': `sessionToken=${dAgentLogin.data.sessionToken}` }
    });
    
    if (updatedDMembers.data.success) {
      const testMemberD01 = updatedDMembers.data.members.find(m => m.username === 'TestMemberD01');
      if (testMemberD01) {
        console.log(`TestMemberD01 更新后状态: market_type=${testMemberD01.market_type}`);
        
        if (testMemberD01.market_type === 'D') {
          console.log(`✅ TestMemberD01 市场类型修复成功`);
        } else {
          console.log(`❌ TestMemberD01 市场类型仍需修复`);
        }
      }
    }
    
    console.log('\n🎯 结论');
    console.log('='.repeat(50));
    console.log(`
如果上述API更新方法不可用，可能需要：

1. 直接在数据库中执行SQL更新:
   UPDATE members SET market_type = 'A' WHERE agent_id IN (SELECT id FROM agents WHERE market_type = 'A');
   UPDATE members SET market_type = 'D' WHERE agent_id IN (SELECT id FROM agents WHERE market_type = 'D');

2. 或者重新创建测试会员来验证新功能

3. 旧会员可以继续使用，但可能看不到正确的赔率差异
    `);
    
  } catch (error) {
    console.error('更新过程发生错误:', error.message);
  }
}

updateOldMembers(); 