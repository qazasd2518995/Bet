// 測試批量下注功能
const fetch = require('node-fetch');

const AGENT_API = 'http://localhost:3003/api/agent';
const GAME_API = 'http://localhost:3000/api';

// 測試配置
const testConfig = {
    username: 'titi',  // 測試會員
    bets: [
        { amount: 100, betType: 'champion', value: 'big', position: null },
        { amount: 100, betType: 'champion', value: 'small', position: null },
        { amount: 100, betType: 'champion', value: 'odd', position: null }
    ]
};

async function testBatchBetting() {
    console.log('=== 測試批量下注功能 ===\n');
    
    try {
        // 1. 獲取初始餘額
        console.log('1. 獲取初始餘額...');
        const balanceRes = await fetch(`${AGENT_API}/member/balance/${testConfig.username}`);
        const balanceData = await balanceRes.json();
        
        if (!balanceData.success) {
            throw new Error(`無法獲取餘額: ${balanceData.message}`);
        }
        
        const initialBalance = parseFloat(balanceData.balance);
        console.log(`初始餘額: $${initialBalance}`);
        
        // 2. 計算總下注金額
        const totalAmount = testConfig.bets.reduce((sum, bet) => sum + bet.amount, 0);
        console.log(`\n2. 準備下注 ${testConfig.bets.length} 筆，總金額: $${totalAmount}`);
        
        // 3. 測試批量扣款
        console.log('\n3. 測試批量扣款...');
        const deductRes = await fetch(`${AGENT_API}/batch-deduct-member-balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: testConfig.username,
                bets: testConfig.bets,
                reason: `測試批量下注${testConfig.bets.length}筆`
            })
        });
        
        const deductData = await deductRes.json();
        console.log('批量扣款結果:', deductData);
        
        if (deductData.success) {
            console.log(`✅ 批量扣款成功！`);
            console.log(`扣除金額: $${deductData.deductedAmount}`);
            console.log(`新餘額: $${deductData.balance}`);
            console.log(`處理數量: ${deductData.processedCount} 筆`);
            
            // 驗證扣款金額
            const expectedBalance = initialBalance - totalAmount;
            if (Math.abs(deductData.balance - expectedBalance) < 0.01) {
                console.log('✅ 餘額計算正確');
            } else {
                console.log(`❌ 餘額計算錯誤！預期: $${expectedBalance}, 實際: $${deductData.balance}`);
            }
        } else {
            console.log('❌ 批量扣款失敗:', deductData.message);
            
            // 測試降級到單筆扣款
            console.log('\n4. 測試降級到單筆扣款...');
            for (let i = 0; i < testConfig.bets.length; i++) {
                const bet = testConfig.bets[i];
                console.log(`\n下注 ${i + 1}/${testConfig.bets.length}: ${bet.betType} ${bet.value} $${bet.amount}`);
                
                const betRes = await fetch(`${GAME_API}/bet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: testConfig.username,
                        amount: bet.amount,
                        betType: bet.betType,
                        value: bet.value,
                        position: bet.position
                    })
                });
                
                const betData = await betRes.json();
                if (betData.success) {
                    console.log(`✅ 下注成功，新餘額: $${betData.balance}`);
                } else {
                    console.log(`❌ 下注失敗: ${betData.message}`);
                }
            }
        }
        
        // 5. 最終餘額驗證
        console.log('\n5. 最終餘額驗證...');
        const finalBalanceRes = await fetch(`${AGENT_API}/member/balance/${testConfig.username}`);
        const finalBalanceData = await finalBalanceRes.json();
        
        if (finalBalanceData.success) {
            const finalBalance = parseFloat(finalBalanceData.balance);
            console.log(`最終餘額: $${finalBalance}`);
            console.log(`總扣除: $${initialBalance - finalBalance}`);
        }
        
    } catch (error) {
        console.error('測試失敗:', error);
    }
}

// 執行測試
testBatchBetting(); 