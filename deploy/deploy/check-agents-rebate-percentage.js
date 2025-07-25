// check-agents-rebate-percentage.js - Check actual rebate_percentage values in agents table
import db from './db/config.js';

async function checkAgentsRebatePercentage() {
    console.log('\n=== CHECKING AGENTS REBATE PERCENTAGE VALUES ===\n');
    
    try {
        // 1. Check all agents and their rebate percentages
        console.log('1. ALL AGENTS WITH REBATE PERCENTAGES:');
        const agents = await db.any(`
            SELECT id, username, level, rebate_percentage, max_rebate_percentage, market_type, parent_id
            FROM agents
            ORDER BY level, username
        `);
        
        console.log(`Total agents: ${agents.length}\n`);
        agents.forEach(agent => {
            console.log(`- ${agent.username} (ID: ${agent.id}, Level: ${agent.level})`);
            console.log(`  Market: ${agent.market_type || 'D'}`);
            console.log(`  Rebate %: ${agent.rebate_percentage} (${(agent.rebate_percentage * 100).toFixed(2)}%)`);
            console.log(`  Max Rebate %: ${agent.max_rebate_percentage} (${(agent.max_rebate_percentage * 100).toFixed(2)}%)`);
            console.log('');
        });
        
        // 2. Check member justin111's agent chain
        console.log('\n2. AGENT CHAIN FOR MEMBER justin111:');
        const member = await db.oneOrNone(`
            SELECT m.*, a.username as agent_username, a.id as agent_id
            FROM members m
            LEFT JOIN agents a ON m.agent_id = a.id
            WHERE m.username = 'justin111'
        `);
        
        if (member && member.agent_id) {
            console.log(`Member: ${member.username}, Agent: ${member.agent_username}, Market: ${member.market_type}`);
            
            // Get full agent chain
            let currentAgentId = member.agent_id;
            const agentChain = [];
            
            while (currentAgentId) {
                const agent = await db.oneOrNone(`
                    SELECT id, username, level, rebate_percentage, max_rebate_percentage, parent_id, market_type
                    FROM agents
                    WHERE id = $1
                `, [currentAgentId]);
                
                if (!agent) break;
                
                agentChain.push(agent);
                currentAgentId = agent.parent_id;
            }
            
            console.log('\nAgent chain (from direct agent to top):');
            agentChain.forEach((agent, index) => {
                console.log(`${index + 1}. ${agent.username} (Level ${agent.level})`);
                console.log(`   Rebate: ${agent.rebate_percentage} (${(agent.rebate_percentage * 100).toFixed(2)}%)`);
                console.log(`   Max: ${agent.max_rebate_percentage} (${(agent.max_rebate_percentage * 100).toFixed(2)}%)`);
            });
            
            // 3. Simulate rebate calculation
            console.log('\n3. SIMULATED REBATE CALCULATION:');
            const betAmount = 1000;
            const maxRebatePercentage = member.market_type === 'A' ? 0.011 : 0.041;
            const totalRebatePool = betAmount * maxRebatePercentage;
            
            console.log(`Bet amount: ${betAmount}`);
            console.log(`Market type: ${member.market_type}`);
            console.log(`Max rebate %: ${(maxRebatePercentage * 100).toFixed(1)}%`);
            console.log(`Total rebate pool: ${totalRebatePool.toFixed(2)}`);
            
            let remainingRebate = totalRebatePool;
            let distributedPercentage = 0;
            
            console.log('\nRebate distribution:');
            for (const agent of agentChain) {
                const rebatePercentage = parseFloat(agent.rebate_percentage);
                
                if (remainingRebate <= 0.01) {
                    console.log(`- ${agent.username}: No rebate (pool exhausted)`);
                    continue;
                }
                
                if (isNaN(rebatePercentage) || rebatePercentage <= 0) {
                    console.log(`- ${agent.username}: No rebate (0% setting)`);
                    continue;
                }
                
                const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
                
                if (actualRebatePercentage <= 0) {
                    console.log(`- ${agent.username}: No rebate (already distributed)`);
                    continue;
                }
                
                let agentRebateAmount = betAmount * actualRebatePercentage;
                agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
                agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
                
                remainingRebate -= agentRebateAmount;
                distributedPercentage += actualRebatePercentage;
                
                console.log(`- ${agent.username}: ${(actualRebatePercentage * 100).toFixed(2)}% = ${agentRebateAmount.toFixed(2)} (remaining: ${remainingRebate.toFixed(2)})`);
            }
            
            console.log(`\nPlatform keeps: ${remainingRebate.toFixed(2)}`);
            console.log(`Total distributed: ${(totalRebatePool - remainingRebate).toFixed(2)}`);
        } else {
            console.log('Member justin111 not found or has no agent');
        }
        
    } catch (error) {
        console.error('Error checking agent rebate percentages:', error);
    } finally {
        await db.$pool.end();
    }
}

checkAgentsRebatePercentage();