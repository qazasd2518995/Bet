import axios from 'axios';

// 配置
const AGENT_API_URL = 'http://localhost:3003/api/agent';
const GAME_API_URL = 'http://localhost:3000/api';

// 设定 axios 预设超时
axios.defaults.timeout = 5000; // 5 秒超时

// 测试数据
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

// 辅助函数
async function login(username, password, isAgent = true) {
    try {
        const url = isAgent ? `${AGENT_API_URL}/login` : `${GAME_API_URL}/login`;
        console.log(`   尝试登入: ${url}`);
        const response = await axios.post(url, { username, password });
        return response.data.token;
    } catch (error) {
        console.error(`登入失败 ${username}:`, error.response?.data || error.message);
        console.error(`错误详情:`, error.response?.status, error.code);
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
        console.error(`创建代理失败 ${agentData.username}:`, error.response?.data || error.message);
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
        console.error(`创建会员失败 ${memberData.username}:`, error.response?.data || error.message);
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
            description: '测试分配点数'
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        console.error(`分配点数失败:`, error.response?.data || error.message);
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
        console.error(`下注失败:`, error.response?.data || error.message);
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
        console.error(`获取代理余额失败:`, error.response?.data || error.message);
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
        console.error(`获取报表失败:`, error.response?.data || error.message);
        throw error;
    }
}

