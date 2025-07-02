const axios = require('axios');

// Render生產環境測試
const RENDER_API = 'https://bet-agent.onrender.com'; // 請替換為實際的Render URL

// 測試憑證
const testAgent = {
  username: 'ti2025A',
  password: 'ti2025A'
};

let authHeaders = {};

async function login() {
  try {
    console.log('🔐 登入Render代理系統...');
    const response = await axios.post(`${RENDER_API}/api/agent/login`, testAgent, {
      timeout: 30000
    });
    
    if (response.data.success) {
      const sessionToken = response.data.sessionToken;
      authHeaders = {
        'Authorization': `Bearer ${sessionToken}`,
        'x-session-token': sessionToken,
        'Content-Type': 'application/json'
      };
      console.log('✅ 登入成功');
      return true;
    } else {
      console.log('❌ 登入失敗:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ 登入錯誤:', error.response?.data || error.message);
    return false;
  }
}

async function testListAPI() {
  try {
    console.log('\n📋 測試輸贏控制列表API...');
    const response = await axios.get(`${RENDER_API}/api/agent/win-loss-control`, {
      headers: authHeaders,
      timeout: 30000
    });
    
    if (response.data.success) {
      console.log('✅ 列表API成功');
      console.log(`📊 獲取到 ${response.data.data.length} 筆控制記錄`);
      
      // 檢查數據完整性
      response.data.data.forEach((control, index) => {
        console.log(`  ${index + 1}. ID:${control.id} 模式:${control.control_mode} 目標:${control.target_display_name || 'NULL'}`);
      });
      
      return true;
    } else {
      console.log('❌ 列表API失敗:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ 列表API錯誤:', error.response?.data || error.message);
    if (error.response?.data?.message === '伺服器錯誤') {
      console.error('⚠️  這是BigInt NaN錯誤，需要執行資料庫修復SQL');
    }
    return false;
  }
}

async function testCreateAPI() {
  try {
    console.log('\n📝 測試創建normal模式控制...');
    const controlData = {
      control_mode: 'normal',
      control_percentage: 55,
      win_control: true,
      loss_control: false,
      start_period: new Date().toISOString().slice(0, 10).replace(/-/g, '') + '001'
    };
    
    const response = await axios.post(`${RENDER_API}/api/agent/win-loss-control`, controlData, {
      headers: authHeaders,
      timeout: 30000
    });
    
    if (response.data.success) {
      console.log('✅ 創建API成功');
      console.log(`📝 創建控制ID: ${response.data.data.id}`);
      return response.data.data.id;
    } else {
      console.log('❌ 創建API失敗:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ 創建API錯誤:', error.response?.data || error.message);
    if (error.response?.data?.message && error.response.data.message.includes('check constraint')) {
      console.error('⚠️  這是CHECK約束錯誤，需要執行約束修復SQL');
    }
    return null;
  }
}

async function testDeleteAPI(controlId) {
  try {
    console.log(`\n🗑️  測試刪除控制 ID: ${controlId}...`);
    const response = await axios.delete(`${RENDER_API}/api/agent/win-loss-control/${controlId}`, {
      headers: authHeaders,
      timeout: 30000
    });
    
    if (response.data.success) {
      console.log('✅ 刪除API成功');
      return true;
    } else {
      console.log('❌ 刪除API失敗:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ 刪除API錯誤:', error.response?.data || error.message);
    return false;
  }
}

async function runTest() {
  console.log('🧪 開始Render生產環境修復驗證測試\n');
  console.log(`測試目標: ${RENDER_API}`);
  
  // 1. 登入
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n❌ 登入失敗，無法進行後續測試');
    return;
  }
  
  // 2. 測試列表API（最容易觸發BigInt錯誤）
  const listSuccess = await testListAPI();
  
  // 3. 測試創建API（會觸發CHECK約束錯誤）
  const createdId = await testCreateAPI();
  
  // 4. 如果創建成功，測試刪除API
  let deleteSuccess = false;
  if (createdId) {
    deleteSuccess = await testDeleteAPI(createdId);
  }
  
  // 總結
  console.log('\n📋 Render修復驗證結果：');
  console.log(`登入測試：${loginSuccess ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`列表測試：${listSuccess ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`創建測試：${createdId ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`刪除測試：${deleteSuccess ? '✅ 成功' : '❌ 失敗'}`);
  
  if (listSuccess && createdId && deleteSuccess) {
    console.log('\n🎉 所有測試通過！Render修復成功！');
  } else {
    console.log('\n⚠️  部分測試失敗，請按照production-fix-commands.md執行修復');
  }
}

// 執行測試
runTest().catch(console.error); 