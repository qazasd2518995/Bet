import axios from 'axios';

const AGENT_URL = 'http://localhost:3003/api/agent';
const GAME_URL = 'http://localhost:3000';

async function adminLogin() {
  const response = await axios.post(`${AGENT_URL}/login`, {
    username: 'ti2025A', password: 'ti2025A'
  });
  
  if (response.data.success) {
    const { token, sessionToken } = response.data;
    console.log('✅ 管理员登录成功!');
    return { 'Authorization': token, 'x-session-token': sessionToken };
  }
  throw new Error('管理员登录失败');
}

async function memberLogin() {
  const response = await axios.post(`${GAME_URL}/api/member/login`, {
    username: 'memberA1', password: 'memberA1'
  });
  
  if (response.data.success) {
    console.log('✅ 会员登录成功!');
    return response.data.sessionToken;
  }
  throw new Error('会员登录失败');
}

async function createControl(authHeaders) {
  const gameData = await axios.get(`${GAME_URL}/api/game-data`);
  const currentPeriod = parseInt(gameData.data.gameData.currentPeriod);
  const targetPeriod = currentPeriod + 1;
  
  console.log(`🎯 为期数${targetPeriod}创建100%赢控制 (memberA1)`);
  
  const response = await axios.post(`${AGENT_URL}/win-loss-control`, {
    control_mode: 'single_member',
    target_type: 'member',
    target_username: 'memberA1',
    control_percentage: 100,
    win_control: true,
    loss_control: false,
    start_period: targetPeriod.toString()
  }, { headers: authHeaders });
  
  const controlId = response.data.data.id;
  
  // 激活控制
  await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/activate`, {}, {
    headers: authHeaders
  });
  
  console.log(`✅ 控制创建并激活 (ID: ${controlId})`);
  
  // 验证控制
  const activeCheck = await axios.get(`${AGENT_URL}/internal/win-loss-control/active`);
  console.log('🔍 内部API验证:', activeCheck.data.data.control_mode, activeCheck.data.data.is_active);
  
  return { controlId, targetPeriod };
}

async function waitForTargetPeriod(targetPeriod) {
  console.log(`⏳ 等待期数${targetPeriod}...`);
  
  for (let i = 0; i < 120; i++) {
    const response = await axios.get(`${GAME_URL}/api/game-data`);
    const { currentPeriod, status, countdownSeconds } = response.data.gameData;
    
    if (currentPeriod === targetPeriod && status === 'betting' && countdownSeconds > 20) {
      console.log(`🎮 期数${targetPeriod}开始，剩余${countdownSeconds}秒！`);
      return true;
    }
    
    if (i % 10 === 0) {
      console.log(`⏳ 当前: ${currentPeriod}, 状态: ${status}, 目标: ${targetPeriod}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

async function placeBetsAndWait(targetPeriod, memberToken) {
  console.log('💰 立即下注多个和值...');
  
  const betValues = ['3', '4', '5', '6', '7'];
  let successBets = [];
  
  for (const value of betValues) {
    try {
      const response = await axios.post(`${GAME_URL}/api/bet`, {
        betType: 'sumValue',
        value,
        amount: 200,
        username: 'memberA1'
      }, {
        headers: { 'Authorization': `Bearer ${memberToken}` }
      });
      
      if (response.data.success) {
        console.log(`✅ 下注成功: 200元在和值${value}`);
        successBets.push(value);
      }
    } catch (error) {
      console.log(`❌ 下注失败: ${error.response?.data?.message}`);
    }
  }
  
  if (successBets.length === 0) {
    throw new Error('没有成功下注');
  }
  
  console.log(`�� 总共下注和值: [${successBets.join(', ')}] (应该必中其中一个)`);
  
  // 等待开奖
  console.log('🎲 等待开奖，监控控制效果...');
  
  for (let i = 0; i < 120; i++) {
    try {
      const response = await axios.get(`${GAME_URL}/api/history?limit=1`);
      if (response.data.success && response.data.records.length > 0) {
        const latest = response.data.records[0];
        
        if (latest.period === targetPeriod.toString()) {
          const sumValue = latest.result[0] + latest.result[1];
          
          console.log(`\n🎲 期数${targetPeriod}开奖结果:`);
          console.log(`   完整结果: [${latest.result.join(', ')}]`);
          console.log(`   冠亚军: ${latest.result[0]} + ${latest.result[1]} = 和值${sumValue}`);
          console.log(`   我们下注: [${successBets.join(', ')}]`);
          
          if (successBets.includes(sumValue.toString())) {
            console.log('\n🎉🎉🎉 100%赢控制成功！');
            console.log(`✅ 和值${sumValue}命中我们的下注！`);
            console.log('✅ 输赢控制系统完全正常工作！');
            return true;
          } else {
            console.log('\n❌❌❌ 100%赢控制完全失败！');
            console.log(`❌ 和值${sumValue}完全没有命中我们的任何下注`);
            console.log('❌ 输赢控制系统没有生效！');
            return false;
          }
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
  
  throw new Error('等待开奖超时');
}

async function main() {
  console.log('🚀 最终100%赢控制验证测试');
  console.log('============================================================');
  console.log('⚠️ 这次测试将创建控制并立即验证，不做任何清理');
  console.log('============================================================\n');
  
  try {
    const authHeaders = await adminLogin();
    const memberToken = await memberLogin();
    
    const { controlId, targetPeriod } = await createControl(authHeaders);
    
    const periodReady = await waitForTargetPeriod(targetPeriod);
    if (!periodReady) {
      throw new Error('等待目标期数超时');
    }
    
    const success = await placeBetsAndWait(targetPeriod, memberToken);
    
    console.log('\n' + '=' .repeat(70));
    if (success) {
      console.log('🎉 最终结果: 输赢控制系统修复成功！');
      console.log('✅ 100%赢控制完美工作，能直接影响开奖结果');
    } else {
      console.log('❌ 最终结果: 输赢控制系统仍然失效');
      console.log('❌ 需要进一步调试智能开奖逻辑');
    }
    console.log('=' .repeat(70));
    
    console.log(`\n🔧 控制ID ${controlId} 保留，可手动清理`);
    
  } catch (error) {
    console.error('测试出错:', error.message);
  }
}

main();
