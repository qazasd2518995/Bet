// 測試 ti2025A 用戶的代理層級分析報表
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3003/api';

async function testTi2025AAgentReport() {
    try {
        console.log('🧪 測試 ti2025A 用戶的代理層級分析報表...');
        
        // 1. 使用 ti2025A 登錄
        console.log('\n📝 嘗試 ti2025A 登錄...');
        
        const loginResponse = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'ti2025A',
                password: 'ti2025A' // 假設密碼相同
            })
        });
        
        let loginData;
        if (loginResponse.ok) {
            loginData = await loginResponse.json();
            console.log('✅ ti2025A 登錄成功');
        } else {
            // 嘗試其他可能的密碼
            const altPasswords = ['ti2025a', 'Ti2025A', '123456', 'admin123'];
            let loginSuccess = false;
            
            for (const password of altPasswords) {
                try {
                    const altLoginResponse = await fetch(`${API_BASE_URL}/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username: 'ti2025A',
                            password: password
                        })
                    });
                    
                    if (altLoginResponse.ok) {
                        loginData = await altLoginResponse.json();
                        console.log(`✅ ti2025A 登錄成功，密碼: ${password}`);
                        loginSuccess = true;
                        break;
                    }
                } catch (e) {
                    // 繼續嘗試下一個密碼
                }
            }
            
            if (!loginSuccess) {
                console.log('❌ ti2025A 無法登錄，請檢查用戶是否存在');
                return;
            }
        }
        
        const token = loginData.token;
        console.log(`🔑 獲得授權令牌: ${token.substring(0, 20)}...`);
        
        // 2. 獲取用戶信息
        console.log('\n👤 獲取 ti2025A 用戶信息...');
        const profileResponse = await fetch(`${API_BASE_URL}/agent/profile`, {
            method: 'GET',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });
        
        if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            console.log('📋 用戶信息:', {
                username: profileData.agent?.username,
                level: profileData.agent?.level,
                status: profileData.agent?.status,
                balance: profileData.agent?.balance
            });
        }
        
        // 3. 測試代理層級分析API
        console.log('\n📊 測試代理層級分析API...');
        
        const reportResponse = await fetch(`${API_BASE_URL}/reports/agent-analysis`, {
            method: 'GET',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });
        
        if (!reportResponse.ok) {
            console.log(`❌ API請求失敗: ${reportResponse.status} ${reportResponse.statusText}`);
            const errorText = await reportResponse.text();
            console.log('錯誤詳情:', errorText);
            return;
        }
        
        const reportData = await reportResponse.json();
        console.log('📊 API返回狀態:', reportData.success ? '✅ 成功' : '❌ 失敗');
        
        if (reportData.success) {
            console.log(`📈 總共返回 ${reportData.reportData ? reportData.reportData.length : 0} 個項目`);
            
            // 分析代理和會員
            if (reportData.reportData && reportData.reportData.length > 0) {
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
                        const type = item.userType === 'agent' ? '🔷 代理' : '🔶 會員';
                        console.log(`  ${type} ${item.username}: ${item.betCount}筆, ${item.betAmount}元, 盈虧: ${item.memberWinLoss}元`);
                    });
                } else {
                    console.log('ℹ️  沒有用戶有下注記錄');
                }
                
                // 檢查總計數據
                console.log('\n📊 總計數據:');
                console.log(`  總筆數: ${reportData.totalSummary.betCount || 0}`);
                console.log(`  總下注金額: ${reportData.totalSummary.betAmount || 0}`);
                console.log(`  總會員輸贏: ${reportData.totalSummary.memberWinLoss || 0}`);
                
                // 模擬前端過濾邏輯
                console.log('\n🔍 前端過濾邏輯測試...');
                const frontendFilteredData = reportData.reportData.filter(item => 
                    item && (item.betCount > 0 || item.betAmount > 0)
                );
                
                console.log(`📊 前端過濾後顯示項目: ${frontendFilteredData.length}`);
                
                if (frontendFilteredData.length === 0) {
                    console.log('ℹ️  前端將顯示: 沒有有效下注資料');
                } else {
                    console.log('✅ 前端將正常顯示代理和會員列表');
                }
            } else {
                console.log('ℹ️  返回的報表數據為空');
            }
            
            // 檢查代理信息
            if (reportData.agentInfo) {
                console.log('\n📋 代理信息:');
                console.log(`  代理用戶名: ${reportData.agentInfo.username || 'N/A'}`);
                console.log(`  下級代理數量: ${reportData.agentInfo.agentCount || 0}`);
                console.log(`  下級會員數量: ${reportData.agentInfo.memberCount || 0}`);
            }
            
        } else {
            console.log('❌ API調用失敗:', reportData.message || '未知錯誤');
        }
        
        // 4. 測試帶日期篩選的查詢
        console.log('\n📅 測試帶日期篩選的查詢...');
        const today = new Date().toISOString().split('T')[0];
        
        const dateFilterResponse = await fetch(`${API_BASE_URL}/reports/agent-analysis?startDate=${today}&endDate=${today}`, {
            method: 'GET',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });
        
        if (dateFilterResponse.ok) {
            const dateFilterData = await dateFilterResponse.json();
            console.log(`📅 今日報表項目數量: ${dateFilterData.reportData ? dateFilterData.reportData.length : 0}`);
            
            const todayActiveBetters = dateFilterData.reportData ? 
                dateFilterData.reportData.filter(item => item && (item.betCount > 0 || item.betAmount > 0)) : [];
            console.log(`📅 今日有下注記錄的項目: ${todayActiveBetters.length}`);
        }
        
        console.log('\n🎉 ti2025A 測試完成！');
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error);
    }
}

// 執行測試
testTi2025AAgentReport();
