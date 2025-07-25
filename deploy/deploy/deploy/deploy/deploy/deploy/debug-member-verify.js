import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';

console.log('🔍 調試會員登入驗證API問題');
console.log('='.repeat(50));

async function debugMemberVerify() {
  try {
    console.log('\n📋 步驟1: 直接測試會員信息API');
    
    // 直接測試會員信息API
    const memberInfo = await axios.get(`${AGENT_API}/member/info/DBTestMember`);
    
    if (memberInfo.data.success) {
      console.log(`✅ 會員信息API正常工作`);
      console.log(`  完整回應:`, JSON.stringify(memberInfo.data, null, 2));
      console.log(`  market_type 值:`, memberInfo.data.member.market_type);
      console.log(`  market_type 類型:`, typeof memberInfo.data.member.market_type);
    } else {
      console.log(`❌ 會員信息API失敗:`, memberInfo.data.message);
    }
    
    console.log('\n📋 步驟2: 測試會員登入驗證API');
    
    // 測試會員登入驗證API
    const verifyLogin = await axios.post(`${AGENT_API}/member/verify-login`, {
      username: 'DBTestMember',
      password: 'test123'
    });
    
    if (verifyLogin.data.success) {
      console.log(`✅ 會員登入驗證API請求成功`);
      console.log(`  完整回應:`, JSON.stringify(verifyLogin.data, null, 2));
      console.log(`  market_type 值:`, verifyLogin.data.member.market_type);
      console.log(`  market_type 類型:`, typeof verifyLogin.data.member.market_type);
      
      // 檢查是否有異常
      if (verifyLogin.data.member.market_type === undefined) {
        console.log(`  ❌ market_type 為 undefined`);
        console.log(`  🔍 檢查所有字段:`, Object.keys(verifyLogin.data.member));
      } else {
        console.log(`  ✅ market_type 正常: ${verifyLogin.data.member.market_type}`);
      }
    } else {
      console.log(`❌ 會員登入驗證API失敗:`, verifyLogin.data.message);
    }
    
    console.log('\n📋 步驟3: 測試其他會員');
    
    // 測試其他已知會員
    const testMembers = ['NewTestA', 'NewTestD', 'A01member'];
    
    for (const username of testMembers) {
      console.log(`\n🔍 測試會員: ${username}`);
      
      try {
        // 會員信息API
        const info = await axios.get(`${AGENT_API}/member/info/${username}`);
        if (info.data.success) {
          console.log(`  信息API - market_type: ${info.data.member.market_type}`);
        } else {
          console.log(`  信息API失敗: ${info.data.message}`);
          continue;
        }
        
        // 登入驗證API (需要知道密碼)
        const passwords = {
          'NewTestA': 'test123456',
          'NewTestD': 'test123456', 
          'A01member': 'A01mem'
        };
        
        if (passwords[username]) {
          const verify = await axios.post(`${AGENT_API}/member/verify-login`, {
            username: username,
            password: passwords[username]
          });
          
          if (verify.data.success) {
            console.log(`  驗證API - market_type: ${verify.data.member.market_type}`);
          } else {
            console.log(`  驗證API失敗: ${verify.data.message}`);
          }
        }
        
      } catch (error) {
        console.log(`  測試失敗: ${error.response?.data?.message || error.message}`);
      }
    }
    
    console.log('\n📋 步驟4: 分析問題原因');
    
    console.log(`
🔍 問題分析:

1. 會員信息API (/member/info) 正常返回 market_type
2. 會員登入驗證API (/member/verify-login) 不返回 market_type

可能原因:
a) verify-login API 實現中的 MemberModel.findByUsername 返回數據不完整
b) API 回應組裝時丟失了 market_type 字段
c) 數據庫查詢時 SELECT * 沒有包含 market_type
d) 字段值處理時被過濾掉

建議檢查:
1. MemberModel.findByUsername 的 SQL 查詢
2. verify-login API 的回應組裝邏輯
3. 數據庫連接和字段映射
    `);
    
  } catch (error) {
    console.error('調試過程發生錯誤:', error.message);
  }
}

debugMemberVerify(); 