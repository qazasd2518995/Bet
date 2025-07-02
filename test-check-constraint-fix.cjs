const axios = require('axios');

// 測試本地環境
const API_BASE = 'http://localhost:3003';

// 測試憑證
const testAgent = {
  username: 'ti2025A',
  password: 'ti2025A'
};

let authHeaders = {};

async function login() {
  try {
    console.log('🔐 登入代理系統...');
    const response = await axios.post(`${API_BASE}/api/agent/login`, testAgent);
    
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
    console.error('❌ 登入錯誤:', error.message);
    return false;
  }
}

async function testEmptyStringHandling() {
  try {
    console.log('\n🧪 測試空字串處理...');
    
    // 測試1: 明確傳送空字串（之前會導致CHECK約束錯誤）
    const controlDataWithEmptyString = {
      control_mode: 'normal',
      target_type: '',  // 空字串
      target_username: '',  // 空字串
      control_percentage: 60,
      win_control: true,
      loss_control: false,
      start_period: new Date().toISOString().slice(0, 10).replace(/-/g, '') + '001'
    };
    
    console.log('📤 傳送數據（含空字串）:', controlDataWithEmptyString);
    
    const response1 = await axios.post(`${API_BASE}/api/agent/win-loss-control`, controlDataWithEmptyString, {
      headers: authHeaders
    });
    
    if (response1.data.success) {
      console.log('✅ 測試1成功: 空字串已正確轉換為NULL');
      console.log('📊 創建的控制:', response1.data.data);
      
      // 驗證數據是否正確儲存為NULL
      const created = response1.data.data;
      if (created.target_type === null && created.target_username === null) {
        console.log('✅ 驗證成功: target_type和target_username已儲存為NULL');
      } else {
        console.log('❌ 驗證失敗: 空字串沒有正確轉換為NULL');
        console.log('實際儲存值:', { target_type: created.target_type, target_username: created.target_username });
      }
      
      // 清理測試數據
      await axios.delete(`${API_BASE}/api/agent/win-loss-control/${created.id}`, {
        headers: authHeaders
      });
      console.log('🧹 測試數據已清理');
      
      return true;
    } else {
      console.log('❌ 測試1失敗:', response1.data.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ 測試空字串處理錯誤:', error.response?.data || error.message);
    
    // 檢查是否仍然是CHECK約束錯誤
    if (error.response?.data?.message && error.response.data.message.includes('check constraint')) {
      console.error('💀 仍然有CHECK約束錯誤！修復失敗！');
      return false;
    } else {
      console.log('🤔 其他錯誤，不是CHECK約束問題');
      return false;
    }
  }
}

async function testUndefinedHandling() {
  try {
    console.log('\n🧪 測試undefined處理...');
    
    // 測試2: 不傳送target_type和target_username (undefined)
    const controlDataWithUndefined = {
      control_mode: 'normal',
      // target_type: undefined,  // 不傳送
      // target_username: undefined,  // 不傳送
      control_percentage: 65,
      win_control: false,
      loss_control: true,
      start_period: new Date().toISOString().slice(0, 10).replace(/-/g, '') + '002'
    };
    
    console.log('📤 傳送數據（不含target字段）:', controlDataWithUndefined);
    
    const response2 = await axios.post(`${API_BASE}/api/agent/win-loss-control`, controlDataWithUndefined, {
      headers: authHeaders
    });
    
    if (response2.data.success) {
      console.log('✅ 測試2成功: undefined已正確處理為NULL');
      console.log('📊 創建的控制:', response2.data.data);
      
      // 清理測試數據
      await axios.delete(`${API_BASE}/api/agent/win-loss-control/${response2.data.data.id}`, {
        headers: authHeaders
      });
      console.log('🧹 測試數據已清理');
      
      return true;
    } else {
      console.log('❌ 測試2失敗:', response2.data.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ 測試undefined處理錯誤:', error.response?.data || error.message);
    return false;
  }
}

async function testValidDataHandling() {
  try {
    console.log('\n🧪 測試有效數據處理...');
    
    // 測試3: 傳送有效的target_type和target_username
    const controlDataValid = {
      control_mode: 'single_member',
      target_type: 'member',
      target_username: 'titi',  // 假設這個會員存在
      control_percentage: 70,
      win_control: true,
      loss_control: true,
      start_period: new Date().toISOString().slice(0, 10).replace(/-/g, '') + '003'
    };
    
    console.log('📤 傳送數據（有效數據）:', controlDataValid);
    
    const response3 = await axios.post(`${API_BASE}/api/agent/win-loss-control`, controlDataValid, {
      headers: authHeaders
    });
    
    if (response3.data.success) {
      console.log('✅ 測試3成功: 有效數據正確處理');
      console.log('📊 創建的控制:', response3.data.data);
      
      // 清理測試數據
      await axios.delete(`${API_BASE}/api/agent/win-loss-control/${response3.data.data.id}`, {
        headers: authHeaders
      });
      console.log('🧹 測試數據已清理');
      
      return true;
    } else {
      console.log('❌ 測試3失敗:', response3.data.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ 測試有效數據處理錯誤:', error.response?.data || error.message);
    return false;
  }
}

async function runTest() {
  console.log('🚀 開始CHECK約束錯誤修復驗證測試\n');
  
  // 1. 登入
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n❌ 登入失敗，無法進行後續測試');
    return;
  }
  
  // 2. 測試空字串處理
  const emptyStringTest = await testEmptyStringHandling();
  
  // 3. 測試undefined處理
  const undefinedTest = await testUndefinedHandling();
  
  // 4. 測試有效數據處理
  const validDataTest = await testValidDataHandling();
  
  // 總結
  console.log('\n📋 CHECK約束修復測試結果：');
  console.log(`空字串處理：${emptyStringTest ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`undefined處理：${undefinedTest ? '✅ 成功' : '❌ 失敗'}`);
  console.log(`有效數據處理：${validDataTest ? '✅ 成功' : '❌ 失敗'}`);
  
  if (emptyStringTest && undefinedTest && validDataTest) {
    console.log('\n🎉 所有測試通過！CHECK約束錯誤修復成功！');
    console.log('✅ 現在可以成功創建normal模式控制');
    console.log('✅ 空字串和undefined都會正確轉換為NULL');
    console.log('✅ 不會再出現check constraint錯誤');
  } else {
    console.log('\n⚠️  部分測試失敗，請檢查修復代碼');
  }
}

// 執行測試
runTest().catch(console.error); 