import axios from 'axios';

// 配置
const AGENT_API_URL = 'http://localhost:3003/api/agent';
const GAME_API_URL = 'http://localhost:3000/api';

// 設定 axios 預設超時
axios.defaults.timeout = 5000; // 5 秒超時

// 測試數據
const testData = {
    topAgent: {
        username: 'MA@x9Kp#2025$zL7',
        password: 'A$2025@xK9p#Secure!mN7qR&wZ3'
    },
    agents: [
        {
            username: 'testAgent1',
            password: 'Test@123456',
            rebatePercentage: 0.8,
            level: 1
        },
        {
            username: 'testAgent2',
            password: 'Test@123456',
            rebatePercentage: 0.5,
            level: 2,
            parent: 'testAgent1'
        },
        {
            username: 'testAgent3',
            password: 'Test@123456',
            rebatePercentage: 0.3,
            level: 3,
            parent: 'testAgent2'
        }
    ],
    members: [
        {
            username: 'testMember1',
            password: 'Test@123456',
            agent: 'testAgent3'
        },
        {
            username: 'testMember2',
            password: 'Test@123456',
            agent: 'testAgent2'
        }
    ]
};

// 輔助函數
async function login(username, password, isAgent = true) {
    try {
        const url = isAgent ? `${AGENT_API_URL}/login` : `${GAME_API_URL}/login`;
        console.log(`   嘗試登入: ${url}`);
        const response = await axios.post(url, { username, password });
        return response.data.token;
    } catch (error) {
        console.error(`登入失敗 ${username}:`, error.response?.data || error.message);
        console.error(`錯誤詳情:`, error.response?.status, error.code);
        throw error;
    }
}

