// 測試代理層級分析報表顯示修復
// 修復問題：只顯示總計，沒有顯示有下注的代理線和會員

import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3003/api';

async function testAgentReportDisplay() {
    try {
        console.log('🧪 測試代理層級分析報表顯示修復...');
        
        // 1. 先創建測試用的代理和會員
        console.log('\n📝 創建測試數據...');
        
        // 登錄超級管理員（假設存在）
        const loginResponse = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'admin',
                password: 'admin123'
            })
        });
        
        if (!loginResponse.ok) {
            console.log('❌ 無法登錄，請確保系統運行並有測試帳號');
            return;
        }
        
        const loginData = await loginResponse.json();
        const token = loginData.token;
        
        console.log('✅ 登錄成功');
        
        // 2. 測試代理層級分析API
        console.log('\n📊 測試代理層級分析API...');
        
        const reportResponse = await fetch(`${API_BASE_URL}/reports/agent-analysis`, {
            method: 'GET',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });
        
        if (!reportResponse.ok) {
            console.log('❌ API請求失敗:', reportResponse.status);
            return;
        }
        
        const reportData = await reportResponse.json();
        console.log('📊 API返回數據:', JSON.stringify(reportData, null, 2));
        
        // 3. 分析返回的數據結構
        if (reportData.success) {
            console.log('\n✅ API調用成功');
            console.log(`📈 總共返回 ${reportData.reportData.length} 個項目`);
            
            // 分析代理和會員
            const agents = reportData.reportData.filter(item => item.userType === 'agent');
            const members = reportData.reportData.filter(item => item.userType === 'member');
            
            console.log(`👥 代理數量: ${agents.length}`);
            console.log(`👤 會員數量: ${members.length}`);
            
            // 檢查有下注記錄的項目
            const activeBetters = reportData.reportData.filter(item => 
                item && (item.betCount > 0 || item.betAmount > 0)
            );
            
            console.log(`💰 有下注記錄的項目: ${activeBetters.length}`);
            
            if (activeBetters.length > 0) {
                console.log('\n📋 有下注記錄的用戶:');
                activeBetters.forEach(item => {
                    console.log(`  - ${item.username} (${item.userType}): ${item.betCount}筆, ${item.betAmount}元`);
                });
            }
            
            // 檢查總計數據
            console.log('\n📊 總計數據:');
            console.log(`  總筆數: ${reportData.totalSummary.betCount || 0}`);
            console.log(`  總下注金額: ${reportData.totalSummary.betAmount || 0}`);
            console.log(`  總會員輸贏: ${reportData.totalSummary.memberWinLoss || 0}`);
            
        } else {
            console.log('❌ API調用失敗:', reportData.message);
        }
        
        // 4. 測試前端過濾邏輯
        console.log('\n🔍 測試前端過濾邏輯...');
        
        if (reportData.reportData) {
            // 模擬前端過濾：只顯示有下注記錄的項目
            const filteredData = reportData.reportData.filter(item => 
                item && (item.betCount > 0 || item.betAmount > 0)
            );
            
            console.log(`📊 前端過濾後顯示項目: ${filteredData.length}`);
            
            if (filteredData.length === 0) {
                console.log('ℹ️  前端將顯示: 沒有有效下注資料');
            } else {
                console.log('✅ 前端將正常顯示代理和會員列表');
                filteredData.forEach(item => {
                    const type = item.userType === 'agent' ? '🔷 代理' : '🔶 會員';
                    console.log(`  ${type} ${item.username}: ${item.betCount}筆/${item.betAmount}元`);
                });
            }
        }
        
        console.log('\n🎉 測試完成！');
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error);
    }
}

// 執行測試
testAgentReportDisplay();
