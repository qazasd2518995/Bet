const fetch = require('node-fetch');
const pgp = require('pg-promise')();
const dbConfig = require('./db/config');

const db = pgp(dbConfig.development);
const LOCAL_API_URL = 'http://localhost:5001';

async function testLocalAPI(username) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing member: ${username}`);
    console.log('='.repeat(50));
    
    try {
        // 1. Get data from database directly
        console.log('\n1. Database Query Results:');
        
        // Get member info
        const member = await db.oneOrNone(`
            SELECT id, username, agent_id
            FROM members
            WHERE username = $1
        `, [username]);
        
        if (!member) {
            console.log('❌ Member not found in database');
            return;
        }
        
        console.log(`\nMember found:`);
        console.log(`  - ID: ${member.id}`);
        console.log(`  - Username: ${member.username}`);
        console.log(`  - Agent ID: ${member.agent_id}`);
        
        // Build agent chain manually
        console.log('\nAgent chain from database:');
        let currentAgentId = member.agent_id;
        let dbChain = [];
        
        while (currentAgentId) {
            const agent = await db.oneOrNone(`
                SELECT id, username, level, parent_id,
                       rebate_mode, rebate_percentage, max_rebate_percentage,
                       market_type, status
                FROM agents
                WHERE id = $1 AND status = 1
            `, [currentAgentId]);
            
            if (!agent) break;
            
            dbChain.push(agent);
            console.log(`\n  [${agent.username}]`);
            console.log(`    - ID: ${agent.id}`);
            console.log(`    - Level: ${agent.level}`);
            console.log(`    - Rebate %: ${agent.rebate_percentage} (raw value from DB)`);
            console.log(`    - Max Rebate %: ${agent.max_rebate_percentage}`);
            console.log(`    - Mode: ${agent.rebate_mode || 'NULL'}`);
            console.log(`    - Market: ${agent.market_type || 'NULL'}`);
            
            currentAgentId = agent.parent_id;
        }
        
        // 2. Call API
        console.log('\n2. API Response:');
        const apiUrl = `${LOCAL_API_URL}/api/agent/member-agent-chain?username=${username}`;
        console.log(`Calling: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
            timeout: 5000
        });
        
        if (!response.ok) {
            console.log(`❌ API Error: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.log(`Error body: ${errorText}`);
            return;
        }
        
        const apiData = await response.json();
        
        if (!apiData.success) {
            console.log(`❌ API returned success: false`);
            console.log(`Message: ${apiData.message}`);
            return;
        }
        
        console.log('\nAPI agent chain:');
        if (apiData.agentChain && apiData.agentChain.length > 0) {
            apiData.agentChain.forEach((agent, index) => {
                console.log(`\n  [${agent.username}]`);
                console.log(`    - ID: ${agent.id}`);
                console.log(`    - Level: ${agent.level}`);
                console.log(`    - Rebate %: ${agent.rebate_percentage} (value from API)`);
                console.log(`    - Max Rebate %: ${agent.max_rebate_percentage}`);
                console.log(`    - Mode: ${agent.rebate_mode}`);
                console.log(`    - Market: ${agent.market_type}`);
            });
        }
        
        // 3. Compare DB vs API
        console.log('\n3. Comparison (DB vs API):');
        
        if (dbChain.length !== apiData.agentChain.length) {
            console.log(`⚠️  Chain length mismatch: DB has ${dbChain.length}, API returns ${apiData.agentChain.length}`);
        }
        
        for (let i = 0; i < Math.min(dbChain.length, apiData.agentChain.length); i++) {
            const dbAgent = dbChain[i];
            const apiAgent = apiData.agentChain[i];
            
            console.log(`\n  Agent: ${dbAgent.username}`);
            
            // Compare rebate_percentage
            if (dbAgent.rebate_percentage !== apiAgent.rebate_percentage) {
                console.log(`    ⚠️  rebate_percentage mismatch:`);
                console.log(`       DB:  ${dbAgent.rebate_percentage} (${typeof dbAgent.rebate_percentage})`);
                console.log(`       API: ${apiAgent.rebate_percentage} (${typeof apiAgent.rebate_percentage})`);
                
                // Check if it's a default value issue
                if (!dbAgent.rebate_percentage && apiAgent.rebate_percentage === 0.041) {
                    console.log(`       → API is using default value 0.041 for NULL`);
                }
            } else {
                console.log(`    ✅ rebate_percentage matches: ${dbAgent.rebate_percentage}`);
            }
            
            // Check for the specific issue
            if (apiAgent.rebate_percentage === 0.041 && (!dbAgent.rebate_percentage || dbAgent.rebate_percentage !== 0.041)) {
                console.log(`    🔍 FOUND ISSUE: API returns 0.041 but DB has ${dbAgent.rebate_percentage || 'NULL'}`);
            }
        }
        
        // 4. Calculate totals
        const dbTotal = dbChain.reduce((sum, agent) => sum + (parseFloat(agent.rebate_percentage) || 0), 0);
        const apiTotal = apiData.agentChain.reduce((sum, agent) => sum + (parseFloat(agent.rebate_percentage) || 0), 0);
        
        console.log('\n4. Total Rebate Calculations:');
        console.log(`  DB Total:  ${dbTotal} (${(dbTotal * 100).toFixed(1)}%)`);
        console.log(`  API Total: ${apiTotal} (${(apiTotal * 100).toFixed(1)}%)`);
        
        if (Math.abs(dbTotal - apiTotal) > 0.0001) {
            console.log(`  ⚠️  Total mismatch: difference of ${Math.abs(dbTotal - apiTotal)}`);
        } else {
            console.log(`  ✅ Totals match`);
        }
        
    } catch (error) {
        console.error(`\n❌ Error testing ${username}:`, error.message);
    }
}

async function runTests() {
    console.log('Local Agent Chain API Test');
    console.log('='.repeat(60));
    console.log(`Test Time: ${new Date().toISOString()}`);
    console.log(`API URL: ${LOCAL_API_URL}`);
    
    const testUsers = ['justin111', 'lala222', 'ti2025', 'ti2025a'];
    
    for (const username of testUsers) {
        await testLocalAPI(username);
    }
    
    // Check the specific code in agentBackend.js
    console.log('\n' + '='.repeat(60));
    console.log('Code Analysis:');
    console.log('='.repeat(60));
    console.log('\nThe API code shows:');
    console.log('```javascript');
    console.log('rebate_percentage: agent.rebate_percentage || 0.041,');
    console.log('max_rebate_percentage: agent.max_rebate_percentage || 0.041,');
    console.log('```');
    console.log('\nThis means:');
    console.log('1. If agent.rebate_percentage is NULL or 0, it defaults to 0.041');
    console.log('2. This could be the source of the issue if agents have NULL or 0 values in DB');
    console.log('3. The calculation logic might be using these default values incorrectly');
    
    pgp.end();
}

// Run the tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    pgp.end();
    process.exit(1);
});