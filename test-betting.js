// test-betting.js - 測試下注功能
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
        
        const token = loginData.token;
        console.log('✅ 登入成功');
        console.log('登入資料:', JSON.stringify(loginData, null, 2));
        const initialBalance = parseFloat(loginData.balance || loginData.user?.balance || 0);
        
        // 2. 獲取當前期號
        console.log('\n2️⃣ 獲取當前期號...');
        const currentRes = await fetch(`${API_URL}/api/current-game`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const currentData = await currentRes.json();
        const period = currentData.current.period;
        console.log('當前期號:', period);
        console.log('剩餘時間:', currentData.current.remainingTime, '秒');
        
        // 3. 準備下注數據 - 冠軍 1-9 號各 100 元
        console.log('\n3️⃣ 準備下注：冠軍 1-9 號，每號 100 元');
        const bets = [];
        for (let i = 1; i <= 9; i++) {
            bets.push({
                position: 'first',
                bet_type: i.toString(),
                amount: 100
            });
        }
        
        console.log('下注明細:');
        bets.forEach(bet => {
            console.log(`  - 冠軍 ${bet.bet_type} 號: ${bet.amount} 元`);
        });
        console.log('總下注金額:', bets.length * 100, '元');
        
        // 4. 執行下注
        console.log('\n4️⃣ 執行下注...');
        const betRes = await fetch(`${API_URL}/api/bet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                period: period,
                bets: bets
            })
        });
        
        const betData = await betRes.json();
        if (!betData.success) {
            console.error('❌ 下注失敗:', betData.message);
            return;
        }
        
        console.log('✅ 下注成功');
        console.log('下注後餘額:', betData.balance);
        const afterBetBalance = parseFloat(betData.balance);
        console.log('餘額變化:', afterBetBalance - initialBalance);
        
        // 5. 等待開獎
        console.log('\n5️⃣ 等待開獎...');
        const waitTime = currentData.current.remainingTime + 5;
        console.log(`等待 ${waitTime} 秒...`);
        
        for (let i = waitTime; i > 0; i--) {
            process.stdout.write(`\r剩餘 ${i} 秒...`);
            await sleep(1000);
        }
        console.log('\n');
        
        // 6. 獲取開獎結果
        console.log('6️⃣ 獲取開獎結果...');
        const resultRes = await fetch(`${API_URL}/api/game-result/${period}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const resultData = await resultRes.json();
        if (resultData.success) {
            console.log('開獎結果:', resultData.result);
            console.log('冠軍號碼:', resultData.result[0]);
        }
        
        // 7. 等待結算完成
        console.log('\n7️⃣ 等待結算完成...');
        await sleep(3000);
        
        // 8. 獲取最新餘額
        console.log('\n8️⃣ 獲取結算後餘額...');
        const finalRes = await fetch(`${API_URL}/api/user-info`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const finalData = await finalRes.json();
        const finalBalance = parseFloat(finalData.user.balance);
        
        console.log('\n📊 結算結果:');
        console.log('初始餘額:', initialBalance);
        console.log('下注後餘額:', afterBetBalance);
        console.log('結算後餘額:', finalBalance);
        console.log('總變化:', finalBalance - initialBalance);
        
        // 9. 分析結果
        console.log('\n📈 結果分析:');
        const totalBet = 900;
        const winNumber = resultData.result ? resultData.result[0] : null;
        
        if (winNumber && winNumber >= 1 && winNumber <= 9) {
            console.log(`✅ 中獎號碼: ${winNumber}`);
            console.log('理論計算:');
            console.log(`  - 下注: -${totalBet}`);
            console.log(`  - 中獎: +${100 * 9.89} (100 × 9.89倍)`);
            console.log(`  - 退水: +${totalBet * 0.011} (900 × 1.1%)`);
            const expectedProfit = (100 * 9.89) - totalBet + (totalBet * 0.011);
            console.log(`  - 預期淨利: ${expectedProfit.toFixed(2)}`);
            console.log(`  - 實際淨利: ${(finalBalance - initialBalance).toFixed(2)}`);
            const difference = (finalBalance - initialBalance) - expectedProfit;
            console.log(`  - 差異: ${difference.toFixed(2)}`);
        } else {
            console.log('❌ 未中獎 (冠軍號碼不在 1-9)');
            console.log('理論計算:');
            console.log(`  - 下注: -${totalBet}`);
            console.log(`  - 退水: +${totalBet * 0.011} (900 × 1.1%)`);
            const expectedLoss = -totalBet + (totalBet * 0.011);
            console.log(`  - 預期虧損: ${expectedLoss.toFixed(2)}`);
            console.log(`  - 實際變化: ${(finalBalance - initialBalance).toFixed(2)}`);
        }
        
        // 10. 查看下注記錄
        console.log('\n🔍 查看下注記錄...');
        const historyRes = await fetch(`${API_URL}/api/bet-history?limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const historyData = await historyRes.json();
        if (historyData.success && historyData.history.length > 0) {
            const recentBets = historyData.history.filter(bet => bet.period === period);
            console.log(`\n期號 ${period} 的下注記錄:`);
            recentBets.forEach(bet => {
                console.log(`  - ${bet.position} ${bet.bet_type}: ${bet.amount} 元, 狀態: ${bet.win ? '中獎' : '未中獎'}, 中獎金額: ${bet.win_amount || 0}`);
            });
        }
        
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