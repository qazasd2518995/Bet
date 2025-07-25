const axios = require('axios');

const BASE_URL = 'http://localhost:3003';
const AGENT_TOKEN = 'Mjg6MTczMDg5NjAwMDAw'; // ti2025A的token

async function testAgentHierarchicalAnalysis() {
    console.log('🧪 測試代理層級分析API修復效果');
    console.log('=' .repeat(50));
    
    try {
        // 測試1: 查詢今天的數據
        console.log('\n📊 測試1: 查詢今天(2025-07-07)的數據');
        const response1 = await axios.get(`${BASE_URL}/api/reports/agent-analysis`, {
            headers: {
                'Authorization': `Bearer ${AGENT_TOKEN}`
            },
            params: {
                startDate: '2025-07-07',
                endDate: '2025-07-07'
            }
        });
        
        if (response1.data.success) {
            console.log('✅ API調用成功');
            console.log(`📈 返回數據條數: ${response1.data.reportData.length}`);
            console.log(`👥 代理信息: ${response1.data.agentInfo.agentCount}代理 + ${response1.data.agentInfo.memberCount}會員`);
            
            // 檢查代理數據
            const agentData = response1.data.reportData.filter(item => item.userType === 'agent');
            console.log(`🔍 代理數量: ${agentData.length}`);
            
            if (agentData.length > 0) {
                console.log('\n🔍 代理級別檢查:');
                agentData.forEach((agent, index) => {
                    console.log(`  ${index + 1}. ${agent.username}:`);
                    console.log(`     - userType: ${agent.userType}`);
                    console.log(`     - level: ${agent.level} (類型: ${typeof agent.level})`);
                    console.log(`     - betCount: ${agent.betCount}`);
                    console.log(`     - betAmount: ${agent.betAmount}`);
                });
            }
            
            // 檢查會員數據
            const memberData = response1.data.reportData.filter(item => item.userType === 'member');
            console.log(`\n👤 會員數量: ${memberData.length}`);
            
            if (memberData.length > 0) {
                console.log('\n🔍 會員數據檢查:');
                memberData.forEach((member, index) => {
                    console.log(`  ${index + 1}. ${member.username}:`);
                    console.log(`     - userType: ${member.userType}`);
                    console.log(`     - betCount: ${member.betCount}`);
                    console.log(`     - betAmount: ${member.betAmount}`);
                });
            }
            
            // 檢查總計
            console.log('\n📊 總計數據:');
            console.log(`  - 總下注次數: ${response1.data.totalSummary.betCount}`);
            console.log(`  - 總下注金額: ${response1.data.totalSummary.betAmount}`);
            console.log(`  - 會員輸贏: ${response1.data.totalSummary.memberWinLoss}`);
            
        } else {
            console.log('❌ API調用失敗:', response1.data.message);
        }
        
        // 測試2: 查詢所有數據（無日期篩選）
        console.log('\n📊 測試2: 查詢所有數據（無日期篩選）');
        const response2 = await axios.get(`${BASE_URL}/api/reports/agent-analysis`, {
            headers: {
                'Authorization': `Bearer ${AGENT_TOKEN}`
            }
        });
        
        if (response2.data.success) {
            console.log('✅ API調用成功');
            console.log(`📈 返回數據條數: ${response2.data.reportData.length}`);
            console.log(`👥 代理信息: ${response2.data.agentInfo.agentCount}代理 + ${response2.data.agentInfo.memberCount}會員`);
            
            // 檢查是否有更多數據
            const agentData2 = response2.data.reportData.filter(item => item.userType === 'agent');
            const memberData2 = response2.data.reportData.filter(item => item.userType === 'member');
            
            console.log(`🔍 代理數量: ${agentData2.length}`);
            console.log(`👤 會員數量: ${memberData2.length}`);
            
            // 比較兩個查詢的結果
            if (response2.data.reportData.length > response1.data.reportData.length) {
                console.log('✅ 無日期篩選返回更多數據，說明日期篩選正常工作');
            } else {
                console.log('ℹ️ 兩個查詢返回相同數據量');
            }
            
        } else {
            console.log('❌ API調用失敗:', response2.data.message);
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
        if (error.response) {
            console.error('錯誤詳情:', error.response.data);
        }
    }
}

// 執行測試
testAgentHierarchicalAnalysis(); 