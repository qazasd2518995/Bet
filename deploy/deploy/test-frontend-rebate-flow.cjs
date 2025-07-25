#!/usr/bin/env node

// 測試前端退水設定完整流程
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function testFrontendRebateFlow() {
    try {
        console.log('🧪 測試前端退水設定完整流程...');
        
        // 1. 登錄
        console.log('1. 登錄獲取token...');
        const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
            username: 'ti2025A',
            password: 'ti2025A'
        });
        
        if (!loginResponse.data.success) {
            throw new Error('登錄失敗: ' + loginResponse.data.message);
        }
        
        const token = loginResponse.data.token;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'X-Session-Token': token
        };
        
        console.log('✅ 登錄成功');
        
        // 2. 模擬前端載入帳號管理頁面 - 獲取層級會員數據
        console.log('2. 載入帳號管理頁面數據...');
        const agentId = loginResponse.data.agent.id;
        console.log('當前登錄代理ID:', agentId);
        
        const membersResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            headers,
            params: { agentId: agentId }
        });
        
        if (!membersResponse.data.success) {
            throw new Error('載入層級會員失敗: ' + membersResponse.data.message);
        }
        
        const hierarchicalMembers = membersResponse.data.data;
        console.log('📋 API返回數據:', {
            總數量: hierarchicalMembers.length,
            代理數量: hierarchicalMembers.filter(m => m.userType === 'agent').length,
            會員數量: hierarchicalMembers.filter(m => m.userType === 'member').length
        });
        
        // 如果沒有下級代理，就用一個會員來測試，或者創建一個測試代理
        let testAgent = hierarchicalMembers.find(m => m.userType === 'agent');
        
        if (!testAgent) {
            // 如果沒有下級代理，我們就用一個會員來測試退水設定
            testAgent = hierarchicalMembers.find(m => m.userType === 'member');
            if (!testAgent) {
                throw new Error('沒有找到可測試的代理或會員');
            }
            console.log('⚠️ 沒有找到下級代理，使用會員進行測試:', testAgent.username);
        }
        
        console.log('📋 找到測試代理:', {
            id: testAgent.id,
            username: testAgent.username,
            rebate_mode: testAgent.rebate_mode,
            rebate_percentage: testAgent.rebate_percentage,
            max_rebate_percentage: testAgent.max_rebate_percentage
        });
        
        // 3. 模擬前端點擊「退水設定」按鈕時的邏輯
        console.log('3. 模擬點擊退水設定按鈕...');
        
        // 前端會執行 showRebateSettingsModal 函數的邏輯
        const agentRebatePercentage = parseFloat(testAgent.rebate_percentage || 0);
        const rebateSettings = {
            rebate_mode: testAgent.rebate_mode || 'percentage',
            rebate_percentage: (agentRebatePercentage * 100).toFixed(1)
        };
        
        console.log('📊 前端計算的退水設定顯示:', {
            原始退水比例: testAgent.rebate_percentage,
            解析後的值: agentRebatePercentage,
            前端顯示值: rebateSettings.rebate_percentage + '%',
            退水模式: rebateSettings.rebate_mode
        });
        
        // 4. 模擬用戶修改退水比例為 1.0%（在最大限制範圍內）
        console.log('4. 模擬修改退水比例為 1.0%...');
        const newRebatePercentage = 1.0;
        const updateResponse = await axios.put(`${API_BASE_URL}/update-rebate-settings/${testAgent.id}`, {
            rebate_mode: 'percentage',
            rebate_percentage: newRebatePercentage / 100 // 轉換為小數
        }, { headers });
        
        if (!updateResponse.data.success) {
            throw new Error('更新退水設定失敗: ' + updateResponse.data.message);
        }
        
        console.log('✅ 退水設定更新成功');
        
        // 5. 模擬前端重新載入帳號管理頁面
        console.log('5. 重新載入帳號管理頁面數據...');
        const reloadResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            headers,
            params: { agentId: agentId }
        });
        
        if (!reloadResponse.data.success) {
            throw new Error('重新載入失敗: ' + reloadResponse.data.message);
        }
        
        const reloadedMembers = reloadResponse.data.data;
        const reloadedAgent = reloadedMembers.find(m => m.id === testAgent.id);
        
        console.log('📋 重新載入後的代理資料:', {
            id: reloadedAgent.id,
            username: reloadedAgent.username,
            rebate_mode: reloadedAgent.rebate_mode,
            rebate_percentage: reloadedAgent.rebate_percentage,
            max_rebate_percentage: reloadedAgent.max_rebate_percentage
        });
        
        // 6. 模擬用戶再次點擊「退水設定」按鈕
        console.log('6. 模擬再次點擊退水設定按鈕...');
        const reloadedRebatePercentage = parseFloat(reloadedAgent.rebate_percentage || 0);
        const reloadedRebateSettings = {
            rebate_mode: reloadedAgent.rebate_mode || 'percentage',
            rebate_percentage: (reloadedRebatePercentage * 100).toFixed(1)
        };
        
        console.log('📊 重新載入後的前端顯示計算:', {
            原始退水比例: reloadedAgent.rebate_percentage,
            解析後的值: reloadedRebatePercentage,
            前端顯示值: reloadedRebateSettings.rebate_percentage + '%',
            退水模式: reloadedRebateSettings.rebate_mode
        });
        
        // 7. 驗證結果
        console.log('7. 驗證測試結果...');
        const expectedDisplayValue = '1.0';
        const actualDisplayValue = reloadedRebateSettings.rebate_percentage;
        
        if (actualDisplayValue === expectedDisplayValue) {
            console.log('✅ 測試通過！前端顯示值正確: ' + actualDisplayValue + '%');
        } else {
            console.log('❌ 測試失敗！');
            console.log('期望顯示值: ' + expectedDisplayValue + '%');
            console.log('實際顯示值: ' + actualDisplayValue + '%');
            console.log('可能的問題：');
            console.log('- 資料庫返回的 rebate_percentage 格式不正確');
            console.log('- 前端的 parseFloat 或計算邏輯有問題');
            console.log('- API 返回的數據格式與前端期望不一致');
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
        if (error.response) {
            console.error('錯誤回應:', error.response.data);
        }
    }
}

// 執行測試
testFrontendRebateFlow();
