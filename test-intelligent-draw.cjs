const axios = require('axios');

// 測試配置
const ADMIN_LOGIN = { username: 'ti2025A', password: 'ti2025A' };
const TEST_MEMBER = { username: 'memberA1', password: 'memberA1' };
const BASE_URL = 'http://localhost:3000';
const AGENT_BASE_URL = 'http://localhost:3003';

let adminToken = '';
let adminSessionToken = '';
let memberToken = '';

async function login(credentials, baseUrl, isAgent = false) {
  try {
    const loginUrl = isAgent ? `${baseUrl}/api/agent/login` : `${baseUrl}/api/member/login`;
    const response = await axios.post(loginUrl, credentials);
    
    if (response.data.success) {
      if (isAgent) {
        adminSessionToken = response.data.sessionToken;
        return response.data.token;
      } else {
        return response.data.sessionToken;
      }
    } else {
      throw new Error(response.data.message || '登錄失敗');
    }
  } catch (error) {
    console.error(`登錄失敗:`, error.response?.data || error.message);
    throw error;
  }
}

async function getCurrentPeriod() {
  try {
    const response = await axios.get(`${BASE_URL}/api/game-data`);
    return response.data.gameData.currentPeriod;
  } catch (error) {
    console.error('獲取當前期數失敗:', error.message);
    throw error;
  }
}

async function createWinLossControl(controlData) {
  try {
    const response = await axios.post(
      `${AGENT_BASE_URL}/api/agent/win-loss-control`,
      {
        ...controlData,
        control_mode: 'single_member',
        target_type: 'member'
      },
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'x-session-token': adminSessionToken,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.success) {
      console.log('API返回:', JSON.stringify(response.data, null, 2));
      const controlId = response.data.data?.id || response.data.id;
      console.log(`✅ 創建控制成功: ID=${controlId}, 目標=${controlData.target_username}, 機率=${controlData.control_percentage}%`);
      return controlId;
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('創建控制失敗:', error.response?.data || error.message);
    throw error;
  }
}

async function activateControl(controlId) {
  try {
    const response = await axios.put(
      `${AGENT_BASE_URL}/api/agent/win-loss-control/${controlId}/activate`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'x-session-token': adminSessionToken
        }
      }
    );
    
    if (response.data.success) {
      console.log(`✅ 激活控制成功: ID=${controlId}`);
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('激活控制失敗:', error.response?.data || error.message);
    throw error;
  }
}

async function deactivateControl(controlId) {
  try {
    const response = await axios.put(
      `${AGENT_BASE_URL}/api/agent/win-loss-control/${controlId}/deactivate`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'x-session-token': adminSessionToken
        }
      }
    );
    
    if (response.data.success) {
      console.log(`✅ 停用控制成功: ID=${controlId}`);
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('停用控制失敗:', error.response?.data || error.message);
    throw error;
  }
}

async function placeBet(betData) {
  try {
    const response = await axios.post(
      `${BASE_URL}/api/bet`,
      {
        ...betData,
        username: TEST_MEMBER.username
      },
      {
        headers: {
          'Authorization': `Bearer ${memberToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.success) {
      console.log(`✅ 下注成功: ${betData.betType}=${betData.value}, 金額=${betData.amount}`);
    } else {
      throw new Error(response.data.message);
    }
  } catch (error) {
    console.error('下注失敗:', error.response?.data || error.message);
    throw error;
  }
}

async function getLatestResult() {
  try {
    const response = await axios.get(`${BASE_URL}/api/history?limit=1`);
    if (response.data.success && response.data.data.length > 0) {
      return response.data.data[0];
    }
    return null;
  } catch (error) {
    console.error('獲取最新開獎結果失敗:', error.message);
    return null;
  }
}

async function waitForNextPeriod(currentPeriod, maxWaitMinutes = 3) {
  const maxWaitTime = maxWaitMinutes * 60 * 1000;
  const startTime = Date.now();
  
  console.log(`⏳ 等待下一期開獎，當前期數: ${currentPeriod}`);
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await axios.get(`${BASE_URL}/api/game-data`);
      const gameState = response.data;
      
      // 檢查是否進入新一期
      if (gameState.gameData.currentPeriod !== currentPeriod) {
        console.log(`🎯 新期開始: ${gameState.gameData.currentPeriod}`);
        return gameState.gameData.currentPeriod;
      }
      
      // 顯示當前狀態
      if (gameState.gameData.countdownSeconds <= 10 && gameState.gameData.status === 'betting') {
        console.log(`⏰ 即將封盤，倒計時: ${gameState.gameData.countdownSeconds}秒`);
      } else if (gameState.gameData.status === 'drawing') {
        console.log(`🎲 開獎中...`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('檢查遊戲狀態失敗:', error.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  throw new Error(`等待下一期超時 (${maxWaitMinutes}分鐘)`);
}

async function testIntelligentDraw() {
  console.log('🚀 開始測試智能開獎功能...\n');
  
  try {
    // 1. 登錄
    console.log('1. 登錄中...');
    adminToken = await login(ADMIN_LOGIN, AGENT_BASE_URL, true);
    memberToken = await login(TEST_MEMBER, BASE_URL, false);
    console.log('✅ 登錄成功\n');
    
    // 2. 獲取當前期數
    const currentPeriod = await getCurrentPeriod();
    console.log(`當前期數: ${currentPeriod}\n`);
    
    // 3. 創建100%贏控制
    console.log('2. 創建100%贏控制...');
    const winControlId = await createWinLossControl({
      target_username: TEST_MEMBER.username,
      win_control: true,
      loss_control: false,
      control_percentage: 100
    });
    
    // 4. 激活控制
    await activateControl(winControlId);
    console.log('✅ 100%贏控制已激活\n');
    
    // 5. 等待下一期開始
    console.log('3. 等待下一期開始...');
    const nextPeriod = await waitForNextPeriod(currentPeriod);
    
    // 6. 在新期下注和值10 (比較少見的和值)
    console.log('4. 下注測試...');
    await placeBet({
      betType: 'sumValue',
      value: 10,
      amount: 100
    });
    console.log('✅ 已下注和值10，金額100元\n');
    
    // 7. 等待開獎
    console.log('5. 等待開獎...');
    const finalPeriod = await waitForNextPeriod(nextPeriod);
    
    // 8. 檢查開獎結果
    console.log('6. 檢查開獎結果...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待結果同步
    
    const result = await getLatestResult();
    if (result && result.period === nextPeriod) {
      const resultArray = JSON.parse(result.result);
      const sum = resultArray[0] + resultArray[1]; // 冠軍 + 亞軍 = 和值
      
      console.log(`期數: ${result.period}`);
      console.log(`開獎結果: ${resultArray.join(', ')}`);
      console.log(`和值: ${sum}`);
      
      if (sum === 10) {
        console.log('🎉 測試成功！100%贏控制生效，和值10中獎！');
      } else {
        console.log('❌ 測試失敗！100%贏控制沒有生效，和值10未中獎');
      }
    } else {
      console.log('❌ 無法獲取開獎結果');
    }
    
    // 9. 清理：停用控制
    console.log('\n7. 清理控制設定...');
    await deactivateControl(winControlId);
    console.log('✅ 控制已停用');
    
  } catch (error) {
    console.error('測試失敗:', error.message);
  }
}

// 執行測試
testIntelligentDraw().then(() => {
  console.log('\n🏁 測試完成');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 測試過程中發生錯誤:', error.message);
  process.exit(1);
}); 