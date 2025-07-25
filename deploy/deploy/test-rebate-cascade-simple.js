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
        console.error('獲取下級失敗:', error.response?.data?.error || error.message);
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
        console.error('更新退水失敗:', error.response?.data?.error || error.message);
        throw error;
    }
}

async function testCascadingRebateUpdate() {
    console.log('=== 測試級聯退水更新機制 ===\n');

    try {
        // Step 1: 登入總代理
        console.log('1. 登入總代理...');
        const loginResult = await login(topAgent.username, topAgent.password);
        const topAgentToken = loginResult.token;
        const topAgentInfo = loginResult.agent;
        console.log(`✓ 總代理登入成功 (ID: ${topAgentInfo.id})\n`);

        // Step 2: 獲取下級代理
        console.log('2. 獲取總代理的下級代理...');
        const subordinates = await getSubordinates(topAgentToken, topAgentInfo.id);
        
        if (subordinates.length === 0) {
            console.log('沒有找到下級代理，請先創建測試代理');
            return;
        }

        // 找一個有下級的代理進行測試
        let testAgent = null;
        let testAgentToken = null;
        let testAgentSubordinates = [];

        for (const agent of subordinates) {
            if (agent.level === 1) {
                // 嘗試登入這個代理
                try {
                    console.log(`\n嘗試使用代理 ${agent.username} (退水: ${(agent.rebate_percentage * 100).toFixed(1)}%)`);
                    
                    // 找到有下級的一級代理
                    const tempLogin = await login(agent.username, 'Test123!@#');
                    const tempToken = tempLogin.token;
                    const subs = await getSubordinates(tempToken, agent.id);
                    
                    if (subs.length > 0) {
                        testAgent = agent;
                        testAgentToken = tempToken;
                        testAgentSubordinates = subs;
                        console.log(`✓ 找到測試代理: ${agent.username}，有 ${subs.length} 個下級`);
                        break;
                    }
                } catch (e) {
                    // 忽略登入失敗的代理
                }
            }
        }

        if (!testAgent) {
            console.log('沒有找到合適的測試代理（需要有下級的一級代理）');
            return;
        }

        // Step 3: 顯示當前狀態
        console.log('\n3. 當前代理層級狀態:');
        console.log(`  一級代理 ${testAgent.username}: 退水 ${(testAgent.rebate_percentage * 100).toFixed(1)}%, max ${(testAgent.max_rebate_percentage * 100).toFixed(1)}%`);
        
        for (const sub of testAgentSubordinates) {
            console.log(`  └─ ${sub.level}級代理 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
        }

        // Step 4: 測試降低退水
        console.log('\n4. 測試降低一級代理退水到 0.1%...');
        await updateRebate(topAgentToken, testAgent.id, 0.001);
        console.log('✓ 退水更新請求已發送');

        // 等待並重新獲取下級資訊
        await new Promise(resolve => setTimeout(resolve, 2000));
        const updatedSubs = await getSubordinates(testAgentToken, testAgent.id);
        
        console.log('\n降低後的狀態:');
        for (const sub of updatedSubs) {
            console.log(`  ${sub.level}級代理 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
        }

        // Step 5: 測試提高退水
        console.log('\n5. 測試提高一級代理退水到 0.9%...');
        await updateRebate(topAgentToken, testAgent.id, 0.009);
        console.log('✓ 退水更新請求已發送');

        // 等待並重新獲取下級資訊
        await new Promise(resolve => setTimeout(resolve, 2000));
        const increasedSubs = await getSubordinates(testAgentToken, testAgent.id);
        
        console.log('\n提高後的狀態:');
        for (const sub of increasedSubs) {
            console.log(`  ${sub.level}級代理 ${sub.username}: 退水 ${(sub.rebate_percentage * 100).toFixed(1)}%, max ${(sub.max_rebate_percentage * 100).toFixed(1)}%`);
            
            // 檢查是否可以提高到新上限
            if (sub.max_rebate_percentage === 0.009) {
                console.log(`  ✓ ${sub.username} 的最大退水已正確更新到 0.9%`);
            } else {
                console.log(`  ✗ ${sub.username} 的最大退水未更新 (仍為 ${(sub.max_rebate_percentage * 100).toFixed(1)}%)`);
            }
        }

        // Step 6: 測試下級代理是否能提高退水
        if (increasedSubs.length > 0) {
            const subAgent = increasedSubs[0];
            console.log(`\n6. 測試 ${subAgent.username} 是否能提高退水到 0.9%...`);
            
            try {
                await updateRebate(testAgentToken, subAgent.id, 0.009);
                console.log('✓ 成功提高退水到 0.9%！');
            } catch (error) {
                console.log('✗ 無法提高退水:', error.response?.data?.error || error.message);
                console.log('這表示 max_rebate_percentage 可能未正確更新');
            }
        }

        console.log('\n=== 測試完成 ===');

    } catch (error) {
        console.error('測試失敗:', error.message);
        process.exit(1);
    }
}

// 執行測試
testCascadingRebateUpdate().then(() => {
    console.log('\n測試結束');
    process.exit(0);
}).catch(error => {
    console.error('測試執行錯誤:', error);
    process.exit(1);
});