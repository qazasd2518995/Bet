const axios = require('axios');

const GAME_API_URL = 'http://localhost:3000';
const AGENT_API_URL = 'http://localhost:3003';

async function testJustinRebateIssue() {
    console.log('🔍 檢查會員 justin2025A 的退水問題...\n');
    
    // 1. 檢查會員的代理關係
    console.log('1️⃣ 檢查會員的代理關係...');
    try {
        const response = await axios.get(`${AGENT_API_URL}/api/agent/member-agent-chain?username=justin2025A`);
        console.log('代理鏈查詢結果:', response.data);
        
        if (response.data.success && response.data.agentChain) {
            const agentChain = response.data.agentChain;
            console.log('✅ 代理鏈存在:');
            agentChain.forEach((agent, index) => {
                console.log(`   L${agent.level}: ${agent.username} (${agent.rebate_mode}, ${(agent.rebate_percentage*100).toFixed(1)}%)`);
            });
        } else {
            console.log('❌ 無法獲取代理鏈:', response.data.message);
            return;
        }
    } catch (error) {
        console.error('❌ 代理鏈查詢錯誤:', error.message);
        return;
    }
    
    // 2. 檢查會員最近的下注記錄
    console.log('\n2️⃣ 檢查會員最近的下注記錄...');
    try {
        const betResponse = await axios.get(`${GAME_API_URL}/api/bet-history?username=justin2025A&limit=10`);
        console.log('下注記錄查詢結果:', betResponse.data);
        
        if (betResponse.data.success && betResponse.data.bets.length > 0) {
            console.log('✅ 最近下注記錄:');
            betResponse.data.bets.forEach(bet => {
                console.log(`   期數${bet.period}: ${bet.bet_type}:${bet.bet_value} ${bet.amount}元 ${bet.settled ? '已結算' : '未結算'}`);
            });
            
            // 檢查是否有未結算的注單
            const unsettledBets = betResponse.data.bets.filter(bet => !bet.settled);
            if (unsettledBets.length > 0) {
                console.log(`\n⚠️ 發現 ${unsettledBets.length} 筆未結算注單，退水將在結算後分配`);
            }
        } else {
            console.log('❌ 無法獲取下注記錄');
        }
    } catch (error) {
        console.error('❌ 下注記錄查詢錯誤:', error.message);
    }
    
    // 3. 檢查代理的退水記錄
    console.log('\n3️⃣ 檢查代理的退水記錄...');
    try {
        // 假設justin2025A是代理（根據命名規則）
        const rebateResponse = await axios.get(`${AGENT_API_URL}/api/agent/rebate-records?username=justin2025A&limit=10`);
        console.log('退水記錄查詢結果:', rebateResponse.data);
        
        if (rebateResponse.data.success) {
            if (rebateResponse.data.records && rebateResponse.data.records.length > 0) {
                console.log('✅ 最近退水記錄:');
                rebateResponse.data.records.forEach(record => {
                    console.log(`   ${record.created_at}: +${record.amount}元 (來自 ${record.member_username})`);
                });
            } else {
                console.log('❌ 沒有退水記錄');
            }
        }
    } catch (error) {
        console.error('❌ 退水記錄查詢錯誤:', error.message);
    }
    
    // 4. 檢查代理餘額
    console.log('\n4️⃣ 檢查代理餘額...');
    try {
        const balanceResponse = await axios.get(`${AGENT_API_URL}/api/agent/balance?username=justin2025A`);
        console.log('代理餘額查詢結果:', balanceResponse.data);
        
        if (balanceResponse.data.success) {
            console.log(`✅ 當前餘額: ${balanceResponse.data.balance} 元`);
        }
    } catch (error) {
        console.error('❌ 代理餘額查詢錯誤:', error.message);
    }
    
    // 5. 手動測試退水分配API
    console.log('\n5️⃣ 手動測試退水分配...');
    try {
        // 模擬一筆1000元下注的退水分配
        const testRebateData = {
            agentId: 1, // 假設代理ID
            agentUsername: 'justin2025A',
            rebateAmount: 1000 * 0.011, // A盤1.1%退水
            memberUsername: 'justin2025A',
            betAmount: 1000,
            reason: '手動測試退水分配'
        };
        
        console.log('測試退水分配請求:', testRebateData);
        
        const rebateTestResponse = await axios.post(`${AGENT_API_URL}/api/agent/allocate-rebate`, testRebateData);
        console.log('退水分配測試結果:', rebateTestResponse.data);
        
        if (rebateTestResponse.data.success) {
            console.log('✅ 退水分配API正常工作');
        } else {
            console.log('❌ 退水分配API失敗:', rebateTestResponse.data.message);
        }
    } catch (error) {
        console.error('❌ 退水分配API測試錯誤:', error.message);
    }
    
    // 6. 檢查最新期數和結算狀態
    console.log('\n6️⃣ 檢查最新期數和結算狀態...');
    try {
        const gameDataResponse = await axios.get(`${GAME_API_URL}/api/game-data`);
        if (gameDataResponse.data.success) {
            const { period, phase } = gameDataResponse.data;
            console.log(`✅ 當前期數: ${period}, 階段: ${phase}`);
            
            // 檢查期數20250702503是否已結算
            const historyResponse = await axios.get(`${GAME_API_URL}/api/history?period=20250702503`);
            if (historyResponse.data.success && historyResponse.data.results.length > 0) {
                const result = historyResponse.data.results[0];
                console.log(`✅ 期數20250702503已結算: 冠軍=${result.first}`);
            } else {
                console.log(`⚠️ 期數20250702503尚未結算，退水將在結算後分配`);
            }
        }
    } catch (error) {
        console.error('❌ 遊戲狀態查詢錯誤:', error.message);
    }
    
    console.log('\n🔍 檢查完成！');
}

testJustinRebateIssue().catch(console.error); 