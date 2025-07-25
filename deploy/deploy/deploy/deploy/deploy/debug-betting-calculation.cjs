const axios = require('axios');

// 測試配置
const config = {
    gameUrl: 'http://localhost:3001',
    agentUrl: 'http://localhost:3002',
    username: 'test03' // 請替換為您的測試用戶名
};

// 工具函數：格式化金額
function formatMoney(amount) {
    return `$${parseFloat(amount).toFixed(2)}`;
}

// 工具函數：等待指定毫秒
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. 獲取用戶餘額
async function getBalance() {
    try {
        const response = await axios.get(`${config.agentUrl}/api/agent/member/balance/${config.username}`);
        return response.data.success ? parseFloat(response.data.balance) : null;
    } catch (error) {
        console.error('獲取餘額失敗:', error.message);
        return null;
    }
}

// 2. 獲取今日盈虧
async function getDailyProfit() {
    try {
        const response = await axios.get(`${config.gameUrl}/api/daily-profit/${config.username}`);
        return response.data.success ? response.data : null;
    } catch (error) {
        console.error('獲取今日盈虧失敗:', error.message);
        return null;
    }
}

// 3. 獲取當前期數
async function getCurrentPeriod() {
    try {
        const response = await axios.get(`${config.gameUrl}/api/current-period`);
        return response.data.success ? response.data.period : null;
    } catch (error) {
        console.error('獲取當前期數失敗:', error.message);
        return null;
    }
}

// 4. 下注函數
async function placeBet(betType, position, value, amount) {
    try {
        const betData = {
            username: config.username,
            betType: betType,
            position: position,
            value: value,
            amount: amount
        };
        
        console.log(`🎯 下注: ${betType} 第${position}名 ${value}號 ${formatMoney(amount)}`);
        
        const response = await axios.post(`${config.gameUrl}/api/bet`, betData);
        
        if (response.data.success) {
            console.log(`✅ 下注成功，返回餘額: ${formatMoney(response.data.balance)}`);
            return {
                success: true,
                balance: parseFloat(response.data.balance),
                betId: response.data.betId
            };
        } else {
            console.log(`❌ 下注失敗: ${response.data.message}`);
            return { success: false, message: response.data.message };
        }
    } catch (error) {
        console.error(`❌ 下注請求失敗:`, error.response?.data?.message || error.message);
        return { success: false, error: error.message };
    }
}

// 5. 獲取用戶的下注記錄
async function getBetRecords() {
    try {
        const response = await axios.get(`${config.gameUrl}/api/bet-records/${config.username}`);
        return response.data.success ? response.data.records : [];
    } catch (error) {
        console.error('獲取下注記錄失敗:', error.message);
        return [];
    }
}

// 6. 獲取開獎歷史
async function getDrawHistory(limit = 5) {
    try {
        const response = await axios.get(`${config.gameUrl}/api/history?limit=${limit}`);
        return response.data.success ? response.data.data : [];
    } catch (error) {
        console.error('獲取開獎歷史失敗:', error.message);
        return [];
    }
}

// 7. 計算預期獎金（手動計算）
function calculateExpectedWin(betAmount, odds, winCount) {
    const totalBetAmount = betAmount * 8; // 8碼每碼100元
    const totalWinAmount = betAmount * odds * winCount; // 中獎數 * 100 * 賠率
    const netProfit = totalWinAmount - totalBetAmount;
    
    return {
        totalBetAmount,
        totalWinAmount,
        netProfit,
        expectedBalance: netProfit // 相對於下注前的變化
    };
}

