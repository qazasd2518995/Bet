// 測試不同的登入組合
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function testDifferentLogins() {
    try {
        console.log('🔍 測試不同的登入組合...\n');
        
        const testCredentials = [
            { username: 'ti2025D', password: 'ti2025' },
            { username: 'ti2025A', password: 'ti2025' },
            { username: 'ti2025D', password: '123456' },
            { username: 'ti2025A', password: '123456' },
            { username: 'admin', password: 'admin' },
            { username: 'test', password: 'test' },
            { username: 'rdd8899', password: '123456' },
            { username: 'upup168j', password: '123456' }
        ];
        
        for (const cred of testCredentials) {
            try {
                console.log(`嘗試登入: ${cred.username} / ${cred.password}`);
                const loginResponse = await axios.post(`${API_BASE_URL}/login`, cred);
                
                if (loginResponse.data.success) {
                    console.log('✅ 登入成功!');
                    console.log('用戶資訊:', {
                        username: loginResponse.data.user.username,
                        level: loginResponse.data.user.level,
                        balance: loginResponse.data.user.balance
                    });
                    
                    // 使用這個成功的登入測試功能
                    const token = loginResponse.data.token;
                    
                    console.log('\n測試會員下注記錄 API...');
                    const recordsResponse = await axios.get(`${API_BASE_URL}/member-bet-records`, {
                        params: {
                            memberUsername: 'rd5168',
                            startDate: '2025-06-30',
                            endDate: '2025-06-30',
                            page: 1,
                            limit: 5
                        },
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    console.log('API 回應:', {
                        success: recordsResponse.data.success,
                        message: recordsResponse.data.message,
                        recordCount: recordsResponse.data.data?.records?.length || 0
                    });
                    
                    if (recordsResponse.data.success && recordsResponse.data.data?.records?.length > 0) {
                        console.log('找到下注記錄！前1筆:');
                        const record = recordsResponse.data.data.records[0];
                        console.log({
                            bet_id: record.bet_id,
                            period_number: record.period_number,
                            bet_amount: record.bet_amount,
                            game_type: record.game_type,
                            result: record.result
                        });
                    }
                    
                    break; // 找到能登入的用戶就停止
                } else {
                    console.log('❌ 登入失敗:', loginResponse.data.message);
                }
            } catch (error) {
                console.log('❌ 登入錯誤:', error.response?.data?.message || error.message);
            }
            
            console.log('');
        }
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error.message);
    }
}

// 執行測試
testDifferentLogins();
