const axios = require('axios');

// API配置
const GAME_API_URL = 'http://localhost:3000';
const AGENT_API_URL = 'http://localhost:3003';

// 測試數據
const TEST_MEMBER = 'titi'; // A盤會員
const TEST_BET_AMOUNT = 1000;

async function testRebateSystem() {
    console.log('🔍 開始測試退水分配機制...\n');
    
    try {
        // 1. 獲取會員的代理鏈信息
        console.log('1️⃣ 檢查會員代理鏈...');
        const agentChainResponse = await axios.get(`${AGENT_API_URL}/api/agent/member-agent-chain`, {
            params: { username: TEST_MEMBER }
        });
        
        if (!agentChainResponse.data.success) {
            console.error('❌ 無法獲取會員代理鏈:', agentChainResponse.data.message);
            return;
        }
        
        const agentChain = agentChainResponse.data.agentChain;
        console.log('✅ 會員代理鏈:');
        agentChain.forEach((agent, index) => {
            console.log(`   L${agent.level}: ${agent.username} (${agent.rebate_mode}模式, ${(agent.rebate_percentage*100).toFixed(1)}%)`);
        });
        
        // 2. 獲取代理當前餘額
        console.log('\n2️⃣ 記錄代理結算前餘額...');
        const balancesBefore = {};
        for (const agent of agentChain) {
            try {
                const agentResponse = await axios.get(`${AGENT_API_URL}/api/agent/agent/${agent.id}`);
                if (agentResponse.data.success) {
                    balancesBefore[agent.username] = parseFloat(agentResponse.data.agent.balance);
                    console.log(`   ${agent.username}: ${balancesBefore[agent.username]} 元`);
                }
            } catch (error) {
                console.warn(`   無法獲取 ${agent.username} 餘額:`, error.message);
                balancesBefore[agent.username] = 0;
            }
        }
        
        // 3. 模擬會員下注（直接調用退水分配）
        console.log('\n3️⃣ 模擬退水分配...');
        const currentPeriod = 20250102001;
        
        try {
            const rebateResponse = await axios.post(`${AGENT_API_URL}/api/agent/allocate-rebate`, {
                agentId: agentChain[0].id,
                agentUsername: agentChain[0].username,
                rebateAmount: TEST_BET_AMOUNT * agentChain[0].rebate_percentage,
                memberUsername: TEST_MEMBER,
                betAmount: TEST_BET_AMOUNT,
                reason: currentPeriod
            });
            
            if (rebateResponse.data.success) {
                console.log('✅ 退水分配API調用成功');
            } else {
                console.log('❌ 退水分配API失敗:', rebateResponse.data.message);
            }
        } catch (error) {
            console.error('❌ 退水分配API調用錯誤:', error.message);
        }
        
        // 4. 等待1秒後檢查餘額變化
        console.log('\n4️⃣ 等待1秒後檢查餘額變化...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const balancesAfter = {};
        let totalRebateDistributed = 0;
        
        for (const agent of agentChain) {
            try {
                const agentResponse = await axios.get(`${AGENT_API_URL}/api/agent/agent/${agent.id}`);
                if (agentResponse.data.success) {
                    balancesAfter[agent.username] = parseFloat(agentResponse.data.agent.balance);
                    const change = balancesAfter[agent.username] - balancesBefore[agent.username];
                    totalRebateDistributed += change;
                    
                    console.log(`   ${agent.username}: ${balancesBefore[agent.username]} → ${balancesAfter[agent.username]} (${change >= 0 ? '+' : ''}${change.toFixed(2)})`);
                }
            } catch (error) {
                console.warn(`   無法獲取 ${agent.username} 更新後餘額:`, error.message);
            }
        }
        
        // 5. 分析結果
        console.log('\n5️⃣ 退水分配分析:');
        const expectedTotalRebate = TEST_BET_AMOUNT * agentChain[0].rebate_percentage;
        console.log(`   預期總退水: ${expectedTotalRebate.toFixed(2)} 元 (${(agentChain[0].rebate_percentage*100).toFixed(1)}%)`);
        console.log(`   實際分配: ${totalRebateDistributed.toFixed(2)} 元`);
        console.log(`   分配比例: ${((totalRebateDistributed / expectedTotalRebate) * 100).toFixed(1)}%`);
        
        if (Math.abs(totalRebateDistributed - expectedTotalRebate) < 0.01) {
            console.log('✅ 退水分配正確！');
        } else if (totalRebateDistributed === 0) {
            console.log('❌ 退水分配失敗 - 沒有任何退水進入代理餘額');
        } else {
            console.log('⚠️ 退水分配可能有問題 - 金額不匹配');
        }
        
        // 6. 檢查交易記錄
        console.log('\n6️⃣ 檢查最近的退水交易記錄...');
        for (const agent of agentChain) {
            try {
                const transactionResponse = await axios.get(`${AGENT_API_URL}/api/agent/transactions`, {
                    params: {
                        userType: 'agent',
                        userId: agent.id,
                        limit: 5
                    }
                });
                
                if (transactionResponse.data.success && transactionResponse.data.transactions.length > 0) {
                    const recentRebates = transactionResponse.data.transactions.filter(t => 
                        t.transaction_type === 'rebate' && 
                        t.member_username === TEST_MEMBER
                    );
                    
                    if (recentRebates.length > 0) {
                        console.log(`   ${agent.username} 最近退水記錄:`);
                        recentRebates.forEach(t => {
                            console.log(`     ${t.amount} 元 - ${t.description} (${new Date(t.created_at).toLocaleString()})`);
                        });
                    } else {
                        console.log(`   ${agent.username} 無相關退水記錄`);
                    }
                }
            } catch (error) {
                console.warn(`   無法獲取 ${agent.username} 交易記錄:`, error.message);
            }
        }
        
    } catch (error) {
        console.error('💥 測試過程中發生錯誤:', error.message);
        if (error.response) {
            console.error('響應狀態:', error.response.status);
            console.error('響應數據:', error.response.data);
        }
    }
}

// 執行測試
testRebateSystem().then(() => {
    console.log('\n🏁 退水系統測試完成');
    process.exit(0);
}).catch(error => {
    console.error('💥 測試執行失敗:', error);
    process.exit(1);
}); 