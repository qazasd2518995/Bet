import axios from 'axios';

const FRONTEND_API = 'http://localhost:3002';
const AGENT_API = 'http://localhost:3003/api/agent';

async function debugRealIssue() {
    try {
        console.log('=== 測試實際問題：會員中獎時代理餘額變化 ===\n');
        
        const testMember = 'testuser2'; // 新註冊的用戶
        const agentId = 1;
        
        // 1. 先給會員一些初始餘額用於下注
        console.log('1. 給會員設置初始餘額...');
        await axios.post(`${FRONTEND_API}/api/update-balance`, {
            username: testMember,
            amount: 1000,
            type: 'deposit',
            reason: '測試初始資金'
        });
        
        // 等待同步
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 2. 獲取初始餘額
        console.log('\n2. 獲取初始餘額...');
        const memberBalanceResponse = await axios.get(`${FRONTEND_API}/api/balance?username=${testMember}`);
        const initialMemberBalance = parseFloat(memberBalanceResponse.data.balance);
        
        const agentBalanceResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
        const initialAgentBalance = parseFloat(agentBalanceResponse.data.balance);
        
        console.log(`會員 ${testMember} 初始餘額: ${initialMemberBalance}`);
        console.log(`代理 admin 初始餘額: ${initialAgentBalance}`);
        
        // 3. 模擬下注
        console.log('\n3. 模擬下注...');
        const betAmount = 100;
        
        const betResponse = await axios.post(`${FRONTEND_API}/api/bet`, {
            username: testMember,
            amount: betAmount,
            betType: 'champion',
            value: 'big'
        });
        
        console.log('下注響應:', betResponse.data);
        
        // 等待處理完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 4. 檢查下注後的餘額變化
        console.log('\n4. 檢查下注後的餘額...');
        const afterBetMemberResponse = await axios.get(`${FRONTEND_API}/api/balance?username=${testMember}`);
        const afterBetMemberBalance = parseFloat(afterBetMemberResponse.data.balance);
        
        const afterBetAgentResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
        const afterBetAgentBalance = parseFloat(afterBetAgentResponse.data.balance);
        
        console.log(`會員下注後餘額: ${afterBetMemberBalance} (變化: ${afterBetMemberBalance - initialMemberBalance})`);
        console.log(`代理下注後餘額: ${afterBetAgentBalance} (變化: ${afterBetAgentBalance - initialAgentBalance})`);
        
        // 5. 模擬會員中獎 - 直接增加餘額
        console.log('\n5. 模擬會員中獎...');
        const winAmount = 500; // 中獎金額
        
        const winResponse = await axios.post(`${FRONTEND_API}/api/update-balance`, {
            username: testMember,
            amount: winAmount,
            type: 'deposit',
            reason: '測試中獎獎金'
        });
        
        console.log('中獎響應:', winResponse.data);
        
        // 等待處理完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 6. 檢查中獎後的餘額變化
        console.log('\n6. 檢查中獎後的餘額...');
        const finalMemberResponse = await axios.get(`${FRONTEND_API}/api/balance?username=${testMember}`);
        const finalMemberBalance = parseFloat(finalMemberResponse.data.balance);
        
        const finalAgentResponse = await axios.get(`${AGENT_API}/agent-balance?agentId=${agentId}`);
        const finalAgentBalance = parseFloat(finalAgentResponse.data.balance);
        
        console.log(`會員最終餘額: ${finalMemberBalance}`);
        console.log(`代理最終餘額: ${finalAgentBalance}`);
        
        // 7. 分析結果
        console.log('\n=== 詳細分析 ===');
        
        // 下注階段分析
        const betPhaseMemberChange = afterBetMemberBalance - initialMemberBalance;
        const betPhaseAgentChange = afterBetAgentBalance - initialAgentBalance;
        console.log(`下注階段：`);
        console.log(`  會員變化: ${betPhaseMemberChange} (預期: -${betAmount})`);
        console.log(`  代理變化: ${betPhaseAgentChange} (退水分配，應該 > 0)`);
        
        // 中獎階段分析
        const winPhaseMemberChange = finalMemberBalance - afterBetMemberBalance;
        const winPhaseAgentChange = finalAgentBalance - afterBetAgentBalance;
        console.log(`\n中獎階段：`);
        console.log(`  會員變化: ${winPhaseMemberChange} (預期: ${winAmount})`);
        console.log(`  代理變化: ${winPhaseAgentChange} (預期: 0)`);
        
        // 總體變化
        const totalMemberChange = finalMemberBalance - initialMemberBalance;
        const totalAgentChange = finalAgentBalance - initialAgentBalance;
        console.log(`\n總體變化：`);
        console.log(`  會員總變化: ${totalMemberChange}`);
        console.log(`  代理總變化: ${totalAgentChange}`);
        
        // 問題診斷
        console.log('\n=== 問題診斷 ===');
        if (Math.abs(winPhaseAgentChange) > 0.01) {
            console.log('❌ 發現問題：會員中獎時代理餘額也增加了！');
            console.log(`   代理在中獎階段增加了: ${winPhaseAgentChange}`);
            
            // 檢查是否等於會員中獎金額
            if (Math.abs(winPhaseAgentChange - winAmount) < 0.01) {
                console.log('   代理增加的金額等於會員中獎金額！這確實是問題！');
            }
        } else {
            console.log('✅ 沒有發現問題：代理在會員中獎時餘額沒有變化');
        }
        
    } catch (error) {
        console.error('調試過程中出錯:', error.message);
        if (error.response) {
            console.error('錯誤詳情:', error.response.data);
        }
    }
}

debugRealIssue(); 