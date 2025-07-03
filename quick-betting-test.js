import axios from 'axios';

const GAME_URL = 'http://localhost:3000';
const AGENT_URL = 'http://localhost:3003/api/agent';

// 測試主函數
async function runQuickTest() {
  console.log('🚀 開始快速下注測試');
  console.log('=====================================\n');

  try {
    // 1. 檢查遊戲狀態
    console.log('1️⃣ 檢查遊戲狀態');
    const gameResponse = await axios.get(`${GAME_URL}/api/game-data`);
    const gameData = gameResponse.data.gameData;
    
    console.log(`期數: ${gameData.currentPeriod}`);
    console.log(`狀態: ${gameData.status}`);
    console.log(`倒數: ${gameData.countdownSeconds}秒`);
    console.log(`上期結果: ${gameData.lastResult?.join(', ')}`);

    // 2. 登錄會員
    console.log('\n2️⃣ 會員登錄');
    const loginResponse = await axios.post(`${GAME_URL}/api/member/login`, {
      username: 'test123',
      password: '123456'
    });
    
    if (!loginResponse.data.success) {
      console.error('❌ 會員登錄失敗:', loginResponse.data.message);
      return;
    }
    
    const memberToken = loginResponse.data.token;
    const memberSessionToken = loginResponse.data.sessionToken;
    console.log('✅ 會員登錄成功');

    // 3. 檢查會員餘額
    console.log('\n3️⃣ 檢查會員餘額');
    const balanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const memberBalance = parseFloat(balanceResponse.data.balance);
    console.log(`會員餘額: ${memberBalance}`);

    // 4. 如果餘額不足，提示需要充值
    if (memberBalance < 1000) {
      console.log('\n💰 會員餘額不足1000，跳過下注測試');
      console.log('請在代理管理平台給test123會員充值後再測試');
      return;
    }

    // 5. 等待下注階段
    console.log('\n4️⃣ 等待下注階段');
    let attempts = 0;
    while (attempts < 10) {
      const currentGameData = await axios.get(`${GAME_URL}/api/game-data`);
      const status = currentGameData.data.gameData.status;
      const countdown = currentGameData.data.gameData.countdownSeconds;
      
      if (status === 'betting' && countdown > 10) {
        console.log(`✅ 可以下注 - 倒數: ${countdown}秒`);
        break;
      }
      
      console.log(`⏳ 等待下注階段 - 狀態: ${status}, 倒數: ${countdown}秒`);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    if (attempts >= 10) {
      console.log('❌ 等待下注階段超時');
      return;
    }

    // 6. 提交單注測試
    console.log('\n5️⃣ 提交單注測試');
    const betData = {
      username: 'test123',
      amount: 100,
      betType: 'number',  // 使用正確的字段名
      value: '1',         // 下注號碼1
      position: 1         // 冠軍位置
    };

    const betResponse = await axios.post(`${GAME_URL}/api/bet`, betData, {
      headers: { 
        'Authorization': `Bearer ${memberToken}`,
        'X-Session-Token': memberSessionToken
      }
    });

    if (betResponse.data.success) {
      console.log('✅ 下注成功');
      console.log(`下注詳情: ${betData.betType} 位置${betData.position} 號碼${betData.value} 金額: ${betData.amount}`);
      console.log(`剩餘餘額: ${betResponse.data.balance}`);
    } else {
      console.error('❌ 下注失敗:', betResponse.data.message);
      return;
    }

    // 7. 檢查下注後餘額
    console.log('\n6️⃣ 檢查下注後餘額');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newBalanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const newBalance = parseFloat(newBalanceResponse.data.balance);
    const deduction = memberBalance - newBalance;
    
    console.log(`下注前餘額: ${memberBalance}`);
    console.log(`下注後餘額: ${newBalance}`);
    console.log(`餘額扣除: ${deduction}`);
    console.log(`扣除是否正確: ${Math.abs(deduction - 100) < 0.01 ? '✅ 正確' : '❌ 錯誤'}`);

    // 8. 登錄代理檢查下注記錄
    console.log('\n7️⃣ 檢查代理系統下注記錄');
    
    // 先找到test123的創建代理
    const memberInfo = await axios.get(`${AGENT_URL}/member/info/test123`);
    const creatorAgentId = memberInfo.data.member.agent_id;
    console.log(`test123由代理ID ${creatorAgentId} 創建`);

    // 使用ti2025A代理查詢記錄
    const agentLoginResponse = await axios.post(`${AGENT_URL}/login`, {
      username: 'ti2025A',
      password: 'ti2025A'
    });
    
    if (agentLoginResponse.data.success) {
      console.log(`✅ 代理 ti2025A 登錄成功`);
      
      // 查詢該代理的下注記錄
      const betsResponse = await axios.get(`${AGENT_URL}/bets`, {
        headers: { 
          'Authorization': `Bearer ${agentLoginResponse.data.token}`,
          'Session-Token': agentLoginResponse.data.sessionToken
        }
      });
      
      const recentBets = betsResponse.data.bets || [];
      const testBet = recentBets.find(bet => bet.username === 'test123' && bet.amount === '100.00');
      
      if (testBet) {
        console.log('✅ 在代理系統中找到下注記錄');
        console.log(`記錄詳情: ${testBet.bet_type} ${testBet.bet_value} 金額: ${testBet.amount}`);
      } else {
        console.log('❌ 在代理系統中未找到下注記錄');
        console.log(`最近${recentBets.length}筆記錄:`);
        recentBets.slice(0, 3).forEach(bet => {
          console.log(`  - ${bet.username}: ${bet.bet_type} ${bet.bet_value} ${bet.amount}`);
        });
      }
    }

    // 9. 創建100%輸控制測試
    console.log('\n8️⃣ 測試100%輸控制');
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
            console.log(`✅ ${agentUsername} 成功創建100%輸控制`);
            
            // 查詢當前活躍控制
            const activeControl = await axios.get(`${AGENT_URL}/internal/win-loss-control/active`);
            if (activeControl.data.success) {
              console.log(`當前活躍控制由 ${activeControl.data.data.operator_username} 設置`);
            }
            break; // 成功創建一個就足夠了
          } else {
            console.log(`❌ ${agentUsername} 創建控制失敗: ${controlResponse.data.message}`);
          }
        }
      } catch (error) {
        console.log(`❌ ${agentUsername} 測試控制功能失敗:`, error.response?.data?.message || error.message);
      }
    }

    console.log('\n📊 快速測試完成！');
    console.log('=====================================');

  } catch (error) {
    console.error('🚨 測試過程中發生錯誤:', error.response?.data || error.message);
  }
}

// 執行測試
runQuickTest().catch(console.error); 