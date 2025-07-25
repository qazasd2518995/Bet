import axios from 'axios';

const GAME_URL = 'http://localhost:3000';

let memberToken = null;

async function memberLogin() {
  const response = await axios.post(`${GAME_URL}/api/member/login`, {
    username: 'memberA1', password: 'memberA1'
  });
  
  if (response.data.success) {
    memberToken = response.data.sessionToken;
    console.log('✅ 会员登录成功!');
    return true;
  }
  return false;
}

async function waitForPeriod51() {
  console.log('⏳ 等待期数20250702051开始...');
  
  for (let i = 0; i < 60; i++) {
    try {
      const response = await axios.get(`${GAME_URL}/api/game-data`);
      const { currentPeriod, status, countdownSeconds } = response.data.gameData;
      
      if (currentPeriod === 20250702051 && status === 'betting' && countdownSeconds > 25) {
        console.log(`🎮 期数${currentPeriod}开始！剩余${countdownSeconds}秒下注时间`);
        return true;
      }
      
      if (i % 5 === 0) {
        console.log(`⏳ 当前期数: ${currentPeriod}, 状态: ${status}, 倒数: ${countdownSeconds}秒`);
      }
    } catch (error) {
      // 继续等待
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

async function placeBetsAndMonitor() {
  try {
    console.log('💰 立即下注测试100%赢控制...');
    
    // 下注多个和值，看控制是否会让其中一个中奖
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
        console.log(`❌ 下注失败: ${error.response?.data?.message}`);
      }
    }
    
    if (successBets.length === 0) {
      console.log('❌ 没有成功的下注');
      return;
    }
    
    console.log(`�� 成功下注和值: [${successBets.join(', ')}]`);
    console.log('🎲 等待开奖结果...');
    
    // 监控开奖结果
    for (let i = 0; i < 120; i++) {
      try {
        const response = await axios.get(`${GAME_URL}/api/history?limit=1`);
        if (response.data.success && response.data.records.length > 0) {
          const latest = response.data.records[0];
          
          if (latest.period === '20250702051') {
            const sumValue = latest.result[0] + latest.result[1];
            console.log(`\n🎲 期数${latest.period}开奖结果: [${latest.result.join(', ')}]`);
            console.log(`📊 冠亚军: ${latest.result[0]} + ${latest.result[1]} = 和值${sumValue}`);
            console.log(`💰 我们下注的和值: [${successBets.join(', ')}]`);
            
            if (successBets.includes(sumValue.toString())) {
              console.log('\n🎉🎉🎉 100%赢控制成功！！！');
              console.log(`✅ 和值${sumValue}命中我们的下注！`);
              console.log('✅ 输赢控制系统正常工作！');
            } else {
              console.log('\n❌❌❌ 100%赢控制失败！');
              console.log(`❌ 和值${sumValue}未命中我们的下注`);
              console.log('❌ 输赢控制系统需要修复！');
            }
            
            return;
          }
        }
      } catch (error) {
        // 继续等待
      }
      
      if (i % 10 === 0) {
        console.log(`⏳ 等待开奖中... (${i}秒)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('❌ 等待开奖超时');
    
  } catch (error) {
    console.error('测试过程出错:', error.message);
  }
}

async function main() {
  console.log('🚀 最终100%赢控制验证测试');
  console.log('=' .repeat(60));
  console.log('⚠️ 期数20250702051已设置为memberA1的100%赢控制');
  console.log('=' .repeat(60));
  
  if (!await memberLogin()) {
    console.log('❌ 会员登录失败');
    return;
  }
  
  if (!await waitForPeriod51()) {
    console.log('❌ 等待期数51超时');
    return;
  }
  
  await placeBetsAndMonitor();
  
  console.log('\n🎉 测试完成！');
}

main().catch(console.error);
