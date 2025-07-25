const axios = require('axios');

// 测试修复后的API端点
async function testAPIs() {
    const baseURL = 'http://localhost:3003/api/agent';
    
    console.log('🧪 开始测试API修复...\n');
    
    // 测试 1: bets API (不需要身份验证)
    try {
        console.log('1. 测试 bets API...');
        const response = await axios.get(`${baseURL}/bets?agentId=1`);
        console.log('✅ bets API: 成功', response.status);
    } catch (error) {
        console.log('❌ bets API: 失败', error.response?.status || error.message);
    }
    
    // 测试 2: hierarchical-members API (需要身份验证)
    try {
        console.log('2. 测试 hierarchical-members API...');
        const response = await axios.get(`${baseURL}/hierarchical-members?agentId=1`, {
            headers: {
                'Authorization': 'Bearer test-token'
            }
        });
        console.log('✅ hierarchical-members API: 成功', response.status);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ hierarchical-members API: 正确要求身份验证 (401)');
        } else {
            console.log('❌ hierarchical-members API: 失败', error.response?.status || error.message);
        }
    }
    
    // 测试 3: transactions API (需要身份验证)
    try {
        console.log('3. 测试 transactions API...');
        const response = await axios.get(`${baseURL}/transactions?agentId=1&type=deposit`, {
            headers: {
                'Authorization': 'Bearer test-token'
            }
        });
        console.log('✅ transactions API: 成功', response.status);
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('✅ transactions API: 正确要求身份验证 (401)');
        } else {
            console.log('❌ transactions API: 失败', error.response?.status || error.message);
        }
    }
    
    console.log('\n🎉 API测试完成!');
}

// 如果这个文件被直接运行，执行测试
if (require.main === module) {
    testAPIs().catch(console.error);
}

module.exports = { testAPIs }; 