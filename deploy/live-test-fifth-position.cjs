const axios = require('axios');

// 遊戲平台URL (生產環境)
const BASE_URL = 'https://bet-gzcl.onrender.com';

async function liveTestFifthPosition() {
  try {
    console.log('🎮 開始實際登入測試第5名輸贏控制...\n');
    
    // 步驟1：登入justin111帳號
    console.log('👤 登入帳號: justin111');
    const loginResponse = await axios.post(`${BASE_URL}/api/login`, {
      username: 'justin111',
      password: 'aaaa00'
    });
    
    if (loginResponse.data.success) {
      console.log('✅ 登入成功');
      console.log(`💰 會員餘額: ${loginResponse.data.user.balance}`);
      console.log(`📊 盤口類型: ${loginResponse.data.user.market_type}`);
      
      const token = loginResponse.data.token;
      const headers = { 'Authorization': `Bearer ${token}` };
      
      // 步驟2：獲取當前遊戲狀態
      console.log('\n🎲 獲取當前遊戲狀態...');
      const gameStateResponse = await axios.get(`${BASE_URL}/api/game-state`, { headers });
      
      if (gameStateResponse.data.success) {
        const gameState = gameStateResponse.data.data;
        console.log(`📅 當前期數: ${gameState.period}`);
        console.log(`⏰ 遊戲狀態: ${gameState.status}`);
        console.log(`⏱️ 剩餘時間: ${gameState.timeLeft}秒`);
        
        if (gameState.status === 'betting') {
          // 步驟3：測試第5名投注
          console.log('\n🎯 測試第5名投注控制...');
          console.log('💡 根據100%贏控制設定，投注應該會中獎');
          
          // 選擇一個號碼進行第5名投注
          const testNumber = 7;
          const betAmount = 10; // 小額測試
          
          console.log(`🎲 投注第5名 ${testNumber}號，金額 ${betAmount}元`);
          
          const betResponse = await axios.post(`${BASE_URL}/api/bet`, {
            betType: 'fifth',
            betValue: testNumber.toString(),
            amount: betAmount
          }, { headers });
          
          if (betResponse.data.success) {
            console.log('✅ 投注成功提交');
            console.log(`🆔 投注ID: ${betResponse.data.betId}`);
            console.log(`💰 剩餘餘額: ${betResponse.data.newBalance}`);
            
            console.log('\n⏳ 等待開獎結果...');
            console.log('💡 請觀察開獎結果中第5名位置是否為你投注的號碼');
            console.log(`📝 如果輸贏控制正常運作，第5名應該開出 ${testNumber}號`);
            
            // 步驟4：監控開獎結果
            await monitorDrawResult(headers, gameState.period, testNumber);
            
          } else {
            console.log('❌ 投注失敗:', betResponse.data.message);
          }
          
        } else {
          console.log('⚠️ 目前不是投注時間，請等待下一期開始');
          console.log('📝 測試說明：需要在投注時間內執行此測試');
        }
        
      } else {
        console.log('❌ 獲取遊戲狀態失敗');
      }
      
    } else {
      console.log('❌ 登入失敗:', loginResponse.data.message);
    }
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error.message);
    if (error.response) {
      console.error('錯誤詳情:', error.response.data);
    }
  }
}

async function monitorDrawResult(headers, period, expectedNumber) {
  let attempts = 0;
  const maxAttempts = 60; // 最多等待60次 (約5分鐘)
  
  const checkResult = async () => {
    try {
      const historyResponse = await axios.get(`${BASE_URL}/api/history`, { headers });
      
      if (historyResponse.data.success && historyResponse.data.data.length > 0) {
        const latestResult = historyResponse.data.data[0];
        
        if (latestResult.period === period && latestResult.result && latestResult.result.length >= 5) {
          console.log('\n🎊 開獎結果出來了！');
          console.log(`📅 期數: ${latestResult.period}`);
          console.log(`🎲 完整結果: [${latestResult.result.join(', ')}]`);
          console.log(`🎯 第5名: ${latestResult.result[4]}`);
          console.log(`💭 你投注的號碼: ${expectedNumber}`);
          
          if (latestResult.result[4] === expectedNumber) {
            console.log('🎉 控制成功！第5名開出了你投注的號碼');
            console.log('✅ 輸贏控制系統運作正常');
          } else {
            console.log('❌ 控制失效！第5名沒有開出你投注的號碼');
            console.log('⚠️ 這證明輸贏控制系統存在問題');
          }
          
          // 檢查投注結果
          await checkBetResult(headers, period);
          return true;
        }
      }
      
      attempts++;
      if (attempts < maxAttempts) {
        console.log(`⏳ 等待開獎中... (${attempts}/${maxAttempts})`);
        setTimeout(checkResult, 5000); // 5秒後再檢查
      } else {
        console.log('⏰ 等待超時，請手動檢查開獎結果');
      }
      
    } catch (error) {
      console.error('檢查開獎結果時發生錯誤:', error.message);
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(checkResult, 5000);
      }
    }
  };
  
  checkResult();
}

async function checkBetResult(headers, period) {
  try {
    console.log('\n📊 檢查投注結果...');
    const betHistoryResponse = await axios.get(`${BASE_URL}/api/bet-history?limit=10`, { headers });
    
    if (betHistoryResponse.data.success) {
      const recentBets = betHistoryResponse.data.data.filter(bet => bet.period === period);
      
      if (recentBets.length > 0) {
        recentBets.forEach(bet => {
          console.log(`💰 投注: ${bet.betType} ${bet.betValue}, 金額: ${bet.amount}, 結果: ${bet.win ? '贏✅' : '輸❌'}`);
        });
      } else {
        console.log('📝 沒有找到該期的投注記錄');
      }
    }
  } catch (error) {
    console.error('檢查投注結果時發生錯誤:', error.message);
  }
}

// 執行測試
liveTestFifthPosition(); 