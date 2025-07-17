// 使用現有的總代理用戶測試功能
const axios = require('axios');

const API_BASE_URL = 'http://localhost:3003/api/agent';

async function testWithExistingUsers() {
    try {
        console.log('🔍 使用現有總代理測試功能...\n');
        
        // 嘗試使用總代理帳號登入
        console.log('1. 嘗試使用總代理 ti2025D 登入...');
        let loginResponse = await axios.post(`${API_BASE_URL}/login`, {
            username: 'ti2025D',
            password: 'ti2025'
        });
        
        if (!loginResponse.data.success) {
            console.log('ti2025D 登入失敗，嘗試 ti2025A...');
            loginResponse = await axios.post(`${API_BASE_URL}/login`, {
                username: 'ti2025A',
                password: 'ti2025'
            });
        }
        
        if (!loginResponse.data.success) {
            throw new Error('總代理登入失敗');
        }
        
        const token = loginResponse.data.token;
        console.log('✅ 登入成功, 用戶:', loginResponse.data.user.username);
        console.log('用戶等級:', loginResponse.data.user.level);
        
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
        
        console.log('分析結果:', {
            success: analysisResponse.data.success,
            hasData: analysisResponse.data.hasData,
            reportDataLength: analysisResponse.data.reportData?.length || 0,
            message: analysisResponse.data.message
        });
        
        if (analysisResponse.data.success && analysisResponse.data.reportData) {
            const members = analysisResponse.data.reportData.filter(item => 
                (item.type === 'member' || item.userType === 'member') && 
                (item.betCount > 0 || item.betAmount > 0)
            );
            
            console.log(`\n找到 ${members.length} 個有下注的會員:`);
            members.forEach(member => {
                console.log(`- ${member.username}: 下注 ${member.betCount} 筆, 金額 ${member.betAmount}`);
            });
            
            // 測試用固定的會員名稱
            console.log(`\n3. 測試查詢會員 rd5168 的下注記錄...`);
            
            const recordsResponse = await axios.get(`${API_BASE_URL}/member-bet-records`, {
                params: {
                    memberUsername: 'rd5168',
                    startDate: '2025-06-30',
                    endDate: '2025-06-30',
                    page: 1,
                    limit: 10
                },
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            console.log('下注記錄查詢結果:');
            console.log('Success:', recordsResponse.data.success);
            console.log('Message:', recordsResponse.data.message);
            
            if (recordsResponse.data.success) {
                console.log('Records count:', recordsResponse.data.data?.records?.length || 0);
                console.log('Statistics:', recordsResponse.data.data?.statistics);
                
                // 顯示前幾筆記錄
                if (recordsResponse.data.data?.records?.length > 0) {
                    console.log('\n前3筆記錄:');
                    recordsResponse.data.data.records.slice(0, 3).forEach((record, index) => {
                        console.log(`${index + 1}. 單號: ${record.bet_id}, 期數: ${record.period_number}, 金額: ${record.bet_amount}, 結果: ${record.result}`);
                    });
                    
                    // 測試佔成明細 API
                    console.log('\n4. 測試佔成明細 API...');
                    const firstRecord = recordsResponse.data.data.records[0];
                    const betId = firstRecord.bet_id || firstRecord.id;
                    
                    const commissionResponse = await axios.get(`${API_BASE_URL}/bet-commission-details/${betId}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });
                    
                    console.log('佔成明細 API 回應:');
                    console.log('Success:', commissionResponse.data.success);
                    if (commissionResponse.data.success) {
                        console.log('Commission details:', commissionResponse.data.data?.commissionDetails);
                    }
                    
                    // 測試開獎結果 API
                    console.log('\n5. 測試開獎結果 API...');
                    const gameType = firstRecord.game_type || 'pk10';
                    const periodNumber = firstRecord.period_number;
                    
                    if (periodNumber) {
                        const drawResponse = await axios.get(`${API_BASE_URL}/draw-result/${gameType}/${periodNumber}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                        
                        console.log('開獎結果 API 回應:');
                        console.log('Success:', drawResponse.data.success);
                        if (drawResponse.data.success) {
                            console.log('期數:', drawResponse.data.data?.periodNumber);
                            console.log('開獎號碼:', drawResponse.data.data?.resultNumbers);
                        } else {
                            console.log('Message:', drawResponse.data.message);
                        }
                    }
                }
            }
        }
        
        console.log('\n🎉 功能測試完成!');
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error.message);
        if (error.response) {
            console.error('錯誤狀態:', error.response.status);
            console.error('錯誤詳情:', error.response.data);
        }
    }
}

// 執行測試
testWithExistingUsers();
