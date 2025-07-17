// 測試多筆下注時的餘額扣除問題
const axios = require('axios');

const GAME_URL = 'http://localhost:3000';
const AGENT_URL = 'http://localhost:3003';
const TEST_USERNAME = 'titi'; // 使用A盤測試會員

async function testBalanceDeduction() {
    console.log('🎯 開始測試多筆下注的餘額扣除邏輯');
    
    try {
        // 1. 獲取初始餘額
        console.log('\n1. 獲取初始餘額...');
        const initialBalanceResponse = await axios.get(`${GAME_URL}/api/balance?username=${TEST_USERNAME}`);
        const initialBalance = parseFloat(initialBalanceResponse.data.balance);
        console.log(`初始餘額: $${initialBalance}`);
        
        // 2. 準備測試下注
        const betAmount = 100;
        const betCount = 3;
        const totalExpected = betAmount * betCount;
        
        console.log(`\n2. 準備同時下注 ${betCount} 筆，每筆 $${betAmount}`);
        console.log(`預期總扣除: $${totalExpected}`);
        console.log(`預期餘額: $${initialBalance - totalExpected}`);
        
        // 3. 同時發送多筆下注請求
        console.log('\n3. 同時發送多筆下注請求...');
        const betPromises = [];
        
        for (let i = 1; i <= betCount; i++) {
            const betData = {
                username: TEST_USERNAME,
                amount: betAmount,
                betType: 'number',
                value: i,
                position: 1
            };
            
            console.log(`發送下注 ${i}: 第1名 ${i}号 $${betAmount}`);
            const promise = axios.post(`${GAME_URL}/api/bet`, betData)
                .then(response => {
                    console.log(`下注 ${i} 成功，返回餘額: $${response.data.balance}`);
                    return {
                        index: i,
                        success: true,
                        balance: parseFloat(response.data.balance),
                        response: response.data
                    };
                })
                .catch(error => {
                    console.error(`下注 ${i} 失敗:`, error.response?.data?.message || error.message);
                    return {
                        index: i,
                        success: false,
                        error: error.response?.data?.message || error.message
                    };
                });
            
            betPromises.push(promise);
        }
        
        // 4. 等待所有下注完成
        const results = await Promise.all(betPromises);
        
        console.log('\n4. 下注結果分析:');
        results.forEach(result => {
            if (result.success) {
                console.log(`✅ 下注 ${result.index}: 成功，餘額 $${result.balance}`);
            } else {
                console.log(`❌ 下注 ${result.index}: 失敗 - ${result.error}`);
            }
        });
        
        // 5. 獲取最終餘額
        console.log('\n5. 獲取最終餘額...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒讓後端處理完成
        
        const finalBalanceResponse = await axios.get(`${GAME_URL}/api/balance?username=${TEST_USERNAME}`);
        const finalBalance = parseFloat(finalBalanceResponse.data.balance);
        console.log(`最終餘額: $${finalBalance}`);
        
        // 6. 分析結果
        console.log('\n6. 結果分析:');
        const successfulBets = results.filter(r => r.success).length;
        const actualDeduction = initialBalance - finalBalance;
        const expectedDeduction = successfulBets * betAmount;
        
        console.log(`成功下注筆數: ${successfulBets}/${betCount}`);
        console.log(`初始餘額: $${initialBalance}`);
        console.log(`最終餘額: $${finalBalance}`);
        console.log(`實際扣除: $${actualDeduction}`);
        console.log(`預期扣除: $${expectedDeduction}`);
        
        if (Math.abs(actualDeduction - expectedDeduction) < 0.01) {
            console.log('✅ 餘額扣除正確！');
        } else {
            console.log('❌ 餘額扣除異常！');
            console.log(`差額: $${Math.abs(actualDeduction - expectedDeduction)}`);
        }
        
        // 7. 檢查代理系統餘額
        console.log('\n7. 檢查代理系統餘額...');
        try {
            const agentBalanceResponse = await axios.get(`${AGENT_URL}/member-balance?username=${TEST_USERNAME}`);
            const agentBalance = parseFloat(agentBalanceResponse.data.balance);
            console.log(`代理系統餘額: $${agentBalance}`);
            
            if (Math.abs(agentBalance - finalBalance) < 0.01) {
                console.log('✅ 遊戲系統與代理系統餘額一致！');
            } else {
                console.log('❌ 遊戲系統與代理系統餘額不一致！');
                console.log(`差額: $${Math.abs(agentBalance - finalBalance)}`);
            }
        } catch (agentError) {
            console.error('獲取代理系統餘額失敗:', agentError.message);
        }
        
    } catch (error) {
        console.error('測試失敗:', error.message);
    }
}

async function testSequentialBets() {
    console.log('\n\n🔄 開始測試順序下注的餘額扣除邏輯');
    
    try {
        // 1. 獲取初始餘額
        const initialBalanceResponse = await axios.get(`${GAME_URL}/api/balance?username=${TEST_USERNAME}`);
        const initialBalance = parseFloat(initialBalanceResponse.data.balance);
        console.log(`初始餘額: $${initialBalance}`);
        
        // 2. 順序下注
        const betAmount = 100;
        const betCount = 3;
        
        console.log(`\n順序下注 ${betCount} 筆，每筆 $${betAmount}`);
        
        for (let i = 1; i <= betCount; i++) {
            const betData = {
                username: TEST_USERNAME,
                amount: betAmount,
                betType: 'number',
                value: i + 3, // 避免與之前的下注衝突
                position: 1
            };
            
            console.log(`\n發送下注 ${i}: 第1名 ${i+3}号 $${betAmount}`);
            
            try {
                const response = await axios.post(`${GAME_URL}/api/bet`, betData);
                console.log(`✅ 下注 ${i} 成功，返回餘額: $${response.data.balance}`);
            } catch (error) {
                console.error(`❌ 下注 ${i} 失敗:`, error.response?.data?.message || error.message);
            }
            
            // 等待500ms確保請求完全處理
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 3. 獲取最終餘額
        const finalBalanceResponse = await axios.get(`${GAME_URL}/api/balance?username=${TEST_USERNAME}`);
        const finalBalance = parseFloat(finalBalanceResponse.data.balance);
        console.log(`\n最終餘額: $${finalBalance}`);
        console.log(`總扣除: $${initialBalance - finalBalance}`);
        
    } catch (error) {
        console.error('順序測試失敗:', error.message);
    }
}

// 執行測試
if (require.main === module) {
    (async () => {
        await testBalanceDeduction();
        await testSequentialBets();
    })();
}

module.exports = { testBalanceDeduction, testSequentialBets }; 