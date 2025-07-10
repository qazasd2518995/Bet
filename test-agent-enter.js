// 測試代理層級進入功能
const fetch = require('node-fetch');

async function testAgentEnter() {
    console.log('=== 測試代理層級進入功能 ===\n');
    
    const API_BASE = 'http://localhost:3003/api/agent';
    
    try {
        // 1. 測試 ti2025A 根層級數據
        console.log('1. 測試 ti2025A 根層級數據...');
        const rootResponse = await fetch(`${API_BASE}/agent-hierarchical-analysis?startDate=2024-01-01&endDate=2025-12-31&agentId=28`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (!rootResponse.ok) {
            throw new Error(`根層級請求失敗: ${rootResponse.status}`);
        }
        
        const rootData = await rootResponse.json();
        console.log('✅ 根層級 API 成功');
        console.log(`📊 根層級數據: ${rootData.reportData ? rootData.reportData.length : 0} 個項目`);
        
        if (rootData.reportData && rootData.reportData.length > 0) {
            const agentItem = rootData.reportData.find(item => item.type === 'agent');
            
            if (agentItem) {
                console.log(`\n2. 找到代理: ${agentItem.username} (ID: ${agentItem.id}, 級別: ${agentItem.level})`);
                
                // 2. 測試進入該代理的層級
                console.log(`3. 測試進入代理 ${agentItem.username} 的層級...`);
                const agentResponse = await fetch(`${API_BASE}/agent-hierarchical-analysis?startDate=2024-01-01&endDate=2025-12-31&agentId=${agentItem.id}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
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
                        console.log(`   ${index + 1}. ${item.username} - 類型: ${item.type} - 下注次數: ${item.betCount} - 下注金額: ${item.betAmount}`);
                    });
                } else {
                    console.log('❌ 代理層級無數據或無有效下注記錄');
                }
                
            } else {
                console.log('❌ 根層級中沒有找到代理項目');
                console.log('📋 根層級內容:');
                rootData.reportData.forEach((item, index) => {
                    console.log(`   ${index + 1}. ${item.username} - 類型: ${item.type} - 下注次數: ${item.betCount}`);
                });
            }
        } else {
            console.log('❌ 根層級無數據');
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
    }
}

testAgentEnter();
