const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3000';
const AGENT_API_BASE = 'https://bet-agent.onrender.com';

// 測試龍虎控制修復
async function testDragonTigerControlFix() {
  console.log('🐉🐅 龍虎控制修復測試開始...\n');

  try {
    // 步驟1：清理現有控制設定
    console.log('🧹 清理現有控制設定...');
    const deleteResponse = await fetch(`${AGENT_API_BASE}/api/agent/win-loss-control/32`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ti2025A_token',
        'Content-Type': 'application/json'
      }
    });
    
    if (deleteResponse.ok) {
      console.log('✅ 現有控制設定已清理');
    } else {
      console.log('ℹ️ 沒有需要清理的控制設定');
    }

    // 步驟2：創建新的龍虎控制設定
    console.log('\n🎯 創建dragon_1_10的100%贏控制...');
    const controlData = {
      control_mode: 'single_member',
      target_type: 'member',
      target_username: 'justin111',
      control_percentage: 100,
      win_control: true,
      loss_control: false,
      start_period: Date.now().toString().slice(-11) // 當前期數
    };

    const createResponse = await fetch(`${AGENT_API_BASE}/api/agent/win-loss-control`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ti2025A_token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(controlData)
    });

    const createResult = await createResponse.json();
    if (!createResult.success) {
      console.error('❌ 創建控制設定失敗:', createResult.message);
      return;
    }

    const controlId = createResult.data.id;
    console.log(`✅ 控制設定創建成功，ID: ${controlId}`);

    // 步驟3：等待下一期開始
    console.log('\n⏳ 等待下一期開始...');
    await waitForNewPeriod();

    // 步驟4：模擬justin111進行龍虎投注
    console.log('\n💰 模擬justin111進行dragon_1_10投注...');
    const betResponse = await fetch(`${API_BASE}/api/bet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'justin111',
        amount: 100,
        bet_type: 'dragonTiger',
        bet_value: 'dragon_1_10'
      })
    });

    const betResult = await betResponse.json();
    if (!betResult.success) {
      console.error('❌ 下注失敗:', betResult.message);
      return;
    }

    console.log('✅ 龍虎投注成功，等待開獎...');

    // 步驟5：等待開獎並檢查結果
    console.log('\n🎲 等待開獎結果...');
    const gameResult = await waitForGameResult();
    
    console.log(`\n📊 開獎結果分析:`);
    console.log(`開獎結果: [${gameResult.join(', ')}]`);
    console.log(`第1名: ${gameResult[0]}, 第10名: ${gameResult[9]}`);
    
    const dragonWins = gameResult[0] > gameResult[9];
    console.log(`龍虎結果: ${dragonWins ? '龍勝' : '虎勝'} (${gameResult[0]} vs ${gameResult[9]})`);
    
    if (dragonWins) {
      console.log('🎉 控制成功！justin111的龍虎投注中獎');
    } else {
      console.log('❌ 控制失效！justin111的龍虎投注未中獎');
    }

    // 步驟6：檢查注單結算
    console.log('\n📋 檢查注單結算...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // 等待結算

    const recordsResponse = await fetch(`${API_BASE}/api/bet-records?username=justin111&page=1`);
    const recordsResult = await recordsResponse.json();
    
    if (recordsResult.success && recordsResult.data.records.length > 0) {
      const latestBet = recordsResult.data.records[0];
      console.log(`最新注單: 下注${latestBet.amount}元，${latestBet.win ? '中獎' : '未中獎'}，獲得${latestBet.winAmount}元`);
      
      if (latestBet.win && dragonWins) {
        console.log('✅ 注單結算正確！控制生效且結算準確');
      } else if (!latestBet.win && !dragonWins) {
        console.log('✅ 注單結算正確！控制未生效但結算準確');
      } else {
        console.log('❌ 注單結算錯誤！結果與預期不符');
      }
    }

    // 步驟7：清理測試控制設定
    console.log('\n🧹 清理測試控制設定...');
    const cleanupResponse = await fetch(`${AGENT_API_BASE}/api/agent/win-loss-control/${controlId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ti2025A_token',
        'Content-Type': 'application/json'
      }
    });

    if (cleanupResponse.ok) {
      console.log('✅ 測試控制設定已清理');
    }

    console.log('\n🎯 龍虎控制修復測試完成！');

  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
  }
}

// 等待新期開始
async function waitForNewPeriod() {
  let attempts = 0;
  const maxAttempts = 30; // 最多等待30秒
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${API_BASE}/api/game-status`);
      const gameStatus = await response.json();
      
      if (gameStatus.countdown > 25) {
        console.log(`✅ 新期已開始，期數: ${gameStatus.period}, 倒計時: ${gameStatus.countdown}秒`);
        return;
      }
      
      console.log(`⏳ 等待新期開始... 當前倒計時: ${gameStatus.countdown}秒`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      console.log('⏳ 等待遊戲狀態...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
  }
  
  console.log('⚠️ 等待超時，繼續測試...');
}

// 等待開獎結果
async function waitForGameResult() {
  let attempts = 0;
  const maxAttempts = 60; // 最多等待60秒
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`${API_BASE}/api/game-status`);
      const gameStatus = await response.json();
      
      if (gameStatus.result && gameStatus.result.length === 10) {
        return gameStatus.result;
      }
      
      if (attempts % 5 === 0) {
        console.log(`⏳ 等待開獎... 當前狀態: ${gameStatus.status}, 倒計時: ${gameStatus.countdown}秒`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    } catch (error) {
      console.log('⏳ 等待開獎結果...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
  }
  
  throw new Error('等待開獎結果超時');
}

// 執行測試
testDragonTigerControlFix().catch(console.error); 