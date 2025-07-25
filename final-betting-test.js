import axios from 'axios';

const GAME_URL = 'http://localhost:3000';
const AGENT_URL = 'http://localhost:3003/api/agent';

// 测试主函数
async function runFinalTest() {
  console.log('🚀 开始最终综合下注测试');
  console.log('=====================================\n');

  try {
    // 1. 检查系统状态
    console.log('1️⃣ 检查系统状态');
    const gameResponse = await axios.get(`${GAME_URL}/api/game-data`);
    const gameData = gameResponse.data.gameData;
    
    console.log(`期数: ${gameData.currentPeriod}`);
    console.log(`状态: ${gameData.status}`);
    console.log(`倒数: ${gameData.countdownSeconds}秒`);
    console.log(`上期结果: ${gameData.lastResult?.join(', ')}`);

    // 2. 登录会员
    console.log('\n2️⃣ 会员登录');
    const loginResponse = await axios.post(`${GAME_URL}/api/member/login`, {
      username: 'test123',
      password: '123456'
    });
    
    if (!loginResponse.data.success) {
      console.error('❌ 会员登录失败:', loginResponse.data.message);
      return;
    }
    
    const memberToken = loginResponse.data.token;
    const memberSessionToken = loginResponse.data.sessionToken;
    console.log('✅ 会员登录成功');

    // 3. 检查会员余额
    console.log('\n3️⃣ 检查会员余额');
    const balanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const initialBalance = parseFloat(balanceResponse.data.balance);
    console.log(`会员初始余额: ${initialBalance}`);

    // 4. 创建100%输控制
    console.log('\n4️⃣ 创建100%输控制');
    const agentLogin = await axios.post(`${AGENT_URL}/login`, {
      username: 'ti2025A',
      password: 'ti2025A'
    });
    
    if (agentLogin.data.success) {
      console.log('✅ 代理ti2025A登录成功');
      
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
        console.log('✅ 成功创建100%输控制');
      } else {
        console.log('❌ 创建控制失败:', controlResponse.data.message);
      }
    } else {
      console.log('❌ 代理登录失败');
    }

    // 5. 等待下注阶段
    console.log('\n5️⃣ 等待下注阶段');
    let attempts = 0;
    while (attempts < 15) {
      const currentGameData = await axios.get(`${GAME_URL}/api/game-data`);
      const status = currentGameData.data.gameData.status;
      const countdown = currentGameData.data.gameData.countdownSeconds;
      
      if (status === 'betting' && countdown > 15) {
        console.log(`✅ 可以下注 - 倒数: ${countdown}秒`);
        break;
      }
      
      console.log(`⏳ 等待下注阶段 - 状态: ${status}, 倒数: ${countdown}秒`);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    if (attempts >= 15) {
      console.log('❌ 等待下注阶段超时');
      return;
    }

    // 6. 提交9码下注（所有必输）
    console.log('\n6️⃣ 提交9码下注测试');
    
    const bets = [
      { betType: 'number', value: '1', position: 1, amount: 500 },  // 冠军1号
      { betType: 'number', value: '2', position: 1, amount: 500 },  // 冠军2号
      { betType: 'number', value: '3', position: 1, amount: 500 },  // 冠军3号
      { betType: 'number', value: '4', position: 1, amount: 500 },  // 冠军4号
      { betType: 'number', value: '5', position: 1, amount: 500 },  // 冠军5号
      { betType: 'number', value: '6', position: 1, amount: 500 },  // 冠军6号
      { betType: 'number', value: '7', position: 1, amount: 500 },  // 冠军7号
      { betType: 'number', value: '8', position: 1, amount: 500 },  // 冠军8号
      { betType: 'number', value: '9', position: 1, amount: 500 }   // 冠军9号
    ];

    const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
    console.log(`准备下注: ${bets.length}注，总金额: ${totalBetAmount}`);

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

        console.log(`提交第${i+1}注: 冠军${bet.value}号 ${bet.amount}元`);

        const betResponse = await axios.post(`${GAME_URL}/api/bet`, betData, {
          headers: { 
            'Authorization': `Bearer ${memberToken}`,
            'X-Session-Token': memberSessionToken
          }
        });

        if (betResponse.data.success) {
          console.log(`✅ 第${i+1}注成功，余额: ${betResponse.data.balance}`);
          successfulBets++;
          totalDeducted += bet.amount;
        } else {
          console.log(`❌ 第${i+1}注失败: ${betResponse.data.message}`);
        }

        // 小延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.log(`❌ 第${i+1}注请求失败:`, error.response?.data?.message || error.message);
      }
    }

    console.log(`\n📊 下注总结:`);
    console.log(`- 成功下注: ${successfulBets}/${bets.length}注`);
    console.log(`- 总扣除金额: ${totalDeducted}元`);

    // 7. 检查余额变化
    console.log('\n7️⃣ 检查余额变化');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const finalBalanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const finalBalance = parseFloat(finalBalanceResponse.data.balance);
    const actualDeduction = initialBalance - finalBalance;
    
    console.log(`初始余额: ${initialBalance}`);
    console.log(`最终余额: ${finalBalance}`);
    console.log(`实际扣除: ${actualDeduction}`);
    console.log(`扣除正确性: ${Math.abs(actualDeduction - totalDeducted) < 0.01 ? '✅ 正确' : '❌ 错误'}`);

    // 8. 检查代理退水
    console.log('\n8️⃣ 检查代理退水');
    const agentBalanceAfter = await axios.post(`${AGENT_URL}/login`, {
      username: 'ti2025A',
      password: 'ti2025A'
    });
    
    if (agentBalanceAfter.data.success) {
      console.log(`代理ti2025A当前余额: ${agentBalanceAfter.data.agent.balance}`);
      console.log('📝 注：退水通常在开奖结算时分配');
    }

    // 9. 等待开奖
    console.log('\n9️⃣ 等待开奖结果');
    let drawWaitCount = 0;
    let drawResult = null;
    
    while (drawWaitCount < 30) {
      const currentGameData = await axios.get(`${GAME_URL}/api/game-data`);
      const status = currentGameData.data.gameData.status;
      const countdown = currentGameData.data.gameData.countdownSeconds;
      
      if (status === 'drawing') {
        console.log('🎲 正在开奖...');
      } else if (status === 'betting' && drawWaitCount > 0) {
        // 新一期开始，获取上期结果
        console.log('🎯 开奖完成，新一期开始');
        try {
          const lastResult = currentGameData.data.gameData.lastResult;
          if (lastResult && Array.isArray(lastResult)) {
            drawResult = lastResult;
            break;
          }
        } catch (error) {
          console.log('获取开奖结果失败');
        }
      }
      
      drawWaitCount++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (drawResult) {
      console.log(`🎲 开奖结果: ${drawResult.join(', ')}`);
      
      // 检查控制效果
      const championNumber = drawResult[0];
      const isLoss = ![1,2,3,4,5,6,7,8,9].includes(championNumber);
      
      console.log(`冠军号码: ${championNumber}`);
      console.log(`下注号码: 1,2,3,4,5,6,7,8,9`);
      console.log(`100%输控制效果: ${isLoss ? '✅ 生效（全输）' : `❌ 未生效（冠军${championNumber}中奖）`}`);
    } else {
      console.log('⏳ 等待开奖超时');
    }

    // 10. 检查最终结算
    console.log('\n🔟 检查最终结算');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const settlementBalanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const settlementBalance = parseFloat(settlementBalanceResponse.data.balance);
    
    console.log(`结算前余额: ${finalBalance}`);
    console.log(`结算后余额: ${settlementBalance}`);
    
    const winAmount = settlementBalance - finalBalance;
    if (winAmount > 0) {
      console.log(`🎉 中奖金额: ${winAmount}`);
    } else if (winAmount === 0) {
      console.log(`📊 无中奖，余额不变`);
    } else {
      console.log(`⚠️ 余额异常变化: ${winAmount}`);
    }

    console.log('\n📊 最终测试完成！');
    console.log('=====================================');

  } catch (error) {
    console.error('🚨 测试过程中发生错误:', error.response?.data || error.message);
  }
}

// 执行测试
runFinalTest().catch(console.error); 