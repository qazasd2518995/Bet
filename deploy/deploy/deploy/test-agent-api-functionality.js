// 測試代理管理 API 的級別顯示功能
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function testAgentAPI() {
    try {
        console.log('🔧 測試代理管理 API...');
        
        // 測試登錄功能
        console.log('\n1. 測試登錄功能...');
        const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
            username: 'ti2025A', // 使用 A盤總代理測試
            password: 'pass123'
        });
        
        if (loginResponse.data.success) {
            console.log('✅ 登錄成功');
            console.log('用戶信息:', {
                username: loginResponse.data.user.username,
                level: loginResponse.data.user.level,
                level_name: loginResponse.data.user.level_name || '未知'
            });
            
            // 測試代理列表
            console.log('\n2. 測試代理列表 API...');
            const agentsResponse = await axios.get(`${API_BASE_URL}/agents`, {
                headers: {
                    'Authorization': `Bearer ${loginResponse.data.token}`
                }
            });
            
            if (agentsResponse.data.success) {
                console.log('✅ 代理列表獲取成功');
                agentsResponse.data.agents.slice(0, 3).forEach(agent => {
                    console.log(`代理: ${agent.username}, 級別: ${agent.level}, 級別名稱: ${agent.level_name || '未知'}`);
                });
            }
            
            // 測試會員列表
            console.log('\n3. 測試會員列表 API...');
            const membersResponse = await axios.get(`${API_BASE_URL}/members`, {
                headers: {
                    'Authorization': `Bearer ${loginResponse.data.token}`
                }
            });
            
            if (membersResponse.data.success) {
                console.log('✅ 會員列表獲取成功');
                console.log(`總會員數: ${membersResponse.data.members.length}`);
                if (membersResponse.data.members.length > 0) {
                    const member = membersResponse.data.members[0];
                    console.log(`示例會員: ${member.username}, 狀態: ${member.status}`);
                }
            }
            
        } else {
            console.log('❌ 登錄失敗:', loginResponse.data.message);
        }
        
    } catch (error) {
        console.error('❌ API 測試失敗:', error.message);
        if (error.response) {
            console.error('響應狀態:', error.response.status);
            console.error('響應數據:', error.response.data);
        }
    }
}

// 執行測試
testAgentAPI();
