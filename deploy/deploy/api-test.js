const axios = require('axios');

// 測試修復後的API端點
async function testAPIs() {
    const baseURL = 'http://localhost:3003/api/agent';
    
    console.log('🧪 開始測試API修復...\n');
    
    // 測試 1: bets API (不需要身份驗證)
    try {
        console.log('1. 測試 bets API...');
        const response = await axios.get(`${baseURL}/bets?agentId=1`);
        console.log('✅ bets API: 成功', response.status);
    } catch (error) {
        console.log('❌ bets API: 失敗', error.response?.status || error.message);
    }
    
    // 測試 2: hierarchical-members API (需要身份驗證)
    try {
        console.log('2. 測試 hierarchical-members API...');
        const response = await axios.get(`${baseURL}/hierarchical-members?agentId=1`, {
            headers: {
                'Authorization': 'Bearer test-token'
            }
        });
        console.log('✅ hierarchical-members API: 成功', response.status);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ hierarchical-members API: 正確要求身份驗證 (401)');
        } else {
            console.log('❌ hierarchical-members API: 失敗', error.response?.status || error.message);
        }
    }
    
    // 測試 3: transactions API (需要身份驗證)
    try {
        console.log('3. 測試 transactions API...');
        const response = await axios.get(`${baseURL}/transactions?agentId=1&type=deposit`, {
            headers: {
                'Authorization': 'Bearer test-token'
            }
        });
        console.log('✅ transactions API: 成功', response.status);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ transactions API: 正確要求身份驗證 (401)');
        } else {
            console.log('❌ transactions API: 失敗', error.response?.status || error.message);
        }
    }
    
    console.log('\n🎉 API測試完成!');
}

// 如果這個文件被直接運行，執行測試
if (require.main === module) {
    testAPIs().catch(console.error);
}

module.exports = { testAPIs }; 