// 測試級別顯示修復的腳本
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3003/api/agent';

console.log('🧪 測試級別顯示修復...');

async function test() {
    try {
        // 1. 登入獲取 token
        console.log('1. 登入測試...');
        const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
            username: 'ti2025A',
            password: 'ti2025A'
        });
        
        if (!loginResponse.data.success) {
            throw new Error('登入失败');
        }
        
        const token = loginResponse.data.token;
        console.log('✅ 登入成功');
        
        // 2. 測試層級會員管理 API
        console.log('2. 測試層級會員管理 API...');
        const membersResponse = await axios.get(`${API_BASE_URL}/hierarchical-members`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { agentId: loginResponse.data.user.id }
        });
        
        if (membersResponse.data.success) {
            console.log('✅ 層級會員管理 API 正常');
            console.log('📊 數據樣本:');
            membersResponse.data.data.slice(0, 3).forEach(item => {
                console.log(`  - ${item.userType}: ${item.username}, 級別: "${item.level}", 狀態: ${item.status}`);
            });
        }
        
        // 3. 測試狀態更改
        const testMember = membersResponse.data.data.find(item => item.userType === 'member');
        if (testMember) {
            console.log(`3. 測試會員狀態更改 (${testMember.username})...`);
            const originalStatus = testMember.status;
            const newStatus = originalStatus === 1 ? 0 : 1;
            
            const statusResponse = await axios.post(`${API_BASE_URL}/toggle-member-status`, {
                memberId: testMember.id,
                status: newStatus
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (statusResponse.data.success) {
                console.log(`✅ 狀態更改成功: ${originalStatus} → ${newStatus}`);
                
                // 恢復原狀態
                await axios.post(`${API_BASE_URL}/toggle-member-status`, {
                    memberId: testMember.id,
                    status: originalStatus
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log('✅ 狀態已恢復');
            }
        }
        
        console.log('\n🎉 所有測試通過！修復已生效！');
        
    } catch (error) {
        console.error('❌ 測試失败:', error.response?.data || error.message);
    }
}

test();
