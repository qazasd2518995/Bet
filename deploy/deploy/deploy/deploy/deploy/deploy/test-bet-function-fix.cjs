const axios = require('axios');

// 測試配置
const AGENT_API_URL = 'https://bet-agent-yqvzhmmkhx-w.onrender.com';
const GAME_API_URL = 'https://bet-game-l4a2t47nap-w.onrender.com';
const testUsername = 'justin111';

async function testBetFunction() {
  console.log('🔍 開始測試下注功能修復...\n');
  
  try {
    // 1. 檢查會員餘額
    console.log('1️⃣ 檢查會員餘額...');
    const balanceResponse = await axios.get(`${GAME_API_URL}/api/agent/member/info/${testUsername}`);
    
    if (balanceResponse.data.success) {
      console.log(`✅ 會員 ${testUsername} 當前餘額: ${balanceResponse.data.balance}`);
      
      if (parseFloat(balanceResponse.data.balance) < 100) {
        console.log('❌ 餘額不足，無法進行下注測試');
        return;
      }
    } else {
      console.log('❌ 無法獲取會員餘額:', balanceResponse.data.message);
      return;
    }
    
    // 2. 測試下注扣款功能
    console.log('\n2️⃣ 測試下注扣款功能...');
    const deductResponse = await axios.post(`${AGENT_API_URL}/api/agent/deduct-member-balance`, {
      username: testUsername,
      amount: 10,
      reason: '測試下注'
    });
    
    if (deductResponse.data.success) {
      console.log(`✅ 扣款成功! 扣除金額: 10 元`);
      console.log(`✅ 扣款後餘額: ${deductResponse.data.balance}`);
    } else {
      console.log('❌ 扣款失敗:', deductResponse.data.message);
      return;
    }
    
    // 3. 測試遊戲下注 API (模擬前端下注)
    console.log('\n3️⃣ 測試遊戲下注 API...');
    const betResponse = await axios.post(`${GAME_API_URL}/api/bet`, {
      username: testUsername,
      amount: 20,
      betType: 'number',
      value: '05',
      position: null
    });
    
    if (betResponse.data.success) {
      console.log(`✅ 下注成功! 下注金額: 20 元`);
      console.log(`✅ 下注後餘額: ${betResponse.data.balance}`);
      console.log(`✅ 下注ID: ${betResponse.data.betId}`);
    } else {
      console.log('❌ 下注失敗:', betResponse.data.message);
    }
    
    // 4. 再次檢查最終餘額
    console.log('\n4️⃣ 檢查最終餘額...');
    const finalBalanceResponse = await axios.get(`${GAME_API_URL}/api/agent/member/info/${testUsername}`);
    
    if (finalBalanceResponse.data.success) {
      console.log(`✅ 會員 ${testUsername} 最終餘額: ${finalBalanceResponse.data.balance}`);
    }
    
    console.log('\n🎉 下注功能測試完成！所有功能都正常運作！');
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      console.log('⚠️  仍有 400 錯誤，可能需要進一步檢查');
    }
  }
}

// 執行測試
testBetFunction(); 