import axios from 'axios';

const GAME_URL = 'http://localhost:3000';
const AGENT_URL = 'http://localhost:3003/api/agent';

// 测试帐号
const TEST_ACCOUNTS = {
  member: { username: 'test123', password: '123456' },
  agentA: { username: 'ti2025A', password: 'ti2025A' },
  agentD: { username: 'ti2025D', password: 'ti2025D' }
};

let authTokens = {};

// 登录会员
async function loginMember() {
  try {
    const response = await axios.post(`${GAME_URL}/api/member/login`, TEST_ACCOUNTS.member);
    if (response.data.success) {
      authTokens.member = {
        token: response.data.token,
        sessionToken: response.data.sessionToken,
        memberId: response.data.member.id,
        username: response.data.member.username
      };
      console.log(`✅ 会员 ${TEST_ACCOUNTS.member.username} 登录成功`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 会员登录失败:', error.response?.data || error.message);
    return false;
  }
}

// 登录代理
async function loginAgent(agentKey) {
  try {
    const response = await axios.post(`${AGENT_URL}/login`, TEST_ACCOUNTS[agentKey]);
    if (response.data.success) {
      authTokens[agentKey] = {
        token: response.data.token,
        sessionToken: response.data.sessionToken,
        agentId: response.data.agent.id,
        username: response.data.agent.username,
        balance: response.data.agent.balance
      };
      console.log(`✅ 代理 ${TEST_ACCOUNTS[agentKey].username} 登录成功`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ 代理 ${agentKey} 登录失败:`, error.response?.data || error.message);
    return false;
  }
}

// 检查余额
async function checkBalance(accountType, accountKey) {
  try {
    if (accountType === 'member') {
      // 使用代理系统的会员余额查询API
      const response = await axios.get(`${AGENT_URL}/member/balance/${authTokens.member.username}`);
      return response.data.balance;
    } else {
      // 使用登录时返回的代理余额或重新登录获取最新余额
      const response = await axios.post(`${AGENT_URL}/login`, TEST_ACCOUNTS[accountKey]);
      return response.data.agent.balance;
    }
  } catch (error) {
    console.error(`❌ 查询 ${accountType} 余额失败:`, error.response?.data || error.message);
    return null;
  }
}

// 创建100%输控制
async function create100LossControl(agentKey) {
  try {
    const controlData = {
      control_mode: 'normal',
      target_type: null,
      target_username: null,
      control_percentage: 100,
      win_control: false,
      loss_control: true
    };

    const response = await axios.post(`${AGENT_URL}/win-loss-control`, controlData, {
      headers: { 
        'Authorization': `Bearer ${authTokens[agentKey].token}`,
        'Session-Token': authTokens[agentKey].sessionToken
      }
    });

    if (response.data.success) {
      console.log(`✅ ${agentKey} 创建100%输控制成功: ID=${response.data.control.id}`);
      return response.data.control;
    }
    return null;
  } catch (error) {
    console.error(`❌ 创建100%输控制失败:`, error.response?.data || error.message);
    return null;
  }
}

// 获取当前期数和阶段
async function getCurrentGameState() {
  try {
    const response = await axios.get(`${GAME_URL}/api/game-data`);
    return {
      period: response.data.period,
      phase: response.data.phase,
      countdown: response.data.countdown
    };
  } catch (error) {
    console.error('❌ 获取游戏状态失败:', error.response?.data || error.message);
    return null;
  }
}

// 提交多注下注
async function placeBets(bets) {
  try {
    const response = await axios.post(`${GAME_URL}/api/bet`, { bets }, {
      headers: { 
        'Authorization': `Bearer ${authTokens.member.token}`,
        'X-Session-Token': authTokens.member.sessionToken
      }
    });
    
    if (response.data.success) {
      console.log(`✅ 下注成功: ${bets.length} 注`);
      return response.data;
    } else {
      console.error('❌ 下注失败:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ 下注请求失败:', error.response?.data || error.message);
    return null;
  }
}

// 查询代理下注记录和退水
async function getAgentBets(agentKey) {
  try {
    const response = await axios.get(`${AGENT_URL}/bets`, {
      headers: { 
        'Authorization': `Bearer ${authTokens[agentKey].token}`,
        'Session-Token': authTokens[agentKey].sessionToken
      }
    });
    return response.data.bets || [];
  } catch (error) {
    console.error(`❌ 查询 ${agentKey} 下注记录失败:`, error.response?.data || error.message);
    return [];
  }
}

// 检查退水记录
async function getAgentTransactions(agentKey) {
  try {
    const response = await axios.get(`${AGENT_URL}/transactions?type=rebate`, {
      headers: { 
        'Authorization': `Bearer ${authTokens[agentKey].token}`,
        'Session-Token': authTokens[agentKey].sessionToken
      }
    });
    return response.data.transactions || [];
  } catch (error) {
    console.error(`❌ 查询 ${agentKey} 退水记录失败:`, error.response?.data || error.message);
    return [];
  }
}

// 等待下注阶段
async function waitForBettingPhase() {
  console.log('🔄 等待下注阶段...');
  let attempts = 0;
  const maxAttempts = 30; // 最多等待60秒
  
  while (attempts < maxAttempts) {
    const gameState = await getCurrentGameState();
    if (gameState && gameState.phase === 'betting') {
      console.log(`✅ 进入下注阶段 - 期数: ${gameState.period}, 倒数: ${gameState.countdown}秒`);
      return gameState;
    }
    console.log(`⏳ 当前阶段: ${gameState?.phase || 'unknown'}, 等待中... (${attempts+1}/${maxAttempts})`);
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('等待下注阶段超时');
}

// 给会员充值用于测试
async function addMemberBalance(username, amount) {
  try {
    // 使用代理A给会员充值
    const response = await axios.post(`${AGENT_URL}/transfer-member-balance`, {
      agentId: authTokens.agentA.agentId,
      memberId: authTokens.member.memberId,
      amount: amount,
      type: 'deposit',
      description: '测试下注充值'
    }, {
      headers: { 
        'Authorization': `Bearer ${authTokens.agentA.token}`,
        'Session-Token': authTokens.agentA.sessionToken
      }
    });

    if (response.data.success) {
      console.log(`✅ 成功给会员 ${username} 充值 ${amount}`);
      return true;
    } else {
      console.error(`❌ 充值失败:`, response.data.message);
      return false;
    }
  } catch (error) {
    console.error(`❌ 充值请求失败:`, error.response?.data || error.message);
    return false;
  }
}

// 主测试函数
async function runComprehensiveTest() {
  console.log('🚀 开始综合下注测试');
  console.log('=====================================\n');

  try {
    // 1. 登录所有帐号
    console.log('1️⃣ 登录测试帐号');
    const loginResults = await Promise.all([
      loginMember(),
      loginAgent('agentA'),
      loginAgent('agentD')
    ]);

    if (!loginResults.every(result => result)) {
      console.error('❌ 登录失败，终止测试');
      return;
    }

    // 2. 记录初始余额
    console.log('\n2️⃣ 记录初始余额');
    const initialBalances = {
      member: await checkBalance('member'),
      agentA: await checkBalance('agent', 'agentA'),
      agentD: await checkBalance('agent', 'agentD')
    };
    
    console.log('初始余额:');
    console.log(`- 会员 ${authTokens.member.username}: ${initialBalances.member}`);
    console.log(`- 代理A ${authTokens.agentA.username}: ${initialBalances.agentA}`);
    console.log(`- 代理D ${authTokens.agentD.username}: ${initialBalances.agentD}`);

    // 2.5. 如果会员余额不足，进行充值
    const memberBalance = parseFloat(initialBalances.member);
    if (memberBalance < 10000) {
      console.log('\n💰 会员余额不足，进行充值');
      await addMemberBalance(authTokens.member.username, 10000);
      const newBalance = await checkBalance('member');
      console.log(`充值后余额: ${newBalance}`);
    }

    // 3. 创建100%输控制
    console.log('\n3️⃣ 创建100%输控制');
    const control = await create100LossControl('agentA');
    if (!control) {
      console.error('❌ 创建控制失败，继续测试但无法验证控制效果');
    }

    // 4. 等待下注阶段
    console.log('\n4️⃣ 等待下注阶段');
    const gameState = await waitForBettingPhase();
    
    // 5. 准备9码下注（全部必输）
    console.log('\n5️⃣ 准备9码下注');
    const bets = [
      { type: 'number', value: '01', amount: 1000 },
      { type: 'number', value: '02', amount: 1000 },
      { type: 'number', value: '03', amount: 1000 },
      { type: 'number', value: '04', amount: 1000 },
      { type: 'number', value: '05', amount: 1000 },
      { type: 'number', value: '06', amount: 1000 },
      { type: 'number', value: '07', amount: 1000 },
      { type: 'number', value: '08', amount: 1000 },
      { type: 'number', value: '09', amount: 1000 }
    ];

    const totalBetAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
    console.log(`准备下注: ${bets.length} 注，总金额: ${totalBetAmount}`);

    // 6. 提交下注
    console.log('\n6️⃣ 提交下注');
    const betResult = await placeBets(bets);
    if (!betResult) {
      console.error('❌ 下注失败，终止测试');
      return;
    }

    // 7. 检查下注后余额
    console.log('\n7️⃣ 检查下注后余额');
    await new Promise(resolve => setTimeout(resolve, 2000)); // 等待余额更新
    
    const afterBetBalances = {
      member: await checkBalance('member'),
      agentA: await checkBalance('agent', 'agentA'),
      agentD: await checkBalance('agent', 'agentD')
    };

    console.log('下注后余额:');
    console.log(`- 会员 ${authTokens.member.username}: ${afterBetBalances.member}`);
    console.log(`- 代理A ${authTokens.agentA.username}: ${afterBetBalances.agentA}`);
    console.log(`- 代理D ${authTokens.agentD.username}: ${afterBetBalances.agentD}`);

    // 计算余额变化
    const memberDeduction = parseFloat(initialBalances.member) - parseFloat(afterBetBalances.member);
    console.log(`\n💰 会员余额扣除: ${memberDeduction} (预期: ${totalBetAmount})`);
    console.log(`扣除是否正确: ${Math.abs(memberDeduction - totalBetAmount) < 0.01 ? '✅ 正确' : '❌ 错误'}`);

    // 8. 等待开奖
    console.log('\n8️⃣ 等待开奖结果');
    let drawResult = null;
    let waitCount = 0;
    
    while (!drawResult && waitCount < 30) {
      const gameState = await getCurrentGameState();
      if (gameState && gameState.phase === 'drawing') {
        console.log('🎲 正在开奖...');
      } else if (gameState && gameState.phase === 'betting') {
        console.log('🎯 开奖完成，新一期开始');
        // 获取上一期开奖结果
        try {
          const response = await axios.get(`${GAME_URL}/api/latest-draw`);
          drawResult = response.data;
          break;
        } catch (error) {
          console.log('等待开奖结果...');
        }
      }
      waitCount++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (drawResult) {
      console.log(`🎲 开奖结果: ${drawResult.numbers?.join(', ') || 'N/A'}`);
      
      // 检查是否为必输结果（9码都没中）
      const betNumbers = bets.map(bet => bet.value);
      const winningNumbers = drawResult.numbers?.slice(0, 10) || [];
      const hits = betNumbers.filter(num => winningNumbers.includes(num));
      
      console.log(`下注号码: ${betNumbers.join(', ')}`);
      console.log(`中奖号码: ${winningNumbers.join(', ')}`);
      console.log(`命中数量: ${hits.length}`);
      console.log(`100%输控制效果: ${hits.length === 0 ? '✅ 生效（全输）' : `❌ 未生效（中${hits.length}个）`}`);
    }

    // 9. 检查最终余额和退水
    console.log('\n9️⃣ 检查最终余额和退水');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 等待结算完成

    const finalBalances = {
      member: await checkBalance('member'),
      agentA: await checkBalance('agent', 'agentA'),
      agentD: await checkBalance('agent', 'agentD')
    };

    console.log('最终余额:');
    console.log(`- 会员 ${authTokens.member.username}: ${finalBalances.member}`);
    console.log(`- 代理A ${authTokens.agentA.username}: ${finalBalances.agentA}`);
    console.log(`- 代理D ${authTokens.agentD.username}: ${finalBalances.agentD}`);

    // 计算退水
    const agentARebate = parseFloat(finalBalances.agentA) - parseFloat(initialBalances.agentA);
    const agentDRebate = parseFloat(finalBalances.agentD) - parseFloat(initialBalances.agentD);

    console.log(`\n💎 退水分析:`);
    console.log(`- 代理A退水变化: ${agentARebate} (扣除充值操作影响)`);
    console.log(`- 代理D退水变化: ${agentDRebate}`);

    // 10. 查询详细交易记录
    console.log('\n🔟 查询详细交易记录');
    const agentABets = await getAgentBets('agentA');
    const agentDBets = await getAgentBets('agentD');
    const agentATransactions = await getAgentTransactions('agentA');
    const agentDTransactions = await getAgentTransactions('agentD');

    console.log(`代理A下注记录: ${agentABets.length} 笔`);
    console.log(`代理D下注记录: ${agentDBets.length} 笔`);
    console.log(`代理A退水记录: ${agentATransactions.length} 笔`);
    console.log(`代理D退水记录: ${agentDTransactions.length} 笔`);

    console.log('\n📊 测试完成！');
    console.log('=====================================');
    
  } catch (error) {
    console.error('🚨 测试过程中发生错误:', error.message);
  }
}

// 执行测试
runComprehensiveTest().catch(console.error); 