// 檢查數據庫中的用戶和下注記錄
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function checkDatabaseData() {
    try {
        console.log('🔍 檢查數據庫中的數據...\n');
        
        // 先嘗試用 rdd8899 登入
        console.log('1. 嘗試使用 rdd8899 登入...');
        let loginResponse = await axios.post(`${API_BASE_URL}/login`, {
            username: 'rdd8899',
            password: '123456'
        });
        
        if (!loginResponse.data.success) {
            console.log('rdd8899 登入失敗，嘗試 test_agent...');
            loginResponse = await axios.post(`${API_BASE_URL}/login`, {
                username: 'test_agent',
                password: 'password123'
            });
        }
        
        if (!loginResponse.data.success) {
            throw new Error('所有測試用戶都登入失敗');
        }
        
        const token = loginResponse.data.token;
        console.log('✅ 登入成功, 用戶:', loginResponse.data.user.username);
        
        // 查詢代理層級分析，看看有哪些會員
        console.log('\n2. 查詢代理層級分析...');
        const analysisResponse = await axios.get(`${API_BASE_URL}/agent-hierarchical-analysis`, {
            params: {
                startDate: '2025-06-30',
                endDate: '2025-06-30'
            },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('分析結果:', JSON.stringify(analysisResponse.data, null, 2));
        
        if (analysisResponse.data.success && analysisResponse.data.reportData) {
            const members = analysisResponse.data.reportData.filter(item => 
                (item.type === 'member' || item.userType === 'member') && 
                (item.betCount > 0 || item.betAmount > 0)
            );
            
            console.log(`\n找到 ${members.length} 個有下注的會員:`);
            members.forEach(member => {
                console.log(`- ${member.username}: 下注 ${member.betCount} 筆, 金額 ${member.betAmount}`);
            });
            
            // 如果有會員，測試查詢其下注記錄
            if (members.length > 0) {
                const testMember = members[0];
                console.log(`\n3. 測試查詢會員 ${testMember.username} 的下注記錄...`);
                
                const recordsResponse = await axios.get(`${API_BASE_URL}/member-bet-records`, {
                    params: {
                        memberUsername: testMember.username,
                        startDate: '2025-06-30',
                        endDate: '2025-06-30',
                        page: 1,
                        limit: 10
                    },
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                console.log('下注記錄查詢結果:', JSON.stringify(recordsResponse.data, null, 2));
            }
        }
        
    } catch (error) {
        console.error('❌ 檢查過程中發生錯誤:', error.message);
        if (error.response) {
            console.error('錯誤詳情:', error.response.data);
        }
    }
}

// 執行檢查
checkDatabaseData();
