import axios from 'axios';

const AGENT_URL = 'http://localhost:3003/api/agent';
const GAME_URL = 'http://localhost:3000';

let authHeaders = {};
let memberToken = null;
let controlId = null;

// 管理員登錄
async function adminLogin() {
  try {
    console.log('🔐 管理員登錄...');
    const response = await axios.post(`${AGENT_URL}/login`, {
      username: 'ti2025A',
      password: 'ti2025A'
    });
    
    if (response.data.success) {
      const { token, sessionToken } = response.data;
      authHeaders = { 'Authorization': token, 'x-session-token': sessionToken };
      console.log('✅ 管理員登錄成功!');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 管理員登錄失敗:', error.response?.data || error.message);
    return false;
  }
}

// 會員登錄
async function memberLogin() {
  try {
    console.log('🎮 會員登錄...');
    const response = await axios.post(`${GAME_URL}/api/member/login`, {
      username: 'memberA1',
      password: 'memberA1'
    });
    
    if (response.data.success) {
      memberToken = response.data.sessionToken;
      console.log('✅ 會員登錄成功!');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 會員登錄失敗:', error.response?.data || error.message);
    return false;
  }
}

// 獲取當前期數
async function getCurrentPeriod() {
  try {
    const response = await axios.get(`${GAME_URL}/api/game-data`);
    return response.data.gameData.currentPeriod;
  } catch (error) {
    console.error('❌ 獲取期數失敗:', error.message);
    return null;
  }
}

// 創建100%贏控制
async function createWinControl(startPeriod) {
  try {
    console.log(`�� 創建100%贏控制 (期數: ${startPeriod})...`);
    const response = await axios.post(`${AGENT_URL}/win-loss-control`, {
      control_mode: 'single_member',
      target_type: 'member',
      target_username: 'memberA1', 
      control_percentage: 100,
      win_control: true,
      loss_control: false,
      start_period: startPeriod.toString()
    }, { headers: authHeaders });
    
    if (response.data.success) {
      controlId = response.data.data.id;
      console.log(`✅ 控制設定創建成功 (ID: ${controlId})`);
      
      // 激活控制
      await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/activate`, {}, {
        headers: authHeaders
      });
      console.log('✅ 控制設定已激活 - memberA1 100%贏控制');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 創建控制失敗:', error.response?.data || error.message);
    return false;
  }
}

// 下注測試
async function placeBets() {
  try {
    console.log('💰 開始下注測試...');
    
    const bets = [
      { betType: 'sumValue', value: '10', amount: 100 },
      { betType: 'sumValue', value: '11', amount: 100 },
      { betType: 'sumValue', value: '9', amount: 100 }
    ];
    
    let successCount = 0;
    for (const bet of bets) {
      try {
        const response = await axios.post(`${GAME_URL}/api/bet`, {
          ...bet,
          username: 'memberA1'
        }, {
          headers: { 'Authorization': `Bearer ${memberToken}` }
        });
        
        if (response.data.success) {
          console.log(`✅ 下注成功: ${bet.amount}元 在 ${bet.betType}-${bet.value}`);
          successCount++;
        } else {
          console.log(`❌ 下注失敗: ${response.data.message}`);
        }
      } catch (error) {
        console.log(`❌ 下注錯誤: ${error.response?.data?.message || error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📊 下注結果: ${successCount}/${bets.length} 筆成功`);
    return successCount > 0;
  } catch (error) {
    console.error('❌ 下注過程錯誤:', error);
    return false;
  }
}

// 等待並檢查開獎結果
async function waitAndCheckResult() {
  console.log('⏳ 等待開獎結果...');
  
  let lastPeriod = null;
  
  for (let i = 0; i < 120; i++) { // 等待2分鐘
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const response = await axios.get(`${GAME_URL}/api/history?limit=1`);
      if (response.data.success && response.data.data.length > 0) {
        const latest = response.data.data[0];
        
        if (lastPeriod !== latest.period) {
          lastPeriod = latest.period;
          console.log(`🎲 期數 ${latest.period} 開獎: [${latest.result.join(', ')}]`);
          
          // 檢查和值
          const sumValue = latest.result[0] + latest.result[1];
          console.log(`📊 冠亞軍和值: ${latest.result[0]} + ${latest.result[1]} = ${sumValue}`);
          
          // 檢查是否命中我們的下注
          const ourBets = [9, 10, 11];
          if (ourBets.includes(sumValue)) {
            console.log(`🎉 中獎了！和值 ${sumValue} 命中我們的下注`);
          } else {
            console.log(`😞 沒中獎，和值 ${sumValue} 未命中我們的下注`);
          }
          
          return { period: latest.period, result: latest.result, sumValue };
        }
      }
    } catch (error) {
      // 繼續等待
    }
    
    if (i % 10 === 0) {
      console.log(`⏳ 等待中... (${i}秒)`);
    }
  }
  
  console.log('❌ 等待超時');
  return null;
}

// 檢查下注記錄
async function checkBetResults() {
  try {
    console.log('📋 檢查下注結果...');
    const response = await axios.get(`${GAME_URL}/api/bet-history?limit=10`, {
      headers: { 'Authorization': `Bearer ${memberToken}` }
    });
    
    if (response.data.success) {
      const recentBets = response.data.data.filter(bet => 
        bet.username === 'memberA1' && bet.settled
      ).slice(0, 5);
      
      console.log('📊 最近5筆已結算下注:');
      let totalWins = 0;
      let totalBets = 0;
      let totalWinAmount = 0;
      
      recentBets.forEach((bet, index) => {
        const isWin = bet.win_amount > 0;
        totalBets++;
        if (isWin) {
          totalWins++;
          totalWinAmount += bet.win_amount;
        }
        
        console.log(`${index + 1}. 期數${bet.period} ${bet.bet_type}:${bet.bet_value} 金額${bet.amount}元 ${isWin ? '✅中獎' + bet.win_amount + '元' : '❌未中獎'}`);
      });
      
      const winRate = totalBets > 0 ? (totalWins / totalBets * 100).toFixed(1) : 0;
      console.log(`\n🎯 總結: ${totalBets}筆下注, ${totalWins}筆中獎, 勝率${winRate}%, 總贏${totalWinAmount}元`);
      
      if (winRate >= 80) {
        console.log('🎉 100%贏控制效果優秀！');
      } else {
        console.log('⚠️ 100%贏控制效果待改善');
      }
    }
  } catch (error) {
    console.error('❌ 檢查結果失敗:', error.response?.data || error.message);
  }
}

// 清理控制設定
async function cleanup() {
  if (controlId) {
    try {
      await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/deactivate`, {}, {
        headers: authHeaders
      });
      await axios.delete(`${AGENT_URL}/win-loss-control/${controlId}`, {
        headers: authHeaders
      });
      console.log('🧹 控制設定已清理');
    } catch (error) {
      console.error('❌ 清理失敗:', error.response?.data || error.message);
    }
  }
}

// 主測試流程
async function main() {
  console.log('🚀 真實輸贏控制測試開始\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. 登錄
    if (!await adminLogin()) return;
    if (!await memberLogin()) return;
    
    // 2. 獲取當前期數
    const currentPeriod = await getCurrentPeriod();
    if (!currentPeriod) return;
    
    const nextPeriod = currentPeriod + 1;
    console.log(`📅 當前期數: ${currentPeriod}, 下期: ${nextPeriod}\n`);
    
    // 3. 創建控制
    if (!await createWinControl(nextPeriod)) return;
    
    // 4. 等待下一期開始並下注
    console.log('⏳ 等待下一期開始...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    if (!await placeBets()) {
      console.log('❌ 下注失敗，結束測試');
      await cleanup();
      return;
    }
    
    // 5. 等待開獎結果
    const result = await waitAndCheckResult();
    
    // 6. 檢查結果
    if (result) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 等待結算
      await checkBetResults();
    }
    
  } catch (error) {
    console.error('測試過程出錯:', error);
  } finally {
    await cleanup();
    console.log('\n🎉 測試完成！');
  }
}

// 執行測試
main().catch(console.error);
