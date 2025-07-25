#!/usr/bin/env node

// 測試退水比例範圍顯示修正
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function testRebateRangeDisplay() {
    try {
        console.log('🎯 測試退水比例範圍顯示修正...');
        
        // 1. 登錄 justin2025A
        console.log('1. 登錄 justin2025A...');
        const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
            username: 'justin2025A',
            password: 'justin2025A'
        });
        
        const token = loginResponse.data.token;
        const user = loginResponse.data.agent;
        const headers = {
            'Authorization': `Bearer ${token}`,
            'X-Session-Token': token
        };
        
        console.log('✅ 登錄成功');
        console.log('當前用戶退水資料:', {
            username: user.username,
            rebate_percentage: user.rebate_percentage,
            max_rebate_percentage: user.max_rebate_percentage
        });
        
        // 2. 先確保 justin2025A 的退水比例是 1.0%
        console.log('\n2. 確保 justin2025A 退水比例是 1.0%...');
        const updateSelfResponse = await axios.put(`${API_BASE_URL}/update-rebate-settings/${user.id}`, {
            rebate_mode: 'percentage',
            rebate_percentage: 0.01 // 1.0%
        }, { headers });
        
        if (updateSelfResponse.data.success) {
            console.log('✅ justin2025A 退水比例設定為 1.0%');
            
            // 3. 模擬前端的計算邏輯（新增代理時）
            console.log('\n3. 模擬新增代理時的計算邏輯...');
            
            // 假設 currentManagingAgent 就是 justin2025A 自己
            const currentManagingAgent = {
                id: user.id,
                username: user.username,
                rebate_percentage: updateSelfResponse.data.agent.rebate_percentage, // 使用更新後的值
                max_rebate_percentage: user.max_rebate_percentage
            };
            
            console.log('currentManagingAgent:', currentManagingAgent);
            
            // 模擬 availableMaxRebatePercentage 計算
            let actualRebatePercentage = currentManagingAgent.rebate_percentage;
            
            if (actualRebatePercentage !== undefined && actualRebatePercentage !== null) {
                actualRebatePercentage = parseFloat(actualRebatePercentage);
            }
            
            if (isNaN(actualRebatePercentage) || actualRebatePercentage === undefined || actualRebatePercentage === null) {
                actualRebatePercentage = parseFloat(currentManagingAgent.max_rebate_percentage) || 0;
            }
            
            if (isNaN(actualRebatePercentage) || actualRebatePercentage <= 0) {
                const marketType = currentManagingAgent.market_type || 'D';
                actualRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
            }
            
            const displayRange = (actualRebatePercentage * 100).toFixed(1);
            console.log('📊 計算結果:');
            console.log(`應該顯示範圍: 0% - ${displayRange}% (直屬上級代理分配額度)`);
            
            if (displayRange === '1.0') {
                console.log('✅ 計算正確！新增代理時應該顯示 1.0%');
            } else {
                console.log('❌ 計算錯誤！期望 1.0%，實際', displayRange + '%');
            }
            
            // 4. 測試創建一個新代理
            console.log('\n4. 測試新增代理的退水範圍限制...');
            
            const testAgentData = {
                username: 'testagent' + Date.now().toString().slice(-6),
                password: 'testpassword',
                realName: '測試代理',
                level: (user.level || 0) + 1, // 比當前用戶低一級
                rebate_mode: 'percentage',
                rebate_percentage: 0.8, // 應該可以設定，因為 0.8% < 1.0%
                market_type: user.market_type || 'D',
                parent_agent_id: user.id
            };
            
            const createResponse = await axios.post(`${API_BASE_URL}/create-agent`, testAgentData, { headers });
            
            if (createResponse.data.success) {
                console.log('✅ 成功創建代理，退水比例 0.8% 被接受');
                
                // 嘗試設定超過範圍的退水比例
                const testAgent = createResponse.data.agent;
                console.log('\n5. 測試設定超過範圍的退水比例...');
                
                try {
                    await axios.put(`${API_BASE_URL}/update-rebate-settings/${testAgent.id}`, {
                        rebate_mode: 'percentage',
                        rebate_percentage: 0.015 // 1.5% > 1.0%，應該被拒絕
                    }, { headers });
                    console.log('❌ 意外！系統允許了超過範圍的設定');
                } catch (error) {
                    if (error.response?.data?.message?.includes('不能超過')) {
                        console.log('✅ 正確！系統拒絕了超過範圍的設定');
                    } else {
                        console.log('⚠️  系統拒絕了設定，但原因不明:', error.response?.data?.message);
                    }
                }
            } else {
                console.log('❌ 創建代理失敗:', createResponse.data.message);
            }
            
        } else {
            console.log('❌ 設定 justin2025A 退水比例失敗:', updateSelfResponse.data.message);
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
        if (error.response) {
            console.error('錯誤回應:', error.response.data);
        }
    }
}

// 執行測試
testRebateRangeDisplay();
