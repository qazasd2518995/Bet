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

async function getSubordinates(token, parentId = null) {
    try {
        let url = `${API_URL}/sub-agents?limit=100`;
        if (parentId) {
            url += `&parentId=${parentId}`;
        }
        const response = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data.agents || [];
    } catch (error) {
        console.error('获取下级失败:', error.response?.data?.error || error.message);
        return [];
    }
}

async function updateRebate(token, agentId, newRebate) {
    try {
        const response = await axios.post(`${API_URL}/agent/update-rebate-settings`, {
            agentId,
            rebatePercentage: newRebate
        }, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error('更新退水失败:', error.response?.data?.error || error.message);
        throw error;
    }
}

async function testCascadingRebateUpdate() {
    console.log('=== 测试级联退水更新机制 ===\n');

    try {
        // Step 1: 登入总代理
        console.log('1. 登入总代理...');
        const loginResult = await login(topAgent.username, topAgent.password);
        const topAgentToken = loginResult.token;
        const topAgentInfo = loginResult.agent;
        console.log(`✓ 总代理登入成功 (ID: ${topAgentInfo.id})\n`);

        // Step 2: 获取下级代理
        console.log('2. 获取总代理的下级代理...');
        const subordinates = await getSubordinates(topAgentToken, topAgentInfo.id);
        
        if (subordinates.length === 0) {
            console.log('没有找到下级代理，请先创建测试代理');
            return;
        }

        // 找一个有下级的代理进行测试
        let testAgent = null;
        let testAgentToken = null;
        let testAgentSubordinates = [];

        for (const agent of subordinates) {
            if (agent.level === 1) {
                // 尝试登入这个代理
                try {
                    console.log(`\n尝试使用代理 ${agent.username} (退水: ${(agent.rebate_percentage * 100).toFixed(1)}%)`);
                    
                    // 找到有下级的一级代理
                    const tempLogin = await login(agent.username, 'Test123!@#');
                    const tempToken = tempLogin.token;
                    const subs = await getSubordinates(tempToken, agent.id);
                    
                    if (subs.length > 0) {
                        testAgent = agent;
                        testAgentToken = tempToken;
                        testAgentSubordinates = subs;
                        console.log(`✓ 找到测试代理: ${agent.username}，有 ${subs.length} 个下级`);
                        break;
                    }
                } catch (e) {
                    // 忽略登入失败的代理
                }
            }
        }

        if (!testAgent) {
            console.log('没有找到合适的测试代理（需要有下级的一级代理）');
            return;
        }

        // Step 3: 显示当前状态
        console.log('\n3. 当前代理层级状态:');
        console.log(`  一级代理 ${testAgent.username}: 退水 ${(testAgent.rebate_percentage * 100).toFixed(1)}%, max ${(testAgent.max_rebate_percentage * 100).toFixed(1)}%`);
        
        for (const sub of testAgentSubordinates) {
            console.log(`  └─ ${sub.level}级代理 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
        }

        // Step 4: 测试降低退水
        console.log('\n4. 测试降低一级代理退水到 0.1%...');
        await updateRebate(topAgentToken, testAgent.id, 0.001);
        console.log('✓ 退水更新请求已发送');

        // 等待并重新获取下级资讯
        await new Promise(resolve => setTimeout(resolve, 2000));
        const updatedSubs = await getSubordinates(testAgentToken, testAgent.id);
        
        console.log('\n降低后的状态:');
        for (const sub of updatedSubs) {
            console.log(`  ${sub.level}级代理 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
        }

        // Step 5: 测试提高退水
        console.log('\n5. 测试提高一级代理退水到 0.9%...');
        await updateRebate(topAgentToken, testAgent.id, 0.009);
        console.log('✓ 退水更新请求已发送');

        // 等待并重新获取下级资讯
        await new Promise(resolve => setTimeout(resolve, 2000));
        const increasedSubs = await getSubordinates(testAgentToken, testAgent.id);
        
        console.log('\n提高后的状态:');
        for (const sub of increasedSubs) {
            console.log(`  ${sub.level}级代理 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
            
            // 检查是否可以提高到新上限
            if (sub.max_rebate_percentage === 0.009) {
                console.log(`  ✓ ${sub.username} 的最大退水已正确更新到 0.9%`);
            } else {
                console.log(`  ✗ ${sub.username} 的最大退水未更新 (仍为 ${(sub.max_rebate_percentage * 100).toFixed(1)}%)`);
            }
        }

        // Step 6: 测试下级代理是否能提高退水
        if (increasedSubs.length > 0) {
            const subAgent = increasedSubs[0];
            console.log(`\n6. 测试 ${subAgent.username} 是否能提高退水到 0.9%...`);
            
            try {
                await updateRebate(testAgentToken, subAgent.id, 0.009);
                console.log('✓ 成功提高退水到 0.9%！');
            } catch (error) {
                console.log('✗ 无法提高退水:', error.response?.data?.error || error.message);
                console.log('这表示 max_rebate_percentage 可能未正确更新');
            }
        }

        console.log('\n=== 测试完成 ===');

    } catch (error) {
        console.error('测试失败:', error.message);
        process.exit(1);
    }
}

// 执行测试
testCascadingRebateUpdate().then(() => {
    console.log('\n测试结束');
    process.exit(0);
}).catch(error => {
    console.error('测试执行错误:', error);
    process.exit(1);
});