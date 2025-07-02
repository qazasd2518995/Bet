const axios = require('axios');

const AGENT_API = 'http://localhost:3003';

// 測試憑證
const testAgent = {
  username: 'ti2025A', 
  password: 'ti2025A'
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

async function testCreateAndDeleteControl() {
  try {
    console.log('\n📝 測試創建輸贏控制...');
    const controlData = {
      control_mode: 'single_member',
      target_type: 'member',
      target_username: 'titi',
      control_percentage: 75,
      win_control: true,
      loss_control: false,
      start_period: 20250703001
    };
    
    // 創建控制
    const createResponse = await axios.post(`${AGENT_API}/api/agent/win-loss-control`, controlData, {
      headers: authHeaders
    });
    
    if (createResponse.data.success) {
      const controlId = createResponse.data.data.id;
      console.log('✅ 創建控制成功, ID:', controlId);
      
      // 立即嘗試刪除
      console.log(`\n🗑️  測試刪除輸贏控制 ID: ${controlId}...`);
      const deleteResponse = await axios.delete(`${AGENT_API}/api/agent/win-loss-control/${controlId}`, {
        headers: authHeaders
      });
      
      if (deleteResponse.data.success) {
        console.log('✅ 刪除控制成功 - NULL外鍵修復生效！');
        return true;
      } else {
        console.log('❌ 刪除控制失敗:', deleteResponse.data.message);
        return false;
      }
    } else {
      console.log('❌ 創建控制失敗:', createResponse.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ 測試過程錯誤:', error.response?.data || error.message);
    return false;
  }
}

async function testMultipleDeleteOperations() {
  try {
    console.log('\n🔄 測試多個刪除操作...');
    
    // 創建多個控制設定
    const controlIds = [];
    for (let i = 0; i < 3; i++) {
      const controlData = {
        control_mode: 'normal',
        control_percentage: 50 + i * 10,
        win_control: i % 2 === 0,
        loss_control: i % 2 === 1,
        start_period: 20250703001 + i
      };
      
      const response = await axios.post(`${AGENT_API}/api/agent/win-loss-control`, controlData, {
        headers: authHeaders
      });
      
      if (response.data.success) {
        controlIds.push(response.data.data.id);
        console.log(`✅ 創建控制 ${i + 1}, ID: ${response.data.data.id}`);
      }
    }
    
    // 依序刪除所有控制
    let deleteSuccessCount = 0;
    for (const controlId of controlIds) {
      try {
        const deleteResponse = await axios.delete(`${AGENT_API}/api/agent/win-loss-control/${controlId}`, {
          headers: authHeaders
        });
        
        if (deleteResponse.data.success) {
          console.log(`✅ 刪除控制 ID: ${controlId} 成功`);
          deleteSuccessCount++;
        }
      } catch (deleteError) {
        console.error(`❌ 刪除控制 ID: ${controlId} 失敗:`, deleteError.response?.data || deleteError.message);
      }
    }
    
    console.log(`\n📊 刪除結果：${deleteSuccessCount}/${controlIds.length} 成功`);
    return deleteSuccessCount === controlIds.length;
    
  } catch (error) {
    console.error('❌ 多重刪除測試錯誤:', error.response?.data || error.message);
    return false;
  }
}

async function runTest() {
  console.log('🧪 開始輸贏控制NULL外鍵修復測試\n');
  
  // 1. 登入
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('❌ 無法登入，測試終止');
    return;
  }
  
  // 2. 測試基本創建和刪除
  const basicTestSuccess = await testCreateAndDeleteControl();
  
  // 3. 測試多個刪除操作
  const multipleTestSuccess = await testMultipleDeleteOperations();
  
  // 總結
  console.log('\n📋 測試結果總結：');
  console.log(`基本刪除測試：${basicTestSuccess ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`多重刪除測試：${multipleTestSuccess ? '✅ 成功' : '❌ 失敗'}`);
  
  if (basicTestSuccess && multipleTestSuccess) {
    console.log('\n🎉 所有測試通過！NULL外鍵修復成功！');
  } else {
    console.log('\n⚠️  部分測試失敗，需要進一步檢查');
  }
}

// 執行測試
runTest().catch(console.error); 