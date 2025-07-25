import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';

console.log('⚡ 快速API测试');
console.log('='.repeat(30));

async function quickTest() {
  try {
    console.log('\n🔍 测试最新会员 DBTestMember...');
    
    // 测试会员登入验证API
    const response = await axios.post(`${AGENT_API}/member/verify-login`, {
      username: 'DBTestMember',
      password: 'test123'
    }, {
      timeout: 10000
    });
    
    console.log(`✅ API请求成功`);
    console.log(`回应状态: ${response.status}`);
    console.log(`完整回应:`);
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.member) {
      const member = response.data.member;
      console.log(`\n📊 会员字段分析:`);
      console.log(`所有字段: ${Object.keys(member).join(', ')}`);
      console.log(`market_type 存在: ${member.hasOwnProperty('market_type')}`);
      console.log(`market_type 值: ${member.market_type}`);
      console.log(`market_type 类型: ${typeof member.market_type}`);
      
      if (member.market_type) {
        console.log(`✅ market_type 正常: ${member.market_type}`);
      } else {
        console.log(`❌ market_type 缺失或为falsy值`);
      }
    }
    
    // 对比测试会员信息API
    console.log(`\n🔍 对比会员信息API...`);
    const infoResponse = await axios.get(`${AGENT_API}/member/info/DBTestMember`);
    
    if (infoResponse.data.success) {
      console.log(`会员信息API market_type: ${infoResponse.data.member.market_type}`);
      
      if (infoResponse.data.member.market_type && !response.data.member.market_type) {
        console.log(`⚠️  确认问题: 信息API有market_type，验证API没有`);
      }
    }
    
  } catch (error) {
    console.error(`❌ 测试失败:`, error.message);
    if (error.response) {
      console.log(`错误回应:`, error.response.data);
    }
  }
}

quickTest(); 