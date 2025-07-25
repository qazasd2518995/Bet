const fetch = require('node-fetch');

// 代理系統API URL
const AGENT_API_URL = 'https://bet-agent.onrender.com';

async function testAgentAPI() {
    console.log('===== 測試代理系統 API =====\n');
    
    try {
        // 1. 測試基本連線
        console.log('1. 測試基本連線...');
        const response = await fetch(`${AGENT_API_URL}/api/test`, {
            timeout: 10000
        });
        console.log(`回應狀態: ${response.status}`);
        
        // 2. 測試獲取代理鏈 API
        console.log('\n2. 測試獲取代理鏈 API...');
        const chainResponse = await fetch(`${AGENT_API_URL}/api/member-agent-chain?username=justin111`, {
            timeout: 10000
        });
        console.log(`回應狀態: ${chainResponse.status}`);
        
        if (chainResponse.ok) {
            const chainData = await chainResponse.json();
            console.log('代理鏈資料:', JSON.stringify(chainData, null, 2));
        } else {
            console.log('獲取代理鏈失敗:', await chainResponse.text());
        }
        
        // 3. 測試退水分配 API路徑
        console.log('\n3. 測試退水分配 API路徑...');
        console.log('退水分配 API 路徑:', `${AGENT_API_URL}/api/allocate-rebate`);
        console.log('該 API 使用 POST 方法');
        
    } catch (error) {
        console.error('測試過程中發生錯誤:', error.message);
        if (error.code === 'ETIMEDOUT') {
            console.error('連線逾時，代理系統可能沒有回應');
        }
    }
}

// 執行測試
testAgentAPI();