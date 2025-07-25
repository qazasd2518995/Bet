import axios from 'axios';

const AGENT_URL = 'http://localhost:3003/api/agent';
const GAME_URL = 'http://localhost:3000';

let authHeaders = {};

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

async function memberLogin() {
  const response = await axios.post(`${GAME_URL}/api/member/login`, {
    username: 'memberA1', password: 'memberA1'
  });
  
  if (response.data.success) {
    console.log('✅ 会员登录成功!');
    return response.data.sessionToken;
  }
  return null;
}

async function cleanupAndCreateControl() {
  // 清理旧控制
  try {
    const list = await axios.get(`${AGENT_URL}/win-loss-control`, { headers: authHeaders });
    if (list.data.success) {
      for (const control of list.data.data) {
        await axios.delete(`${AGENT_URL}/win-loss-control/${control.id}`, { headers: authHeaders });
      }
    }
  } catch (error) {}
  
  // 获取下一期
  const gameData = await axios.get(`${GAME_URL}/api/game-data`);
  const currentPeriod = parseInt(gameData.data.gameData.currentPeriod);
  const nextPeriod = currentPeriod + 1;
  
  console.log(`🎯 设置期数${nextPeriod}为100%赢控制`);
  
  // 创建新控制
  const response = await axios.post(`${AGENT_URL}/win-loss-control`, {
    control_mode: 'single_member',
    target_type: 'member',
    target_username: 'memberA1',
    control_percentage: 100,
    win_control: true,
    loss_control: false,
    start_period: nextPeriod.toString()
  }, { headers: authHeaders });
  
  const controlId = response.data.data.id;
  await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/activate`, {}, { headers: authHeaders });
  
  console.log(`✅ 控制激活成功 (ID: ${controlId})`);
  return { controlId, targetPeriod: nextPeriod };
}

async function waitAndTest(targetPeriod, memberToken) {
  console.log(`⏳ 等待期数${targetPeriod}开始...`);
  
  // 等待目标期数
  for (let i = 0; i < 120; i++) {
    const response = await axios.get(`${GAME_URL}/api/game-data`);
    const { currentPeriod, status, countdownSeconds } = response.data.gameData;
    
    if (currentPeriod === targetPeriod && status === 'betting' && countdownSeconds > 20) {
      console.log(`🎮 期数${targetPeriod}开始，立即下注！`);
      
      // 立即下注
      const betValues = ['5', '6', '7', '8', '9'];
      let successBets = [];
      
      for (const value of betValues) {
        try {
          const betResponse = await axios.post(`${GAME_URL}/api/bet`, {
            betType: 'sumValue',
            value,
            amount: 100,
            username: 'memberA1'
          }, {
            headers: { 'Authorization': `Bearer ${memberToken}` }
          });
          
          if (betResponse.data.success) {
            console.log(`✅ 下注成功: 100元在和值${value}`);
            successBets.push(value);
          }
        } catch (error) {
          console.log(`❌ 下注失败: ${error.response?.data?.message}`);
        }
      }
      
      if (successBets.length === 0) {
        console.log('❌ 没有成功下注');
        return false;
      }
      
      console.log(`📊 成功下注和值: [${successBets.join(', ')}]`);
      
      // 等待开奖
      console.log('🎲 等待开奖结果...');
      for (let j = 0; j < 120; j++) {
        try {
          const historyResponse = await axios.get(`${GAME_URL}/api/history?limit=1`);
          if (historyResponse.data.success && historyResponse.data.records.length > 0) {
            const latest = historyResponse.data.records[0];
            
            if (latest.period === targetPeriod.toString()) {
              const sumValue = latest.result[0] + latest.result[1];
              console.log(`\n🎲 期数${targetPeriod}开奖结果: [${latest.result.join(', ')}]`);
              console.log(`📊 冠亚军: ${latest.result[0]} + ${latest.result[1]} = 和值${sumValue}`);
              console.log(`💰 我们下注的和值: [${successBets.join(', ')}]`);
              
              if (successBets.includes(sumValue.toString())) {
                console.log('\n🎉🎉🎉 100%赢控制成功！系统正常工作！');
                return true;
              } else {
                console.log('\n❌❌❌ 100%赢控制失败！系统仍有问题！');
                return false;
              }
            }
          }
        } catch (error) {}
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log('❌ 等待开奖超时');
      return false;
    }
    
    if (i % 10 === 0) {
      console.log(`⏳ 当前期数: ${currentPeriod}, 状态: ${status}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('❌ 等待目标期数超时');
  return false;
}

async function cleanup(controlId) {
  try {
    await axios.delete(`${AGENT_URL}/win-loss-control/${controlId}`, { headers: authHeaders });
    console.log('🧹 清理完成');
  } catch (error) {}
}

async function main() {
  console.log('🚀 终极输赢控制验证测试');
  console.log('=' .repeat(60));
  
  if (!await adminLogin()) return;
  
  const memberToken = await memberLogin();
  if (!memberToken) return;
  
  const controlInfo = await cleanupAndCreateControl();
  
  // 测试内部API
  console.log('\n🔍 验证内部API...');
  try {
    const internalResponse = await axios.get(`${AGENT_URL}/internal/win-loss-control/active`);
    console.log('✅ 内部API正常，控制设定:', internalResponse.data.data.control_mode);
  } catch (error) {
    console.log('❌ 内部API错误:', error.message);
    return;
  }
  
  const success = await waitAndTest(controlInfo.targetPeriod, memberToken);
  
  console.log('\n' + '=' .repeat(60));
  if (success) {
    console.log('🎉 测试结果: 输赢控制系统修复成功！');
    console.log('✅ 100%赢控制完全正常工作');
  } else {
    console.log('❌ 测试结果: 输赢控制系统仍需调试');
  }
  console.log('=' .repeat(60));
  
  await cleanup(controlInfo.controlId);
}

main().catch(console.error);
