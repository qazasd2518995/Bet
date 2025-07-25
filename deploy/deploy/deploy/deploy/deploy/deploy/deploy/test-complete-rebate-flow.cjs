#!/usr/bin/env node

// 完整測試退水設定和自動刷新功能
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function testCompleteRebateFlow() {
    try {
        console.log('🎯 完整測試退水設定和自動刷新功能...');
        
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
        
        console.log('✅ 登錄成功，當前用戶退水比例:', loginResponse.data.agent.rebate_percentage);
        
        // 2. 獲取下級代理用於測試
        const membersResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            headers,
            params: { agentId: agentId }
        });
        
        const testAgent = membersResponse.data.data.find(m => m.userType === 'agent');
        if (!testAgent) {
            console.log('❌ 沒有找到可測試的下級代理');
            return;
        }
        
        console.log('\n📋 測試目標代理:', {
            username: testAgent.username,
            當前退水比例: testAgent.rebate_percentage
        });
        
        // 3. 模擬第一次點擊「退水設定」
        console.log('\n🔍 第一次點擊退水設定...');
        const firstDisplay = (parseFloat(testAgent.rebate_percentage) * 100).toFixed(1);
        console.log('📊 第一次顯示:', firstDisplay + '%');
        
        // 4. 修改退水比例
        const newPercentage = 0.9; // 0.9%
        console.log(`\n✏️ 修改退水比例為 ${newPercentage}%...`);
        
        const updateResponse = await axios.put(`${API_BASE_URL}/update-rebate-settings/${testAgent.id}`, {
            rebate_mode: 'percentage',
            rebate_percentage: newPercentage / 100
        }, { headers });
        
        if (!updateResponse.data.success) {
            console.log('❌ 更新失敗:', updateResponse.data.message);
            return;
        }
        
        console.log('✅ 更新成功');
        
        // 5. 模擬前端的自動刷新邏輯
        console.log('\n🔄 模擬前端自動刷新...');
        
        const refreshResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            headers,
            params: { agentId: agentId }
        });
        
        const refreshedAgent = refreshResponse.data.data.find(m => m.id === testAgent.id);
        
        // 6. 模擬第二次點擊「退水設定」
        console.log('\n🔍 第二次點擊退水設定（刷新後）...');
        const secondDisplay = (parseFloat(refreshedAgent.rebate_percentage) * 100).toFixed(1);
        console.log('📊 第二次顯示:', secondDisplay + '%');
        
        // 7. 驗證結果
        console.log('\n📝 測試結果:');
        if (secondDisplay === newPercentage.toString()) {
            console.log('✅ 成功！退水設定完整流程正常:');
            console.log('  1. ✅ 資料庫正確更新');
            console.log('  2. ✅ 前端正確刷新');
            console.log('  3. ✅ 重新點擊顯示正確的新值');
            console.log('\n🎉 用戶體驗：設定完成後，立即點擊退水設定會看到最新的值！');
        } else {
            console.log('❌ 測試失敗:');
            console.log(`  期望顯示: ${newPercentage}%`);
            console.log(`  實際顯示: ${secondDisplay}%`);
        }
        
        // 8. 測試顯示範圍計算
        console.log('\n🔍 測試顯示範圍計算...');
        const currentUserRebate = parseFloat(loginResponse.data.agent.rebate_percentage);
        const expectedRange = (currentUserRebate * 100).toFixed(1);
        console.log(`📊 新增代理時應顯示範圍: 0% - ${expectedRange}% (直屬上級代理分配額度)`);
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
        if (error.response) {
            console.error('錯誤回應:', error.response.data);
        }
    }
}

// 執行測試
testCompleteRebateFlow();
