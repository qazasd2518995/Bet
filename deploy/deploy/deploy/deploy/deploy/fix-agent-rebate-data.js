// fix-agent-rebate-data.js - Fix incorrect rebate percentage data
import db from './db/config.js';

async function fixAgentRebateData() {
    console.log('\n=== FIXING AGENT REBATE DATA ===\n');
    
    try {
        // 1. Find agents with incorrect max_rebate_percentage values
        console.log('1. CHECKING FOR INCORRECT MAX_REBATE_PERCENTAGE VALUES:');
        const incorrectAgents = await db.any(`
            SELECT id, username, rebate_percentage, max_rebate_percentage, market_type
            FROM agents
            WHERE max_rebate_percentage > 1.0 OR max_rebate_percentage < 0
            ORDER BY username
        `);
        
        if (incorrectAgents.length === 0) {
            console.log('No agents with incorrect max_rebate_percentage found.');
        } else {
            console.log(`Found ${incorrectAgents.length} agents with incorrect max_rebate_percentage:`);
            incorrectAgents.forEach(agent => {
                console.log(`- ${agent.username} (ID: ${agent.id}): max_rebate_percentage = ${agent.max_rebate_percentage} (should be ${agent.market_type === 'A' ? '0.011' : '0.041'})`);
            });
            
            // Fix the incorrect values
            console.log('\n2. FIXING INCORRECT VALUES:');
            for (const agent of incorrectAgents) {
                const correctMaxRebate = agent.market_type === 'A' ? 0.011 : 0.041;
                
                await db.none(`
                    UPDATE agents 
                    SET max_rebate_percentage = $1 
                    WHERE id = $2
                `, [correctMaxRebate, agent.id]);
                
                console.log(`✅ Fixed agent ${agent.username}: max_rebate_percentage ${agent.max_rebate_percentage} → ${correctMaxRebate}`);
            }
        }
        
        // 2. Check for agents with rebate_percentage > max_rebate_percentage
        console.log('\n3. CHECKING FOR REBATE_PERCENTAGE > MAX_REBATE_PERCENTAGE:');
        const invalidRebateAgents = await db.any(`
            SELECT id, username, rebate_percentage, max_rebate_percentage, market_type
            FROM agents
            WHERE rebate_percentage > max_rebate_percentage
            ORDER BY username
        `);
        
        if (invalidRebateAgents.length === 0) {
            console.log('No agents with rebate_percentage > max_rebate_percentage found.');
        } else {
            console.log(`Found ${invalidRebateAgents.length} agents with rebate_percentage > max_rebate_percentage:`);
            invalidRebateAgents.forEach(agent => {
                console.log(`- ${agent.username} (ID: ${agent.id}): rebate=${agent.rebate_percentage}, max=${agent.max_rebate_percentage}`);
            });
            
            // Fix by capping rebate_percentage to max_rebate_percentage
            console.log('\n4. FIXING INVALID REBATE PERCENTAGES:');
            for (const agent of invalidRebateAgents) {
                await db.none(`
                    UPDATE agents 
                    SET rebate_percentage = max_rebate_percentage 
                    WHERE id = $1
                `, [agent.id]);
                
                console.log(`✅ Fixed agent ${agent.username}: rebate_percentage ${agent.rebate_percentage} → ${agent.max_rebate_percentage}`);
            }
        }
        
        // 3. Verify all agents have reasonable values
        console.log('\n5. FINAL VERIFICATION:');
        const allAgents = await db.any(`
            SELECT id, username, rebate_percentage, max_rebate_percentage, market_type
            FROM agents
            WHERE market_type IN ('A', 'D')
            ORDER BY market_type, username
        `);
        
        let aMarketIssues = 0;
        let dMarketIssues = 0;
        
        allAgents.forEach(agent => {
            const expectedMax = agent.market_type === 'A' ? 0.011 : 0.041;
            
            if (Math.abs(agent.max_rebate_percentage - expectedMax) > 0.0001) {
                console.log(`⚠️  ${agent.username}: max_rebate_percentage ${agent.max_rebate_percentage} (expected ${expectedMax})`);
                if (agent.market_type === 'A') aMarketIssues++;
                else dMarketIssues++;
            }
            
            if (agent.rebate_percentage > agent.max_rebate_percentage + 0.0001) {
                console.log(`⚠️  ${agent.username}: rebate_percentage ${agent.rebate_percentage} > max ${agent.max_rebate_percentage}`);
                if (agent.market_type === 'A') aMarketIssues++;
                else dMarketIssues++;
            }
        });
        
        console.log(`\nVerification complete:`);
        console.log(`- A market agents: ${allAgents.filter(a => a.market_type === 'A').length} total, ${aMarketIssues} issues`);
        console.log(`- D market agents: ${allAgents.filter(a => a.market_type === 'D').length} total, ${dMarketIssues} issues`);
        
        if (aMarketIssues === 0 && dMarketIssues === 0) {
            console.log('✅ All agent rebate data is now correct!');
        }
        
    } catch (error) {
        console.error('Error fixing agent rebate data:', error);
    } finally {
        await db.$pool.end();
    }
}

fixAgentRebateData();