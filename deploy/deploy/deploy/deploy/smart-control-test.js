import axios from 'axios';

const AGENT_URL = 'http://localhost:3003/api/agent';
const GAME_URL = 'http://localhost:3000';

let authHeaders = {};
let memberToken = null;

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

// 會員登錄
async function memberLogin() {
  const response = await axios.post(`${GAME_URL}/api/member/login`, {
    username: 'memberA1', password: 'memberA1'
  });
  
  if (response.data.success) {
    memberToken = response.data.sessionToken;
    console.log('✅ 會員登錄成功!');
    return true;
  }
  return false;
}

// 等待下注階段
async function waitForBettingPhase() {
  console.log('⏳ 等待下注階段...');
  
  for (let i = 0; i < 120; i++) {
    try {
      const response = await axios.get(`${GAME_URL}/api/game-data`);
      const { status, countdownSeconds, currentPeriod } = response.data.gameData;
      
      if (status === 'betting' && countdownSeconds > 30) {
        console.log(`🎮 期數${currentPeriod}下注階段開始，剩餘${countdownSeconds}秒`);
        return currentPeriod;
      }
      
      if (i % 5 === 0) {
        console.log(`⏳ 當前狀態: ${status}, 期數: ${currentPeriod}, 倒數: ${countdownSeconds}秒`);
      }
    } catch (error) {
      // 繼續等待
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return null;
}

// 創建並激活控制
async function setupControl(period) {
  console.log(`🎯 為期數${period}設置100%贏控制...`);
  
  const response = await axios.post(`${AGENT_URL}/win-loss-control`, {
    control_mode: 'single_member',
    target_type: 'member',
    target_username: 'memberA1',
    control_percentage: 100,
    win_control: true,
    loss_control: false,
    start_period: period.toString()
  }, { headers: authHeaders });
  
  if (response.data.success) {
    const controlId = response.data.data.id;
    await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/activate`, {}, {
      headers: authHeaders
    });
    console.log(`✅ 100%贏控制已激活 (ID: ${controlId})`);
    return controlId;
  }
  return null;
}

// 快速下注
async function quickBet() {
  console.log('💰 立即下注...');
  
  const bets = [
    { betType: 'sumValue', value: '8', amount: 100 },
    { betType: 'sumValue', value: '9', amount: 100 },
    { betType: 'sumValue', value: '10', amount: 100 }
  ];
  
  let success = 0;
  for (const bet of bets) {
    try {
      const response = await axios.post(`${GAME_URL}/api/bet`, {
        ...bet, username: 'memberA1'
      }, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
      });
      
      if (response.data.success) {
        console.log(`✅ 下注成功: ${bet.amount}元 在和值${bet.value}`);
        success++;
      }
    } catch (error) {
      console.log(`❌ 下注失敗: ${error.response?.data?.message}`);
    }
  }
  
  return success;
}

// 監控開獎結果
async function monitorResult(targetPeriod) {
  console.log(`🎲 監控期數${targetPeriod}的開獎結果...`);
  
  for (let i = 0; i < 60; i++) {
    try {
      const response = await axios.get(`${GAME_URL}/api/history?limit=1`);
      if (response.data.success && response.data.data.length > 0) {
        const latest = response.data.data[0];
        
        if (latest.period >= targetPeriod) {
          const sumValue = latest.result[0] + latest.result[1];
          console.log(`🎲 期數${latest.period}開獎: [${latest.result.join(', ')}]`);
          console.log(`📊 冠亞軍和值: ${latest.result[0]} + ${latest.result[1]} = ${sumValue}`);
          
          // 檢查是否命中
          const ourBets = [8, 9, 10];
          if (ourBets.includes(sumValue)) {
            console.log(`🎉 100%贏控制成功！和值${sumValue}命中我們的下注！`);
            return { success: true, sumValue, result: latest.result };
          } else {
            console.log(`❌ 100%贏控制失敗，和值${sumValue}未命中我們的下注`);
            return { success: false, sumValue, result: latest.result };
          }
        }
      }
    } catch (error) {
      // 繼續等待
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return { success: false, timeout: true };
}

// 清理控制
async function cleanup(controlId) {
  if (controlId) {
    try {
      await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/deactivate`, {}, {
        headers: authHeaders
      });
      await axios.delete(`${AGENT_URL}/win-loss-control/${controlId}`, {
        headers: authHeaders
      });
      console.log('🧹 控制設定已清理');
    } catch (error) {
      // 忽略清理錯誤
    }
  }
}

// 主測試
async function main() {
  console.log('🚀 智能輸贏控制測試');
  console.log('=' .repeat(50));
  
  try {
    // 登錄
    if (!await adminLogin() || !await memberLogin()) {
      console.log('❌ 登錄失敗');
      return;
    }
    
    // 等待下注階段
    const bettingPeriod = await waitForBettingPhase();
    if (!bettingPeriod) {
      console.log('❌ 未找到下注階段');
      return;
    }
    
    // 設置控制
    const controlId = await setupControl(bettingPeriod);
    if (!controlId) {
      console.log('❌ 控制設置失敗');
      return;
    }
    
    // 立即下注
    const betCount = await quickBet();
    if (betCount === 0) {
      console.log('❌ 下注失敗');
      await cleanup(controlId);
      return;
    }
    
    console.log(`📊 成功下注${betCount}筆，等待開獎驗證100%贏控制效果...`);
    
    // 監控結果
    const result = await monitorResult(bettingPeriod);
    
    // 輸出最終結果
    console.log('\n' + '=' .repeat(50));
    if (result.success) {
      console.log('🎉 測試結果: 100%贏控制系統正常工作！');
      console.log(`✅ 成功控制開獎結果，確保會員中獎`);
    } else if (result.timeout) {
      console.log('⏰ 測試超時');
    } else {
      console.log('❌ 測試結果: 100%贏控制系統需要調整');
      console.log(`❌ 控制失效，會員未能中獎`);
    }
    
    await cleanup(controlId);
    
  } catch (error) {
    console.error('測試錯誤:', error.message);
  }
  
  console.log('🎉 測試完成');
}

main().catch(console.error);
