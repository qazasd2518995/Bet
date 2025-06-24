const axios = require('axios');

const FRONTEND_API = 'http://localhost:3002';
const AGENT_API = 'http://localhost:3003/api/agent';

async function testRebateTiming() {
    try {
        const testMember = 'testuser2';
        const agentId = 12; // 測試代理ID
        
        console.log('=== 退水機制時機測試 ===\n');
        
        // 1. 檢查初始餘額
        console.log('1. 檢查初始餘額...');
        const initialMemberResponse = await axios.get(`${AGENT_API}/member-balance?username=${testMember}`);
        const initialMemberBalance = parseFloat(initialMemberResponse.data.balance);
        
        const initialAgentResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
        const initialAgentBalance = parseFloat(initialAgentResponse.data.balance);
        
        console.log(`會員初始餘額: ${initialMemberBalance}`);
        console.log(`代理初始餘額: ${initialAgentBalance}`);
        
        // 2. 執行下注
        console.log('\n2. 執行下注...');
        const betAmount = 100;
        
        const betResponse = await axios.post(`${FRONTEND_API}/api/bet`, {
            username: testMember,
            amount: betAmount,
            betType: 'champion',
            value: 'big'
        });
        
        console.log('下注響應:', betResponse.data);
        
        // 3. 檢查下注後的餘額（這時應該只有會員餘額變化，代理餘額不變）
        console.log('\n3. 檢查下注後的餘額...');
        const afterBetMemberResponse = await axios.get(`${AGENT_API}/member-balance?username=${testMember}`);
        const afterBetMemberBalance = parseFloat(afterBetMemberResponse.data.balance);
        
        const afterBetAgentResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
        const afterBetAgentBalance = parseFloat(afterBetAgentResponse.data.balance);
        
        console.log(`會員下注後餘額: ${afterBetMemberBalance} (變化: ${afterBetMemberBalance - initialMemberBalance})`);
        console.log(`代理下注後餘額: ${afterBetAgentBalance} (變化: ${afterBetAgentBalance - initialAgentBalance})`);
        
        // 驗證下注階段的正確性
        const memberBetPhaseChange = afterBetMemberBalance - initialMemberBalance;
        const agentBetPhaseChange = afterBetAgentBalance - initialAgentBalance;
        
        console.log('\n=== 下注階段驗證 ===');
        console.log(`會員餘額變化: ${memberBetPhaseChange} (預期: -${betAmount})`);
        console.log(`代理餘額變化: ${agentBetPhaseChange} (預期: 0)`);
        
        if (Math.abs(memberBetPhaseChange + betAmount) < 0.01) {
            console.log('✅ 會員下注扣除正確');
        } else {
            console.log('❌ 會員下注扣除異常');
        }
        
        if (Math.abs(agentBetPhaseChange) < 0.01) {
            console.log('✅ 代理餘額在下注時未變化（退水將在結算後分配）');
        } else {
            console.log('❌ 代理餘額在下注時異常變化！');
        }
        
        console.log('\n測試完成 - 已驗證下注階段邏輯');
        console.log('如需測試結算階段，請等待遊戲自然結算或手動觸發結算。');
        
    } catch (error) {
        console.error('測試過程中出錯:', error.message);
        if (error.response) {
            console.error('錯誤詳情:', error.response.data);
        }
    }
}

// 運行測試
testRebateTiming(); 