#!/usr/bin/env node

// 測試退水顯示修正是否有效
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function testRebateDisplayFix() {
    try {
        console.log('🧪 測試退水顯示修正效果...');
        
        // 1. 登錄
        const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
            username: 'ti2025A',
            password: 'ti2025A'
        });
        
        const token = loginResponse.data.token;
        const agentId = loginResponse.data.agent.id;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'X-Session-Token': token
        };
        
        console.log('✅ 登錄成功');
        
        // 2. 直接用登錄回應中的用戶數據
        console.log('\n� 當前用戶資料:', {
            username: loginResponse.data.agent.username,
            rebate_mode: loginResponse.data.agent.rebate_mode,
            rebate_percentage: loginResponse.data.agent.rebate_percentage,
            max_rebate_percentage: loginResponse.data.agent.max_rebate_percentage
        });
        
        // 3. 查看層級會員數據
        console.log('\n📋 查看層級會員數據...');
        const membersResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            headers,
            params: { agentId: agentId }
        });
        
        const hierarchicalMembers = membersResponse.data.data;
        const testAgent = hierarchicalMembers.find(m => m.userType === 'agent');
        
        if (!testAgent) {
            console.log('❌ 沒有找到下級代理進行測試');
            return;
        }
        
        console.log('📊 找到測試下級代理:', {
            username: testAgent.username,
            rebate_mode: testAgent.rebate_mode,
            rebate_percentage: testAgent.rebate_percentage,
            max_rebate_percentage: testAgent.max_rebate_percentage
        });
        
        // 4. 計算前端的 availableMaxRebatePercentage
        console.log('\n🔍 計算前端的 availableMaxRebatePercentage...');
        
        // 模擬前端的計算邏輯
        const currentUser = loginResponse.data.agent;
        let actualRebatePercentage = currentUser.rebate_percentage;
        
        if (actualRebatePercentage === undefined || actualRebatePercentage === null) {
            actualRebatePercentage = currentUser.max_rebate_percentage;
        }
        
        if (actualRebatePercentage === undefined || actualRebatePercentage === null) {
            const marketType = currentUser.market_type || 'D';
            actualRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
        }
        
        console.log('📊 計算結果:', {
            當前用戶: currentUser.username,
            實際退水比例: actualRebatePercentage,
            前端顯示範圍: `0% - ${(actualRebatePercentage * 100).toFixed(1)}%`
        });
        
        // 5. 驗證結果
        console.log('\n📝 驗證結果:');
        const expectedValue = 0.01;
        const actualValue = parseFloat(actualRebatePercentage);
        
        if (Math.abs(actualValue - expectedValue) < 0.0001) {
            console.log('✅ 成功！現在新增代理時應該顯示：0% - 1.0% (直屬上級代理分配額度)');
            console.log('✅ 編輯退水設定時也應該顯示：0% - 1.0% (直屬上級代理分配額度)');
        } else {
            console.log('❌ 計算結果不正確');
            console.log('期望: 0.01 (1.0%)');
            console.log('實際:', actualValue);
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
        if (error.response) {
            console.error('錯誤回應:', error.response.data);
        }
    }
}

// 執行測試
testRebateDisplayFix();
