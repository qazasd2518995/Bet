import axios from 'axios';
import db from './db/config.js';

const AGENT_API_URL = 'http://localhost:3003/api/agent';

async function testAgentRebateDisplay() {
    console.log('=== 測試代理層級分析報表賺水顯示 ===\n');
    
    try {
        // 1. 創建測試代理結構
        console.log('1. 創建測試代理結構...');
        
        // 找一個總代理
        const topAgent = await db.oneOrNone(`
            SELECT id, username, rebate_percentage 
            FROM agents 
            WHERE level = 0 AND status = 1 
            LIMIT 1
        `);
        
        if (!topAgent) {
            console.error('找不到總代理');
            return;
        }
        
        console.log(`總代理: ${topAgent.username} (退水: ${(topAgent.rebate_percentage * 100).toFixed(1)}%)\n`);
        
        // 2. 查找該總代理下的代理層級
        console.log('2. 查找代理層級結構...');
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
        
        console.log('代理層級結構:');
        agentHierarchy.forEach(agent => {
            const indent = '  '.repeat(agent.depth + 1);
            console.log(`${indent}L${agent.level} ${agent.username} (退水: ${(agent.rebate_percentage * 100).toFixed(1)}%)`);
        });
        
        // 3. 計算預期的賺水顯示
        console.log('\n3. 預期的賺水顯示:');
        
        // 總代理查看一級代理
        agentHierarchy.filter(a => a.depth === 0).forEach(agent => {
            const expectedRebate = topAgent.rebate_percentage - agent.rebate_percentage;
            console.log(`總代理查看 ${agent.username}:`);
            console.log(`  總代理退水: ${(topAgent.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`  一級代理退水: ${(agent.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`  預期賺水: ${(expectedRebate * 100).toFixed(1)}%\n`);
        });
        
        // 4. 找有下注記錄的代理
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
            console.log(`4. 找到有下注記錄的代理: ${agentWithBets.username}`);
            
            // 模擬API調用
            console.log('\n5. 模擬API調用獲取報表...');
            
            // 這裡可以實際調用API，但需要先登入
            // const response = await axios.get(`${AGENT_API_URL}/agent-hierarchical-analysis`, {
            //     headers: { Authorization: `Bearer ${token}` },
            //     params: {
            //         startDate: new Date().toISOString().split('T')[0],
            //         endDate: new Date().toISOString().split('T')[0]
            //     }
            // });
            
            console.log('(需要登入token才能調用API，這裡顯示預期結果)');
            
            // 顯示預期結果
            const expectedRebate = topAgent.rebate_percentage - agentWithBets.rebate_percentage;
            console.log(`\n預期API返回的賺水計算:`);
            console.log(`- 查詢代理(${topAgent.username})退水: ${(topAgent.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`- 下級代理(${agentWithBets.username})退水: ${(agentWithBets.rebate_percentage * 100).toFixed(1)}%`);
            console.log(`- 賺水差額: ${(expectedRebate * 100).toFixed(1)}%`);
            
            // 查找會員
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
                console.log(`\n代理(${agentWithBets.username})查看會員(${memberWithBets.username}):`);
                console.log(`- 代理退水設定: ${(agentWithBets.rebate_percentage * 100).toFixed(1)}%`);
                console.log(`- 預期賺水顯示: ${(agentWithBets.rebate_percentage * 100).toFixed(1)}%`);
                console.log(`- 下注金額: ${memberWithBets.total_amount}`);
                console.log(`- 賺水金額: ${(parseFloat(memberWithBets.total_amount) * agentWithBets.rebate_percentage).toFixed(2)}`);
            }
        } else {
            console.log('4. 今日沒有找到有下注記錄的代理');
            
            // 顯示範例
            console.log('\n範例計算:');
            console.log('假設總代理4.1%開一級代理3.8%:');
            console.log('- 總代理看一級代理的賺水: 0.3% (4.1% - 3.8%)');
            console.log('\n假設一級代理3.8%開二級代理3.6%:');
            console.log('- 一級代理看二級代理的賺水: 0.2% (3.8% - 3.6%)');
            console.log('\n一級代理看會員:');
            console.log('- 賺水顯示: 3.8% (代理自己的完整退水)');
        }
        
        console.log('\n=== 測試完成 ===');
        
    } catch (error) {
        console.error('測試失敗:', error);
    } finally {
        process.exit(0);
    }
}

// 執行測試
testAgentRebateDisplay();