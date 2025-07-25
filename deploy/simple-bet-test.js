import axios from 'axios';

const GAME_URL = 'http://localhost:3000';
const AGENT_URL = 'http://localhost:3003/api/agent';

async function simpleBetTest() {
  console.log('🚀 开始简化下注测试');
  console.log('=====================================\n');

  try {
    // 1. 登录会员
    console.log('1️⃣ 会员登录');
    const loginResponse = await axios.post(`${GAME_URL}/api/member/login`, {
      username: 'test123',
      password: '123456'
    });
    
    if (!loginResponse.data.success) {
      console.error('❌ 会员登录失败:', loginResponse.data.message);
      return;
    }
    
    console.log('✅ 会员登录成功');

    // 2. 检查余额
    console.log('\n2️⃣ 检查会员余额');
    const balanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const initialBalance = parseFloat(balanceResponse.data.balance);
    console.log(`会员初始余额: ${initialBalance}`);

    // 3. 检查游戏状态
    console.log('\n3️⃣ 检查游戏状态');
    const gameResponse = await axios.get(`${GAME_URL}/api/game-data`);
    const gameData = gameResponse.data.gameData;
    
    console.log(`期数: ${gameData.currentPeriod}`);
    console.log(`状态: ${gameData.status}`);
    console.log(`倒数: ${gameData.countdownSeconds}秒`);

    if (gameData.status !== 'betting') {
      console.log('❌ 当前不是下注阶段，跳过下注测试');
      return;
    }

    // 4. 提交一注测试
    console.log('\n4️⃣ 提交单注测试');
    
    const betData = {
      username: 'test123',
      amount: 100,
      betType: 'champion',  // 冠军大小
      value: 'big'          // 冠军大
    };

    console.log(`下注内容: ${betData.betType} ${betData.value} ${betData.amount}元`);

    try {
      const betResponse = await axios.post(`${GAME_URL}/api/bet`, betData);

      if (betResponse.data.success) {
        console.log('✅ 下注成功');
        console.log(`剩余余额: ${betResponse.data.balance}`);
      } else {
        console.log('❌ 下注失败:', betResponse.data.message);
      }
    } catch (betError) {
      console.log('❌ 下注请求失败:', betError.response?.data?.message || betError.message);
      console.log('完整错误:', betError.response?.data);
    }

    // 5. 检查余额变化
    console.log('\n5️⃣ 检查余额变化');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const newBalanceResponse = await axios.get(`${AGENT_URL}/member/balance/test123`);
    const newBalance = parseFloat(newBalanceResponse.data.balance);
    
    console.log(`下注前余额: ${initialBalance}`);
    console.log(`下注后余额: ${newBalance}`);
    console.log(`余额变化: ${initialBalance - newBalance}`);

  } catch (error) {
    console.error('🚨 测试过程中发生错误:', error.response?.data || error.message);
  }
}

simpleBetTest(); 