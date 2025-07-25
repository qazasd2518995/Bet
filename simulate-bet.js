import fetch from 'node-fetch';

async function simulateBet() {
    try {
        // 使用生产环境 API
        const apiUrl = 'https://bet-game.onrender.com';
        
        console.log('=== 模拟下注测试 ===\n');
        
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
            console.error('登入失败:', loginData.message);
            return;
        }
        
        const token = loginData.token;
        console.log('✅ 登入成功');
        console.log(`余额: ${loginData.user.balance}`);
        
        // 2. 获取游戏状态
        console.log('\n2. 获取游戏状态...');
        const gameStateResponse = await fetch(`${apiUrl}/api/game-state?username=justin111`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const gameState = await gameStateResponse.json();
        console.log(`当前期号: ${gameState.currentPeriod}`);
        console.log(`游戏状态: ${gameState.gameStatus}`);
        console.log(`倒数时间: ${gameState.countdownTime}秒`);
        
        if (gameState.gameStatus !== 'waiting') {
            console.log('⏳ 等待下一期开始...');
            return;
        }
        
        // 3. 下注
        console.log('\n3. 进行下注...');
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
            console.log(`下注金额: ${betData.bets[0].amount}`);
            console.log(`下注类型: ${betData.bets[0].type}/${betData.bets[0].value}`);
            console.log(`剩余余额: ${betResult.balance}`);
            console.log('\n请等待开奖和结算，退水将在结算后自动处理。');
        } else {
            console.error('❌ 下注失败:', betResult.message);
        }
        
        // 4. 监控结算和退水
        console.log('\n4. 开始监控结算和退水（60秒）...');
        const startTime = Date.now();
        const monitorDuration = 60000; // 60秒
        
        const checkInterval = setInterval(async () => {
            try {
                // 检查最新的退水记录
                const checkResponse = await fetch(`${apiUrl}/api/agent/recent-transactions`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (checkResponse.ok) {
                    const transactions = await checkResponse.json();
                    const rebates = transactions.filter(t => t.transaction_type === 'rebate');
                    if (rebates.length > 0) {
                        console.log('\n💰 发现退水记录！');
                        clearInterval(checkInterval);
                    }
                }
                
                if (Date.now() - startTime > monitorDuration) {
                    console.log('\n监控时间结束');
                    clearInterval(checkInterval);
                }
            } catch (error) {
                // 忽略错误继续监控
            }
        }, 3000);
        
    } catch (error) {
        console.error('模拟下注错误:', error);
    }
}

simulateBet();