// 主測試函數
async function main() {
    console.log('🔍 開始調試下注計算問題\n');
    
    try {
        // 1. 獲取初始狀態
        console.log('📊 === 初始狀態檢查 ===');
        const initialBalance = await getBalance();
        const initialProfit = await getDailyProfit();
        const currentPeriod = await getCurrentPeriod();
        
        console.log(`用戶: ${config.username}`);
        console.log(`當前期數: ${currentPeriod}`);
        console.log(`當前餘額: ${formatMoney(initialBalance)}`);
        console.log(`今日盈虧: ${formatMoney(initialProfit?.profit || 0)}`);
        console.log(`今日總投注: ${formatMoney(initialProfit?.totalBet || 0)}`);
        console.log(`今日總贏額: ${formatMoney(initialProfit?.totalWin || 0)}\n`);
        
        // 2. 檢查最近的下注記錄
        console.log('📋 === 最近下注記錄 ===');
        const recentBets = await getBetRecords();
        const recentSettledBets = recentBets.filter(bet => bet.settled).slice(0, 10);
        
        console.log(`總下注記錄: ${recentBets.length} 筆`);
        console.log(`已結算記錄: ${recentSettledBets.length} 筆`);
        
        if (recentSettledBets.length > 0) {
            console.log('\n最近10筆已結算記錄:');
            recentSettledBets.forEach((bet, index) => {
                const result = bet.win ? '✅中獎' : '❌未中';
                const winAmount = bet.win_amount || 0;
                const netProfit = bet.win ? (winAmount - bet.amount) : -bet.amount;
                
                console.log(`${index + 1}. 期數${bet.period} ${bet.bet_type} ${bet.position || ''}名 ${bet.bet_value} ` +
                          `投注${formatMoney(bet.amount)} 賠率${bet.odds} ${result} ` +
                          `獎金${formatMoney(winAmount)} 盈虧${formatMoney(netProfit)}`);
            });
        }
        
        // 3. 檢查最近開獎歷史
        console.log('\n🎲 === 最近開獎歷史 ===');
        const drawHistory = await getDrawHistory(5);
        
        if (drawHistory.length > 0) {
            console.log('最近5期開獎:');
            drawHistory.forEach((draw, index) => {
                const result = draw.result ? JSON.parse(draw.result) : [];
                console.log(`${index + 1}. 期數${draw.period}: [${result.join(', ')}]`);
            });
        }
        
        // 4. 分析問題
        console.log('\n🔍 === 問題分析 ===');
        
        // 根據您的描述：下注8碼一碼100元共800，中獎後應該增加260，但實際只增加89
        // 這意味著：
        // - 總下注: 800元
        // - 預期淨盈虧: +260元 (意味著獲得獎金1060元)
        // - 實際淨盈虧: +89元 (意味著獲得獎金889元)
        // - 差距: 171元
        
        console.log('根據您的描述分析:');
        console.log('- 下注: 8碼 × 100元 = 800元');
        console.log('- 預期獎金: 1060元 (淨盈虧+260元)');
        console.log('- 實際獎金: 889元 (淨盈虧+89元)');
        console.log('- 差距: 171元');
        console.log('');
        
        // 檢查可能的賠率問題
        console.log('可能原因分析:');
        console.log('1. 賠率計算錯誤 - 檢查是否使用了正確的單號賠率');
        console.log('2. 中獎數量計算錯誤 - 可能部分號碼被重複計算或漏算');
        console.log('3. 退水/手續費扣除 - 檢查是否有額外的費用扣除');
        console.log('4. 結算邏輯錯誤 - 檢查calculateWinAmount函數');
        
        // 5. 建議的單號賠率檢查
        console.log('\n⚙️ === 賠率配置檢查 ===');
        
        // 根據前端代碼，單號賠率應該是：
        // A盤: 10.0 × (1 - 0.011) = 9.89
        // D盤: 10.0 × (1 - 0.041) = 9.59
        
        console.log('標準賠率配置:');
        console.log('- A盤單號賠率: 9.89 (10.0 × 0.989)');
        console.log('- D盤單號賠率: 9.59 (10.0 × 0.959)');
        console.log('');
        
        // 計算正確的預期結果
        console.log('正確計算 (假設使用D盤賠率9.59):');
        console.log('- 如果8碼全中: 800 × 9.59 = 7672元總獎金, 淨盈虧: +6872元');
        console.log('- 如果1碼中: 100 × 9.59 = 959元總獎金, 淨盈虧: +159元');
        console.log('- 如果2碼中: 200 × 9.59 = 1918元總獎金, 淨盈虧: +1118元');
        console.log('- 如果3碼中: 300 × 9.59 = 2877元總獎金, 淨盈虧: +2077元');
        
        console.log('\n根據您的實際結果(+89元)分析:');
        console.log('- 實際獲得獎金: 889元');
        console.log('- 如果賠率是9.59: 889 ÷ 9.59 ≈ 0.93碼 (不合理)');
        console.log('- 如果賠率是8.9: 889 ÷ 8.9 = 1碼 (可能)');
        console.log('- 建議檢查: 1) 實際中獎數量 2) 使用的賠率 3) 是否有額外扣費');
        
    } catch (error) {
        console.error('測試過程中發生錯誤:', error);
    }
}

// 運行測試
main().catch(console.error);
