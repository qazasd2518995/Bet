const axios = require('axios');

const AGENT_API = 'https://bet-agent-backend.onrender.com';

// 測試憑證
const testAgent = {
  username: 'ti2025A', 
  password: 'Ti2025a!'
};

let authHeaders = {};

async function login() {
  try {
    console.log('🔐 開始登入測試代理...');
    const response = await axios.post(`${AGENT_API}/api/agent/login`, testAgent);
    
    if (response.data.success) {
      const sessionToken = response.data.sessionToken;
      authHeaders = {
        'Authorization': `Bearer ${sessionToken}`,
        'x-session-token': sessionToken,
        'Content-Type': 'application/json'
      };
      console.log('✅ 登入成功');
      return true;
    }
  } catch (error) {
    console.error('❌ 登入失敗:', error.response?.data || error.message);
    return false;
  }
}

async function testWinLossControlList() {
  try {
    console.log('\n📋 測試獲取輸贏控制列表...');
    const response = await axios.get(`${AGENT_API}/api/agent/win-loss-control`, {
      headers: authHeaders
    });
    
    if (response.data.success) {
      console.log('✅ 獲取列表成功');
      console.log(`📊 共有 ${response.data.data.length} 條記錄`);
      
      // 檢查是否有NaN值
      const hasNaNTarget = response.data.data.some(item => 
        item.target_id && isNaN(parseInt(item.target_id))
      );
      
      if (hasNaNTarget) {
        console.log('⚠️  發現NaN target_id值');
      } else {
        console.log('✅ 沒有發現NaN值');
      }
      
      return response.data.data;
    } else {
      console.log('❌ 獲取列表失敗:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ 獲取列表錯誤:', error.response?.data || error.message);
    return null;
  }
}

async function testCreateControl() {
  try {
    console.log('\n➕ 測試創建輸贏控制...');
    const controlData = {
      control_mode: 'single_member',
      target_type: 'member',
      target_username: 'titi',
      control_percentage: 80,
      win_control: true,
      loss_control: false,
      start_period: 20250703001
    };
    
    const response = await axios.post(`${AGENT_API}/api/agent/win-loss-control`, controlData, {
      headers: authHeaders
    });
    
    if (response.data.success) {
      console.log('✅ 創建控制成功, ID:', response.data.data.id);
      return response.data.data.id;
    } else {
      console.log('❌ 創建控制失敗:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ 創建控制錯誤:', error.response?.data || error.message);
    return null;
  }
}

async function testDeleteControl(controlId) {
  try {
    console.log(`\n🗑️  測試刪除輸贏控制 ID: ${controlId}...`);
    const response = await axios.delete(`${AGENT_API}/api/agent/win-loss-control/${controlId}`, {
      headers: authHeaders
    });
    
    if (response.data.success) {
      console.log('✅ 刪除控制成功');
      return true;
    } else {
      console.log('❌ 刪除控制失敗:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ 刪除控制錯誤:', error.response?.data || error.message);
    return false;
  }
}

async function testActiveControl() {
  try {
    console.log('\n🎯 測試獲取活躍控制...');
    const response = await axios.get(`${AGENT_API}/api/agent/win-loss-control/active`, {
      headers: authHeaders
    });
    
    if (response.data.success) {
      console.log('✅ 獲取活躍控制成功');
      if (response.data.data && response.data.data.id) {
        console.log(`📊 活躍控制 ID: ${response.data.data.id}, 模式: ${response.data.data.control_mode}`);
      } else {
        console.log('📊 沒有活躍的控制設定');
      }
      return response.data.data;
    } else {
      console.log('❌ 獲取活躍控制失敗:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ 獲取活躍控制錯誤:', error.response?.data || error.message);
    return null;
  }
}

async function runTest() {
  console.log('🧪 開始輸贏控制系統BigInt修復測試\n');
  
  // 1. 登入
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ 無法登入，測試終止');
    return;
  }
  
  // 2. 測試獲取列表（檢查NaN問題）
  const controls = await testWinLossControlList();
  if (!controls) {
    console.log('❌ 無法獲取控制列表');
    return;
  }
  
  // 3. 測試獲取活躍控制
  await testActiveControl();
  
  // 4. 創建新控制
  const newControlId = await testCreateControl();
  if (!newControlId) {
    console.log('❌ 無法創建新控制');
    return;
  }
  
  // 5. 測試刪除（檢查外鍵約束問題）
  const deleteSuccess = await testDeleteControl(newControlId);
  if (deleteSuccess) {
    console.log('✅ 刪除測試成功');
  } else {
    console.log('❌ 刪除測試失敗');
  }
  
  // 6. 再次獲取列表確認刪除
  console.log('\n🔄 確認刪除結果...');
  await testWinLossControlList();
  
  console.log('\n🎉 所有測試完成！');
}

// 執行測試
runTest().catch(console.error); 