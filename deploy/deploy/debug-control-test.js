import axios from 'axios';

const AGENT_URL = 'http://localhost:3003/api/agent';
const GAME_URL = 'http://localhost:3000';

let authHeaders = {};

// 管理員登錄
async function adminLogin() {
  const response = await axios.post(`${AGENT_URL}/login`, {
    username: 'ti2025A', password: 'ti2025A'
  });
  
  if (response.data.success) {
    const { token, sessionToken } = response.data;
    authHeaders = { 'Authorization': token, 'x-session-token': sessionToken };
    console.log('✅ 管理員登錄成功!');
    return true;
  }
  return false;
}

// 檢查活躍控制
async function checkActiveControl() {
  try {
    console.log('🔍 檢查活躍控制設定...');
    const response = await axios.get(`${AGENT_URL}/win-loss-control/active`, {
      headers: authHeaders
    });
    
    console.log('活躍控制回應:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('檢查活躍控制失敗:', error.response?.data || error.message);
    return null;
  }
}

// 創建測試控制
async function createTestControl() {
  try {
    console.log('🎯 創建測試控制...');
    
    const gameData = await axios.get(`${GAME_URL}/api/game-data`);
    const currentPeriod = gameData.data.gameData.currentPeriod;
    const nextPeriod = currentPeriod + 1;
    
    console.log(`當前期數: ${currentPeriod}, 設置控制期數: ${nextPeriod}`);
    
    const response = await axios.post(`${AGENT_URL}/win-loss-control`, {
      control_mode: 'single_member',
      target_type: 'member', 
      target_username: 'memberA1',
      control_percentage: 100,
      win_control: true,
      loss_control: false,
      start_period: nextPeriod.toString()
    }, { headers: authHeaders });
    
    if (response.data.success) {
      const controlId = response.data.data.id;
      console.log(`✅ 控制創建成功 (ID: ${controlId})`);
      
      // 激活控制
      await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/activate`, {}, {
        headers: authHeaders
      });
      console.log('✅ 控制已激活');
      
      return { controlId, targetPeriod: nextPeriod };
    }
    
    return null;
  } catch (error) {
    console.error('創建控制失敗:', error.response?.data || error.message);
    return null;
  }
}

// 測試API直接調用
async function testAPIDirectly() {
  try {
    console.log('🔬 直接測試代理系統API...');
    const response = await axios.get(`${AGENT_URL}/win-loss-control/active`);
    console.log('API回應:', JSON.stringify(response.data, null, 2));
    
    // 測試遊戲後端能否訪問這個API
    console.log('🔬 測試遊戲後端API訪問...');
    const gameResponse = await fetch('http://localhost:3003/api/agent/win-loss-control/active');
    const gameData = await gameResponse.json();
    console.log('遊戲後端API訪問結果:', JSON.stringify(gameData, null, 2));
    
  } catch (error) {
    console.error('API測試失敗:', error.message);
  }
}

// 主函數
async function main() {
  console.log('🔧 輸贏控制調試測試');
  console.log('=' .repeat(50));
  
  await adminLogin();
  
  // 檢查現有控制
  await checkActiveControl();
  
  // 創建新控制
  const controlInfo = await createTestControl();
  
  if (controlInfo) {
    console.log(`\n📋 控制設定完成:`);
    console.log(`   控制ID: ${controlInfo.controlId}`);
    console.log(`   目標期數: ${controlInfo.targetPeriod}`);
    console.log(`   目標會員: memberA1`);
    console.log(`   控制模式: 100%贏控制`);
    
    // 再次檢查活躍控制
    console.log('\n🔍 驗證控制是否激活...');
    await checkActiveControl();
  }
  
  // 測試API直接訪問
  await testAPIDirectly();
  
  console.log('\n🔧 調試測試完成');
  console.log('現在請在下一期下注並檢查開獎結果');
}

main().catch(console.error);
