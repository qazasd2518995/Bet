// 測試限紅驗證系統
import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:3000';
const AGENT_API_URL = 'http://localhost:3003';

async function testBettingLimits() {
    console.log('🧪 測試限紅驗證系統...\n');
    
    const username = 'justin111';
    
    // 1. 先獲取用戶的限紅配置
    console.log('1️⃣ 獲取用戶限紅配置...');
    try {
        const response = await fetch(`${AGENT_API_URL}/api/agent/member-betting-limit-by-username?username=${username}`);
        const data = await response.json();
        
        if (data.success && data.config) {
            console.log('✅ 限紅配置:', JSON.stringify(data.config, null, 2));
        } else {
            console.log('❌ 無法獲取限紅配置');
        }
    } catch (error) {
        console.error('獲取限紅配置失敗:', error.message);
    }
    
    // 2. 測試單注超限
    console.log('\n2️⃣ 測試單注超限...');
    const testBets = [
        {
            betType: 'sumValue',
            value: 'even',
            amount: 500  // sumValue 單注最高 400
        }
    ];
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/batch-bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                bets: testBets
            })
        });
        
        const data = await response.json();
        console.log('回應:', data);
        
        if (data.success) {
            console.log('❌ 問題：下注成功了！限紅驗證沒有生效');
        } else {
            console.log('✅ 正確：下注被拒絕 -', data.message);
        }
    } catch (error) {
        console.error('測試失敗:', error.message);
    }
    
    // 3. 直接測試 optimizedBatchBet 函數
    console.log('\n3️⃣ 直接測試 optimizedBatchBet 函數...');
    try {
        const { optimizedBatchBet } = await import('./optimized-betting-system.js');
        const result = await optimizedBatchBet(username, testBets, '20250716999', AGENT_API_URL);
        console.log('函數回應:', result);
    } catch (error) {
        console.error('直接測試失敗:', error.message);
    }
}

testBettingLimits().catch(console.error);