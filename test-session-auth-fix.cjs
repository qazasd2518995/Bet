const axios = require('axios');

// 測試本地環境的會話認證修復
const API_BASE = 'http://localhost:3003/api/agent';

const testCredentials = {
  username: 'ti2025A',
  password: 'ti2025A'
};

async function testSessionAuth() {
  console.log('🧪 測試輸贏控制會話認證修復\n');
  
  try {
    // 1. 登入獲取會話token
    console.log('1️⃣ 執行登入...');
    const loginResponse = await axios.post(`${API_BASE}/login`, testCredentials);
    
    if (!loginResponse.data.success) {
      console.error('❌ 登入失敗:', loginResponse.data.message);
      return;
    }
    
    const { token, sessionToken } = loginResponse.data;
    console.log('✅ 登入成功');
    console.log(`📝 獲得Token: ${token ? token.substring(0, 20) + '...' : 'None'}`);
    console.log(`📝 獲得SessionToken: ${sessionToken ? sessionToken.substring(0, 20) + '...' : 'None'}`);
    
    // 2. 測試有認證標頭的API調用
    console.log('\n2️⃣ 測試帶認證標頭的列表API...');
    const headers = {};
    if (sessionToken) {
      headers['x-session-token'] = sessionToken;
      headers['X-Session-Token'] = sessionToken;
    }
    if (token) {
      headers['Authorization'] = token;
    }
    
    const listResponse = await axios.get(`${API_BASE}/win-loss-control`, { headers });
    
    if (listResponse.data.success) {
      console.log('✅ 列表API成功');
      console.log(`📊 獲取到 ${listResponse.data.data.length} 筆記錄`);
      
      // 顯示前3筆記錄
      if (listResponse.data.data.length > 0) {
        console.log('\n📋 記錄預覽:');
        listResponse.data.data.slice(0, 3).forEach((item, index) => {
          console.log(`  ${index + 1}. ID:${item.id} 模式:${item.control_mode} 狀態:${item.is_active ? '啟用' : '停用'}`);
        });
      }
    } else {
      console.log('❌ 列表API失敗:', listResponse.data.message);
    }
    
    // 3. 測試沒有認證標頭的API調用（應該失敗）
    console.log('\n3️⃣ 測試無認證標頭的API調用（預期失敗）...');
    try {
      await axios.get(`${API_BASE}/win-loss-control`);
      console.log('⚠️ 無認證調用意外成功（這不應該發生）');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ 無認證調用正確失敗 (401)');
      } else {
        console.log('❓ 無認證調用失敗，但不是401錯誤:', error.response?.status);
      }
    }
    
    // 4. 測試其他相關API
    console.log('\n4️⃣ 測試其他輸贏控制API...');
    
    const apiTests = [
      { name: '代理列表', url: '/win-loss-control/agents' },
      { name: '會員列表', url: '/win-loss-control/members' },
      { name: '當前期數', url: '/win-loss-control/current-period' },
      { name: '活躍控制', url: '/win-loss-control/active' }
    ];
    
    for (const test of apiTests) {
      try {
        const response = await axios.get(`${API_BASE}${test.url}`, { headers });
        if (response.data.success) {
          const dataCount = Array.isArray(response.data.data) ? response.data.data.length : 1;
          console.log(`  ✅ ${test.name}: 成功 (${dataCount} 項)`);
        } else {
          console.log(`  ❌ ${test.name}: 失敗 - ${response.data.message}`);
        }
      } catch (error) {
        console.log(`  ❌ ${test.name}: 錯誤 - ${error.response?.status || error.message}`);
      }
    }
    
    console.log('\n🎉 會話認證測試完成！');
    
  } catch (error) {
    console.error('❌ 測試過程發生錯誤:', error.response?.data || error.message);
  }
}

// 執行測試
testSessionAuth(); 