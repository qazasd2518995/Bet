const axios = require('axios');

// 測試配置
const BASE_URL = 'http://localhost:3003';
const AGENT_TOKEN = 'your_agent_token_here'; // 需要替換為實際的代理token

async function testAgentLevelDisplay() {
    try {
        console.log('🧪 開始測試代理層級分析報表級別顯示修復...');
        
        // 1. 測試代理層級分析API
        console.log('\n📊 測試代理層級分析API...');
        const response = await axios.get(`${BASE_URL}/api/reports/agent-analysis`, {
            headers: {
                'Authorization': `Bearer ${AGENT_TOKEN}`,
                'Content-Type': 'application/json'
            },
            params: {
                startDate: '2024-01-01',
                endDate: '2024-12-31'
            }
        });
        
        if (response.data.success) {
            console.log('✅ API調用成功');
            console.log(`📈 返回數據條數: ${response.data.reportData.length}`);
            
            // 檢查代理數據
            const agentData = response.data.reportData.filter(item => item.userType === 'agent');
            console.log(`👥 代理數量: ${agentData.length}`);
            
            if (agentData.length > 0) {
                console.log('\n🔍 代理級別檢查:');
                agentData.forEach((agent, index) => {
                    console.log(`  ${index + 1}. ${agent.username}:`);
                    console.log(`     - userType: ${agent.userType}`);
                    console.log(`     - level: ${agent.level} (類型: ${typeof agent.level})`);
                    console.log(`     - hasDownline: ${agent.hasDownline}`);
                    
                    // 驗證級別是否為數字
                    if (typeof agent.level === 'number') {
                        console.log(`     ✅ 級別為數字: ${agent.level}`);
                    } else {
                        console.log(`     ❌ 級別不是數字: ${agent.level}`);
                    }
                });
            }
            
            // 檢查會員數據
            const memberData = response.data.reportData.filter(item => item.userType === 'member');
            console.log(`\n👤 會員數量: ${memberData.length}`);
            
            if (memberData.length > 0) {
                console.log('\n🔍 會員級別檢查:');
                memberData.forEach((member, index) => {
                    console.log(`  ${index + 1}. ${member.username}:`);
                    console.log(`     - userType: ${member.userType}`);
                    console.log(`     - level: ${member.level}`);
                });
            }
            
        } else {
            console.log('❌ API調用失敗:', response.data.message);
        }
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
        if (error.response) {
            console.error('HTTP狀態:', error.response.status);
            console.error('錯誤詳情:', error.response.data);
        }
    }
}

// 模擬前端顯示邏輯
function simulateFrontendDisplay(agentData) {
    console.log('\n🎨 模擬前端顯示邏輯:');
    
    agentData.forEach((agent, index) => {
        let displayLevel = '';
        
        if (agent.userType === 'agent') {
            if (agent.level === 0) {
                displayLevel = '總代理';
            } else if (typeof agent.level === 'number') {
                // 使用getLevelShortName函數
                const levelNames = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
                const levelName = agent.level <= 10 ? levelNames[agent.level] : agent.level;
                displayLevel = `${levelName}級代理`;
            } else {
                displayLevel = agent.level; // 如果是字符串，直接使用
            }
        } else {
            displayLevel = '會員';
        }
        
        console.log(`  ${index + 1}. ${agent.username}: ${displayLevel}`);
    });
}

// 執行測試
if (require.main === module) {
    console.log('🚀 代理層級顯示修復測試');
    console.log('=' .repeat(50));
    
    testAgentLevelDisplay().then(() => {
        console.log('\n✅ 測試完成');
    }).catch(error => {
        console.error('\n❌ 測試失敗:', error);
    });
}

module.exports = { testAgentLevelDisplay, simulateFrontendDisplay }; 