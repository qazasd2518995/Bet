import axios from 'axios';

const API_URL = 'http://localhost:3003/api';

// Test accounts
const topAgent = {
    username: 'MA@x9Kp#2025$zL7',
    password: 'A$2025@xK9p#Secure!mN7qR&wZ3'
};

async function login(username, password) {
    try {
        const response = await axios.post(`${API_URL}/agent/login`, {
            username,
            password
        });
        return {
            token: response.data.token,
            agent: response.data.agent
        };
    } catch (error) {
        console.error('登入失敗:', error.response?.data?.error || error.message);
        throw error;
    }
}

async function createAgent(token, agentData) {
    try {
        const response = await axios.post(`${API_URL}/create-agent`, {
            ...agentData,
            commission_rate: 0
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data.agent;
    } catch (error) {
        console.error('創建代理失敗:', error.response?.data?.message || error.message);
        throw error;
    }
}

async function createTestAgents() {
    console.log('=== 創建測試代理層級 ===\n');

    try {
        // Step 1: 登入總代理
        console.log('1. 登入總代理...');
        const loginResult = await login(topAgent.username, topAgent.password);
        const topAgentToken = loginResult.token;
        console.log(`✓ 總代理登入成功 (ID: ${loginResult.agent.id})\n`);

        // Step 2: 創建一級代理
        console.log('2. 創建一級代理 (退水 0.5%)...');
        const level1Agent = await createAgent(topAgentToken, {
            username: `testL1_${Date.now()}`,
            password: 'Test123!@#',
            nickname: '測試一級代理',
            rebatePercentage: 0.005
        });
        console.log(`✓ 一級代理創建成功: ${level1Agent.username} (ID: ${level1Agent.id})`);

        // Step 3: 登入一級代理並創建二級代理
        console.log('\n3. 登入一級代理...');
        const level1Login = await login(level1Agent.username, 'Test123!@#');
        console.log('✓ 一級代理登入成功');

        console.log('4. 創建二級代理 (退水 0.3%)...');
        const level2Agent = await createAgent(level1Login.token, {
            username: `testL2_${Date.now()}`,
            password: 'Test123!@#',
            nickname: '測試二級代理',
            rebatePercentage: 0.003
        });
        console.log(`✓ 二級代理創建成功: ${level2Agent.username} (ID: ${level2Agent.id})`);

        // Step 4: 登入二級代理並創建三級代理
        console.log('\n5. 登入二級代理...');
        const level2Login = await login(level2Agent.username, 'Test123!@#');
        console.log('✓ 二級代理登入成功');

        console.log('6. 創建三級代理 (退水 0.1%)...');
        const level3Agent = await createAgent(level2Login.token, {
            username: `testL3_${Date.now()}`,
            password: 'Test123!@#',
            nickname: '測試三級代理',
            rebatePercentage: 0.001
        });
        console.log(`✓ 三級代理創建成功: ${level3Agent.username} (ID: ${level3Agent.id})`);

        console.log('\n=== 測試代理層級創建完成 ===');
        console.log('\n代理層級結構:');
        console.log(`總代理 ${topAgent.username} (A盤)`);
        console.log(`└─ 一級代理 ${level1Agent.username} (0.5%)`);
        console.log(`   └─ 二級代理 ${level2Agent.username} (0.3%)`);
        console.log(`      └─ 三級代理 ${level3Agent.username} (0.1%)`);

        console.log('\n現在可以運行 test-rebate-cascade-simple.js 來測試級聯更新');

        return {
            level1Agent,
            level2Agent,
            level3Agent
        };

    } catch (error) {
        console.error('創建失敗:', error.message);
        process.exit(1);
    }
}

// 執行創建
createTestAgents().then(() => {
    console.log('\n創建完成');
    process.exit(0);
}).catch(error => {
    console.error('執行錯誤:', error);
    process.exit(1);
});