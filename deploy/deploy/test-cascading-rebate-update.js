import axios from 'axios';

const API_URL = 'http://localhost:3003/api';
const GAME_API_URL = 'http://localhost:3000/api';

// Test accounts
const topAgent = {
    username: 'MA@x9Kp#2025$zL7',
    password: 'A$2025@xK9p#Secure!mN7qR&wZ3'
};

let topAgentToken;
let level1Agent;
let level2Agent;
let level3Agent;

async function login(username, password) {
    try {
        const response = await axios.post(`${API_URL}/agent/login`, {
            username,
            password
        });
        return response.data.token;
    } catch (error) {
        console.error('登入失敗:', error.response?.data?.error || error.message);
        throw error;
    }
}

async function createAgent(token, agentData) {
    try {
        const response = await axios.post(`${API_URL}/create-agent`, agentData, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data.agent;
    } catch (error) {
        console.error('創建代理失敗:', error.response?.data?.message || error.message);
        throw error;
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

async function getAgentInfo(token, agentId) {
    try {
        const response = await axios.get(`${API_URL}/agent/info/${agentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data.agent;
    } catch (error) {
        console.error('獲取代理資訊失敗:', error.response?.data?.error || error.message);
        throw error;
    }
}

async function getSubordinates(token) {
    try {
        const response = await axios.get(`${API_URL}/agent/subordinates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data.subordinates;
    } catch (error) {
        console.error('獲取下級代理失敗:', error.response?.data?.error || error.message);
        throw error;
    }
}

async function testCascadingRebateUpdate() {
    console.log('=== 開始測試級聯退水更新機制 ===\n');

    try {
        // Step 1: 登入總代理
        console.log('1. 登入總代理...');
        topAgentToken = await login(topAgent.username, topAgent.password);
        console.log('✓ 總代理登入成功\n');

        // Step 2: 創建測試代理層級
        console.log('2. 創建測試代理層級...');
        
        // 創建一級代理 (0.5% 退水)
        level1Agent = await createAgent(topAgentToken, {
            username: `test_l1_${Date.now()}`,
            password: 'Test123!@#',
            nickname: '測試一級代理',
            rebatePercentage: 0.005
        });
        console.log(`✓ 一級代理創建成功: ${level1Agent.username} (退水: 0.5%, max: ${(level1Agent.max_rebate_percentage * 100).toFixed(1)}%)`);

        // 登入一級代理並創建二級代理
        const level1Token = await login(level1Agent.username, 'Test123!@#');
        level2Agent = await createAgent(level1Token, {
            username: `test_l2_${Date.now()}`,
            password: 'Test123!@#',
            nickname: '測試二級代理',
            rebatePercentage: 0.003
        });
        console.log(`✓ 二級代理創建成功: ${level2Agent.username} (退水: 0.3%, max: ${(level2Agent.max_rebate_percentage * 100).toFixed(1)}%)`);

        // 登入二級代理並創建三級代理
        const level2Token = await login(level2Agent.username, 'Test123!@#');
        level3Agent = await createAgent(level2Token, {
            username: `test_l3_${Date.now()}`,
            password: 'Test123!@#',
            nickname: '測試三級代理',
            rebatePercentage: 0.001
        });
        console.log(`✓ 三級代理創建成功: ${level3Agent.username} (退水: 0.1%, max: ${(level3Agent.max_rebate_percentage * 100).toFixed(1)}%)\n`);

        // Step 3: 測試降低退水
        console.log('3. 測試降低退水 (0.5% → 0.2%)...');
        await updateRebate(topAgentToken, level1Agent.id, 0.002);
        console.log('✓ 一級代理退水已調整為 0.2%');

        // 檢查下級代理的退水是否被調整
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待資料庫更新
        
        const updatedLevel2 = await getAgentInfo(level1Token, level2Agent.id);
        const updatedLevel3 = await getAgentInfo(level2Token, level3Agent.id);
        
        console.log(`  二級代理: 退水 ${(updatedLevel2.rebate_percentage * 100).toFixed(1)}%, max ${(updatedLevel2.max_rebate_percentage * 100).toFixed(1)}%`);
        console.log(`  三級代理: 退水 ${(updatedLevel3.rebate_percentage * 100).toFixed(1)}%, max ${(updatedLevel3.max_rebate_percentage * 100).toFixed(1)}%`);
        console.log('✓ 下級代理退水已正確調整\n');

        // Step 4: 測試提高退水
        console.log('4. 測試提高退水 (0.2% → 0.9%)...');
        await updateRebate(topAgentToken, level1Agent.id, 0.009);
        console.log('✓ 一級代理退水已調整為 0.9%');

        // 檢查下級代理的最大退水是否被更新
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const increasedLevel2 = await getAgentInfo(level1Token, level2Agent.id);
        const increasedLevel3 = await getAgentInfo(level2Token, level3Agent.id);
        
        console.log(`  二級代理: 退水 ${(increasedLevel2.rebate_percentage * 100).toFixed(1)}%, max ${(increasedLevel2.max_rebate_percentage * 100).toFixed(1)}%`);
        console.log(`  三級代理: 退水 ${(increasedLevel3.rebate_percentage * 100).toFixed(1)}%, max ${(increasedLevel3.max_rebate_percentage * 100).toFixed(1)}%`);

        // Step 5: 測試二級代理是否能提高退水到新的上限
        console.log('\n5. 測試二級代理提高退水到新上限 (0.2% → 0.9%)...');
        try {
            await updateRebate(level1Token, level2Agent.id, 0.009);
            console.log('✓ 二級代理成功提高退水到 0.9%');
            
            // 再次檢查
            const finalLevel2 = await getAgentInfo(level1Token, level2Agent.id);
            console.log(`  最終退水: ${(finalLevel2.rebate_percentage * 100).toFixed(1)}%, max: ${(finalLevel2.max_rebate_percentage * 100).toFixed(1)}%`);
        } catch (error) {
            console.error('✗ 無法提高退水:', error.response?.data?.error || error.message);
            console.log('  這表示 max_rebate_percentage 未正確更新！');
        }

        console.log('\n=== 測試完成 ===');

    } catch (error) {
        console.error('測試失敗:', error.message);
        process.exit(1);
    }
}

// 執行測試
testCascadingRebateUpdate().then(() => {
    console.log('\n所有測試完成！');
    process.exit(0);
}).catch(error => {
    console.error('測試執行錯誤:', error);
    process.exit(1);
});