import axios from 'axios';

const GAME_URL = 'http://localhost:3000';
const AGENT_URL = 'http://localhost:3003/api/agent';

// 測試帳號
const TEST_ACCOUNTS = {
  member: { username: 'test123', password: '123456' },
  agentA: { username: 'ti2025A', password: 'ti2025A' },
  agentD: { username: 'ti2025D', password: 'ti2025D' }
};

let authTokens = {};

// 登錄會員
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
      console.log(`✅ 會員 ${TEST_ACCOUNTS.member.username} 登錄成功`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 會員登錄失敗:', error.response?.data || error.message);
    return false;
  }
}

// 登錄代理
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
      console.log(`✅ 代理 ${TEST_ACCOUNTS[agentKey].username} 登錄成功`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ 代理 ${agentKey} 登錄失敗:`, error.response?.data || error.message);
    return false;
  }
}

// 檢查餘額
async function checkBalance(accountType, accountKey) {
  try {
    if (accountType === 'member') {
      // 使用代理系統的會員餘額查詢API
      const response = await axios.get(`${AGENT_URL}/member/balance/${authTokens.member.username}`);
      return response.data.balance;
    } else {
      // 使用登錄時返回的代理餘額或重新登錄獲取最新餘額
      const response = await axios.post(`${AGENT_URL}/login`, TEST_ACCOUNTS[accountKey]);
      return response.data.agent.balance;
    }
  } catch (error) {
    console.error(`❌ 查詢 ${accountType} 餘額失敗:`, error.response?.data || error.message);
    return null;
  }
}

// 創建100%輸控制
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
      console.log(`✅ ${agentKey} 創建100%輸控制成功: ID=${response.data.control.id}`);
      return response.data.control;
    }
    return null;
  } catch (error) {
    console.error(`❌ 創建100%輸控制失敗:`, error.response?.data || error.message);
    return null;
  }
}

// 獲取當前期數和階段
async function getCurrentGameState() {
  try {
    const response = await axios.get(`${GAME_URL}/api/game-data`);
    return {
      period: response.data.period,
      phase: response.data.phase,
      countdown: response.data.countdown
    };
  } catch (error) {
    console.error('❌ 獲取遊戲狀態失敗:', error.response?.data || error.message);
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
      console.error('❌ 下注失敗:', response.data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ 下注請求失敗:', error.response?.data || error.message);
    return null;
  }
}

// 查詢代理下注記錄和退水
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
    console.error(`❌ 查詢 ${agentKey} 下注記錄失敗:`, error.response?.data || error.message);
    return [];
  }
}

// 檢查退水記錄
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
    console.error(`❌ 查詢 ${agentKey} 退水記錄失敗:`, error.response?.data || error.message);
    return [];
  }
}

// 等待下注階段
async function waitForBettingPhase() {
  console.log('🔄 等待下注階段...');
  let attempts = 0;
  const maxAttempts = 30; // 最多等待60秒
  
  while (attempts < maxAttempts) {
    const gameState = await getCurrentGameState();
    if (gameState && gameState.phase === 'betting') {
      console.log(`✅ 進入下注階段 - 期數: ${gameState.period}, 倒數: ${gameState.countdown}秒`);
      return gameState;
    }
    console.log(`⏳ 當前階段: ${gameState?.phase || 'unknown'}, 等待中... (${attempts+1}/${maxAttempts})`);
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('等待下注階段超時');
}

// 給會員充值用於測試
async function addMemberBalance(username, amount) {
  try {
    // 使用代理A給會員充值
    const response = await axios.post(`${AGENT_URL}/transfer-member-balance`, {
      agentId: authTokens.agentA.agentId,
      memberId: authTokens.member.memberId,
      amount: amount,
      type: 'deposit',
      description: '測試下注充值'
    }, {
      headers: { 
        'Authorization': `Bearer ${authTokens.agentA.token}`,
        'Session-Token': authTokens.agentA.sessionToken
      }
    });

    if (response.data.success) {
      console.log(`✅ 成功給會員 ${username} 充值 ${amount}`);
      return true;
    } else {
      console.error(`❌ 充值失敗:`, response.data.message);
      return false;
    }
  } catch (error) {
    console.error(`❌ 充值請求失敗:`, error.response?.data || error.message);
    return false;
  }
}

// 主測試函數
async function runComprehensiveTest() {
  console.log('🚀 開始綜合下注測試');
  console.log('=====================================\n');

  try {
    // 1. 登錄所有帳號
    console.log('1️⃣ 登錄測試帳號');
    const loginResults = await Promise.all([
      loginMember(),
      loginAgent('agentA'),
      loginAgent('agentD')
    ]);

    if (!loginResults.every(result => result)) {
      console.error('❌ 登錄失敗，終止測試');
      return;
    }

    // 2. 記錄初始餘額
    console.log('\n2️⃣ 記錄初始餘額');
    const initialBalances = {
      member: await checkBalance('member'),
      agentA: await checkBalance('agent', 'agentA'),
      agentD: await checkBalance('agent', 'agentD')
    };
    
    console.log('初始餘額:');
    console.log(`- 會員 ${authTokens.member.username}: ${initialBalances.member}`);
    console.log(`- 代理A ${authTokens.agentA.username}: ${initialBalances.agentA}`);
    console.log(`- 代理D ${authTokens.agentD.username}: ${initialBalances.agentD}`);

    // 2.5. 如果會員餘額不足，進行充值
    const memberBalance = parseFloat(initialBalances.member);
    if (memberBalance < 10000) {
      console.log('\n💰 會員餘額不足，進行充值');
      await addMemberBalance(authTokens.member.username, 10000);
      const newBalance = await checkBalance('member');
      console.log(`充值後餘額: ${newBalance}`);
    }

    // 3. 創建100%輸控制
    console.log('\n3️⃣ 創建100%輸控制');
    const control = await create100LossControl('agentA');
    if (!control) {
      console.error('❌ 創建控制失敗，繼續測試但無法驗證控制效果');
    }

    // 4. 等待下注階段
    console.log('\n4️⃣ 等待下注階段');
    const gameState = await waitForBettingPhase();
    
    // 5. 準備9碼下注（全部必輸）
    console.log('\n5️⃣ 準備9碼下注');
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
    console.log(`準備下注: ${bets.length} 注，總金額: ${totalBetAmount}`);

    // 6. 提交下注
    console.log('\n6️⃣ 提交下注');
    const betResult = await placeBets(bets);
    if (!betResult) {
      console.error('❌ 下注失敗，終止測試');
      return;
    }

    // 7. 檢查下注後餘額
    console.log('\n7️⃣ 檢查下注後餘額');
    await new Promise(resolve => setTimeout(resolve, 2000)); // 等待餘額更新
    
    const afterBetBalances = {
      member: await checkBalance('member'),
      agentA: await checkBalance('agent', 'agentA'),
      agentD: await checkBalance('agent', 'agentD')
    };

    console.log('下注後餘額:');
    console.log(`- 會員 ${authTokens.member.username}: ${afterBetBalances.member}`);
    console.log(`- 代理A ${authTokens.agentA.username}: ${afterBetBalances.agentA}`);
    console.log(`- 代理D ${authTokens.agentD.username}: ${afterBetBalances.agentD}`);

    // 計算餘額變化
    const memberDeduction = parseFloat(initialBalances.member) - parseFloat(afterBetBalances.member);
    console.log(`\n💰 會員餘額扣除: ${memberDeduction} (預期: ${totalBetAmount})`);
    console.log(`扣除是否正確: ${Math.abs(memberDeduction - totalBetAmount) < 0.01 ? '✅ 正確' : '❌ 錯誤'}`);

    // 8. 等待開獎
    console.log('\n8️⃣ 等待開獎結果');
    let drawResult = null;
    let waitCount = 0;
    
    while (!drawResult && waitCount < 30) {
      const gameState = await getCurrentGameState();
      if (gameState && gameState.phase === 'drawing') {
        console.log('🎲 正在開獎...');
      } else if (gameState && gameState.phase === 'betting') {
        console.log('🎯 開獎完成，新一期開始');
        // 獲取上一期開獎結果
        try {
          const response = await axios.get(`${GAME_URL}/api/latest-draw`);
          drawResult = response.data;
          break;
        } catch (error) {
          console.log('等待開獎結果...');
        }
      }
      waitCount++;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (drawResult) {
      console.log(`🎲 開獎結果: ${drawResult.numbers?.join(', ') || 'N/A'}`);
      
      // 檢查是否為必輸結果（9碼都沒中）
      const betNumbers = bets.map(bet => bet.value);
      const winningNumbers = drawResult.numbers?.slice(0, 10) || [];
      const hits = betNumbers.filter(num => winningNumbers.includes(num));
      
      console.log(`下注號碼: ${betNumbers.join(', ')}`);
      console.log(`中獎號碼: ${winningNumbers.join(', ')}`);
      console.log(`命中數量: ${hits.length}`);
      console.log(`100%輸控制效果: ${hits.length === 0 ? '✅ 生效（全輸）' : `❌ 未生效（中${hits.length}個）`}`);
    }

    // 9. 檢查最終餘額和退水
    console.log('\n9️⃣ 檢查最終餘額和退水');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 等待結算完成

    const finalBalances = {
      member: await checkBalance('member'),
      agentA: await checkBalance('agent', 'agentA'),
      agentD: await checkBalance('agent', 'agentD')
    };

    console.log('最終餘額:');
    console.log(`- 會員 ${authTokens.member.username}: ${finalBalances.member}`);
    console.log(`- 代理A ${authTokens.agentA.username}: ${finalBalances.agentA}`);
    console.log(`- 代理D ${authTokens.agentD.username}: ${finalBalances.agentD}`);

    // 計算退水
    const agentARebate = parseFloat(finalBalances.agentA) - parseFloat(initialBalances.agentA);
    const agentDRebate = parseFloat(finalBalances.agentD) - parseFloat(initialBalances.agentD);

    console.log(`\n💎 退水分析:`);
    console.log(`- 代理A退水變化: ${agentARebate} (扣除充值操作影響)`);
    console.log(`- 代理D退水變化: ${agentDRebate}`);

    // 10. 查詢詳細交易記錄
    console.log('\n🔟 查詢詳細交易記錄');
    const agentABets = await getAgentBets('agentA');
    const agentDBets = await getAgentBets('agentD');
    const agentATransactions = await getAgentTransactions('agentA');
    const agentDTransactions = await getAgentTransactions('agentD');

    console.log(`代理A下注記錄: ${agentABets.length} 筆`);
    console.log(`代理D下注記錄: ${agentDBets.length} 筆`);
    console.log(`代理A退水記錄: ${agentATransactions.length} 筆`);
    console.log(`代理D退水記錄: ${agentDTransactions.length} 筆`);

    console.log('\n📊 測試完成！');
    console.log('=====================================');
    
  } catch (error) {
    console.error('🚨 測試過程中發生錯誤:', error.message);
  }
}

// 執行測試
runComprehensiveTest().catch(console.error); 