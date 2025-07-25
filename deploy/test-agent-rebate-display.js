import axios from 'axios';
import db from './db/config.js';

const AGENT_API_URL = 'http://localhost:3003/api/agent';

async function testAgentRebateDisplay() {
    console.log('=== 测试代理层级分析报表赚水显示 ===\n');
    
    try {
        // 1. 创建测试代理结构
        console.log('1. 创建测试代理结构...');
        
        // 找一个总代理
        const topAgent = await db.oneOrNone(`
            SELECT id, username, rebate_percentage 
            FROM agents 
            WHERE level = 0 AND status = 1 
            LIMIT 1
        `);
        
        if (!topAgent) {
            console.error('找不到总代理');
            return;
        }
        
        console.log(`总代理: ${topAgent.username} (退水: ${(topAgent.rebate_percentage * 100).toFixed(1)}%)\n`);
        
        // 2. 查找该总代理下的代理层级
        console.log('2. 查找代理层级结构...');
        const agentHierarchy = await db.any(`
            WITH RECURSIVE agent_tree AS (
                SELECT id, username, parent_id, rebate_percentage, level, 0 as depth
                FROM agents
                WHERE parent_id = $1 AND status = 1
                
                UNION ALL
                
                SELECT a.id, a.username, a.parent_id, a.rebate_percentage, a.level, at.depth + 1
                FROM agents a
                INNER JOIN agent_tree at ON a.parent_id = at.id
                WHERE a.status = 1 AND at.depth < 2
            )
            SELECT * FROM agent_tree
            ORDER BY depth, username
        `, [topAgent.id]);
        
        console.log('代理层级结构:');
        agentHierarchy.forEach(agent => {
            const indent = '  '.repeat(agent.depth + 1);
            console.log(`${indent}L${agent.level} ${agent.username} (退水: ${(agent.rebate_percentage * 100).toFixed(1)}%)`);
        });
        
        // 3. 计算预期的赚水显示
        console.log('\n3. 预期的赚水显示:');
        
        // 总代理查看一级代理
        agentHierarchy.filter(a => a.depth === 0).forEach(agent => {
            const expectedRebate = topAgent.rebate_percentage - agent.rebate_percentage;
            console.log(`总代理查看 ${agent.username}:`);
            console.log(`  总代理退水: ${(topAgent.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`  一级代理退水: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`  预期赚水: ${(expectedRebate * 100).toFixed(1)}%\n`);
        });
        
        // 4. 找有下注记录的代理
        const agentWithBets = await db.oneOrNone(`
            SELECT DISTINCT a.id, a.username, a.rebate_percentage
            FROM agents a
            INNER JOIN members m ON m.agent_id = a.id
            INNER JOIN bet_history bh ON bh.username = m.username
            WHERE a.parent_id = $1 AND a.status = 1
            AND DATE(bh.created_at) = CURRENT_DATE
            LIMIT 1
        `, [topAgent.id]);
        
        if (agentWithBets) {
            console.log(`4. 找到有下注记录的代理: ${agentWithBets.username}`);
            
            // 模拟API调用
            console.log('\n5. 模拟API调用获取报表...');
            
            // 这里可以实际调用API，但需要先登入
            // const response = await axios.get(`${AGENT_API_URL}/agent-hierarchical-analysis`, {
            //     headers: { Authorization: `Bearer ${token}` },
            //     params: {
            //         startDate: new Date().toISOString().split('T')[0],
            //         endDate: new Date().toISOString().split('T')[0]
            //     }
            // });
            
            console.log('(需要登入token才能调用API，这里显示预期结果)');
            
            // 显示预期结果
            const expectedRebate = topAgent.rebate_percentage - agentWithBets.rebate_percentage;
            console.log(`\n预期API返回的赚水计算:`);
            console.log(`- 查询代理(${topAgent.username})退水: ${(topAgent.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`- 下级代理(${agentWithBets.username})退水: ${(agentWithBets.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`- 赚水差额: ${(expectedRebate * 100).toFixed(1)}%`);
            
            // 查找会员
            const memberWithBets = await db.oneOrNone(`
                SELECT m.username, COUNT(bh.id) as bet_count, SUM(bh.amount) as total_amount
                FROM members m
                INNER JOIN bet_history bh ON bh.username = m.username
                WHERE m.agent_id = $1 AND m.status = 1
                AND DATE(bh.created_at) = CURRENT_DATE
                GROUP BY m.username
                LIMIT 1
            `, [agentWithBets.id]);
            
            if (memberWithBets) {
                console.log(`\n代理(${agentWithBets.username})查看会员(${memberWithBets.username}):`);
                console.log(`- 代理退水设定: ${(agentWithBets.rebate_percentage * 100).toFixed(1)}%`);
                console.log(`- 预期赚水显示: ${(agentWithBets.rebate_percentage * 100).toFixed(1)}%`);
                console.log(`- 下注金额: ${memberWithBets.total_amount}`);
                console.log(`- 赚水金额: ${(parseFloat(memberWithBets.total_amount) * agentWithBets.rebate_percentage).toFixed(2)}`);
            }
        } else {
            console.log('4. 今日没有找到有下注记录的代理');
            
            // 显示范例
            console.log('\n范例计算:');
            console.log('假设总代理4.1%开一级代理3.8%:');
            console.log('- 总代理看一级代理的赚水: 0.3% (4.1% - 3.8%)');
            console.log('\n假设一级代理3.8%开二级代理3.6%:');
            console.log('- 一级代理看二级代理的赚水: 0.2% (3.8% - 3.6%)');
            console.log('\n一级代理看会员:');
            console.log('- 赚水显示: 3.8% (代理自己的完整退水)');
        }
        
        console.log('\n=== 测试完成 ===');
        
    } catch (error) {
        console.error('测试失败:', error);
    } finally {
        process.exit(0);
    }
}

// 执行测试
testAgentRebateDisplay();