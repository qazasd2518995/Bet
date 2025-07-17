import axios from 'axios';

const GAME_URL = 'http://localhost:3000';
const AGENT_URL = 'http://localhost:3003/api/agent';

async function simpleBetTest() {
  console.log('🚀 開始簡化下注測試');
  console.log('=====================================\n');

  try {
    // 1. 登錄會員
    console.log('1️⃣ 會員登錄');
    const loginResponse = await axios.post(`${GAME_URL}/api/member/login`, {
      username: 'test123',
      password: '123456'
    });
    
    if (!loginResponse.data.success) {
      console.error('❌ 會員登錄失敗:', loginResponse.data.message);
      return;
    }
    
    console.log('✅ 會員登錄成功');

    // 2. 檢查餘額
    console.log('\n2️⃣ 檢查會員餘額');
    const balanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const initialBalance = parseFloat(balanceResponse.data.balance);
    console.log(`會員初始餘額: ${initialBalance}`);

    // 3. 檢查遊戲狀態
    console.log('\n3️⃣ 檢查遊戲狀態');
    const gameResponse = await axios.get(`${GAME_URL}/api/game-data`);
    const gameData = gameResponse.data.gameData;
    
    console.log(`期數: ${gameData.currentPeriod}`);
    console.log(`狀態: ${gameData.status}`);
    console.log(`倒數: ${gameData.countdownSeconds}秒`);

    if (gameData.status !== 'betting') {
      console.log('❌ 當前不是下注階段，跳過下注測試');
      return;
    }

    // 4. 提交一注測試
    console.log('\n4️⃣ 提交單注測試');
    
    const betData = {
      username: 'test123',
      amount: 100,
      betType: 'champion',  // 冠軍大小
      value: 'big'          // 冠軍大
    };

    console.log(`下注內容: ${betData.betType} ${betData.value} ${betData.amount}元`);

    try {
      const betResponse = await axios.post(`${GAME_URL}/api/bet`, betData);

      if (betResponse.data.success) {
        console.log('✅ 下注成功');
        console.log(`剩餘餘額: ${betResponse.data.balance}`);
      } else {
        console.log('❌ 下注失敗:', betResponse.data.message);
      }
    } catch (betError) {
      console.log('❌ 下注請求失敗:', betError.response?.data?.message || betError.message);
      console.log('完整錯誤:', betError.response?.data);
    }

    // 5. 檢查餘額變化
    console.log('\n5️⃣ 檢查餘額變化');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newBalanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const newBalance = parseFloat(newBalanceResponse.data.balance);
    
    console.log(`下注前餘額: ${initialBalance}`);
    console.log(`下注後餘額: ${newBalance}`);
    console.log(`餘額變化: ${initialBalance - newBalance}`);

  } catch (error) {
    console.error('🚨 測試過程中發生錯誤:', error.response?.data || error.message);
  }
}

simpleBetTest(); 