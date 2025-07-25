// 測試會員下注記錄功能
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function testMemberBetRecords() {
    try {
        console.log('🧪 開始測試會員下注記錄功能...\n');
        
        // 1. 模擬登入獲取 token
        console.log('1. 模擬登入...');
        const loginResponse = await axios.post(`${API_BASE_URL}/login`, {
            username: 'upup168j',
            password: '123456'
        });
        
        if (!loginResponse.data.success) {
            throw new Error('登入失敗: ' + loginResponse.data.message);
        }
        
        const token = loginResponse.data.token;
        console.log('✅ 登入成功, Token:', token.substring(0, 20) + '...\n');
        
        // 2. 測試查詢會員下注記錄 API
        console.log('2. 測試查詢會員下注記錄 API...');
        const memberUsername = 'rd5168'; // 測試會員用戶名
        const startDate = '2025-06-30';
        const endDate = '2025-06-30';
        
        const recordsResponse = await axios.get(`${API_BASE_URL}/member-bet-records`, {
            params: {
                memberUsername,
                startDate,
                endDate,
                page: 1,
                limit: 10
            },
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('會員下注記錄 API 回應:', JSON.stringify(recordsResponse.data, null, 2));
        
        if (recordsResponse.data.success) {
            console.log(`✅ 查詢成功! 找到 ${recordsResponse.data.data.records.length} 筆記錄`);
            console.log('統計資訊:', recordsResponse.data.data.statistics);
            
            // 顯示前幾筆記錄
            if (recordsResponse.data.data.records.length > 0) {
                console.log('\n前幾筆記錄:');
                recordsResponse.data.data.records.slice(0, 3).forEach((record, index) => {
                    console.log(`${index + 1}. 單號: ${record.bet_id}, 金額: ${record.bet_amount}, 結果: ${record.result}`);
                });
            }
        } else {
            console.log('❌ 查詢失敗:', recordsResponse.data.message);
        }
        
        console.log('\n');
        
        // 3. 測試佔成明細 API（如果有記錄的話）
        if (recordsResponse.data.success && recordsResponse.data.data.records.length > 0) {
            console.log('3. 測試佔成明細 API...');
            const firstRecord = recordsResponse.data.data.records[0];
            const betId = firstRecord.bet_id || firstRecord.id;
            
            const commissionResponse = await axios.get(`${API_BASE_URL}/bet-commission-details/${betId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('佔成明細 API 回應:', JSON.stringify(commissionResponse.data, null, 2));
            
            if (commissionResponse.data.success) {
                console.log('✅ 佔成明細查詢成功!');
            } else {
                console.log('❌ 佔成明細查詢失敗:', commissionResponse.data.message);
            }
        }
        
        console.log('\n');
        
        // 4. 測試開獎結果 API
        console.log('4. 測試開獎結果 API...');
        const gameType = 'pk10';
        const periodNumber = '202506300960';
        
        const drawResponse = await axios.get(`${API_BASE_URL}/draw-result/${gameType}/${periodNumber}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        console.log('開獎結果 API 回應:', JSON.stringify(drawResponse.data, null, 2));
        
        if (drawResponse.data.success) {
            console.log('✅ 開獎結果查詢成功!');
            console.log('開獎號碼:', drawResponse.data.data.resultNumbers);
        } else {
            console.log('❌ 開獎結果查詢失敗:', drawResponse.data.message);
        }
        
        console.log('\n🎉 所有測試完成!');
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error.message);
        if (error.response) {
            console.error('錯誤詳情:', error.response.data);
        }
    }
}

// 執行測試
testMemberBetRecords();
