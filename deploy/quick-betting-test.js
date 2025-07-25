import axios from 'axios';

const GAME_URL = 'http://localhost:3000';
const AGENT_URL = 'http://localhost:3003/api/agent';

// 测试主函数
async function runQuickTest() {
  console.log('🚀 开始快速下注测试');
  console.log('=====================================\n');

  try {
    // 1. 检查游戏状态
    console.log('1️⃣ 检查游戏状态');
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
    const memberBalance = parseFloat(balanceResponse.data.balance);
    console.log(`会员余额: ${memberBalance}`);

    // 4. 如果余额不足，提示需要充值
    if (memberBalance < 1000) {
      console.log('\n💰 会员余额不足1000，跳过下注测试');
      console.log('请在代理管理平台给test123会员充值后再测试');
      return;
    }

    // 5. 等待下注阶段
    console.log('\n4️⃣ 等待下注阶段');
    let attempts = 0;
    while (attempts < 10) {
      const currentGameData = await axios.get(`${GAME_URL}/api/game-data`);
      const status = currentGameData.data.gameData.status;
      const countdown = currentGameData.data.gameData.countdownSeconds;
      
      if (status === 'betting' && countdown > 10) {
        console.log(`✅ 可以下注 - 倒数: ${countdown}秒`);
        break;
      }
      
      console.log(`⏳ 等待下注阶段 - 状态: ${status}, 倒数: ${countdown}秒`);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (attempts >= 10) {
      console.log('❌ 等待下注阶段超时');
      return;
    }

    // 6. 提交单注测试
    console.log('\n5️⃣ 提交单注测试');
    const betData = {
      username: 'test123',
      amount: 100,
      betType: 'number',  // 使用正确的字段名
      value: '1',         // 下注号码1
      position: 1         // 冠军位置
    };

    const betResponse = await axios.post(`${GAME_URL}/api/bet`, betData, {
      headers: { 
        'Authorization': `Bearer ${memberToken}`,
        'X-Session-Token': memberSessionToken
      }
    });

    if (betResponse.data.success) {
      console.log('✅ 下注成功');
      console.log(`下注详情: ${betData.betType} 位置${betData.position} 号码${betData.value} 金额: ${betData.amount}`);
      console.log(`剩余余额: ${betResponse.data.balance}`);
    } else {
      console.error('❌ 下注失败:', betResponse.data.message);
      return;
    }

    // 7. 检查下注后余额
    console.log('\n6️⃣ 检查下注后余额');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newBalanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const newBalance = parseFloat(newBalanceResponse.data.balance);
    const deduction = memberBalance - newBalance;
    
    console.log(`下注前余额: ${memberBalance}`);
    console.log(`下注后余额: ${newBalance}`);
    console.log(`余额扣除: ${deduction}`);
    console.log(`扣除是否正确: ${Math.abs(deduction - 100) < 0.01 ? '✅ 正确' : '❌ 错误'}`);

    // 8. 登录代理检查下注记录
    console.log('\n7️⃣ 检查代理系统下注记录');
    
    // 先找到test123的创建代理
    const memberInfo = await axios.get(`${AGENT_URL}/member/info/test123`);
    const creatorAgentId = memberInfo.data.member.agent_id;
    console.log(`test123由代理ID ${creatorAgentId} 创建`);

    // 使用ti2025A代理查询记录
    const agentLoginResponse = await axios.post(`${AGENT_URL}/login`, {
      username: 'ti2025A',
      password: 'ti2025A'
    });
    
    if (agentLoginResponse.data.success) {
      console.log(`✅ 代理 ti2025A 登录成功`);
      
      // 查询该代理的下注记录
      const betsResponse = await axios.get(`${AGENT_URL}/bets`, {
        headers: { 
          'Authorization': `Bearer ${agentLoginResponse.data.token}`,
          'Session-Token': agentLoginResponse.data.sessionToken
        }
      });
      
      const recentBets = betsResponse.data.bets || [];
      const testBet = recentBets.find(bet => bet.username === 'test123' && bet.amount === '100.00');
      
      if (testBet) {
        console.log('✅ 在代理系统中找到下注记录');
        console.log(`记录详情: ${testBet.bet_type} ${testBet.bet_value} 金额: ${testBet.amount}`);
      } else {
        console.log('❌ 在代理系统中未找到下注记录');
        console.log(`最近${recentBets.length}笔记录:`);
        recentBets.slice(0, 3).forEach(bet => {
          console.log(`  - ${bet.username}: ${bet.bet_type} ${bet.bet_value} ${bet.amount}`);
        });
      }
    }

    // 9. 创建100%输控制测试
    console.log('\n8️⃣ 测试100%输控制');
    const controlTestAgents = ['ti2025A', 'ti2025D'];
    
    for (const agentUsername of controlTestAgents) {
      try {
        const agentLogin = await axios.post(`${AGENT_URL}/login`, {
          username: agentUsername,
          password: agentUsername
        });
        
        if (agentLogin.data.success) {
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
            console.log(`✅ ${agentUsername} 成功创建100%输控制`);
            
            // 查询当前活跃控制
            const activeControl = await axios.get(`${AGENT_URL}/internal/win-loss-control/active`);
            if (activeControl.data.success) {
              console.log(`当前活跃控制由 ${activeControl.data.data.operator_username} 设置`);
            }
            break; // 成功创建一个就足够了
          } else {
            console.log(`❌ ${agentUsername} 创建控制失败: ${controlResponse.data.message}`);
          }
        }
      } catch (error) {
        console.log(`❌ ${agentUsername} 测试控制功能失败:`, error.response?.data?.message || error.message);
      }
    }

    console.log('\n📊 快速测试完成！');
    console.log('=====================================');

  } catch (error) {
    console.error('🚨 测试过程中发生错误:', error.response?.data || error.message);
  }
}

// 执行测试
runQuickTest().catch(console.error); 