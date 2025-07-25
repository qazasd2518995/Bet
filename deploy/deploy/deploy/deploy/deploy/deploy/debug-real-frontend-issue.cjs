#!/usr/bin/env node

// 詳細調試實際前端問題
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function debugRealFrontendIssue() {
    try {
        console.log('🔍 詳細調試實際前端退水設定問題...');
        
        // 1. 登錄
        console.log('1. 登錄...');
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
        
        console.log('✅ 登錄成功, agentId:', agentId);
        
        // 2. 載入帳號管理頁面數據 - 模擬用戶打開帳號管理頁面
        console.log('\n2. 模擬用戶打開帳號管理頁面...');
        const membersResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            headers,
            params: { agentId: agentId }
        });
        
        const hierarchicalMembers = membersResponse.data.data;
        const testAgent = hierarchicalMembers.find(m => m.userType === 'agent' && m.rebate_mode === 'percentage');
        
        if (!testAgent) {
            console.log('❌ 沒有找到合適的測試代理（需要 percentage 模式）');
            return;
        }
        
        console.log('📋 找到測試代理:', {
            id: testAgent.id,
            username: testAgent.username,
            rebate_mode: testAgent.rebate_mode,
            rebate_percentage: testAgent.rebate_percentage
        });
        
        // 3. 第一次點擊「退水設定」- 查看目前顯示什麼
        console.log('\n3. 第一次點擊「退水設定」按鈕...');
        const agentRebatePercentage = parseFloat(testAgent.rebate_percentage || 0);
        const firstClickDisplay = (agentRebatePercentage * 100).toFixed(1);
        console.log('📊 第一次點擊顯示：', {
            原始數據: testAgent.rebate_percentage,
            轉換後: firstClickDisplay + '%'
        });
        
        // 4. 模擬修改退水比例
        console.log('\n4. 修改退水比例為 0.8%...');
        const newPercentage = 0.8;
        const updateResponse = await axios.put(`${API_BASE_URL}/update-rebate-settings/${testAgent.id}`, {
            rebate_mode: 'percentage',
            rebate_percentage: newPercentage / 100
        }, { headers });
        
        if (!updateResponse.data.success) {
            console.log('❌ 更新失敗:', updateResponse.data.message);
            return;
        }
        
        console.log('✅ 更新成功');
        
        // 5. 重新載入數據 - 模擬前端的 loadHierarchicalMembers()
        console.log('\n5. 重新載入帳號管理頁面數據...');
        const reloadResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            headers,
            params: { agentId: agentId }
        });
        
        const reloadedMembers = reloadResponse.data.data;
        const reloadedAgent = reloadedMembers.find(m => m.id === testAgent.id);
        
        console.log('📋 重新載入後的代理數據:', {
            id: reloadedAgent.id,
            username: reloadedAgent.username,
            rebate_mode: reloadedAgent.rebate_mode,
            rebate_percentage: reloadedAgent.rebate_percentage,
            dataType: typeof reloadedAgent.rebate_percentage
        });
        
        // 6. 第二次點擊「退水設定」- 查看現在顯示什麼
        console.log('\n6. 第二次點擊「退水設定」按鈕...');
        const reloadedRebatePercentage = parseFloat(reloadedAgent.rebate_percentage || 0);
        const secondClickDisplay = (reloadedRebatePercentage * 100).toFixed(1);
        console.log('📊 第二次點擊顯示：', {
            原始數據: reloadedAgent.rebate_percentage,
            parseFloat結果: reloadedRebatePercentage,
            轉換後: secondClickDisplay + '%'
        });
        
        // 7. 檢查問題
        console.log('\n7. 問題分析：');
        if (secondClickDisplay === newPercentage.toString()) {
            console.log('✅ 前端顯示正確！');
            console.log('如果用戶仍然看到 0.0%，可能是：');
            console.log('  - 瀏覽器緩存問題');
            console.log('  - 前端沒有正確重新載入');
            console.log('  - Vue.js 響應性問題');
        } else {
            console.log('❌ 前端顯示不正確！');
            console.log('期望:', newPercentage + '%');
            console.log('實際:', secondClickDisplay + '%');
            console.log('可能的問題：');
            console.log('  - 資料庫更新問題');
            console.log('  - API 返回格式問題');
            console.log('  - 前端數據轉換問題');
        }
        
        // 8. 直接檢查資料庫
        console.log('\n8. 直接查詢資料庫驗證...');
        const dbCheckResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            headers,
            params: { agentId: agentId }
        });
        
        const dbAgent = dbCheckResponse.data.data.find(m => m.id === testAgent.id);
        console.log('📋 資料庫最新數據:', {
            rebate_percentage: dbAgent.rebate_percentage,
            type: typeof dbAgent.rebate_percentage,
            asFloat: parseFloat(dbAgent.rebate_percentage),
            asPercentage: (parseFloat(dbAgent.rebate_percentage) * 100).toFixed(1) + '%'
        });
        
    } catch (error) {
        console.error('❌ 調試失敗:', error.message);
        if (error.response) {
            console.error('錯誤回應:', error.response.data);
        }
    }
}

// 執行調試
debugRealFrontendIssue();