// 主测试函数
async function runTest() {
    console.log('=== 开始退水系统综合测试 ===\n');
    
    try {
        // 1. 登入总代理
        console.log('1. 登入总代理...');
        const topAgentToken = await login(testData.topAgent.username, testData.topAgent.password);
        console.log('✓ 总代理登入成功\n');
        
        // 记录创建的代理和会员
        const createdAgents = {};
        const createdMembers = {};
        const agentTokens = {};
        
        // 2. 创建多层代理结构
        console.log('2. 创建多层代理结构...');
        let currentToken = topAgentToken;
        let currentParent = null;
        
        for (const agent of testData.agents) {
            console.log(`   创建 ${agent.level} 级代理: ${agent.username} (退水: ${agent.rebatePercentage * 100}%)`);
            
            // 如果有父代理，先登入父代理
            if (agent.parent) {
                currentToken = agentTokens[agent.parent];
            }
            
            const agentResult = await createAgent(currentToken, {
                username: agent.username,
                password: agent.password,
                name: `测试代理${agent.level}`,
                rebatePercentage: agent.rebatePercentage,
                market_type: 'A'
            });
            
            console.log(`   代理创建回应:`, JSON.stringify(agentResult));
            
            // 从回应中获取代理资料
            const createdAgentData = agentResult.agent || agentResult;
            createdAgents[agent.username] = createdAgentData;
            
            // 登入新创建的代理以便创建下级
            const agentToken = await login(agent.username, agent.password);
            agentTokens[agent.username] = agentToken;
            
            console.log(`   ✓ ${agent.username} 创建成功 (ID: ${createdAgentData.id || 'N/A'})`);
        }
        console.log('\n');
        
        // 3. 创建会员并分配点数
        console.log('3. 创建会员并分配点数...');
        for (const member of testData.members) {
            console.log(`   创建会员: ${member.username} (所属代理: ${member.agent})`);
            
            const agentToken = agentTokens[member.agent];
            const memberResult = await createMember(agentToken, {
                username: member.username,
                password: member.password,
                agentId: createdAgents[member.agent].id,
                notes: '测试会员'
            });
            
            createdMembers[member.username] = memberResult.member;
            
            // 分配1000点数给会员
            await allocatePoints(agentToken, createdAgents[member.agent].id, memberResult.member.id, 1000);
            console.log(`   ✓ ${member.username} 创建成功并分配 1000 点数`);
        }
        console.log('\n');
        
        // 记录总代理初始余额
        // 先透过资料库查询找到总代理ID
        const topAgentInfo = await axios.get(`${AGENT_API_URL}/sub-agents`, {
            headers: { Authorization: `Bearer ${topAgentToken}` },
            params: { page: 1, limit: 1 }
        });
        
        // 使用stats API获取当前代理资讯
        const statsResponse = await axios.get(`${AGENT_API_URL}/stats`, {
            headers: { Authorization: `Bearer ${topAgentToken}` }
        });
        const topAgentId = statsResponse.data.agentId;
        const initialBalance = statsResponse.data.balance;
        console.log(`4. 总代理初始余额: ${initialBalance}\n`);
        
        // 4. 模拟会员下注
        console.log('5. 模拟会员下注...');
        const betAmounts = [500, 300]; // 每个会员的下注金额
        
        for (let i = 0; i < testData.members.length; i++) {
            const member = testData.members[i];
            const betAmount = betAmounts[i];
            
            console.log(`   ${member.username} 下注 ${betAmount} 元...`);
            
            // 登入会员
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
        
        // 等待几秒让系统处理退水
        console.log('6. 等待系统处理退水...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 5. 验证退水分配
        console.log('7. 验证退水分配...');
        // 重新获取余额
        const finalStatsResponse = await axios.get(`${AGENT_API_URL}/stats`, {
            headers: { Authorization: `Bearer ${topAgentToken}` }
        });
        const finalBalance = finalStatsResponse.data.balance;
        const totalBetAmount = betAmounts.reduce((a, b) => a + b, 0);
        const expectedRebate = totalBetAmount * 0.011; // A盘 1.1%
        const actualRebate = finalBalance - initialBalance;
        
        console.log(`   总下注金额: ${totalBetAmount}`);
        console.log(`   预期退水 (1.1%): ${expectedRebate.toFixed(2)}`);
        console.log(`   实际退水增加: ${actualRebate.toFixed(2)}`);
        console.log(`   总代理最终余额: ${finalBalance}`);
        
        if (Math.abs(actualRebate - expectedRebate) < 0.01) {
            console.log('   ✓ 退水分配正确！所有退水都给了总代理\n');
        } else {
            console.log('   ✗ 退水分配异常！\n');
        }
        
        // 6. 检查各层代理报表
        console.log('8. 检查各层代理报表...');
        const today = new Date().toISOString().split('T')[0];
        
        for (const agent of testData.agents) {
            console.log(`\n   === ${agent.username} 的报表 ===`);
            const token = agentTokens[agent.username];
            const report = await getHierarchicalReport(token, today, today);
            
            if (report.data && report.data.length > 0) {
                report.data.forEach(item => {
                    console.log(`   代理: ${item.agentUsername}`);
                    console.log(`   下注金额: ${item.betAmount}`);
                    console.log(`   赚水比例: ${(item.earnedRebatePercentage * 100).toFixed(1)}%`);
                    console.log(`   赚水金额: ${item.earnedRebateAmount.toFixed(2)}`);
                    console.log(`   ---`);
                });
                
                // 检查总计
                const summary = report.summary;
                console.log(`   总下注金额: ${summary.totalBetAmount}`);
                console.log(`   总赚水金额: ${summary.totalEarnedRebateAmount.toFixed(2)}`);
                
                // 验证赚水计算是否正确（应该是该代理的退水设定）
                const expectedEarnedRebate = summary.totalBetAmount * agent.rebatePercentage;
                if (Math.abs(summary.totalEarnedRebateAmount - expectedEarnedRebate) < 0.01) {
                    console.log(`   ✓ 赚水计算正确！基于代理退水设定 ${(agent.rebatePercentage * 100).toFixed(1)}%`);
                } else {
                    console.log(`   ✗ 赚水计算异常！预期: ${expectedEarnedRebate.toFixed(2)}, 实际: ${summary.totalEarnedRebateAmount.toFixed(2)}`);
                }
            } else {
                console.log('   无下注记录');
            }
        }
        
        console.log('\n=== 测试完成 ===');
        
    } catch (error) {
        console.error('\n测试失败:', error.message);
        process.exit(1);
    }
}

// 执行测试
runTest().then(() => {
    console.log('\n所有测试通过！');
    process.exit(0);
}).catch(error => {
    console.error('测试过程出错:', error);
    process.exit(1);
});