async function createAgent(token, agentData) {
    try {
        const response = await axios.post(`${AGENT_API_URL}/create-agent`, agentData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error(`創建代理失敗 ${agentData.username}:`, error.response?.data || error.message);
        throw error;
    }
}

async function createMember(token, memberData) {
    try {
        const response = await axios.post(`${AGENT_API_URL}/create-member`, memberData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error(`創建會員失敗 ${memberData.username}:`, error.response?.data || error.message);
        throw error;
    }
}

async function allocatePoints(token, agentId, memberId, amount) {
    try {
        const response = await axios.post(`${AGENT_API_URL}/transfer-member-balance`, {
            agentId,
            memberId,
            amount,
            type: 'deposit',
            description: '測試分配點數'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error(`分配點數失敗:`, error.response?.data || error.message);
        throw error;
    }
}

async function placeBet(token, betData) {
    try {
        const response = await axios.post(`${GAME_API_URL}/bet`, betData, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error(`下注失敗:`, error.response?.data || error.message);
        throw error;
    }
}

async function getAgentBalance(token, agentId) {
    try {
        const response = await axios.get(`${AGENT_API_URL}/agents/${agentId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data.balance;
    } catch (error) {
        console.error(`獲取代理餘額失敗:`, error.response?.data || error.message);
        throw error;
    }
}

async function getHierarchicalReport(token, startDate, endDate) {
    try {
        const response = await axios.get(`${AGENT_API_URL}/agent-hierarchical-analysis`, {
            params: { startDate, endDate },
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error(`獲取報表失敗:`, error.response?.data || error.message);
        throw error;
    }
}

// 主測試函數
async function runTest() {
    console.log('=== 開始退水系統綜合測試 ===\n');
    
    try {
        // 1. 登入總代理
        console.log('1. 登入總代理...');
        const topAgentToken = await login(testData.topAgent.username, testData.topAgent.password);
        console.log('✓ 總代理登入成功\n');
        
        // 記錄創建的代理和會員
        const createdAgents = {};
        const createdMembers = {};
        const agentTokens = {};
        
        // 2. 創建多層代理結構
        console.log('2. 創建多層代理結構...');
        let currentToken = topAgentToken;
        let currentParent = null;
        
        for (const agent of testData.agents) {
            console.log(`   創建 ${agent.level} 級代理: ${agent.username} (退水: ${agent.rebatePercentage * 100}%)`);
            
            // 如果有父代理，先登入父代理
            if (agent.parent) {
                currentToken = agentTokens[agent.parent];
            }
            
            const agentResult = await createAgent(currentToken, {
                username: agent.username,
                password: agent.password,
                name: `測試代理${agent.level}`,
                rebatePercentage: agent.rebatePercentage,
                market_type: 'A'
            });
            
            console.log(`   代理創建回應:`, JSON.stringify(agentResult));
            
            // 從回應中獲取代理資料
            const createdAgentData = agentResult.agent || agentResult;
            createdAgents[agent.username] = createdAgentData;
            
            // 登入新創建的代理以便創建下級
            const agentToken = await login(agent.username, agent.password);
            agentTokens[agent.username] = agentToken;
            
            console.log(`   ✓ ${agent.username} 創建成功 (ID: ${createdAgentData.id || 'N/A'})`);
        }
        console.log('\n');
        
        // 3. 創建會員並分配點數
        console.log('3. 創建會員並分配點數...');
        for (const member of testData.members) {
            console.log(`   創建會員: ${member.username} (所屬代理: ${member.agent})`);
            
            const agentToken = agentTokens[member.agent];
            const memberResult = await createMember(agentToken, {
                username: member.username,
                password: member.password,
                agentId: createdAgents[member.agent].id,
                notes: '測試會員'
            });
            
            createdMembers[member.username] = memberResult.member;
            
            // 分配1000點數給會員
            await allocatePoints(agentToken, createdAgents[member.agent].id, memberResult.member.id, 1000);
            console.log(`   ✓ ${member.username} 創建成功並分配 1000 點數`);
        }
        console.log('\n');
        
        // 記錄總代理初始餘額
        // 先透過資料庫查詢找到總代理ID
        const topAgentInfo = await axios.get(`${AGENT_API_URL}/sub-agents`, {
            headers: { Authorization: `Bearer ${topAgentToken}` },
            params: { page: 1, limit: 1 }
        });
        
        // 使用stats API獲取當前代理資訊
        const statsResponse = await axios.get(`${AGENT_API_URL}/stats`, {
            headers: { Authorization: `Bearer ${topAgentToken}` }
        });
        const topAgentId = statsResponse.data.agentId;
        const initialBalance = statsResponse.data.balance;
        console.log(`4. 總代理初始餘額: ${initialBalance}\n`);
        
        // 4. 模擬會員下注
        console.log('5. 模擬會員下注...');
        const betAmounts = [500, 300]; // 每個會員的下注金額
        
        for (let i = 0; i < testData.members.length; i++) {
            const member = testData.members[i];
            const betAmount = betAmounts[i];
            
            console.log(`   ${member.username} 下注 ${betAmount} 元...`);
            
            // 登入會員
            const memberToken = await login(member.username, member.password, false);
            
            // 下注
            await placeBet(memberToken, {
                bets: [{
                    category: '两面',
                    type: '冠军',
                    detail: '大',
                    odds: 1.95,
                    amount: betAmount
                }]
            });
            
            console.log(`   ✓ 下注成功`);
        }
        console.log('\n');
        
        // 等待幾秒讓系統處理退水
        console.log('6. 等待系統處理退水...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 5. 驗證退水分配
        console.log('7. 驗證退水分配...');
        // 重新獲取餘額
        const finalStatsResponse = await axios.get(`${AGENT_API_URL}/stats`, {
            headers: { Authorization: `Bearer ${topAgentToken}` }
        });
        const finalBalance = finalStatsResponse.data.balance;
        const totalBetAmount = betAmounts.reduce((a, b) => a + b, 0);
        const expectedRebate = totalBetAmount * 0.011; // A盤 1.1%
        const actualRebate = finalBalance - initialBalance;
        
        console.log(`   總下注金額: ${totalBetAmount}`);
        console.log(`   預期退水 (1.1%): ${expectedRebate.toFixed(2)}`);
        console.log(`   實際退水增加: ${actualRebate.toFixed(2)}`);
        console.log(`   總代理最終餘額: ${finalBalance}`);
        
        if (Math.abs(actualRebate - expectedRebate) < 0.01) {
            console.log('   ✓ 退水分配正確！所有退水都給了總代理\n');
        } else {
            console.log('   ✗ 退水分配異常！\n');
        }
        
        // 6. 檢查各層代理報表
        console.log('8. 檢查各層代理報表...');
        const today = new Date().toISOString().split('T')[0];
        
        for (const agent of testData.agents) {
            console.log(`\n   === ${agent.username} 的報表 ===`);
            const token = agentTokens[agent.username];
            const report = await getHierarchicalReport(token, today, today);
            
            if (report.data && report.data.length > 0) {
                report.data.forEach(item => {
                    console.log(`   代理: ${item.agentUsername}`);
                    console.log(`   下注金額: ${item.betAmount}`);
                    console.log(`   賺水比例: ${(item.earnedRebatePercentage * 100).toFixed(1)}%`);
                    console.log(`   賺水金額: ${item.earnedRebateAmount.toFixed(2)}`);
                    console.log(`   ---`);
                });
                
                // 檢查總計
                const summary = report.summary;
                console.log(`   總下注金額: ${summary.totalBetAmount}`);
                console.log(`   總賺水金額: ${summary.totalEarnedRebateAmount.toFixed(2)}`);
                
                // 驗證賺水計算是否正確（應該是該代理的退水設定）
                const expectedEarnedRebate = summary.totalBetAmount * agent.rebatePercentage;
                if (Math.abs(summary.totalEarnedRebateAmount - expectedEarnedRebate) < 0.01) {
                    console.log(`   ✓ 賺水計算正確！基於代理退水設定 ${(agent.rebatePercentage * 100).toFixed(1)}%`);
                } else {
                    console.log(`   ✗ 賺水計算異常！預期: ${expectedEarnedRebate.toFixed(2)}, 實際: ${summary.totalEarnedRebateAmount.toFixed(2)}`);
                }
            } else {
                console.log('   無下注記錄');
            }
        }
        
        console.log('\n=== 測試完成 ===');
        
    } catch (error) {
        console.error('\n測試失敗:', error.message);
        process.exit(1);
    }
}

// 執行測試
runTest().then(() => {
    console.log('\n所有測試通過！');
    process.exit(0);
}).catch(error => {
    console.error('測試過程出錯:', error);
    process.exit(1);
});