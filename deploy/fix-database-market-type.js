import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';

console.log('🔧 数据库修复 - 确保members表包含market_type字段');
console.log('='.repeat(60));

async function fixDatabaseMarketType() {
  try {
    console.log('\n📋 测试1: 检查现有会员的market_type字段');
    
    // 登入A盘代理
    const aAgentLogin = await axios.post(`${AGENT_API}/login`, {
      username: 'A01agent',
      password: 'A01pass'
    });
    
    if (aAgentLogin.data.success) {
      console.log(`✅ A01agent 登入成功，市场类型: ${aAgentLogin.data.agent.market_type}`);
      
      // 获取会员列表
      const aMembers = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (aMembers.data.success) {
        console.log(`A01agent 管理的会员数量: ${aMembers.data.members.length}`);
        
        aMembers.data.members.forEach(member => {
          console.log(`  ${member.username}: id=${member.id}, market_type=${member.market_type || 'null'}, agent_id=${member.agent_id}`);
        });
        
        const needsUpdate = aMembers.data.members.filter(m => !m.market_type);
        if (needsUpdate.length > 0) {
          console.log(`\n⚠️  发现 ${needsUpdate.length} 个会员缺少market_type字段`);
        } else {
          console.log(`✅ 所有会员都有market_type字段`);
        }
      }
    }
    
    console.log('\n📋 测试2: 创建测试会员验证数据库结构');
    
    // 创建一个测试会员来检查数据库结构
    try {
      const testMember = await axios.post(`${AGENT_API}/create-member`, {
        username: 'DBTestMember',
        password: 'test123',
        agentId: aAgentLogin.data.agent.id,
        notes: '数据库测试会员'
      }, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (testMember.data.success) {
        console.log(`✅ 成功创建测试会员: DBTestMember`);
        
        // 立即查询这个会员的详细信息
        const memberInfo = await axios.get(`${AGENT_API}/member/info/DBTestMember`);
        
        if (memberInfo.data.success) {
          console.log(`测试会员详细信息:`, memberInfo.data.member);
          
          if (memberInfo.data.member.market_type) {
            console.log(`✅ 数据库正确支持market_type字段: ${memberInfo.data.member.market_type}`);
          } else {
            console.log(`❌ 数据库不支持market_type字段或字段为null`);
          }
        }
        
        // 测试会员登入验证API
        const loginTest = await axios.post(`${AGENT_API}/member/verify-login`, {
          username: 'DBTestMember',
          password: 'test123'
        });
        
        if (loginTest.data.success) {
          console.log(`✅ 会员登入验证成功`);
          console.log(`  验证API返回的market_type: ${loginTest.data.member.market_type}`);
          
          if (loginTest.data.member.market_type === 'A') {
            console.log(`  ✅ 验证API正确返回A盘类型`);
          } else {
            console.log(`  ❌ 验证API返回错误类型: ${loginTest.data.member.market_type}`);
          }
        }
        
      } else {
        console.log(`❌ 创建测试会员失败: ${testMember.data.message}`);
      }
    } catch (error) {
      console.log(`❌ 创建测试会员请求失败: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n📋 测试3: 检查游戏平台登入API');
    
    // 测试游戏平台会员登入API
    try {
      const gameLogin = await axios.post('https://bet-game-vcje.onrender.com/api/member/login', {
        username: 'DBTestMember',
        password: 'test123'
      });
      
      if (gameLogin.data.success) {
        console.log(`✅ 游戏平台登入成功`);
        console.log(`  游戏平台返回的数据:`, gameLogin.data.member);
        
        if (gameLogin.data.member.market_type) {
          console.log(`  ✅ 游戏平台正确获得market_type: ${gameLogin.data.member.market_type}`);
        } else {
          console.log(`  ❌ 游戏平台未获得market_type字段`);
        }
      } else {
        console.log(`❌ 游戏平台登入失败: ${gameLogin.data.message}`);
      }
    } catch (error) {
      console.log(`❌ 游戏平台登入请求失败: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n🎯 诊断结果');
    console.log('='.repeat(60));
    
    console.log(`
📊 市场类型功能诊断:

如果发现问题，可能的解决方案:

1. 数据库缺少market_type列:
   ALTER TABLE members ADD COLUMN market_type VARCHAR(1) DEFAULT 'D';

2. 现有会员缺少市场类型:
   UPDATE members SET market_type = 'A' 
   WHERE agent_id IN (SELECT id FROM agents WHERE market_type = 'A');
   
   UPDATE members SET market_type = 'D' 
   WHERE agent_id IN (SELECT id FROM agents WHERE market_type = 'D');

3. 确保数据同步:
   需要重启代理系统服务使更改生效

4. 测试顺序:
   a) 代理系统会员创建 ✓
   b) 代理系统会员登入验证 ✓
   c) 游戏平台会员登入 (需要从代理系统获取market_type)
   d) 游戏数据API根据市场类型返回不同赔率
    `);
    
  } catch (error) {
    console.error('诊断过程发生错误:', error.message);
  }
}

fixDatabaseMarketType(); 