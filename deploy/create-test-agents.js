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
        console.error('登入失败:', error.response?.data?.error || error.message);
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
        console.error('创建代理失败:', error.response?.data?.message || error.message);
        throw error;
    }
}

async function createTestAgents() {
    console.log('=== 创建测试代理层级 ===\n');

    try {
        // Step 1: 登入总代理
        console.log('1. 登入总代理...');
        const loginResult = await login(topAgent.username, topAgent.password);
        const topAgentToken = loginResult.token;
        console.log(`✓ 总代理登入成功 (ID: ${loginResult.agent.id})\n`);

        // Step 2: 创建一级代理
        console.log('2. 创建一级代理 (退水 0.5%)...');
        const level1Agent = await createAgent(topAgentToken, {
            username: `testL1_${Date.now()}`,
            password: 'Test123!@#',
            nickname: '测试一级代理',
            rebatePercentage: 0.005
        });
        console.log(`✓ 一级代理创建成功: ${level1Agent.username} (ID: ${level1Agent.id})`);

        // Step 3: 登入一级代理并创建二级代理
        console.log('\n3. 登入一级代理...');
        const level1Login = await login(level1Agent.username, 'Test123!@#');
        console.log('✓ 一级代理登入成功');

        console.log('4. 创建二级代理 (退水 0.3%)...');
        const level2Agent = await createAgent(level1Login.token, {
            username: `testL2_${Date.now()}`,
            password: 'Test123!@#',
            nickname: '测试二级代理',
            rebatePercentage: 0.003
        });
        console.log(`✓ 二级代理创建成功: ${level2Agent.username} (ID: ${level2Agent.id})`);

        // Step 4: 登入二级代理并创建三级代理
        console.log('\n5. 登入二级代理...');
        const level2Login = await login(level2Agent.username, 'Test123!@#');
        console.log('✓ 二级代理登入成功');

        console.log('6. 创建三级代理 (退水 0.1%)...');
        const level3Agent = await createAgent(level2Login.token, {
            username: `testL3_${Date.now()}`,
            password: 'Test123!@#',
            nickname: '测试三级代理',
            rebatePercentage: 0.001
        });
        console.log(`✓ 三级代理创建成功: ${level3Agent.username} (ID: ${level3Agent.id})`);

        console.log('\n=== 测试代理层级创建完成 ===');
        console.log('\n代理层级结构:');
        console.log(`总代理 ${topAgent.username} (A盘)`);
        console.log(`└─ 一级代理 ${level1Agent.username} (0.5%)`);
        console.log(`   └─ 二级代理 ${level2Agent.username} (0.3%)`);
        console.log(`      └─ 三级代理 ${level3Agent.username} (0.1%)`);

        console.log('\n现在可以运行 test-rebate-cascade-simple.js 来测试级联更新');

        return {
            level1Agent,
            level2Agent,
            level3Agent
        };

    } catch (error) {
        console.error('创建失败:', error.message);
        process.exit(1);
    }
}

// 执行创建
createTestAgents().then(() => {
    console.log('\n创建完成');
    process.exit(0);
}).catch(error => {
    console.error('执行错误:', error);
    process.exit(1);
});