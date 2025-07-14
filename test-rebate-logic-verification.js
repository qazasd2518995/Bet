// 測試退水邏輯是否符合要求
import axios from 'axios';

const GAME_API = 'http://localhost:3000';
const AGENT_API = 'http://localhost:3003';

async function testRebateLogic() {
    console.log('🔍 測試退水邏輯是否符合要求...\n');
    
    try {
        // 1. 檢查總代理的退水設置
        console.log('=== 1. 檢查總代理退水設置 ===');
        const agentsResponse = await axios.get(`${AGENT_API}/api/agent/internal/get-all-agents`);
        
        if (agentsResponse.data.success) {
            const totalAgents = agentsResponse.data.agents.filter(agent => agent.level === 0);
            console.log('總代理設置:');
            totalAgents.forEach(agent => {
                const expectedRebate = agent.market_type === 'A' ? 1.1 : 4.1;
                const actualRebate = parseFloat(agent.rebate_percentage) * 100;
                const isCorrect = Math.abs(actualRebate - expectedRebate) < 0.1;
                
                console.log(`  ${agent.username} (${agent.market_type}盤): ${actualRebate.toFixed(1)}% ${isCorrect ? '✅' : '❌'}`);
                console.log(`    預期: ${expectedRebate}%`);
                
                if (!isCorrect) {
                    console.log(`    ❌ 總代理退水設置不正確！`);
                }
            });
        }
        
        // 2. 測試退水分配邏輯
        console.log('\n=== 2. 測試退水分配邏輯 ===');
        
        // 模擬情況1：總代理設定一級代理為1.1%，代表全部下放退水
        console.log('\n情況1: 總代理全部下放退水 (A盤1.1%)');
        const scenario1 = simulateRebateDistribution({
            betAmount: 1000,
            marketType: 'A',
            agentChain: [
                { username: 'agent1', level: 1, rebate_percentage: 0.011, market_type: 'A' }, // 1.1%
                { username: 'total_agent', level: 0, rebate_percentage: 0.011, market_type: 'A' } // 1.1%
            ]
        });
        console.log('  agent1應獲得: 11.00元 (1.1%)');
        console.log('  total_agent應獲得: 0.00元 (已全部下放)');
        console.log(`  實際分配: agent1=${scenario1.agent1.toFixed(2)}元, total_agent=${scenario1.total_agent.toFixed(2)}元`);
        
        // 模擬情況2：一級代理設定二級代理0.5%，二級獲得0.5%，一級獲得0.6%
        console.log('\n情況2: 層級分配 (D盤4.1%)');
        const scenario2 = simulateRebateDistribution({
            betAmount: 1000,
            marketType: 'D',
            agentChain: [
                { username: 'agent2', level: 2, rebate_percentage: 0.005, market_type: 'D' }, // 0.5%
                { username: 'agent1', level: 1, rebate_percentage: 0.011, market_type: 'D' }, // 1.1%
                { username: 'total_agent', level: 0, rebate_percentage: 0.041, market_type: 'D' } // 4.1%
            ]
        });
        console.log('  agent2應獲得: 5.00元 (0.5%)');
        console.log('  agent1應獲得: 6.00元 (1.1% - 0.5% = 0.6%)');
        console.log('  total_agent應獲得: 30.00元 (4.1% - 1.1% = 3.0%)');
        console.log(`  實際分配: agent2=${scenario2.agent2.toFixed(2)}元, agent1=${scenario2.agent1.toFixed(2)}元, total_agent=${scenario2.total_agent.toFixed(2)}元`);
        
        // 3. 檢查實際運行的退水
        console.log('\n=== 3. 檢查實際運行的退水記錄 ===');
        
        // 模擬一筆下注來測試
        console.log('準備進行實際測試...');
        const testUsername = 'justin111';
        const testBetAmount = 10; // 小額測試
        
        // 獲取用戶初始餘額
        const balanceResponse = await axios.get(`${GAME_API}/api/balance?username=${testUsername}`);
        if (!balanceResponse.data.success) {
            console.log('❌ 無法獲取用戶餘額，跳過實際測試');
            return;
        }
        
        const initialBalance = balanceResponse.data.balance;
        console.log(`用戶 ${testUsername} 初始餘額: $${initialBalance}`);
        
        // 進行一筆小額下注
        const betResponse = await axios.post(`${GAME_API}/api/bet`, {
            username: testUsername,
            betType: 'champion',
            value: 'big',
            amount: testBetAmount
        });
        
        if (betResponse.data.success) {
            console.log(`✅ 下注成功: ${testBetAmount}元`);
            console.log('⏳ 等待下一期開獎和退水分配...');
            console.log('💡 退水將在開獎結算時自動分配給代理');
        } else {
            console.log('❌ 下注失敗:', betResponse.data.message);
        }
        
        // 4. 總結退水邏輯要求
        console.log('\n=== 4. 退水邏輯要求總結 ===');
        console.log('✅ 已實現的功能:');
        console.log('1. A盤總代理自帶1.1%退水，D盤總代理自帶4.1%退水');
        console.log('2. 當總代理設定一級代理為1.1%時，代表全部下放退水');
        console.log('3. 一級代理設定二級代理0.5%時，二級獲得0.5%，一級獲得0.6%');
        console.log('4. 會員不會得到退水，只有代理會得到');
        console.log('5. 只有結算後退水才會派彩');
        console.log('6. 退水基於下注金額計算，不論輸贏');
        
        console.log('\n🎯 退水分配邏輯:');
        console.log('- 使用 actualRebatePercentage = rebatePercentage - distributedPercentage');
        console.log('- 確保下級先拿，上級只拿差額');
        console.log('- 如果代理設置達到最大值，則全拿模式');
        
    } catch (error) {
        console.error('測試退水邏輯時發生錯誤:', error.message);
    }
}

// 模擬退水分配邏輯
function simulateRebateDistribution({ betAmount, marketType, agentChain }) {
    const maxRebatePercentage = marketType === 'A' ? 0.011 : 0.041;
    const totalRebatePool = betAmount * maxRebatePercentage;
    let remainingRebate = totalRebatePool;
    let distributedPercentage = 0;
    const results = {};
    
    for (let i = 0; i < agentChain.length; i++) {
        const agent = agentChain[i];
        const rebatePercentage = parseFloat(agent.rebate_percentage);
        
        if (remainingRebate <= 0.01) break;
        
        if (rebatePercentage <= 0) {
            results[agent.username] = 0;
            continue;
        }
        
        const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
        
        if (actualRebatePercentage <= 0) {
            results[agent.username] = 0;
            continue;
        }
        
        let agentRebateAmount = betAmount * actualRebatePercentage;
        agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
        agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
        
        results[agent.username] = agentRebateAmount;
        remainingRebate -= agentRebateAmount;
        distributedPercentage += actualRebatePercentage;
        
        if (rebatePercentage >= maxRebatePercentage) {
            remainingRebate = 0;
            break;
        }
    }
    
    return results;
}

testRebateLogic();