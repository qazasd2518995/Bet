// 測試代理層級進入功能 - 使用會話 token
const fetch = require('node-fetch');

async function testWithLogin() {
    console.log('=== 測試代理層級進入功能（有登入）===\n');
    
    const API_BASE = 'http://localhost:3003/api/agent';
    
    try {
        // 1. 先登入獲取 token
        console.log('1. 嘗試登入...');
        const loginResponse = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'ti2025A',
                password: 'ti2025A' // ti2025A 的密碼
            })
        });
        
        let token = '';
        if (loginResponse.ok) {
            const loginData = await loginResponse.json();
            if (loginData.success) {
                token = loginData.token;
                console.log('✅ 登入成功');
            } else {
                console.log('❌ 登入失敗:', loginData.message);
                return;
            }
        } else {
            console.log('❌ 登入請求失敗:', loginResponse.status);
            return;
        }
        
        // 2. 測試根層級報表
        console.log('\n2. 測試根層級報表...');
        const rootResponse = await fetch(`${API_BASE}/agent-hierarchical-analysis?startDate=2024-01-01&endDate=2025-12-31`, {
            method: 'GET',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!rootResponse.ok) {
            throw new Error(`根層級請求失敗: ${rootResponse.status}`);
        }
        
        const rootData = await rootResponse.json();
        console.log('✅ 根層級 API 成功');
        console.log(`📊 根層級數據: ${rootData.reportData ? rootData.reportData.length : 0} 個項目`);
        
        if (rootData.reportData && rootData.reportData.length > 0) {
            console.log('\n📋 根層級內容:');
            rootData.reportData.forEach((item, index) => {
                console.log(`   ${index + 1}. ${item.username} - 類型: ${item.type} - ID: ${item.id} - 級別: ${item.level} - 下注次數: ${item.betCount} - 下注金額: ${item.betAmount}`);
            });
            
            const agentItem = rootData.reportData.find(item => item.type === 'agent');
            
            if (agentItem) {
                console.log(`\n3. 找到代理: ${agentItem.username} (ID: ${agentItem.id}, 級別: ${agentItem.level})`);
                
                // 3. 測試進入該代理的層級
                console.log(`4. 測試進入代理 ${agentItem.username} 的層級...`);
                const agentResponse = await fetch(`${API_BASE}/agent-hierarchical-analysis?startDate=2024-01-01&endDate=2025-12-31&agentId=${agentItem.id}`, {
                    method: 'GET',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!agentResponse.ok) {
                    throw new Error(`代理層級請求失敗: ${agentResponse.status}`);
                }
                
                const agentData = await agentResponse.json();
                console.log('✅ 代理層級 API 成功');
                console.log(`📊 代理層級數據: ${agentData.reportData ? agentData.reportData.length : 0} 個項目`);
                
                if (agentData.reportData && agentData.reportData.length > 0) {
                    console.log('\n📋 代理層級內容:');
                    agentData.reportData.forEach((item, index) => {
                        console.log(`   ${index + 1}. ${item.username} - 類型: ${item.type} - ID: ${item.id || 'N/A'} - 下注次數: ${item.betCount} - 下注金額: ${item.betAmount}`);
                    });
                    
                    console.log('\n✅ 成功：代理層級有數據，表示點擊進入功能正常');
                } else {
                    console.log('\n❌ 代理層級無數據 - 這就是用戶遇到的問題');
                }
                
            } else {
                console.log('❌ 根層級中沒有找到代理項目');
            }
        } else {
            console.log('❌ 根層級無數據');
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
    }
}

testWithLogin();
