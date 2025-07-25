import axios from 'axios';

const GAME_API = 'https://bet-game-vcje.onrender.com';

// 測試賠率和下注功能
async function testOddsAndBetting() {
  console.log('🔍 測試賠率和下注功能');
  
  try {
    // 1. 測試A盤會員登入和賠率
    console.log('\n1. 測試A盤會員賠率...');
    
    const aMemberLogin = await axios.post(`${GAME_API}/api/member/login`, {
      username: 'A01member',
      password: 'A01mem'
    });
    
    if (aMemberLogin.data.success) {
      console.log(`✅ A盤會員登入成功`);
      console.log('登入響應:', JSON.stringify(aMemberLogin.data, null, 2));
      
      const aToken = aMemberLogin.data.token;
      
      // 獲取遊戲數據（包含賠率）
      try {
        const gameDataResponse = await axios.get(`${GAME_API}/api/game-data`, {
          headers: { 'Authorization': `Bearer ${aToken}` }
        });
        
        console.log('遊戲數據響應:', JSON.stringify(gameDataResponse.data, null, 2));
        
        if (gameDataResponse.data.success && gameDataResponse.data.odds) {
          const odds = gameDataResponse.data.odds;
          console.log(`A盤賠率數據:`, {
            冠軍大: odds.champion?.big || 'N/A',
            冠軍小: odds.champion?.small || 'N/A',
            單號賠率: odds.number?.first || 'N/A'
          });
        } else {
          console.log('⚠️  遊戲數據中沒有賠率信息');
        }
      } catch (gameError) {
        console.error('❌ 獲取遊戲數據失敗:', gameError.response?.status, gameError.response?.data);
      }
    } else {
      console.error('❌ A盤會員登入失敗:', aMemberLogin.data);
    }
    
    // 2. 測試D盤會員
    console.log('\n2. 測試D盤會員賠率...');
    
    try {
      const dMemberLogin = await axios.post(`${GAME_API}/api/member/login`, {
        username: 'TestMemberD01',
        password: 'test123456'
      });
      
      if (dMemberLogin.data.success) {
        console.log(`✅ D盤會員登入成功`);
        console.log('D盤登入響應:', JSON.stringify(dMemberLogin.data, null, 2));
        
        const dToken = dMemberLogin.data.token;
        
        // 獲取遊戲數據
        const gameDataResponse = await axios.get(`${GAME_API}/api/game-data`, {
          headers: { 'Authorization': `Bearer ${dToken}` }
        });
        
        console.log('D盤遊戲數據:', JSON.stringify(gameDataResponse.data, null, 2));
        
        if (gameDataResponse.data.success && gameDataResponse.data.odds) {
          const odds = gameDataResponse.data.odds;
          console.log(`D盤賠率數據:`, {
            冠軍大: odds.champion?.big || 'N/A',
            冠軍小: odds.champion?.small || 'N/A',
            單號賠率: odds.number?.first || 'N/A'
          });
        }
      } else {
        console.error('❌ D盤會員登入失敗:', dMemberLogin.data);
      }
    } catch (dError) {
      console.error('❌ D盤測試失敗:', dError.response?.data || dError.message);
    }
    
    console.log('\n✅ 測試完成');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
  }
}

// 執行測試
testOddsAndBetting().catch(console.error); 