const fetch = require('node-fetch');

// 測試URL
const BACKEND_URL = 'https://bet-4d5m.onrender.com';
const AGENT_URL = 'https://bet-4d5m.onrender.com:8081';

// 測試用戶
const TEST_USERS = {
    A_MARKET: 'titi',    // A盤會員
    D_MARKET: 'testd1'   // D盤會員（假設）
};

async function testMarketStatus() {
    console.log('🧪 A盤D盤龍虎賠率狀況檢查');
    console.log('=====================================');
    
    // 1. 檢查後端賠率配置
    console.log('\n📊 1. 後端賠率配置檢查');
    try {
        const response = await fetch(`${BACKEND_URL}/api/game-data`);
        const data = await response.json();
        
        console.log('✅ 遊戲數據API回應:', {
            status: response.status,
            hasOdds: !!data.odds,
            currentPeriod: data.currentPeriod
        });
    } catch (error) {
        console.error('❌ 遊戲數據API錯誤:', error.message);
    }
    
    // 2. 檢查A盤會員信息
    console.log('\n🅰️ 2. A盤會員檢查 (titi)');
    try {
        const response = await fetch(`${AGENT_URL}/api/agent/member/info/titi`);
        const data = await response.json();
        
        console.log('A盤會員信息:', {
            success: data.success,
            marketType: data.member?.market_type,
            username: data.member?.username,
            agent: data.member?.agent_username
        });
    } catch (error) {
        console.error('❌ A盤會員檢查錯誤:', error.message);
    }
    
    // 3. 測試賠率API
    console.log('\n⚖️ 3. 龍虎賠率API檢查');
    const betTypes = ['dragonTiger'];
    const markets = ['A', 'D'];
    
    for (const market of markets) {
        console.log(`\n${market}盤龍虎賠率:`);
        try {
            const response = await fetch(`${BACKEND_URL}/api/odds`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    betType: 'dragonTiger',
                    value: 'dragon',
                    marketType: market
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log(`  ${market}盤龍賠率:`, data.odds || '未知');
            } else {
                console.log(`  ${market}盤API錯誤:`, response.status);
            }
        } catch (error) {
            console.error(`  ${market}盤請求錯誤:`, error.message);
        }
    }
    
    // 4. 檢查前端配置
    console.log('\n🖥️ 4. 前端配置檢查');
    const fs = require('fs');
    const path = require('path');
    
    try {
        const frontendPath = path.join(__dirname, 'frontend/src/scripts/vue-app.js');
        const content = fs.readFileSync(frontendPath, 'utf8');
        
        // 搜索龍虎賠率配置
        const dragonTigerMatches = content.match(/dragonTiger:\s*\{[^}]+\}/g);
        
        if (dragonTigerMatches) {
            console.log('前端龍虎配置數量:', dragonTigerMatches.length);
            dragonTigerMatches.forEach((match, index) => {
                console.log(`  配置 ${index + 1}:`, match);
            });
        } else {
            console.log('❌ 未找到前端龍虎配置');
        }
    } catch (error) {
        console.error('❌ 前端文件讀取錯誤:', error.message);
    }
    
    // 5. 檢查部署版本同步狀況
    console.log('\n🚀 5. 部署版本同步檢查');
    try {
        const agentPath = path.join(__dirname, 'agent/frontend/index.html');
        const deployPath = path.join(__dirname, 'deploy/frontend/index.html');
        
        const agentStats = fs.statSync(agentPath);
        const deployStats = fs.statSync(deployPath);
        
        console.log('版本同步狀況:', {
            agent修改時間: agentStats.mtime.toISOString(),
            deploy修改時間: deployStats.mtime.toISOString(),
            是否同步: agentStats.mtime.getTime() === deployStats.mtime.getTime()
        });
    } catch (error) {
        console.error('❌ 版本同步檢查錯誤:', error.message);
    }
    
    // 6. 總結和建議
    console.log('\n📋 6. 檢查總結');
    console.log('=====================================');
    console.log('問題分析：');
    console.log('1. 如果A盤龍虎顯示0.0，可能原因：');
    console.log('   - 前端賠率更新邏輯有問題');
    console.log('   - 用戶市場類型獲取失敗');
    console.log('   - Vue實例賠率對象沒有正確更新');
    console.log('2. 建議檢查：');
    console.log('   - 瀏覽器控制台是否有JavaScript錯誤');
    console.log('   - 用戶登錄後是否正確獲取A盤標識');
    console.log('   - updateOddsDisplay()函數是否正確執行');
}

testMarketStatus().catch(console.error); 