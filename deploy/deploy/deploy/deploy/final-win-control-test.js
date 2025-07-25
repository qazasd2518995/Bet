import axios from 'axios';

const AGENT_URL = 'http://localhost:3003/api/agent';
const GAME_URL = 'http://localhost:3000';

async function adminLogin() {
  const response = await axios.post(`${AGENT_URL}/login`, {
    username: 'ti2025A', password: 'ti2025A'
  });
  
  if (response.data.success) {
    const { token, sessionToken } = response.data;
    console.log('✅ 管理員登錄成功!');
    return { 'Authorization': token, 'x-session-token': sessionToken };
  }
  throw new Error('管理員登錄失敗');
}

async function memberLogin() {
  const response = await axios.post(`${GAME_URL}/api/member/login`, {
    username: 'memberA1', password: 'memberA1'
  });
  
  if (response.data.success) {
    console.log('✅ 會員登錄成功!');
    return response.data.sessionToken;
  }
  throw new Error('會員登錄失敗');
}

async function createControl(authHeaders) {
  const gameData = await axios.get(`${GAME_URL}/api/game-data`);
  const currentPeriod = parseInt(gameData.data.gameData.currentPeriod);
  const targetPeriod = currentPeriod + 1;
  
  console.log(`🎯 為期數${targetPeriod}創建100%贏控制 (memberA1)`);
  
  const response = await axios.post(`${AGENT_URL}/win-loss-control`, {
    control_mode: 'single_member',
    target_type: 'member',
    target_username: 'memberA1',
    control_percentage: 100,
    win_control: true,
    loss_control: false,
    start_period: targetPeriod.toString()
  }, { headers: authHeaders });
  
  const controlId = response.data.data.id;
  
  // 激活控制
  await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/activate`, {}, {
    headers: authHeaders
  });
  
  console.log(`✅ 控制創建並激活 (ID: ${controlId})`);
  
  // 驗證控制
  const activeCheck = await axios.get(`${AGENT_URL}/internal/win-loss-control/active`);
  console.log('🔍 內部API驗證:', activeCheck.data.data.control_mode, activeCheck.data.data.is_active);
  
  return { controlId, targetPeriod };
}

async function waitForTargetPeriod(targetPeriod) {
  console.log(`⏳ 等待期數${targetPeriod}...`);
  
  for (let i = 0; i < 120; i++) {
    const response = await axios.get(`${GAME_URL}/api/game-data`);
    const { currentPeriod, status, countdownSeconds } = response.data.gameData;
    
    if (currentPeriod === targetPeriod && status === 'betting' && countdownSeconds > 20) {
      console.log(`🎮 期數${targetPeriod}開始，剩餘${countdownSeconds}秒！`);
      return true;
    }
    
    if (i % 10 === 0) {
      console.log(`⏳ 當前: ${currentPeriod}, 狀態: ${status}, 目標: ${targetPeriod}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

async function placeBetsAndWait(targetPeriod, memberToken) {
  console.log('💰 立即下注多個和值...');
  
  const betValues = ['3', '4', '5', '6', '7'];
  let successBets = [];
  
  for (const value of betValues) {
    try {
      const response = await axios.post(`${GAME_URL}/api/bet`, {
        betType: 'sumValue',
        value,
        amount: 200,
        username: 'memberA1'
      }, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
      });
      
      if (response.data.success) {
        console.log(`✅ 下注成功: 200元在和值${value}`);
        successBets.push(value);
      }
    } catch (error) {
      console.log(`❌ 下注失敗: ${error.response?.data?.message}`);
    }
  }
  
  if (successBets.length === 0) {
    throw new Error('沒有成功下注');
  }
  
  console.log(`�� 總共下注和值: [${successBets.join(', ')}] (應該必中其中一個)`);
  
  // 等待開獎
  console.log('🎲 等待開獎，監控控制效果...');
  
  for (let i = 0; i < 120; i++) {
    try {
      const response = await axios.get(`${GAME_URL}/api/history?limit=1`);
      if (response.data.success && response.data.records.length > 0) {
        const latest = response.data.records[0];
        
        if (latest.period === targetPeriod.toString()) {
          const sumValue = latest.result[0] + latest.result[1];
          
          console.log(`\n🎲 期數${targetPeriod}開獎結果:`);
          console.log(`   完整結果: [${latest.result.join(', ')}]`);
          console.log(`   冠亞軍: ${latest.result[0]} + ${latest.result[1]} = 和值${sumValue}`);
          console.log(`   我們下注: [${successBets.join(', ')}]`);
          
          if (successBets.includes(sumValue.toString())) {
            console.log('\n🎉🎉🎉 100%贏控制成功！');
            console.log(`✅ 和值${sumValue}命中我們的下注！`);
            console.log('✅ 輸贏控制系統完全正常工作！');
            return true;
          } else {
            console.log('\n❌❌❌ 100%贏控制完全失敗！');
            console.log(`❌ 和值${sumValue}完全沒有命中我們的任何下注`);
            console.log('❌ 輸贏控制系統沒有生效！');
            return false;
          }
        }
      }
    } catch (error) {
      // 繼續等待
    }
    
    if (i % 10 === 0) {
      console.log(`⏳ 等待開獎中... (${i}秒)`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('等待開獎超時');
}

async function main() {
  console.log('🚀 最終100%贏控制驗證測試');
  console.log('============================================================');
  console.log('⚠️ 這次測試將創建控制並立即驗證，不做任何清理');
  console.log('============================================================\n');
  
  try {
    const authHeaders = await adminLogin();
    const memberToken = await memberLogin();
    
    const { controlId, targetPeriod } = await createControl(authHeaders);
    
    const periodReady = await waitForTargetPeriod(targetPeriod);
    if (!periodReady) {
      throw new Error('等待目標期數超時');
    }
    
    const success = await placeBetsAndWait(targetPeriod, memberToken);
    
    console.log('\n' + '=' .repeat(70));
    if (success) {
      console.log('🎉 最終結果: 輸贏控制系統修復成功！');
      console.log('✅ 100%贏控制完美工作，能直接影響開獎結果');
    } else {
      console.log('❌ 最終結果: 輸贏控制系統仍然失效');
      console.log('❌ 需要進一步調試智能開獎邏輯');
    }
    console.log('=' .repeat(70));
    
    console.log(`\n🔧 控制ID ${controlId} 保留，可手動清理`);
    
  } catch (error) {
    console.error('測試出錯:', error.message);
  }
}

main();
