const axios = require('axios');

const AGENT_API = 'http://localhost:3003/api/agent';

async function testRebateLogicFix() {
    console.log('🧪 測試修正後的退水邏輯\n');
    
    try {
        // 測試不同退水模式的邏輯
        console.log('=== 測試退水模式邏輯 ===\n');
        
        const testCases = [
            {
                mode: 'all',
                description: '全拿退水：上級代理拿走所有退水，下級代理退水比例應該是0%',
                expectedRebatePercentage: 0
            },
            {
                mode: 'none', 
                description: '全退下級：上級代理不拿退水，下級代理退水比例應該是最大值(1.1%)',
                expectedRebatePercentage: 0.011 // A盤最大值
            },
            {
                mode: 'percentage',
                percentage: 0.005,
                description: '按比例分配：下級代理拿設定的比例(0.5%)，其餘歸上級',
                expectedRebatePercentage: 0.005
            }
        ];
        
        for (const testCase of testCases) {
            console.log(`📝 測試案例: ${testCase.description}`);
            console.log(`   模式: ${testCase.mode}`);
            if (testCase.percentage) {
                console.log(`   設定比例: ${(testCase.percentage * 100).toFixed(1)}%`);
            }
            console.log(`   預期下級代理退水比例: ${(testCase.expectedRebatePercentage * 100).toFixed(1)}%\n`);
        }
        
        // 檢查現有代理的退水設定
        console.log('=== 檢查現有代理退水設定 ===\n');
        
        const agentsResponse = await axios.get(`${AGENT_API}/agents?page=1&limit=10`);
        if (agentsResponse.data.success) {
            const agents = agentsResponse.data.agents;
            console.log(`找到 ${agents.length} 個代理:\n`);
            
            agents.forEach((agent, index) => {
                console.log(`${index + 1}. ${agent.username} (Level ${agent.level})`);
                console.log(`   退水模式: ${agent.rebate_mode}`);
                console.log(`   退水比例: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
                console.log(`   最大退水: ${(agent.max_rebate_percentage * 100).toFixed(1)}%`);
                console.log(`   盤口類型: ${agent.market_type}`);
                
                // 驗證邏輯正確性
                let logicCorrect = true;
                let errorMessage = '';
                
                if (agent.rebate_mode === 'all' && agent.rebate_percentage > 0.001) {
                    logicCorrect = false;
                    errorMessage = '❌ 全拿模式下退水比例應該是0%';
                } else if (agent.rebate_mode === 'none' && Math.abs(agent.rebate_percentage - agent.max_rebate_percentage) > 0.001) {
                    logicCorrect = false;
                    errorMessage = '❌ 全退下級模式下退水比例應該是最大值';
                } else if (agent.rebate_mode === 'percentage' && (agent.rebate_percentage <= 0 || agent.rebate_percentage > agent.max_rebate_percentage)) {
                    logicCorrect = false;
                    errorMessage = '❌ 按比例模式下退水比例應該在0%到最大值之間';
                }
                
                if (logicCorrect) {
                    console.log(`   ✅ 邏輯正確`);
                } else {
                    console.log(`   ${errorMessage}`);
                }
                console.log('');
            });
        }
        
        console.log('=== 退水分配邏輯說明 ===\n');
        console.log('修正後的邏輯:');
        console.log('1. 「全拿退水」(all): 本代理拿走所有退水 → 下級代理 rebate_percentage = 0%');
        console.log('2. 「全退下級」(none): 本代理不拿退水 → 下級代理 rebate_percentage = 最大值');
        console.log('3. 「按比例分配」(percentage): 下級代理拿設定比例，其餘歸本代理');
        console.log('');
        console.log('退水分配流程:');
        console.log('- 會員下注後，總退水 = 下注金額 × 直屬代理的退水比例');
        console.log('- 從最下級代理開始，根據每個代理的 rebate_percentage 進行分配');
        console.log('- 如果代理的 rebate_percentage = 0，跳過該代理，退水繼續往上分配');
        console.log('- 如果代理的 rebate_percentage > 0，該代理獲得相應比例的退水');
        console.log('');
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error.message);
        if (error.response) {
            console.error('   響應狀態:', error.response.status);
            console.error('   響應數據:', error.response.data);
        }
    }
}

// 執行測試
testRebateLogicFix().catch(console.error); 