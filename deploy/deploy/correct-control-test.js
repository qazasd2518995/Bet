import axios from 'axios';

const AGENT_URL = 'http://localhost:3003/api/agent';
const GAME_URL = 'http://localhost:3000';

let authHeaders = {};

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

async function cleanupOldControls() {
  try {
    const response = await axios.get(`${AGENT_URL}/win-loss-control`, {
      headers: authHeaders
    });
    
    if (response.data.success && response.data.data.length > 0) {
      console.log('🧹 清理舊控制設定...');
      for (const control of response.data.data) {
        await axios.delete(`${AGENT_URL}/win-loss-control/${control.id}`, {
          headers: authHeaders
        });
      }
      console.log('✅ 舊控制設定已清理');
    }
  } catch (error) {
    console.log('清理舊控制時出錯:', error.message);
  }
}

async function createCorrectControl() {
  try {
    // 獲取當前期數
    const gameData = await axios.get(`${GAME_URL}/api/game-data`);
    const currentPeriod = parseInt(gameData.data.gameData.currentPeriod);
    const nextPeriod = currentPeriod + 1;
    
    console.log(`🎯 當前期數: ${currentPeriod}`);
    console.log(`🎯 設置控制期數: ${nextPeriod}`);
    
    const controlData = {
      control_mode: 'single_member',
      target_type: 'member',
      target_username: 'memberA1',
      control_percentage: 100,
      win_control: true,
      loss_control: false,
      start_period: nextPeriod.toString()
    };
    
    console.log('📋 控制設定:', JSON.stringify(controlData, null, 2));
    
    const response = await axios.post(`${AGENT_URL}/win-loss-control`, controlData, {
      headers: authHeaders
    });
    
    if (response.data.success) {
      const controlId = response.data.data.id;
      console.log(`✅ 控制創建成功 (ID: ${controlId})`);
      
      // 激活控制
      await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/activate`, {}, {
        headers: authHeaders
      });
      
      console.log('✅ 控制已激活');
      
      // 驗證激活
      const activeResponse = await axios.get(`${AGENT_URL}/win-loss-control/active`, {
        headers: authHeaders
      });
      
      console.log('✅ 激活驗證:', JSON.stringify(activeResponse.data, null, 2));
      
      return { controlId, targetPeriod: nextPeriod };
    }
    
    return null;
  } catch (error) {
    console.error('創建控制失敗:', error.response?.data || error.message);
    return null;
  }
}

async function main() {
  console.log('🔧 正確的輸贏控制測試');
  console.log('=' .repeat(50));
  
  await adminLogin();
  await cleanupOldControls();
  
  const controlInfo = await createCorrectControl();
  
  if (controlInfo) {
    console.log(`\n🎉 準備就緒！`);
    console.log(`   控制期數: ${controlInfo.targetPeriod}`);
    console.log(`   memberA1將在該期100%中獎`);
    console.log('\n⚠️ 請在下一期下注測試！');
  }
}

main().catch(console.error);
