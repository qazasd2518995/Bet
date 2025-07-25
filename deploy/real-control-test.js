import axios from 'axios';

const AGENT_URL = 'http://localhost:3003/api/agent';
const GAME_URL = 'http://localhost:3000';

let authHeaders = {};
let memberToken = null;
let controlId = null;

// 管理员登录
async function adminLogin() {
  try {
    console.log('🔐 管理员登录...');
    const response = await axios.post(`${AGENT_URL}/login`, {
      username: 'ti2025A',
      password: 'ti2025A'
    });
    
    if (response.data.success) {
      const { token, sessionToken } = response.data;
      authHeaders = { 'Authorization': token, 'x-session-token': sessionToken };
      console.log('✅ 管理员登录成功!');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 管理员登录失败:', error.response?.data || error.message);
    return false;
  }
}

// 会员登录
async function memberLogin() {
  try {
    console.log('🎮 会员登录...');
    const response = await axios.post(`${GAME_URL}/api/member/login`, {
      username: 'memberA1',
      password: 'memberA1'
    });
    
    if (response.data.success) {
      memberToken = response.data.sessionToken;
      console.log('✅ 会员登录成功!');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 会员登录失败:', error.response?.data || error.message);
    return false;
  }
}

// 获取当前期数
async function getCurrentPeriod() {
  try {
    const response = await axios.get(`${GAME_URL}/api/game-data`);
    return response.data.gameData.currentPeriod;
  } catch (error) {
    console.error('❌ 获取期数失败:', error.message);
    return null;
  }
}

// 创建100%赢控制
async function createWinControl(startPeriod) {
  try {
    console.log(`�� 创建100%赢控制 (期数: ${startPeriod})...`);
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
      console.log(`✅ 控制设定创建成功 (ID: ${controlId})`);
      
      // 激活控制
      await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/activate`, {}, {
        headers: authHeaders
      });
      console.log('✅ 控制设定已激活 - memberA1 100%赢控制');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 创建控制失败:', error.response?.data || error.message);
    return false;
  }
}

// 下注测试
async function placeBets() {
  try {
    console.log('💰 开始下注测试...');
    
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
          console.log(`❌ 下注失败: ${response.data.message}`);
        }
      } catch (error) {
        console.log(`❌ 下注错误: ${error.response?.data?.message || error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`📊 下注结果: ${successCount}/${bets.length} 笔成功`);
    return successCount > 0;
  } catch (error) {
    console.error('❌ 下注过程错误:', error);
    return false;
  }
}

// 等待并检查开奖结果
async function waitAndCheckResult() {
  console.log('⏳ 等待开奖结果...');
  
  let lastPeriod = null;
  
  for (let i = 0; i < 120; i++) { // 等待2分钟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const response = await axios.get(`${GAME_URL}/api/history?limit=1`);
      if (response.data.success && response.data.data.length > 0) {
        const latest = response.data.data[0];
        
        if (lastPeriod !== latest.period) {
          lastPeriod = latest.period;
          console.log(`🎲 期数 ${latest.period} 开奖: [${latest.result.join(', ')}]`);
          
          // 检查和值
          const sumValue = latest.result[0] + latest.result[1];
          console.log(`📊 冠亚军和值: ${latest.result[0]} + ${latest.result[1]} = ${sumValue}`);
          
          // 检查是否命中我们的下注
          const ourBets = [9, 10, 11];
          if (ourBets.includes(sumValue)) {
            console.log(`🎉 中奖了！和值 ${sumValue} 命中我们的下注`);
          } else {
            console.log(`😞 没中奖，和值 ${sumValue} 未命中我们的下注`);
          }
          
          return { period: latest.period, result: latest.result, sumValue };
        }
      }
    } catch (error) {
      // 继续等待
    }
    
    if (i % 10 === 0) {
      console.log(`⏳ 等待中... (${i}秒)`);
    }
  }
  
  console.log('❌ 等待超时');
  return null;
}

// 检查下注记录
async function checkBetResults() {
  try {
    console.log('📋 检查下注结果...');
    const response = await axios.get(`${GAME_URL}/api/bet-history?limit=10`, {
      headers: { 'Authorization': `Bearer ${memberToken}` }
    });
    
    if (response.data.success) {
      const recentBets = response.data.data.filter(bet => 
        bet.username === 'memberA1' && bet.settled
      ).slice(0, 5);
      
      console.log('📊 最近5笔已结算下注:');
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
        
        console.log(`${index + 1}. 期数${bet.period} ${bet.bet_type}:${bet.bet_value} 金额${bet.amount}元 ${isWin ? '✅中奖' + bet.win_amount + '元' : '❌未中奖'}`);
      });
      
      const winRate = totalBets > 0 ? (totalWins / totalBets * 100).toFixed(1) : 0;
      console.log(`\n🎯 总结: ${totalBets}笔下注, ${totalWins}笔中奖, 胜率${winRate}%, 总赢${totalWinAmount}元`);
      
      if (winRate >= 80) {
        console.log('🎉 100%赢控制效果优秀！');
      } else {
        console.log('⚠️ 100%赢控制效果待改善');
      }
    }
  } catch (error) {
    console.error('❌ 检查结果失败:', error.response?.data || error.message);
  }
}

// 清理控制设定
async function cleanup() {
  if (controlId) {
    try {
      await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/deactivate`, {}, {
        headers: authHeaders
      });
      await axios.delete(`${AGENT_URL}/win-loss-control/${controlId}`, {
        headers: authHeaders
      });
      console.log('🧹 控制设定已清理');
    } catch (error) {
      console.error('❌ 清理失败:', error.response?.data || error.message);
    }
  }
}

// 主测试流程
async function main() {
  console.log('🚀 真实输赢控制测试开始\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. 登录
    if (!await adminLogin()) return;
    if (!await memberLogin()) return;
    
    // 2. 获取当前期数
    const currentPeriod = await getCurrentPeriod();
    if (!currentPeriod) return;
    
    const nextPeriod = currentPeriod + 1;
    console.log(`📅 当前期数: ${currentPeriod}, 下期: ${nextPeriod}\n`);
    
    // 3. 创建控制
    if (!await createWinControl(nextPeriod)) return;
    
    // 4. 等待下一期开始并下注
    console.log('⏳ 等待下一期开始...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    if (!await placeBets()) {
      console.log('❌ 下注失败，结束测试');
      await cleanup();
      return;
    }
    
    // 5. 等待开奖结果
    const result = await waitAndCheckResult();
    
    // 6. 检查结果
    if (result) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 等待结算
      await checkBetResults();
    }
    
  } catch (error) {
    console.error('测试过程出错:', error);
  } finally {
    await cleanup();
    console.log('\n🎉 测试完成！');
  }
}

// 执行测试
main().catch(console.error);
