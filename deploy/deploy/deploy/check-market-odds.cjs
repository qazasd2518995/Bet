const axios = require('axios');

// 測試配置
const config = {
    agentUrl: 'http://localhost:3002'
};

async function checkMarketAndOdds() {
    console.log('🔍 檢查盤口配置和賠率設定\n');
    
    // 1. 檢查代理系統中的會員設定
    try {
        console.log('📋 === 檢查用戶盤口類型 ===');
        
        // 獲取會員列表，找到 test03 的盤口設定
        const response = await axios.get(`${config.agentUrl}/api/agent/members?page=1&limit=100`);
        
        if (response.data.success) {
            const members = response.data.data.list || [];
            const test03Member = members.find(m => m.username === 'test03');
            
            if (test03Member) {
                console.log(`找到用戶 test03:`);
                console.log(`- 用戶名: ${test03Member.username}`);
                console.log(`- 餘額: $${test03Member.balance}`);
                console.log(`- 盤口類型: ${test03Member.market_type || '未設定(預設D盤)'}`);
                console.log(`- 狀態: ${test03Member.status === 1 ? '正常' : '異常'}`);
                
                // 根據盤口類型計算預期賠率
                const marketType = test03Member.market_type || 'D';
                const expectedOdds = marketType === 'A' ? 9.89 : 9.59;
                
                console.log(`\n根據盤口類型 ${marketType} 的預期單號賠率: ${expectedOdds}`);
                
                // 計算您實際情況的分析
                console.log('\n🧮 === 您的實際情況分析 ===');
                console.log('下注情況: 8碼 × 100元 = 800元');
                console.log('結果: 餘額增加89元');
                console.log('推算獲得獎金: 800 + 89 = 889元');
                
                // 反推計算中獎情況
                console.log('\n反推分析:');
                const totalWinAmount = 889;
                const betPerCode = 100;
                
                if (expectedOdds === 9.59) {
                    const possibleWins = totalWinAmount / (betPerCode * expectedOdds);
                    console.log(`- 如果賠率是9.59: ${totalWinAmount} ÷ (100 × 9.59) = ${possibleWins.toFixed(2)}碼中獎`);
                }
                
                if (expectedOdds === 9.89) {
                    const possibleWins = totalWinAmount / (betPerCode * expectedOdds);
                    console.log(`- 如果賠率是9.89: ${totalWinAmount} ÷ (100 × 9.89) = ${possibleWins.toFixed(2)}碼中獎`);
                }
                
                // 檢查其他可能的賠率
                console.log('\n其他可能的賠率檢查:');
                for (let odds of [8.9, 9.0, 9.1, 9.2, 9.3, 9.4, 9.5]) {
                    const wins = totalWinAmount / (betPerCode * odds);
                    if (Math.abs(wins - Math.round(wins)) < 0.01) {
                        console.log(`- 賠率 ${odds}: ${wins.toFixed(0)}碼中獎 ✓`);
                    }
                }
                
            } else {
                console.log('❌ 未找到用戶 test03');
            }
        } else {
            console.log('❌ 無法獲取會員列表:', response.data.message);
        }
        
    } catch (error) {
        console.error('❌ 檢查用戶資訊失敗:', error.message);
    }
    
    // 2. 檢查後端賠率配置
    console.log('\n⚙️ === 後端賠率配置檢查 ===');
    console.log('根據 backend.js 中的 MARKET_CONFIG:');
    console.log('A盤配置:');
    console.log('- 退水: 1.1%');
    console.log('- 單號賠率: 10 × (1 - 0.011) = 9.89');
    console.log('- 兩面賠率: 2 × (1 - 0.011) = 1.978');
    
    console.log('\nD盤配置:');
    console.log('- 退水: 4.1%');
    console.log('- 單號賠率: 10 × (1 - 0.041) = 9.59');
    console.log('- 兩面賠率: 2 × (1 - 0.041) = 1.918');
    
    // 3. 檢查可能的問題
    console.log('\n🔍 === 可能問題分析 ===');
    console.log('根據您的描述(下注800元，餘額只增加89元):');
    console.log('1. 賠率問題: 如果實際使用的賠率不是9.59或9.89');
    console.log('2. 中獎數量問題: 可能不是預期的中獎數量');
    console.log('3. 額外扣費: 可能有手續費或其他扣除');
    console.log('4. 結算邏輯錯誤: calculateWinAmount函數可能有bug');
    console.log('5. 數據庫更新問題: 可能餘額更新不完整');
    
    console.log('\n🔧 === 建議檢查步驟 ===');
    console.log('1. 檢查 test03 用戶的具體下注記錄');
    console.log('2. 查看開獎結果和實際中獎數量');
    console.log('3. 檢查結算日志中的計算過程');
    console.log('4. 確認使用的賠率是否正確');
    console.log('5. 檢查是否有其他扣除(如手續費、退水等)');
}

checkMarketAndOdds().catch(console.error);
