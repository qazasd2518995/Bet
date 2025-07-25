import axios from 'axios';

const FRONTEND_API = 'http://localhost:3002';
const AGENT_API = 'http://localhost:3003/api/agent';

async function debugBalanceIssue() {
    try {
        console.log('=== 調試會員中獎時代理餘額變化問題 ===\n');
        
        const testMember = 'testuser';
        const testAgent = 'admin'; // 假設admin是代理
        
        // 1. 獲取會員初始餘額
        console.log('1. 獲取會員初始餘額...');
        const memberBalanceResponse = await axios.get(`${AGENT_API}/member-balance?username=${testMember}`);
        const initialMemberBalance = memberBalanceResponse.data.balance;
        console.log(`會員 ${testMember} 初始餘額: ${initialMemberBalance}`);
        
        // 2. 獲取代理初始餘額 (使用已知的admin代理ID=1)
        console.log('\n2. 獲取代理初始餘額...');
        const agentId = 1; // admin代理的ID通常是1
        const agentBalanceResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
        const initialAgentBalance = agentBalanceResponse.data.balance;
        console.log(`代理 ${testAgent} (ID: ${agentId}) 初始餘額: ${initialAgentBalance}`);
        
        // 3. 模擬會員中獎 - 直接調用同步餘額API
        console.log('\n3. 模擬會員中獎...');
        const winAmount = 100;
        const newMemberBalance = parseFloat(initialMemberBalance) + winAmount;
        
        console.log(`模擬會員中獎 ${winAmount} 元，新餘額應為: ${newMemberBalance}`);
        
        const syncResponse = await axios.post(`${AGENT_API}/sync-member-balance`, {
            username: testMember,
            balance: newMemberBalance,
            reason: '測試中獎'
        });
        
        console.log('同步響應:', syncResponse.data);
        
        // 4. 檢查會員餘額是否正確更新
        console.log('\n4. 檢查會員餘額...');
        const finalMemberBalanceResponse = await axios.get(`${AGENT_API}/member-balance?username=${testMember}`);
        const finalMemberBalance = finalMemberBalanceResponse.data.balance;
        console.log(`會員 ${testMember} 最終餘額: ${finalMemberBalance}`);
        console.log(`會員餘額變化: ${parseFloat(finalMemberBalance) - parseFloat(initialMemberBalance)}`);
        
        // 5. 檢查代理餘額是否錯誤地變化
        console.log('\n5. 檢查代理餘額...');
        const finalAgentBalanceResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
        const finalAgentBalance = finalAgentBalanceResponse.data.balance;
        console.log(`代理 ${testAgent} 最終餘額: ${finalAgentBalance}`);
        console.log(`代理餘額變化: ${parseFloat(finalAgentBalance) - parseFloat(initialAgentBalance)}`);
        
        // 6. 分析結果
        console.log('\n=== 分析結果 ===');
        const memberChange = parseFloat(finalMemberBalance) - parseFloat(initialMemberBalance);
        const agentChange = parseFloat(finalAgentBalance) - parseFloat(initialAgentBalance);
        
        console.log(`會員餘額變化: ${memberChange} (預期: ${winAmount})`);
        console.log(`代理餘額變化: ${agentChange} (預期: 0)`);
        
        if (Math.abs(memberChange - winAmount) < 0.01) {
            console.log('✅ 會員餘額正確更新');
        } else {
            console.log('❌ 會員餘額更新有誤');
        }
        
        if (Math.abs(agentChange) < 0.01) {
            console.log('✅ 代理餘額沒有變化 (正確)');
        } else {
            console.log('❌ 代理餘額錯誤地變化了！這就是問題所在！');
        }
        
    } catch (error) {
        console.error('調試過程中出錯:', error.message);
        if (error.response) {
            console.error('錯誤詳情:', error.response.data);
        }
    }
}

debugBalanceIssue(); 