import axios from 'axios';

const API_BASE = 'http://localhost:3000';
let authToken = null;
let initialBalance = null;
let finalBalance = null;

// 延遲函數
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 格式化時間
const formatTime = () => new Date().toLocaleTimeString('zh-TW');

// 步驟 1: 登入
async function login() {
    console.log(`\n[${formatTime()}] ========== 步驟 1: 登入 ==========`);
    try {
        const response = await axios.post(`${API_BASE}/api/member/login`, {
            username: 'justin111',
            password: 'aaaa00'
        });
        
        authToken = response.data.sessionToken;
        initialBalance = response.data.member.balance;
        
        console.log('登入成功！');
        console.log(`用戶名: ${response.data.member.username}`);
        console.log(`初始餘額: $${initialBalance}`);
        console.log(`會員ID: ${response.data.member.id}`);
        console.log(`Token: ${authToken.substring(0, 20)}...`);
        
        return response.data;
    } catch (error) {
        console.error('登入失敗:', error.response?.data || error.message);
        throw error;
    }
}

// 步驟 2: 獲取當前期號
async function getCurrentPeriod() {
    console.log(`\n[${formatTime()}] ========== 步驟 2: 獲取當前期號 ==========`);
    try {
        const response = await axios.get(`${API_BASE}/api/game-data`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const gameData = response.data.gameData;
        console.log(`當前期號: ${gameData.currentPeriod}`);
        console.log(`期號狀態: ${gameData.status}`);
        console.log(`倒計時: ${gameData.countdownSeconds}秒`);
        if (gameData.lastResult) {
            console.log(`上期結果: ${gameData.lastResult}`);
        }
        console.log(`盤口類型: ${response.data.marketType}`);
        
        return {
            period: gameData.currentPeriod,
            status: gameData.status,
            countdown: gameData.countdownSeconds
        };
    } catch (error) {
        console.error('獲取期號失敗:', error.response?.data || error.message);
        throw error;
    }
}

// 步驟 3: 下注冠軍 1-9 號
async function placeBets(period) {
    console.log(`\n[${formatTime()}] ========== 步驟 3: 下注冠軍 1-9 號 ==========`);
    
    const betResults = [];
    
    // 分別下注每個號碼
    for (let i = 1; i <= 9; i++) {
        console.log(`\n下注冠軍 ${i}號: $100`);
        
        try {
            const response = await axios.post(`${API_BASE}/api/bet`, {
                username: 'justin111',
                amount: 100,
                betType: 'champion',
                value: i.toString()
                // 不傳遞 position 參數
            }, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            
            console.log(`  ✓ 下注成功: 訂單號 ${response.data.betId}, 餘額 ${response.data.balance}`);
            betResults.push(response.data);
            
        } catch (error) {
            console.error(`  ✗ 下注失敗:`, error.response?.data || error.message);
            throw error;
        }
    }
    
    console.log(`\n總下注金額: $${betResults.length * 100}`);
    console.log(`成功下注數量: ${betResults.length}`);
    
    return betResults;
}

// 步驟 4: 記錄餘額變化
async function checkBalance() {
    console.log(`\n[${formatTime()}] ========== 步驟 4: 檢查餘額 ==========`);
    try {
        const response = await axios.get(`${API_BASE}/api/balance?username=justin111`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const currentBalance = response.data.balance;
        console.log(`當前餘額: $${currentBalance}`);
        console.log(`餘額變化: $${currentBalance - initialBalance}`);
        
        return currentBalance;
    } catch (error) {
        console.error('檢查餘額失敗:', error.response?.data || error.message);
        throw error;
    }
}

// 步驟 5: 等待開獎
async function waitForDraw(period) {
    console.log(`\n[${formatTime()}] ========== 步驟 5: 等待開獎 ==========`);
    console.log(`等待期號 ${period} 開獎...`);
    
    let attempts = 0;
    const maxAttempts = 120; // 最多等待 120 秒
    
    while (attempts < maxAttempts) {
        try {
            const response = await axios.get(`${API_BASE}/api/history`, {
                headers: { 'Authorization': `Bearer ${authToken}` },
                params: { limit: 10 }
            });
            
            // 查找當前期號的開獎結果
            const currentDraw = response.data.find(item => item.period === period);
            
            if (currentDraw && currentDraw.result) {
                console.log(`\n開獎成功！`);
                console.log(`開獎時間: ${new Date(currentDraw.draw_time).toLocaleString('zh-TW')}`);
                console.log(`開獎結果: ${currentDraw.result}`);
                
                // 解析結果
                const numbers = currentDraw.result.split(',').map(n => parseInt(n));
                console.log(`\n名次結果:`);
                const positions = ['冠軍', '亞軍', '季軍', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'];
                numbers.forEach((num, index) => {
                    console.log(`  ${positions[index]}: ${num}號車`);
                });
                
                console.log(`\n冠軍號碼: ${numbers[0]}號車`);
                
                return currentDraw;
            }
        } catch (error) {
            // 如果還沒開獎，繼續等待
        }
        
        attempts++;
        process.stdout.write('.');
        await delay(1000);
    }
    
    console.log('\n等待開獎超時');
    return null;
}

// 步驟 6: 檢查結算結果
async function checkSettlement(period) {
    console.log(`\n[${formatTime()}] ========== 步驟 6: 檢查結算結果 ==========`);
    
    // 等待結算完成
    console.log('等待結算完成...');
    await delay(3000);
    
    // 檢查最終餘額
    try {
        const response = await axios.get(`${API_BASE}/api/balance?username=justin111`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        finalBalance = response.data.balance;
        console.log(`\n結算後餘額: $${finalBalance}`);
        console.log(`總餘額變化: $${finalBalance - initialBalance}`);
        
        // 獲取下注記錄詳情
        const historyResponse = await axios.get(`${API_BASE}/api/bet-history`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
            params: { period: period }
        });
        
        if (historyResponse.data && historyResponse.data.length > 0) {
            console.log(`\n下注結算詳情:`);
            let totalBet = 0;
            let totalWin = 0;
            
            historyResponse.data.forEach(bet => {
                const status = bet.status === 'won' ? '中獎' : bet.status === 'lost' ? '未中' : '待開獎';
                console.log(`  - ${bet.bet_type} ${bet.bet_content}號: $${bet.amount} - ${status}`);
                if (bet.win_amount) {
                    console.log(`    中獎金額: $${bet.win_amount}`);
                }
                totalBet += bet.amount;
                totalWin += bet.win_amount || 0;
            });
            
            console.log(`\n統計:`);
            console.log(`  總下注: $${totalBet}`);
            console.log(`  總中獎: $${totalWin}`);
            console.log(`  淨盈虧: $${totalWin - totalBet}`);
        }
        
        return finalBalance;
    } catch (error) {
        console.error('檢查結算失敗:', error.response?.data || error.message);
        throw error;
    }
}

// 主測試流程
async function runTest() {
    console.log('========== 開始測試下注功能 ==========');
    console.log(`測試時間: ${new Date().toLocaleString('zh-TW')}`);
    console.log(`API 端點: ${API_BASE}`);
    
    try {
        // 步驟 1: 登入
        await login();
        
        // 步驟 2: 獲取當前期號
        const periodData = await getCurrentPeriod();
        
        if (periodData.status !== 'betting') {
            console.log('\n當前期號不接受投注，狀態:', periodData.status);
            return;
        }
        
        // 步驟 3: 下注
        const betResult = await placeBets(periodData.period);
        
        // 步驟 4: 記錄下注後餘額
        await checkBalance();
        
        // 步驟 5: 等待開獎
        const drawResult = await waitForDraw(periodData.period);
        
        if (drawResult) {
            // 步驟 6: 檢查結算
            await checkSettlement(periodData.period);
            
            console.log('\n========== 測試完成 ==========');
            console.log(`初始餘額: $${initialBalance}`);
            console.log(`最終餘額: $${finalBalance}`);
            console.log(`總變化: $${finalBalance - initialBalance}`);
        }
        
    } catch (error) {
        console.error('\n測試失敗:', error.message);
    }
}

// 執行測試
runTest();