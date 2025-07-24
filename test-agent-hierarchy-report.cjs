const axios = require('axios');

async function testAgentHierarchyReport() {
    console.log('=== 測試代理層級分析報表 API ===\n');
    
    const agentApiUrl = 'https://fs-agent-api.onrender.com';
    
    // 模擬登入取得 token
    try {
        console.log('1. 登入 MA@x9Kp#2025$zL7 (justin2025A 的上級)...');
        const loginRes = await axios.post(`${agentApiUrl}/api/agent/login`, {
            username: 'MA@x9Kp#2025$zL7',
            password: '123456'
        });
        
        const token = loginRes.data.token;
        console.log('登入成功，取得 token\n');
        
        // 查詢代理層級報表
        console.log('2. 查詢代理層級報表...');
        const reportRes = await axios.get(`${agentApiUrl}/api/agent/reports/agent-analysis`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('報表資料:');
        console.log(JSON.stringify(reportRes.data, null, 2));
        
        // 分析結果
        if (reportRes.data.success && reportRes.data.reportData) {
            console.log('\n分析結果:');
            const reportData = reportRes.data.reportData;
            
            // 找到 justin2025A
            const justin2025A = reportData.find(item => item.username === 'justin2025A');
            if (justin2025A) {
                console.log('\njustin2025A 的資料:');
                console.log(`- 下注金額: $${justin2025A.betAmount}`);
                console.log(`- 退水百分比: ${justin2025A.rebatePercentage * 100}%`);
                console.log(`- 賺水百分比: ${justin2025A.earnedRebatePercentage * 100}%`);
                console.log(`- 賺水金額: $${justin2025A.earnedRebateAmount}`);
                
                console.log('\n問題分析:');
                if (justin2025A.earnedRebatePercentage === 0.006) {
                    console.log('❌ 賺水百分比顯示為 0.6%，這是錯誤的');
                    console.log('   應該顯示 justin2025A 本身的退水百分比 0.5%');
                    console.log('   而不是上級退水 1.1% - 自己退水 0.5% = 0.6% 的差額');
                }
            }
            
            // 檢查總計
            if (reportRes.data.totalSummary) {
                console.log('\n總計資料:');
                console.log(`- 總下注金額: $${reportRes.data.totalSummary.betAmount}`);
                console.log(`- 總賺水金額: $${reportRes.data.totalSummary.earnedRebateAmount}`);
                
                const actualPercentage = reportRes.data.totalSummary.earnedRebateAmount / reportRes.data.totalSummary.betAmount;
                console.log(`- 實際使用的百分比: ${(actualPercentage * 100).toFixed(3)}%`);
            }
        }
        
    } catch (error) {
        console.error('測試失敗:', error.response?.data || error.message);
    }
}

testAgentHierarchyReport();