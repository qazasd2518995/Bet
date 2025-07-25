import axios from 'axios';

const GAME_URL = 'http://localhost:3000';

let memberToken = null;

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

async function waitForPeriod51() {
  console.log('⏳ 等待期數20250702051開始...');
  
  for (let i = 0; i < 60; i++) {
    try {
      const response = await axios.get(`${GAME_URL}/api/game-data`);
      const { currentPeriod, status, countdownSeconds } = response.data.gameData;
      
      if (currentPeriod === 20250702051 && status === 'betting' && countdownSeconds > 25) {
        console.log(`🎮 期數${currentPeriod}開始！剩餘${countdownSeconds}秒下注時間`);
        return true;
      }
      
      if (i % 5 === 0) {
        console.log(`⏳ 當前期數: ${currentPeriod}, 狀態: ${status}, 倒數: ${countdownSeconds}秒`);
      }
    } catch (error) {
      // 繼續等待
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

async function placeBetsAndMonitor() {
  try {
    console.log('💰 立即下注測試100%贏控制...');
    
    // 下注多個和值，看控制是否會讓其中一個中獎
    const bets = [
      { betType: 'sumValue', value: '7', amount: 100 },
      { betType: 'sumValue', value: '8', amount: 100 },
      { betType: 'sumValue', value: '9', amount: 100 },
      { betType: 'sumValue', value: '12', amount: 100 }
    ];
    
    let successBets = [];
    for (const bet of bets) {
      try {
        const response = await axios.post(`${GAME_URL}/api/bet`, {
          ...bet, username: 'memberA1'
        }, {
          headers: { 'Authorization': `Bearer ${memberToken}` }
        });
        
        if (response.data.success) {
          console.log(`✅ 下注成功: ${bet.amount}元 在和值${bet.value}`);
          successBets.push(bet.value);
        }
      } catch (error) {
        console.log(`❌ 下注失敗: ${error.response?.data?.message}`);
      }
    }
    
    if (successBets.length === 0) {
      console.log('❌ 沒有成功的下注');
      return;
    }
    
    console.log(`�� 成功下注和值: [${successBets.join(', ')}]`);
    console.log('🎲 等待開獎結果...');
    
    // 監控開獎結果
    for (let i = 0; i < 120; i++) {
      try {
        const response = await axios.get(`${GAME_URL}/api/history?limit=1`);
        if (response.data.success && response.data.records.length > 0) {
          const latest = response.data.records[0];
          
          if (latest.period === '20250702051') {
            const sumValue = latest.result[0] + latest.result[1];
            console.log(`\n🎲 期數${latest.period}開獎結果: [${latest.result.join(', ')}]`);
            console.log(`📊 冠亞軍: ${latest.result[0]} + ${latest.result[1]} = 和值${sumValue}`);
            console.log(`💰 我們下注的和值: [${successBets.join(', ')}]`);
            
            if (successBets.includes(sumValue.toString())) {
              console.log('\n🎉🎉🎉 100%贏控制成功！！！');
              console.log(`✅ 和值${sumValue}命中我們的下注！`);
              console.log('✅ 輸贏控制系統正常工作！');
            } else {
              console.log('\n❌❌❌ 100%贏控制失敗！');
              console.log(`❌ 和值${sumValue}未命中我們的下注`);
              console.log('❌ 輸贏控制系統需要修復！');
            }
            
            return;
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
    
    console.log('❌ 等待開獎超時');
    
  } catch (error) {
    console.error('測試過程出錯:', error.message);
  }
}

async function main() {
  console.log('🚀 最終100%贏控制驗證測試');
  console.log('=' .repeat(60));
  console.log('⚠️ 期數20250702051已設置為memberA1的100%贏控制');
  console.log('=' .repeat(60));
  
  if (!await memberLogin()) {
    console.log('❌ 會員登錄失敗');
    return;
  }
  
  if (!await waitForPeriod51()) {
    console.log('❌ 等待期數51超時');
    return;
  }
  
  await placeBetsAndMonitor();
  
  console.log('\n🎉 測試完成！');
}

main().catch(console.error);
