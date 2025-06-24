import axios from 'axios';

const FRONTEND_API = 'http://localhost:3002';
const AGENT_API = 'http://localhost:3003/api/agent';

async function debugGameSettlement() {
    try {
        console.log('=== 調試實際遊戲結算流程 ===\n');
        
        const testMember = 'testuser';
        const agentId = 1;
        
        // 1. 獲取初始餘額
        console.log('1. 獲取初始餘額...');
        const memberBalanceResponse = await axios.get(`${AGENT_API}/member-balance?username=${testMember}`);
        const initialMemberBalance = parseFloat(memberBalanceResponse.data.balance);
        
        const agentBalanceResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
        const initialAgentBalance = parseFloat(agentBalanceResponse.data.balance);
        
        console.log(`會員 ${testMember} 初始餘額: ${initialMemberBalance}`);
        console.log(`代理 admin 初始餘額: ${initialAgentBalance}`);
        
        // 2. 模擬下注
        console.log('\n2. 模擬下注...');
        const betAmount = 50;
        
        console.log(`會員下注 ${betAmount} 元...`);
        const betResponse = await axios.post(`${FRONTEND_API}/api/bet`, {
            username: testMember,
            amount: betAmount,
            betType: 'champion',
            value: 'big',
            period: '202505055999' // 使用一個未來的期數避免結算
        });
        
        console.log('下注響應:', betResponse.data);
        
        // 3. 檢查下注後的餘額變化
        console.log('\n3. 檢查下注後的餘額...');
        const afterBetMemberResponse = await axios.get(`${AGENT_API}/member-balance?username=${testMember}`);
        const afterBetMemberBalance = parseFloat(afterBetMemberResponse.data.balance);
        
        const afterBetAgentResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
        const afterBetAgentBalance = parseFloat(afterBetAgentResponse.data.balance);
        
        console.log(`會員下注後餘額: ${afterBetMemberBalance} (變化: ${afterBetMemberBalance - initialMemberBalance})`);
        console.log(`代理下注後餘額: ${afterBetAgentBalance} (變化: ${afterBetAgentBalance - initialAgentBalance})`);
        
        // 4. 模擬會員手動中獎 - 使用updateMemberBalance方法
        console.log('\n4. 模擬會員中獎...');
        const winAmount = 200; // 中獎金額
        
        // 直接調用前台的餘額更新API來模擬中獎
        const winResponse = await axios.post(`${FRONTEND_API}/api/update-balance`, {
            username: testMember,
            amount: winAmount,
            type: 'deposit',
            reason: '測試中獎'
        });
        
        console.log('中獎響應:', winResponse.data);
        
        // 5. 檢查中獎後的餘額變化
        console.log('\n5. 檢查中獎後的餘額...');
        const finalMemberResponse = await axios.get(`${AGENT_API}/member-balance?username=${testMember}`);
        const finalMemberBalance = parseFloat(finalMemberResponse.data.balance);
        
        const finalAgentResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
        const finalAgentBalance = parseFloat(finalAgentResponse.data.balance);
        
        console.log(`會員最終餘額: ${finalMemberBalance}`);
        console.log(`代理最終餘額: ${finalAgentBalance}`);
        
        // 6. 分析整個流程的變化
        console.log('\n=== 流程分析 ===');
        
        const totalMemberChange = finalMemberBalance - initialMemberBalance;
        const totalAgentChange = finalAgentBalance - initialAgentBalance;
        
        const expectedMemberChange = -betAmount + winAmount; // 下注扣除 + 中獎增加
        const expectedAgentChange = 0; // 代理不應該從會員中獎中受益
        
        console.log(`會員總變化: ${totalMemberChange} (預期: ${expectedMemberChange})`);
        console.log(`代理總變化: ${totalAgentChange} (預期: ${expectedAgentChange})`);
        
        // 檢查下注階段
        const betPhaseAgentChange = afterBetAgentBalance - initialAgentBalance;
        console.log(`代理在下注階段的變化: ${betPhaseAgentChange} (退水分配)`);
        
        // 檢查中獎階段
        const winPhaseAgentChange = finalAgentBalance - afterBetAgentBalance;
        console.log(`代理在中獎階段的變化: ${winPhaseAgentChange} (應該為0)`);
        
        if (Math.abs(winPhaseAgentChange) > 0.01) {
            console.log('❌ 問題發現：代理在會員中獎階段餘額發生了變化！');
        } else {
            console.log('✅ 代理在會員中獎階段餘額沒有變化');
        }
        
    } catch (error) {
        console.error('調試過程中出錯:', error.message);
        if (error.response) {
            console.error('錯誤詳情:', error.response.data);
        }
    }
}

debugGameSettlement(); 