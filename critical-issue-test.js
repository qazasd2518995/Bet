import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';
const GAME_API = 'https://bet-game-vcje.onrender.com';

console.log('🚨 关键问题诊断：A盘D盘市场类型传递问题');
console.log('='.repeat(60));

// 1. 检查代理系统中会员的市场类型设置
async function checkMemberMarketType() {
  console.log('\n🔍 步骤1: 检查代理系统中会员的市场类型设置');
  
  try {
    // 检查A盘代理的会员
    const aAgentLogin = await axios.post(`${AGENT_API}/login`, { 
      username: 'A01agent', 
      password: 'A01pass' 
    });
    
    if (aAgentLogin.data.success) {
      console.log(`✅ A01agent 登入成功，市场类型: ${aAgentLogin.data.agent.market_type}`);
      
      const membersResponse = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (membersResponse.data.success) {
        const members = membersResponse.data.members || [];
        console.log(`A01agent 管理的会员数量: ${members.length}`);
        
        const a01member = members.find(m => m.username === 'A01member');
        if (a01member) {
          console.log(`A01member 详细资料:`, {
            id: a01member.id,
            username: a01member.username,
            market_type: a01member.market_type || '未设置',
            agent_id: a01member.agent_id,
            balance: a01member.balance
          });
        } else {
          console.log(`❌ 未找到 A01member`);
        }
      }
    }
    
    // 检查D盘代理的会员
    const dAgentLogin = await axios.post(`${AGENT_API}/login`, { 
      username: 'D01agent', 
      password: 'D01pass' 
    });
    
    if (dAgentLogin.data.success) {
      console.log(`✅ D01agent 登入成功，市场类型: ${dAgentLogin.data.agent.market_type}`);
      
      const membersResponse = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${dAgentLogin.data.sessionToken}` }
      });
      
      if (membersResponse.data.success) {
        const members = membersResponse.data.members || [];
        console.log(`D01agent 管理的会员数量: ${members.length}`);
        
        const testMemberD01 = members.find(m => m.username === 'TestMemberD01');
        if (testMemberD01) {
          console.log(`TestMemberD01 详细资料:`, {
            id: testMemberD01.id,
            username: testMemberD01.username,
            market_type: testMemberD01.market_type || '未设置',
            agent_id: testMemberD01.agent_id,
            balance: testMemberD01.balance
          });
        }
      }
    }
    
  } catch (error) {
    console.error(`❌ 检查失败: ${error.message}`);
  }
}

// 2. 检查会员登入API的回应内容
async function checkMemberLoginAPI() {
  console.log('\n🔍 步骤2: 检查会员登入API的回应内容');
  
  try {
    // 测试A盘会员登入
    const aMemberLogin = await axios.post(`${GAME_API}/api/member/login`, {
      username: 'A01member',
      password: 'A01mem'
    });
    
    console.log('A01member 登入回应完整内容:');
    console.log(JSON.stringify(aMemberLogin.data, null, 2));
    
    // 测试D盘会员登入
    const dMemberLogin = await axios.post(`${GAME_API}/api/member/login`, {
      username: 'TestMemberD01', 
      password: 'D01mem'
    });
    
    console.log('\nTestMemberD01 登入回应完整内容:');
    console.log(JSON.stringify(dMemberLogin.data, null, 2));
    
  } catch (error) {
    console.error(`❌ 会员登入测试失败: ${error.message}`);
  }
}

// 3. 检查游戏数据API的赔率设置
async function checkGameOddsAPI() {
  console.log('\n🔍 步骤3: 检查游戏数据API的赔率设置');
  
  try {
    const gameDataResponse = await axios.get(`${GAME_API}/api/game-data`);
    
    console.log('游戏数据API完整回应:');
    console.log(JSON.stringify(gameDataResponse.data, null, 2));
    
    // 检查是否有动态赔率设置
    const gameData = gameDataResponse.data.gameData;
    if (gameData) {
      console.log('\n赔率分析:');
      console.log(`当前期数: ${gameData.currentPeriod}`);
      console.log(`游戏状态: ${gameData.status}`);
      console.log(`赔率设置:`, gameData.odds || '无赔率设置');
      
      // 检查是否有市场类型相关的赔率差异
      if (gameData.odds) {
        Object.entries(gameData.odds).forEach(([key, value]) => {
          console.log(`  ${key}: ${value}`);
        });
      }
    }
    
  } catch (error) {
    console.error(`❌ 游戏数据检查失败: ${error.message}`);
  }
}

// 4. 检查后端代码中的会员登入API
async function checkBackendMemberAPI() {
  console.log('\n🔍 步骤4: 检查后端API端点');
  
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
        console.log(`⚠️  ${endpoint} 需要授权`);
      } else {
        console.log(`❌ ${endpoint} 错误: ${error.message}`);
      }
    }
  }
}

// 5. 测试手动设置赔率
async function testManualOddsSet() {
  console.log('\n🔍 步骤5: 测试手动设置赔率');
  
  try {
    // 尝试设置A盘赔率
    const aOddsData = {
      market_type: 'A',
      odds: {
        bigSmall: 1.9,
        oddEven: 1.9,
        number: 9.89
      }
    };
    
    console.log('尝试设置A盘赔率:', aOddsData);
    
    try {
      const setOddsResponse = await axios.post(`${GAME_API}/api/set-odds`, aOddsData);
      console.log(`✅ 赔率设置成功:`, setOddsResponse.data);
    } catch (error) {
      console.log(`⚠️  赔率设置API不可用: ${error.response?.status || error.message}`);
    }
    
    // 尝试获取更新后的游戏数据
    const updatedGameData = await axios.get(`${GAME_API}/api/game-data`);
    console.log('更新后的赔率:', updatedGameData.data.gameData?.odds || '无变化');
    
  } catch (error) {
    console.error(`❌ 手动赔率测试失败: ${error.message}`);
  }
}

// 6. 生成修复建议
function generateFixSuggestions() {
  console.log('\n💡 修复建议:');
  console.log('='.repeat(60));
  
  console.log(`
1. 会员登入API修复 (${GAME_API}/api/member/login):
   - 需要在登入回应中添加 market_type 字段
   - 从会员记录或其代理的 market_type 中获取

2. 赔率动态显示修复:
   - 前端需要根据会员的 market_type 显示不同赔率
   - A盘：大小/单双 1.9，号码 9.89
   - D盘：大小/单双 1.88，号码 9.59

3. 市场类型继承确认:
   - 确保会员创建时正确继承代理的 market_type
   - 在数据库中验证会员表是否有 market_type 字段

4. 前端赔率更新逻辑:
   - 修改 updateOddsFromServer() 函数
   - 根据登入回应的 market_type 设置对应赔率
  `);
}

// 主执行函数
async function runCriticalDiagnosis() {
  await checkMemberMarketType();
  await checkMemberLoginAPI();
  await checkGameOddsAPI();
  await checkBackendMemberAPI();
  await testManualOddsSet();
  generateFixSuggestions();
  
  console.log('\n✅ 关键问题诊断完成！');
}

runCriticalDiagnosis().catch(console.error); 