// test-betting-web.js - 模擬網頁界面測試下注
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000';
const username = 'justin111';
const password = 'aaaa00';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBetting() {
    console.log('🎲 開始測試下注功能...\n');
    
    try {
        // 1. 登入
        console.log('1️⃣ 登入用戶:', username);
        const loginRes = await fetch(`${API_URL}/api/member/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const loginData = await loginRes.json();
        if (!loginData.success) {
            console.error('❌ 登入失敗:', loginData.message);
            return;
        }
        
        const sessionToken = loginData.sessionToken;
        console.log('✅ 登入成功');
        console.log('初始餘額:', loginData.member.balance);
        const initialBalance = parseFloat(loginData.member.balance);
        
        // 2. 獲取遊戲資料
        console.log('\n2️⃣ 獲取遊戲資料...');
        const gameDataRes = await fetch(`${API_URL}/api/game-data?username=${username}`, {
            headers: { 
                'Authorization': `Bearer ${sessionToken}`,
                'Accept': 'application/json'
            }
        });
        
        const gameData = await gameDataRes.json();
        console.log('當前期號:', gameData.gameData.currentPeriod);
        console.log('剩餘時間:', gameData.gameData.countdownSeconds, '秒');
        let period = gameData.gameData.currentPeriod;
        
        // 如果時間太短，等待下一期
        if (gameData.gameData.countdownSeconds < 10) {
            console.log('時間太短，等待下一期...');
            await sleep((gameData.gameData.countdownSeconds + 5) * 1000);
            // 重新獲取
            const newGameRes = await fetch(`${API_URL}/api/game-data?username=${username}`, {
                headers: { 
                    'Authorization': `Bearer ${sessionToken}`,
                    'Accept': 'application/json'
                }
            });
            const newGameData = await newGameRes.json();
            period = newGameData.gameData.currentPeriod;
            console.log('新期號:', period);
        }
        
        // 3. 準備下注數據 - 冠軍 1-9 號各 100 元
        console.log('\n3️⃣ 準備下注：冠軍 1-9 號，每號 100 元');
        const bets = [];
        for (let i = 1; i <= 9; i++) {
            bets.push({
                position: 'champion',
                betType: i.toString(),
                amount: 100
            });
        }
        
        console.log('下注明細:');
        bets.forEach(bet => {
            console.log(`  - 冠軍 ${bet.betType} 號: ${bet.amount} 元`);
        });
        console.log('總下注金額:', bets.length * 100, '元');
        
        // 4. 執行下注
        console.log('\n4️⃣ 執行下注...');
        const betRes = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                period: period,
                bets: bets,
                totalAmount: 900
            })
        });
        
        const betData = await betRes.json();
        if (!betData.success) {
            console.error('❌ 下注失敗:', betData.message);
            console.error('詳細錯誤:', JSON.stringify(betData, null, 2));
            return;
        }
        
        console.log('✅ 下注成功');
        console.log('下注後餘額:', betData.balance);
        const afterBetBalance = parseFloat(betData.balance);
        console.log('餘額變化:', afterBetBalance - initialBalance);
        
        // 5. 等待開獎
        console.log('\n5️⃣ 等待開獎...');
        const waitTime = gameData.gameData.countdownSeconds + 10;
        console.log(`等待 ${waitTime} 秒...`);
        
        for (let i = waitTime; i > 0; i--) {
            process.stdout.write(`\r剩餘 ${i} 秒...`);
            await sleep(1000);
        }
        console.log('\n');
        
        // 6. 獲取用戶資訊查看最新餘額
        console.log('6️⃣ 獲取結算後餘額...');
        const userInfoRes = await fetch(`${API_URL}/api/member/info`, {
            headers: { 
                'Authorization': `Bearer ${sessionToken}`,
                'Accept': 'application/json'
            }
        });
        
        const userInfo = await userInfoRes.json();
        const finalBalance = parseFloat(userInfo.member.balance);
        
        // 7. 獲取下注記錄
        console.log('\n7️⃣ 獲取下注記錄...');
        const betHistoryRes = await fetch(`${API_URL}/api/member/bet-history?period=${period}`, {
            headers: { 
                'Authorization': `Bearer ${sessionToken}`,
                'Accept': 'application/json'
            }
        });
        
        const betHistory = await betHistoryRes.json();
        
        console.log('\n📊 結算結果:');
        console.log('初始餘額:', initialBalance);
        console.log('下注後餘額:', afterBetBalance);
        console.log('結算後餘額:', finalBalance);
        console.log('總變化:', finalBalance - initialBalance);
        
        // 8. 分析結果
        console.log('\n📈 結果分析:');
        const totalBet = 900;
        let winCount = 0;
        let totalWinAmount = 0;
        
        if (betHistory.success && betHistory.bets) {
            console.log('\n下注記錄:');
            betHistory.bets.forEach(bet => {
                const status = bet.status === 'won' ? '✅ 中獎' : '❌ 未中';
                console.log(`  - 冠軍 ${bet.bet_type}: ${bet.amount} 元, ${status}, 中獎金額: ${bet.win_amount || 0}`);
                if (bet.status === 'won') {
                    winCount++;
                    totalWinAmount += parseFloat(bet.win_amount || 0);
                }
            });
        }
        
        console.log('\n計算分析:');
        console.log(`  - 總下注: ${totalBet} 元`);
        console.log(`  - 中獎注數: ${winCount}`);
        console.log(`  - 中獎金額: ${totalWinAmount} 元`);
        console.log(`  - 退水: ${(totalBet * 0.011).toFixed(2)} 元 (1.1%)`);
        
        const expectedChange = totalWinAmount - totalBet + (totalBet * 0.011);
        console.log(`  - 預期變化: ${expectedChange.toFixed(2)} 元`);
        console.log(`  - 實際變化: ${(finalBalance - initialBalance).toFixed(2)} 元`);
        console.log(`  - 差異: ${((finalBalance - initialBalance) - expectedChange).toFixed(2)} 元`);
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error);
    }
}

// 執行測試
testBetting()
    .then(() => {
        console.log('\n測試完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('執行失敗:', error);
        process.exit(1);
    });