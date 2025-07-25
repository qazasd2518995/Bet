import axios from 'axios';

const AGENT_API = 'https://bet-agent.onrender.com/api/agent';

console.log('🔧 數據庫修復 - 確保members表包含market_type字段');
console.log('='.repeat(60));

async function fixDatabaseMarketType() {
  try {
    console.log('\n📋 測試1: 檢查現有會員的market_type字段');
    
    // 登入A盤代理
    const aAgentLogin = await axios.post(`${AGENT_API}/login`, {
      username: 'A01agent',
      password: 'A01pass'
    });
    
    if (aAgentLogin.data.success) {
      console.log(`✅ A01agent 登入成功，市場類型: ${aAgentLogin.data.agent.market_type}`);
      
      // 獲取會員列表
      const aMembers = await axios.get(`${AGENT_API}/members`, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (aMembers.data.success) {
        console.log(`A01agent 管理的會員數量: ${aMembers.data.members.length}`);
        
        aMembers.data.members.forEach(member => {
          console.log(`  ${member.username}: id=${member.id}, market_type=${member.market_type || 'null'}, agent_id=${member.agent_id}`);
        });
        
        const needsUpdate = aMembers.data.members.filter(m => !m.market_type);
        if (needsUpdate.length > 0) {
          console.log(`\n⚠️  發現 ${needsUpdate.length} 個會員缺少market_type字段`);
        } else {
          console.log(`✅ 所有會員都有market_type字段`);
        }
      }
    }
    
    console.log('\n📋 測試2: 創建測試會員驗證數據庫結構');
    
    // 創建一個測試會員來檢查數據庫結構
    try {
      const testMember = await axios.post(`${AGENT_API}/create-member`, {
        username: 'DBTestMember',
        password: 'test123',
        agentId: aAgentLogin.data.agent.id,
        notes: '數據庫測試會員'
      }, {
        headers: { 'Cookie': `sessionToken=${aAgentLogin.data.sessionToken}` }
      });
      
      if (testMember.data.success) {
        console.log(`✅ 成功創建測試會員: DBTestMember`);
        
        // 立即查詢這個會員的詳細信息
        const memberInfo = await axios.get(`${AGENT_API}/member/info/DBTestMember`);
        
        if (memberInfo.data.success) {
          console.log(`測試會員詳細信息:`, memberInfo.data.member);
          
          if (memberInfo.data.member.market_type) {
            console.log(`✅ 數據庫正確支持market_type字段: ${memberInfo.data.member.market_type}`);
          } else {
            console.log(`❌ 數據庫不支持market_type字段或字段為null`);
          }
        }
        
        // 測試會員登入驗證API
        const loginTest = await axios.post(`${AGENT_API}/member/verify-login`, {
          username: 'DBTestMember',
          password: 'test123'
        });
        
        if (loginTest.data.success) {
          console.log(`✅ 會員登入驗證成功`);
          console.log(`  驗證API返回的market_type: ${loginTest.data.member.market_type}`);
          
          if (loginTest.data.member.market_type === 'A') {
            console.log(`  ✅ 驗證API正確返回A盤類型`);
          } else {
            console.log(`  ❌ 驗證API返回錯誤類型: ${loginTest.data.member.market_type}`);
          }
        }
        
      } else {
        console.log(`❌ 創建測試會員失敗: ${testMember.data.message}`);
      }
    } catch (error) {
      console.log(`❌ 創建測試會員請求失敗: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n📋 測試3: 檢查遊戲平台登入API');
    
    // 測試遊戲平台會員登入API
    try {
      const gameLogin = await axios.post('https://bet-game-vcje.onrender.com/api/member/login', {
        username: 'DBTestMember',
        password: 'test123'
      });
      
      if (gameLogin.data.success) {
        console.log(`✅ 遊戲平台登入成功`);
        console.log(`  遊戲平台返回的數據:`, gameLogin.data.member);
        
        if (gameLogin.data.member.market_type) {
          console.log(`  ✅ 遊戲平台正確獲得market_type: ${gameLogin.data.member.market_type}`);
        } else {
          console.log(`  ❌ 遊戲平台未獲得market_type字段`);
        }
      } else {
        console.log(`❌ 遊戲平台登入失敗: ${gameLogin.data.message}`);
      }
    } catch (error) {
      console.log(`❌ 遊戲平台登入請求失敗: ${error.response?.data?.message || error.message}`);
    }
    
    console.log('\n🎯 診斷結果');
    console.log('='.repeat(60));
    
    console.log(`
📊 市場類型功能診斷:

如果發現問題，可能的解決方案:

1. 數據庫缺少market_type列:
   ALTER TABLE members ADD COLUMN market_type VARCHAR(1) DEFAULT 'D';

2. 現有會員缺少市場類型:
   UPDATE members SET market_type = 'A' 
   WHERE agent_id IN (SELECT id FROM agents WHERE market_type = 'A');
   
   UPDATE members SET market_type = 'D' 
   WHERE agent_id IN (SELECT id FROM agents WHERE market_type = 'D');

3. 確保數據同步:
   需要重啟代理系統服務使更改生效

4. 測試順序:
   a) 代理系統會員創建 ✓
   b) 代理系統會員登入驗證 ✓
   c) 遊戲平台會員登入 (需要從代理系統獲取market_type)
   d) 遊戲數據API根據市場類型返回不同賠率
    `);
    
  } catch (error) {
    console.error('診斷過程發生錯誤:', error.message);
  }
}

fixDatabaseMarketType(); 