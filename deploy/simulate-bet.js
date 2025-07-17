import fetch from 'node-fetch';

async function simulateBet() {
    try {
        // 使用生產環境 API
        const apiUrl = 'https://bet-game.onrender.com';
        
        console.log('=== 模擬下注測試 ===\n');
        
        // 1. 登入
        console.log('1. 登入 justin111...');
        const loginResponse = await fetch(`${apiUrl}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'justin111',
                password: 'aaaa00'
            })
        });
        
        const loginData = await loginResponse.json();
        if (!loginData.success) {
            console.error('登入失敗:', loginData.message);
            return;
        }
        
        const token = loginData.token;
        console.log('✅ 登入成功');
        console.log(`餘額: ${loginData.user.balance}`);
        
        // 2. 獲取遊戲狀態
        console.log('\n2. 獲取遊戲狀態...');
        const gameStateResponse = await fetch(`${apiUrl}/api/game-state?username=justin111`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const gameState = await gameStateResponse.json();
        console.log(`當前期號: ${gameState.currentPeriod}`);
        console.log(`遊戲狀態: ${gameState.gameStatus}`);
        console.log(`倒數時間: ${gameState.countdownTime}秒`);
        
        if (gameState.gameStatus !== 'waiting') {
            console.log('⏳ 等待下一期開始...');
            return;
        }
        
        // 3. 下注
        console.log('\n3. 進行下注...');
        const betData = {
            username: 'justin111',
            bets: [{
                type: 'champion',
                value: 'big',
                amount: 1000
            }]
        };
        
        const betResponse = await fetch(`${apiUrl}/api/place-bet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(betData)
        });
        
        const betResult = await betResponse.json();
        if (betResult.success) {
            console.log('✅ 下注成功！');
            console.log(`下注金額: ${betData.bets[0].amount}`);
            console.log(`下注類型: ${betData.bets[0].type}/${betData.bets[0].value}`);
            console.log(`剩餘餘額: ${betResult.balance}`);
            console.log('\n請等待開獎和結算，退水將在結算後自動處理。');
        } else {
            console.error('❌ 下注失敗:', betResult.message);
        }
        
        // 4. 監控結算和退水
        console.log('\n4. 開始監控結算和退水（60秒）...');
        const startTime = Date.now();
        const monitorDuration = 60000; // 60秒
        
        const checkInterval = setInterval(async () => {
            try {
                // 檢查最新的退水記錄
                const checkResponse = await fetch(`${apiUrl}/api/agent/recent-transactions`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (checkResponse.ok) {
                    const transactions = await checkResponse.json();
                    const rebates = transactions.filter(t => t.transaction_type === 'rebate');
                    if (rebates.length > 0) {
                        console.log('\n💰 發現退水記錄！');
                        clearInterval(checkInterval);
                    }
                }
                
                if (Date.now() - startTime > monitorDuration) {
                    console.log('\n監控時間結束');
                    clearInterval(checkInterval);
                }
            } catch (error) {
                // 忽略錯誤繼續監控
            }
        }, 3000);
        
    } catch (error) {
        console.error('模擬下注錯誤:', error);
    }
}

simulateBet();