import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';

console.log('⚡ 快速API測試');
console.log('='.repeat(30));

async function quickTest() {
  try {
    console.log('\n🔍 測試最新會員 DBTestMember...');
    
    // 測試會員登入驗證API
    const response = await axios.post(`${AGENT_API}/member/verify-login`, {
      username: 'DBTestMember',
      password: 'test123'
    }, {
      timeout: 10000
    });
    
    console.log(`✅ API請求成功`);
    console.log(`回應狀態: ${response.status}`);
    console.log(`完整回應:`);
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.member) {
      const member = response.data.member;
      console.log(`\n📊 會員字段分析:`);
      console.log(`所有字段: ${Object.keys(member).join(', ')}`);
      console.log(`market_type 存在: ${member.hasOwnProperty('market_type')}`);
      console.log(`market_type 值: ${member.market_type}`);
      console.log(`market_type 類型: ${typeof member.market_type}`);
      
      if (member.market_type) {
        console.log(`✅ market_type 正常: ${member.market_type}`);
      } else {
        console.log(`❌ market_type 缺失或為falsy值`);
      }
    }
    
    // 對比測試會員信息API
    console.log(`\n🔍 對比會員信息API...`);
    const infoResponse = await axios.get(`${AGENT_API}/member/info/DBTestMember`);
    
    if (infoResponse.data.success) {
      console.log(`會員信息API market_type: ${infoResponse.data.member.market_type}`);
      
      if (infoResponse.data.member.market_type && !response.data.member.market_type) {
        console.log(`⚠️  確認問題: 信息API有market_type，驗證API沒有`);
      }
    }
    
  } catch (error) {
    console.error(`❌ 測試失敗:`, error.message);
    if (error.response) {
      console.log(`錯誤回應:`, error.response.data);
    }
  }
}

quickTest(); 