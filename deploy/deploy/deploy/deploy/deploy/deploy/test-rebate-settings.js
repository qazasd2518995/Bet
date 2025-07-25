// 測試退水設定功能
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function testRebateSettings() {
    try {
        console.log('🧪 開始測試退水設定功能...');
        
        // 1. 首先登錄獲取token
        console.log('1. 登錄獲取token...');
        const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
            username: 'ti2025D',
            password: 'ti2025D'
        });
        
        if (!loginResponse.data.success) {
            throw new Error('登錄失敗: ' + loginResponse.data.message);
        }
        
        const token = loginResponse.data.token;
        const authHeaders = {
            'Authorization': `Bearer ${token}`,
            'X-Session-Token': token
        };
        
        console.log('✅ 登錄成功');
        
        // 2. 獲取層級會員數據，查看代理的退水設定
        console.log('2. 獲取層級會員數據...');
        const membersResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            params: { agentId: 29 }, // ti2025D的ID
            headers: authHeaders
        });
        
        if (!membersResponse.data.success) {
            throw new Error('獲取層級會員失敗: ' + membersResponse.data.message);
        }
        
        const agents = membersResponse.data.data.filter(item => item.userType === 'agent');
        console.log('📊 當前代理數量:', agents.length);
        
        if (agents.length === 0) {
            console.log('⚠️ 沒有找到代理，跳過測試');
            return;
        }
        
        const testAgent = agents[0];
        console.log('🎯 選擇測試代理:', {
            id: testAgent.id,
            username: testAgent.username,
            rebate_mode: testAgent.rebate_mode,
            rebate_percentage: testAgent.rebate_percentage,
            max_rebate_percentage: testAgent.max_rebate_percentage
        });
        
        // 3. 更新代理的退水設定
        console.log('3. 更新代理退水設定...');
        const testPercentage = 2.5; // 測試設定為2.5%
        const updatePayload = {
            rebate_mode: 'percentage',
            rebate_percentage: testPercentage / 100 // 轉換為小數
        };
        
        console.log('📤 發送更新請求:', updatePayload);
        
        const updateResponse = await axios.put(`${API_BASE_URL}/update-rebate-settings/${testAgent.id}`, updatePayload, {
            headers: authHeaders
        });
        
        console.log('📨 更新回應:', updateResponse.data);
        
        if (!updateResponse.data.success) {
            throw new Error('更新退水設定失敗: ' + updateResponse.data.message);
        }
        
        console.log('✅ 退水設定更新成功');
        
        // 4. 重新獲取數據驗證更新結果
        console.log('4. 驗證更新結果...');
        const verifyResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            params: { agentId: 29 },
            headers: authHeaders
        });
        
        const updatedAgents = verifyResponse.data.data.filter(item => item.userType === 'agent');
        const updatedAgent = updatedAgents.find(agent => agent.id === testAgent.id);
        
        if (updatedAgent) {
            console.log('🔍 更新後的代理資料:', {
                id: updatedAgent.id,
                username: updatedAgent.username,
                rebate_mode: updatedAgent.rebate_mode,
                rebate_percentage: updatedAgent.rebate_percentage,
                max_rebate_percentage: updatedAgent.max_rebate_percentage
            });
            
            // 驗證數據
            const expectedPercentage = testPercentage / 100;
            const actualPercentage = parseFloat(updatedAgent.rebate_percentage);
            
            console.log('📊 數據驗證:', {
                期望值: expectedPercentage,
                實際值: actualPercentage,
                匹配: Math.abs(expectedPercentage - actualPercentage) < 0.001
            });
            
            if (Math.abs(expectedPercentage - actualPercentage) < 0.001 && updatedAgent.rebate_mode === 'percentage') {
                console.log('✅ 測試通過！退水設定正確保存和載入');
            } else {
                console.log('❌ 測試失敗！退水設定未正確保存');
            }
        } else {
            console.log('❌ 測試失敗！無法找到更新後的代理');
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
        if (error.response) {
            console.error('錯誤詳情:', error.response.data);
        }
    }
}

// 等待後端啟動後執行測試
setTimeout(testRebateSettings, 3000);
