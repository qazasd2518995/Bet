// test-betting-limits.js - 測試限紅驗證修復
import { optimizedBatchBet } from './optimized-betting-system.js';

async function testBettingLimits() {
    console.log('🧪 測試批量下注限紅驗證\n');
    
    const AGENT_API_URL = 'http://localhost:3003';
    const username = 'justin111';
    const period = 20250716999; // 測試期號
    
    // justin111 的限紅配置 (level2):
    // sumValue: maxBet: 400, periodLimit: 800
    
    console.log('1. 測試單注超限...');
    const singleLimitBets = [
        { betType: 'sumValue', value: 'even', amount: 500 } // 超過 400 限制
    ];
    
    try {
        const result = await optimizedBatchBet(username, singleLimitBets, period, AGENT_API_URL);
        console.log('單注超限結果:', result.success ? '成功 (不應該成功\!)' : result.message);
    } catch (error) {
        console.log('單注超限測試錯誤:', error.message);
    }
    
    console.log('\n🎯 測試完成');
}

testBettingLimits().catch(console.error);
EOF < /dev/null