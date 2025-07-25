const axios = require('axios');

// 測試配置
const AGENT_API_URL = 'https://bet-agent.onrender.com';

async function testAgentAPIFix() {
  console.log('🔍 測試代理系統API路徑修復...\n');
  
  const testApis = [
    {
      name: '開獎結果同步API',
      path: '/api/agent/sync-draw-record',
      method: 'POST',
      body: {
        period: '20250703999',
        result: { champion: 1, runnerup: 2, third: 3 },
        draw_time: new Date().toISOString()
      }
    },
    {
      name: '輸贏控制檢查API',
      path: '/api/agent/internal/win-loss-control/active',
      method: 'GET'
    },
    {
      name: '會員餘額查詢API',
      path: '/api/agent/member-balance?username=justin111',
      method: 'GET'
    },
    {
      name: '會員資訊查詢API',
      path: '/api/agent/member/info/justin111',
      method: 'GET'
    }
  ];
  
  console.log('🚀 開始測試各個API端點...\n');
  
  for (const api of testApis) {
    try {
      console.log(`📡 測試 ${api.name}:`);
      console.log(`   路徑: ${AGENT_API_URL}${api.path}`);
      
      let response;
      if (api.method === 'POST') {
        response = await axios.post(`${AGENT_API_URL}${api.path}`, api.body, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000
        });
      } else {
        response = await axios.get(`${AGENT_API_URL}${api.path}`, {
          timeout: 5000
        });
      }
      
      if (response.status === 200) {
        console.log(`   ✅ 狀態: ${response.status} - API路徑正確`);
        if (response.data?.success !== undefined) {
          console.log(`   📊 響應: success=${response.data.success}`);
        }
      } else {
        console.log(`   ⚠️ 狀態: ${response.status} - 非預期響應`);
      }
      
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          console.log(`   ❌ 狀態: 404 - API路徑仍然錯誤或不存在`);
        } else if (status === 400) {
          console.log(`   ⚠️ 狀態: 400 - API路徑正確，但參數有誤（正常情況）`);
        } else if (status === 401 || status === 403) {
          console.log(`   ⚠️ 狀態: ${status} - API路徑正確，但需要認證（正常情況）`);
        } else {
          console.log(`   ⚠️ 狀態: ${status} - API路徑正確，其他錯誤`);
        }
      } else if (error.code === 'ECONNABORTED') {
        console.log(`   ⏰ 超時 - 可能服務正在重啟中`);
      } else {
        console.log(`   ❌ 網路錯誤: ${error.message}`);
      }
    }
    
    console.log(''); // 空行分隔
  }
  
  console.log('🎯 修復說明:');
  console.log('修復前錯誤路徑例子:');
  console.log('  - https://bet-agent.onrender.com/sync-draw-record ❌');
  console.log('  - https://bet-agent.onrender.com/internal/win-loss-control/active ❌');
  console.log('');
  console.log('修復後正確路徑:');
  console.log('  - https://bet-agent.onrender.com/api/agent/sync-draw-record ✅');
  console.log('  - https://bet-agent.onrender.com/api/agent/internal/win-loss-control/active ✅');
  console.log('');
  console.log('✅ 如果看到200狀態或400/401狀態，說明API路徑已修復正確');
  console.log('❌ 如果看到404狀態，說明API路徑仍有問題');
}

// 運行測試
console.log('🚀 開始測試代理系統API路徑修復...\n');
testAgentAPIFix().then(() => {
  console.log('\n🎉 測試完成！');
}).catch(error => {
  console.error('💥 測試失敗:', error.message);
}); 