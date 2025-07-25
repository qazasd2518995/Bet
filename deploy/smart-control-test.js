import axios from 'axios';

const AGENT_URL = 'http://localhost:3003/api/agent';
const GAME_URL = 'http://localhost:3000';

let authHeaders = {};
let memberToken = null;

// 管理员登录
async function adminLogin() {
  const response = await axios.post(`${AGENT_URL}/login`, {
    username: 'ti2025A', password: 'ti2025A'
  });
  
  if (response.data.success) {
    const { token, sessionToken } = response.data;
    authHeaders = { 'Authorization': token, 'x-session-token': sessionToken };
    console.log('✅ 管理员登录成功!');
    return true;
  }
  return false;
}

// 会员登录
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

// 等待下注阶段
async function waitForBettingPhase() {
  console.log('⏳ 等待下注阶段...');
  
  for (let i = 0; i < 120; i++) {
    try {
      const response = await axios.get(`${GAME_URL}/api/game-data`);
      const { status, countdownSeconds, currentPeriod } = response.data.gameData;
      
      if (status === 'betting' && countdownSeconds > 30) {
        console.log(`🎮 期数${currentPeriod}下注阶段开始，剩余${countdownSeconds}秒`);
        return currentPeriod;
      }
      
      if (i % 5 === 0) {
        console.log(`⏳ 当前状态: ${status}, 期数: ${currentPeriod}, 倒数: ${countdownSeconds}秒`);
      }
    } catch (error) {
      // 继续等待
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return null;
}

// 创建并激活控制
async function setupControl(period) {
  console.log(`🎯 为期数${period}设置100%赢控制...`);
  
  const response = await axios.post(`${AGENT_URL}/win-loss-control`, {
    control_mode: 'single_member',
    target_type: 'member',
    target_username: 'memberA1',
    control_percentage: 100,
    win_control: true,
    loss_control: false,
    start_period: period.toString()
  }, { headers: authHeaders });
  
  if (response.data.success) {
    const controlId = response.data.data.id;
    await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/activate`, {}, {
      headers: authHeaders
    });
    console.log(`✅ 100%赢控制已激活 (ID: ${controlId})`);
    return controlId;
  }
  return null;
}

// 快速下注
async function quickBet() {
  console.log('💰 立即下注...');
  
  const bets = [
    { betType: 'sumValue', value: '8', amount: 100 },
    { betType: 'sumValue', value: '9', amount: 100 },
    { betType: 'sumValue', value: '10', amount: 100 }
  ];
  
  let success = 0;
  for (const bet of bets) {
    try {
      const response = await axios.post(`${GAME_URL}/api/bet`, {
        ...bet, username: 'memberA1'
      }, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
      });
      
      if (response.data.success) {
        console.log(`✅ 下注成功: ${bet.amount}元 在和值${bet.value}`);
        success++;
      }
    } catch (error) {
      console.log(`❌ 下注失败: ${error.response?.data?.message}`);
    }
  }
  
  return success;
}

// 监控开奖结果
async function monitorResult(targetPeriod) {
  console.log(`🎲 监控期数${targetPeriod}的开奖结果...`);
  
  for (let i = 0; i < 60; i++) {
    try {
      const response = await axios.get(`${GAME_URL}/api/history?limit=1`);
      if (response.data.success && response.data.data.length > 0) {
        const latest = response.data.data[0];
        
        if (latest.period >= targetPeriod) {
          const sumValue = latest.result[0] + latest.result[1];
          console.log(`🎲 期数${latest.period}开奖: [${latest.result.join(', ')}]`);
          console.log(`📊 冠亚军和值: ${latest.result[0]} + ${latest.result[1]} = ${sumValue}`);
          
          // 检查是否命中
          const ourBets = [8, 9, 10];
          if (ourBets.includes(sumValue)) {
            console.log(`🎉 100%赢控制成功！和值${sumValue}命中我们的下注！`);
            return { success: true, sumValue, result: latest.result };
          } else {
            console.log(`❌ 100%赢控制失败，和值${sumValue}未命中我们的下注`);
            return { success: false, sumValue, result: latest.result };
          }
        }
      }
    } catch (error) {
      // 继续等待
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return { success: false, timeout: true };
}

// 清理控制
async function cleanup(controlId) {
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
      // 忽略清理错误
    }
  }
}

// 主测试
async function main() {
  console.log('🚀 智能输赢控制测试');
  console.log('=' .repeat(50));
  
  try {
    // 登录
    if (!await adminLogin() || !await memberLogin()) {
      console.log('❌ 登录失败');
      return;
    }
    
    // 等待下注阶段
    const bettingPeriod = await waitForBettingPhase();
    if (!bettingPeriod) {
      console.log('❌ 未找到下注阶段');
      return;
    }
    
    // 设置控制
    const controlId = await setupControl(bettingPeriod);
    if (!controlId) {
      console.log('❌ 控制设置失败');
      return;
    }
    
    // 立即下注
    const betCount = await quickBet();
    if (betCount === 0) {
      console.log('❌ 下注失败');
      await cleanup(controlId);
      return;
    }
    
    console.log(`📊 成功下注${betCount}笔，等待开奖验证100%赢控制效果...`);
    
    // 监控结果
    const result = await monitorResult(bettingPeriod);
    
    // 输出最终结果
    console.log('\n' + '=' .repeat(50));
    if (result.success) {
      console.log('🎉 测试结果: 100%赢控制系统正常工作！');
      console.log(`✅ 成功控制开奖结果，确保会员中奖`);
    } else if (result.timeout) {
      console.log('⏰ 测试超时');
    } else {
      console.log('❌ 测试结果: 100%赢控制系统需要调整');
      console.log(`❌ 控制失效，会员未能中奖`);
    }
    
    await cleanup(controlId);
    
  } catch (error) {
    console.error('测试错误:', error.message);
  }
  
  console.log('🎉 测试完成');
}

main().catch(console.error);
