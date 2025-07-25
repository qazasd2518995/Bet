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

async function cleanupOldControls() {
  try {
    const response = await axios.get(`${AGENT_URL}/win-loss-control`, {
      headers: authHeaders
    });
    
    if (response.data.success && response.data.data.length > 0) {
      console.log('🧹 清理旧控制设定...');
      for (const control of response.data.data) {
        await axios.delete(`${AGENT_URL}/win-loss-control/${control.id}`, {
          headers: authHeaders
        });
      }
      console.log('✅ 旧控制设定已清理');
    }
  } catch (error) {
    console.log('清理旧控制时出错:', error.message);
  }
}

async function createCorrectControl() {
  try {
    // 获取当前期数
    const gameData = await axios.get(`${GAME_URL}/api/game-data`);
    const currentPeriod = parseInt(gameData.data.gameData.currentPeriod);
    const nextPeriod = currentPeriod + 1;
    
    console.log(`🎯 当前期数: ${currentPeriod}`);
    console.log(`🎯 设置控制期数: ${nextPeriod}`);
    
    const controlData = {
      control_mode: 'single_member',
      target_type: 'member',
      target_username: 'memberA1',
      control_percentage: 100,
      win_control: true,
      loss_control: false,
      start_period: nextPeriod.toString()
    };
    
    console.log('📋 控制设定:', JSON.stringify(controlData, null, 2));
    
    const response = await axios.post(`${AGENT_URL}/win-loss-control`, controlData, {
      headers: authHeaders
    });
    
    if (response.data.success) {
      const controlId = response.data.data.id;
      console.log(`✅ 控制创建成功 (ID: ${controlId})`);
      
      // 激活控制
      await axios.put(`${AGENT_URL}/win-loss-control/${controlId}/activate`, {}, {
        headers: authHeaders
      });
      
      console.log('✅ 控制已激活');
      
      // 验证激活
      const activeResponse = await axios.get(`${AGENT_URL}/win-loss-control/active`, {
        headers: authHeaders
      });
      
      console.log('✅ 激活验证:', JSON.stringify(activeResponse.data, null, 2));
      
      return { controlId, targetPeriod: nextPeriod };
    }
    
    return null;
  } catch (error) {
    console.error('创建控制失败:', error.response?.data || error.message);
    return null;
  }
}

async function main() {
  console.log('🔧 正确的输赢控制测试');
  console.log('=' .repeat(50));
  
  await adminLogin();
  await cleanupOldControls();
  
  const controlInfo = await createCorrectControl();
  
  if (controlInfo) {
    console.log(`\n🎉 准备就绪！`);
    console.log(`   控制期数: ${controlInfo.targetPeriod}`);
    console.log(`   memberA1将在该期100%中奖`);
    console.log('\n⚠️ 请在下一期下注测试！');
  }
}

main().catch(console.error);
