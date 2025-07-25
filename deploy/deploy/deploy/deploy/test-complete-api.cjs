const fs = require('fs');

async function testMemberBetRecords() {
    console.log('=== 會員下注紀錄 API 完整測試 ===\n');

    try {
        // 1. 登入代理帳號
        console.log('1. 登入代理帳號...');
        const loginResponse = await fetch('http://localhost:3003/api/agent/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'A01agent',
                password: 'A01pass'
            })
        });

        const loginData = await loginResponse.json();
        console.log('登入結果:', loginData);

        if (!loginData.success) {
            throw new Error('登入失敗: ' + loginData.message);
        }

        const token = loginData.token;
        const sessionToken = loginData.sessionToken;

        // 2. 測試層級分析報表 API
        console.log('\n2. 測試層級分析報表 API...');
        const reportResponse = await fetch(`http://localhost:3003/api/agent/agent-hierarchical-analysis?startDate=2025-07-01&endDate=2025-07-07`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const reportData = await reportResponse.json();
        console.log('層級報表結果:', JSON.stringify(reportData, null, 2));

        // 找一個有下注的會員來測試
        let testMemberUsername = null;
        if (reportData.success && reportData.reportData && reportData.reportData.length > 0) {
            for (const item of reportData.reportData) {
                if (item.type === 'member' && item.total_bet_amount > 0) {
                    testMemberUsername = item.username;
                    console.log('找到有下注的會員:', testMemberUsername);
                    break;
                }
            }
        }

        // 如果沒有找到有下注的會員，使用已知的會員帳號
        if (!testMemberUsername) {
            console.log('層級報表中沒有找到有下注的會員，使用已知會員帳號進行測試...');
            testMemberUsername = 'sb123455'; // 從資料庫查詢中看到的會員
        }

        // 3. 測試會員下注紀錄 API
        console.log(`\n3. 測試會員 ${testMemberUsername} 的下注紀錄...`);
        const betRecordsResponse = await fetch(`http://localhost:3003/api/agent/member-bet-records?memberUsername=${testMemberUsername}&startDate=2025-07-01&endDate=2025-07-07&page=1&limit=10`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const betRecordsData = await betRecordsResponse.json();
        console.log('會員下注紀錄結果:', JSON.stringify(betRecordsData, null, 2));

        // 4. 如果有下注紀錄，測試佔成明細 API
        if (betRecordsData.success && betRecordsData.data && betRecordsData.data.length > 0) {
            const firstBet = betRecordsData.data[0];
            console.log(`\n4. 測試下注單號 ${firstBet.id} 的佔成明細...`);
            
            const commissionResponse = await fetch(`http://localhost:3003/api/agent/bet-commission-details/${firstBet.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const commissionData = await commissionResponse.json();
            console.log('佔成明細結果:', JSON.stringify(commissionData, null, 2));

            // 5. 測試開獎結果 API
            if (firstBet.game_type && firstBet.period_number) {
                console.log(`\n5. 測試 ${firstBet.game_type} 期號 ${firstBet.period_number} 的開獎結果...`);
                
                const drawResultResponse = await fetch(`http://localhost:3003/api/agent/draw-result/${firstBet.game_type}/${firstBet.period_number}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const drawResultData = await drawResultResponse.json();
                console.log('開獎結果:', JSON.stringify(drawResultData, null, 2));
            }
        } else {
            console.log('\n沒有找到下注紀錄，跳過佔成明細和開獎結果測試。');
        }

        console.log('\n=== 測試完成 ===');

    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
    }
}

// 運行測試
testMemberBetRecords();
