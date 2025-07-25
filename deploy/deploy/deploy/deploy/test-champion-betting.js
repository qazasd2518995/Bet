// test-champion-betting.js - 測試冠軍位置下注
import fetch from 'node-fetch';
import db from './db/config.js';

const API_URL = 'http://localhost:3000';
const username = 'justin111';
const password = 'aaaa00';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getBalanceFromDB() {
    const result = await db.oneOrNone(`
        SELECT balance FROM members WHERE username = $1
    `, [username]);
    return result ? parseFloat(result.balance) : 0;
}

async function testChampionBetting() {
    console.log('🎲 開始測試冠軍位置下注...\n');
    
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
        
        // 從資料庫獲取準確餘額
        const initialBalance = await getBalanceFromDB();
        console.log('初始餘額:', initialBalance);
        
        // 2. 獲取遊戲資料
        console.log('\n2️⃣ 獲取遊戲資料...');
        const gameDataRes = await fetch(`${API_URL}/api/game-data?username=${username}`);
        const gameData = await gameDataRes.json();
        
        console.log('當前期號:', gameData.gameData.currentPeriod);
        console.log('剩餘時間:', gameData.gameData.countdownSeconds, '秒');
        let period = gameData.gameData.currentPeriod;
        
        // 如果時間太短，等待下一期
        if (gameData.gameData.countdownSeconds < 15) {
            console.log('時間太短，等待下一期...');
            await sleep((gameData.gameData.countdownSeconds + 5) * 1000);
            // 重新獲取
            const newGameRes = await fetch(`${API_URL}/api/game-data?username=${username}`);
            const newGameData = await newGameRes.json();
            period = newGameData.gameData.currentPeriod;
            console.log('新期號:', period);
        }
        
        // 3. 執行下注 - 冠軍 1-9 號各 100 元
        console.log('\n3️⃣ 開始下注冠軍 1-9 號，每號 100 元...');
        const betResults = [];
        
        for (let i = 1; i <= 9; i++) {
            console.log(`\n下注冠軍 ${i} 號...`);
            
            const betRes = await fetch(`${API_URL}/api/bet`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username: username,
                    amount: 100,
                    betType: 'number',
                    value: i.toString(),
                    position: 'champion'
                })
            });
            
            const betData = await betRes.json();
            if (!betData.success) {
                console.error(`❌ 下注失敗: ${betData.message}`);
                continue;
            }
            
            console.log(`✅ 下注成功`);
            betResults.push({
                number: i,
                success: true,
                balance: betData.balance
            });
            
            // 短暫延遲避免太快
            await sleep(100);
        }
        
        // 獲取下注後餘額
        const afterBetBalance = await getBalanceFromDB();
        console.log('\n下注完成');
        console.log('下注後餘額:', afterBetBalance);
        console.log('餘額變化:', afterBetBalance - initialBalance);
        
        // 4. 等待開獎
        console.log('\n4️⃣ 等待開獎...');
        const waitTime = 65; // 等待65秒確保開獎完成
        console.log(`等待 ${waitTime} 秒...`);
        
        for (let i = waitTime; i > 0; i--) {
            process.stdout.write(`\r剩餘 ${i} 秒...`);
            await sleep(1000);
        }
        console.log('\n');
        
        // 5. 獲取開獎結果
        console.log('5️⃣ 檢查開獎結果...');
        const historyRes = await fetch(`${API_URL}/api/history?limit=1`);
        const historyData = await historyRes.json();
        
        let winNumber = null;
        if (historyData.history && historyData.history.length > 0) {
            const latestResult = historyData.history[0];
            if (latestResult.period === period) {
                winNumber = latestResult.result[0]; // 冠軍號碼
                console.log('開獎結果:', latestResult.result);
                console.log('冠軍號碼:', winNumber);
            }
        }
        
        // 6. 等待結算完成並獲取最終餘額
        console.log('\n6️⃣ 等待結算完成...');
        await sleep(5000);
        
        const finalBalance = await getBalanceFromDB();
        
        // 7. 分析結果
        console.log('\n📊 結算結果:');
        console.log('初始餘額:', initialBalance);
        console.log('下注後餘額:', afterBetBalance);
        console.log('結算後餘額:', finalBalance);
        console.log('總變化:', finalBalance - initialBalance);
        
        console.log('\n📈 結果分析:');
        const totalBet = 900;
        
        if (winNumber && winNumber >= 1 && winNumber <= 9) {
            console.log(`✅ 中獎號碼: ${winNumber}`);
            console.log('\n理論計算:');
            console.log(`  - 下注總額: ${totalBet} 元`);
            console.log(`  - 中獎: 100 × 9.89 = 989 元`);
            console.log(`  - 退水: ${totalBet} × 1.1% = ${(totalBet * 0.011).toFixed(2)} 元`);
            console.log(`  - 輸掉: 800 元 (其他8個號碼)`);
            const expectedProfit = 989 - totalBet + (totalBet * 0.011);
            console.log(`  - 預期淨利: ${expectedProfit.toFixed(2)} 元`);
            console.log(`  - 實際變化: ${(finalBalance - initialBalance).toFixed(2)} 元`);
            const difference = (finalBalance - initialBalance) - expectedProfit;
            console.log(`  - 差異: ${difference.toFixed(2)} 元`);
            
            if (Math.abs(difference) > 1) {
                console.log('\n⚠️ 發現異常：實際變化與預期不符！');
            }
        } else {
            console.log('❌ 未中獎 (冠軍號碼不在 1-9 或是 10 號)');
            console.log('\n理論計算:');
            console.log(`  - 下注總額: ${totalBet} 元`);
            console.log(`  - 退水: ${totalBet} × 1.1% = ${(totalBet * 0.011).toFixed(2)} 元`);
            const expectedLoss = -totalBet + (totalBet * 0.011);
            console.log(`  - 預期虧損: ${expectedLoss.toFixed(2)} 元`);
            console.log(`  - 實際變化: ${(finalBalance - initialBalance).toFixed(2)} 元`);
            const difference = (finalBalance - initialBalance) - expectedLoss;
            console.log(`  - 差異: ${difference.toFixed(2)} 元`);
            
            if (Math.abs(difference) > 1) {
                console.log('\n⚠️ 發現異常：實際變化與預期不符！');
            }
        }
        
        // 8. 查看交易記錄
        console.log('\n📋 查看最近交易記錄...');
        const transactions = await db.manyOrNone(`
            SELECT 
                tr.transaction_type,
                tr.amount,
                tr.balance_before,
                tr.balance_after,
                tr.description,
                tr.created_at
            FROM transaction_records tr
            JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
            WHERE m.username = $1
            AND tr.created_at > NOW() - INTERVAL '10 minutes'
            ORDER BY tr.created_at DESC
            LIMIT 20
        `, [username]);
        
        console.log('\n最近交易:');
        transactions.forEach(tx => {
            console.log(`  ${tx.created_at.toLocaleTimeString()}: ${tx.transaction_type} ${tx.amount}, ${tx.balance_before} → ${tx.balance_after}, ${tx.description}`);
        });
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error);
    }
}

// 執行測試
testChampionBetting()
    .then(() => {
        console.log('\n測試完成');
        process.exit(0);
    })
    .catch(error => {
        console.error('執行失敗:', error);
        process.exit(1);
    });