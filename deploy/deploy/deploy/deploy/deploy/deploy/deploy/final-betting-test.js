import axios from 'axios';

const GAME_URL = 'http://localhost:3000';
const AGENT_URL = 'http://localhost:3003/api/agent';

// 測試主函數
async function runFinalTest() {
  console.log('🚀 開始最終綜合下注測試');
  console.log('=====================================\n');

  try {
    // 1. 檢查系統狀態
    console.log('1️⃣ 檢查系統狀態');
    const gameResponse = await axios.get(`${GAME_URL}/api/game-data`);
    const gameData = gameResponse.data.gameData;
    
    console.log(`期數: ${gameData.currentPeriod}`);
    console.log(`狀態: ${gameData.status}`);
    console.log(`倒數: ${gameData.countdownSeconds}秒`);
    console.log(`上期結果: ${gameData.lastResult?.join(', ')}`);

    // 2. 登錄會員
    console.log('\n2️⃣ 會員登錄');
    const loginResponse = await axios.post(`${GAME_URL}/api/member/login`, {
      username: 'test123',
      password: '123456'
    });
    
    if (!loginResponse.data.success) {
      console.error('❌ 會員登錄失敗:', loginResponse.data.message);
      return;
    }
    
    const memberToken = loginResponse.data.token;
    const memberSessionToken = loginResponse.data.sessionToken;
    console.log('✅ 會員登錄成功');

    // 3. 檢查會員餘額
    console.log('\n3️⃣ 檢查會員餘額');
    const balanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const initialBalance = parseFloat(balanceResponse.data.balance);
    console.log(`會員初始餘額: ${initialBalance}`);

    // 4. 創建100%輸控制
    console.log('\n4️⃣ 創建100%輸控制');
    const agentLogin = await axios.post(`${AGENT_URL}/login`, {
      username: 'ti2025A',
      password: 'ti2025A'
    });
    
    if (agentLogin.data.success) {
      console.log('✅ 代理ti2025A登錄成功');
      
      const controlData = {
        control_mode: 'normal',
        target_type: null,
        target_username: null,
        control_percentage: 100,
        win_control: false,
        loss_control: true
      };

      const controlResponse = await axios.post(`${AGENT_URL}/win-loss-control`, controlData, {
        headers: { 
          'Authorization': `Bearer ${agentLogin.data.token}`,
          'Session-Token': agentLogin.data.sessionToken
        }
      });

      if (controlResponse.data.success) {
        console.log('✅ 成功創建100%輸控制');
      } else {
        console.log('❌ 創建控制失敗:', controlResponse.data.message);
      }
    } else {
      console.log('❌ 代理登錄失敗');
    }

    // 5. 等待下注階段
    console.log('\n5️⃣ 等待下注階段');
    let attempts = 0;
    while (attempts < 15) {
      const currentGameData = await axios.get(`${GAME_URL}/api/game-data`);
      const status = currentGameData.data.gameData.status;
      const countdown = currentGameData.data.gameData.countdownSeconds;
      
      if (status === 'betting' && countdown > 15) {
        console.log(`✅ 可以下注 - 倒數: ${countdown}秒`);
        break;
      }
      
      console.log(`⏳ 等待下注階段 - 狀態: ${status}, 倒數: ${countdown}秒`);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    if (attempts >= 15) {
      console.log('❌ 等待下注階段超時');
      return;
    }

    // 6. 提交9碼下注（所有必輸）
    console.log('\n6️⃣ 提交9碼下注測試');
    
    const bets = [
      { betType: 'number', value: '1', position: 1, amount: 500 },  // 冠軍1號
      { betType: 'number', value: '2', position: 1, amount: 500 },  // 冠軍2號
      { betType: 'number', value: '3', position: 1, amount: 500 },  // 冠軍3號
      { betType: 'number', value: '4', position: 1, amount: 500 },  // 冠軍4號
      { betType: 'number', value: '5', position: 1, amount: 500 },  // 冠軍5號
      { betType: 'number', value: '6', position: 1, amount: 500 },  // 冠軍6號
      { betType: 'number', value: '7', position: 1, amount: 500 },  // 冠軍7號
      { betType: 'number', value: '8', position: 1, amount: 500 },  // 冠軍8號
      { betType: 'number', value: '9', position: 1, amount: 500 }   // 冠軍9號
    ];

    const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
    console.log(`準備下注: ${bets.length}注，總金額: ${totalBetAmount}`);

    let successfulBets = 0;
    let totalDeducted = 0;

    for (let i = 0; i < bets.length; i++) {
      const bet = bets[i];
      try {
        const betData = {
          username: 'test123',
          amount: bet.amount,
          betType: bet.betType,
          value: bet.value,
          position: bet.position
        };

        console.log(`提交第${i+1}注: 冠軍${bet.value}號 ${bet.amount}元`);

        const betResponse = await axios.post(`${GAME_URL}/api/bet`, betData, {
          headers: { 
            'Authorization': `Bearer ${memberToken}`,
            'X-Session-Token': memberSessionToken
          }
        });

        if (betResponse.data.success) {
          console.log(`✅ 第${i+1}注成功，餘額: ${betResponse.data.balance}`);
          successfulBets++;
          totalDeducted += bet.amount;
        } else {
          console.log(`❌ 第${i+1}注失敗: ${betResponse.data.message}`);
        }

        // 小延遲避免請求過快
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`❌ 第${i+1}注請求失敗:`, error.response?.data?.message || error.message);
      }
    }

    console.log(`\n📊 下注總結:`);
    console.log(`- 成功下注: ${successfulBets}/${bets.length}注`);
    console.log(`- 總扣除金額: ${totalDeducted}元`);

    // 7. 檢查餘額變化
    console.log('\n7️⃣ 檢查餘額變化');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const finalBalanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const finalBalance = parseFloat(finalBalanceResponse.data.balance);
    const actualDeduction = initialBalance - finalBalance;
    
    console.log(`初始餘額: ${initialBalance}`);
    console.log(`最終餘額: ${finalBalance}`);
    console.log(`實際扣除: ${actualDeduction}`);
    console.log(`扣除正確性: ${Math.abs(actualDeduction - totalDeducted) < 0.01 ? '✅ 正確' : '❌ 錯誤'}`);

    // 8. 檢查代理退水
    console.log('\n8️⃣ 檢查代理退水');
    const agentBalanceAfter = await axios.post(`${AGENT_URL}/login`, {
      username: 'ti2025A',
      password: 'ti2025A'
    });
    
    if (agentBalanceAfter.data.success) {
      console.log(`代理ti2025A當前餘額: ${agentBalanceAfter.data.agent.balance}`);
      console.log('📝 註：退水通常在開獎結算時分配');
    }

    // 9. 等待開獎
    console.log('\n9️⃣ 等待開獎結果');
    let drawWaitCount = 0;
    let drawResult = null;
    
    while (drawWaitCount < 30) {
      const currentGameData = await axios.get(`${GAME_URL}/api/game-data`);
      const status = currentGameData.data.gameData.status;
      const countdown = currentGameData.data.gameData.countdownSeconds;
      
      if (status === 'drawing') {
        console.log('🎲 正在開獎...');
      } else if (status === 'betting' && drawWaitCount > 0) {
        // 新一期開始，獲取上期結果
        console.log('🎯 開獎完成，新一期開始');
        try {
          const lastResult = currentGameData.data.gameData.lastResult;
          if (lastResult && Array.isArray(lastResult)) {
            drawResult = lastResult;
            break;
          }
        } catch (error) {
          console.log('獲取開獎結果失敗');
        }
      }
      
      drawWaitCount++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (drawResult) {
      console.log(`🎲 開獎結果: ${drawResult.join(', ')}`);
      
      // 檢查控制效果
      const championNumber = drawResult[0];
      const isLoss = ![1,2,3,4,5,6,7,8,9].includes(championNumber);
      
      console.log(`冠軍號碼: ${championNumber}`);
      console.log(`下注號碼: 1,2,3,4,5,6,7,8,9`);
      console.log(`100%輸控制效果: ${isLoss ? '✅ 生效（全輸）' : `❌ 未生效（冠軍${championNumber}中獎）`}`);
    } else {
      console.log('⏳ 等待開獎超時');
    }

    // 10. 檢查最終結算
    console.log('\n🔟 檢查最終結算');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const settlementBalanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const settlementBalance = parseFloat(settlementBalanceResponse.data.balance);
    
    console.log(`結算前餘額: ${finalBalance}`);
    console.log(`結算後餘額: ${settlementBalance}`);
    
    const winAmount = settlementBalance - finalBalance;
    if (winAmount > 0) {
      console.log(`🎉 中獎金額: ${winAmount}`);
    } else if (winAmount === 0) {
      console.log(`📊 無中獎，餘額不變`);
    } else {
      console.log(`⚠️ 餘額異常變化: ${winAmount}`);
    }

    console.log('\n📊 最終測試完成！');
    console.log('=====================================');

  } catch (error) {
    console.error('🚨 測試過程中發生錯誤:', error.response?.data || error.message);
  }
}

// 執行測試
runFinalTest().catch(console.error); 