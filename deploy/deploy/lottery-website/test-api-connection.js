// 測試開獎網 API 連接的腳本

async function testAPIConnection() {
  console.log('=== 測試開獎網 API 連接 ===\n');
  
  // 1. 測試本地 API
  console.log('1. 測試本地 game-state API...');
  try {
    const localResponse = await fetch('http://localhost:3002/api/game-state');
    const localData = await localResponse.json();
    console.log('✅ 本地 API 回應:', JSON.stringify(localData, null, 2));
  } catch (error) {
    console.error('❌ 本地 API 錯誤:', error.message);
  }
  
  console.log('\n2. 測試主遊戲 API...');
  try {
    const gameResponse = await fetch('https://bet-game-vcje.onrender.com/api/game-data');
    const gameData = await gameResponse.json();
    console.log('✅ 主遊戲 API 回應:');
    console.log('- 期號:', gameData.gameData?.currentPeriod);
    console.log('- 倒數:', gameData.gameData?.countdownSeconds, '秒');
    console.log('- 狀態:', gameData.gameData?.status);
    console.log('- 有 serverTime?', !!gameData.gameData?.serverTime);
    console.log('- 有 nextDrawTime?', !!gameData.gameData?.nextDrawTime);
  } catch (error) {
    console.error('❌ 主遊戲 API 錯誤:', error.message);
  }
  
  console.log('\n3. 測試開獎網是否正確獲取主遊戲數據...');
  setTimeout(async () => {
    try {
      const response = await fetch('http://localhost:3002/api/game-state');
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ 開獎網成功獲取數據:');
        console.log('- 期號:', data.data.current_period);
        console.log('- 倒數:', data.data.countdown_seconds, '秒');
        console.log('- 狀態:', data.data.status);
        console.log('- 最後結果:', data.data.last_result);
      } else {
        console.log('❌ 獲取失敗:', data.message);
      }
    } catch (error) {
      console.error('❌ 請求錯誤:', error.message);
    }
  }, 2000);
}

// 執行測試
testAPIConnection();