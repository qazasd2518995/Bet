const fetch = require('node-fetch');

// Configuration
const LOCAL_API_URL = 'http://localhost:5001';
const PRODUCTION_API_URL = 'https://bet-agent.onrender.com';

// Test both local and production environments
const TEST_ENVIRONMENTS = [
    { name: 'Local', url: LOCAL_API_URL },
    { name: 'Production', url: PRODUCTION_API_URL }
];

// Test users
const TEST_USERS = ['justin111', 'lala222', 'ti2025', 'ti2025a'];

async function testAgentChainAPI(baseUrl, username) {
    try {
        const url = `${baseUrl}/api/agent/member-agent-chain?username=${username}`;
        console.log(`\nTesting: ${url}`);
        
        const response = await fetch(url, {
            timeout: 10000,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Response Status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success) {
                console.log('\n✅ API Response Success');
                console.log(`Agent Chain for ${username}:`);
                
                if (data.agentChain && data.agentChain.length > 0) {
                    console.log('\nAgent Chain Details:');
                    data.agentChain.forEach((agent, index) => {
                        console.log(`\n[Level ${index + 1}] ${agent.username}`);
                        console.log(`  - ID: ${agent.id}`);
                        console.log(`  - Level: ${agent.level}`);
                        console.log(`  - Rebate Mode: ${agent.rebate_mode}`);
                        console.log(`  - Rebate Percentage: ${agent.rebate_percentage} (${(agent.rebate_percentage * 100).toFixed(1)}%)`);
                        console.log(`  - Max Rebate Percentage: ${agent.max_rebate_percentage} (${(agent.max_rebate_percentage * 100).toFixed(1)}%)`);
                        console.log(`  - Market Type: ${agent.market_type || 'Not specified'}`);
                        
                        // Check for potential issues
                        if (agent.rebate_percentage === null || agent.rebate_percentage === undefined) {
                            console.log(`  ⚠️  WARNING: rebate_percentage is null/undefined`);
                        }
                        if (agent.rebate_percentage === 0) {
                            console.log(`  ⚠️  WARNING: rebate_percentage is 0`);
                        }
                        if (agent.rebate_percentage > 1) {
                            console.log(`  ⚠️  WARNING: rebate_percentage > 1 (might be stored as percentage instead of decimal)`);
                        }
                    });
                    
                    // Calculate total rebate
                    const totalRebate = data.agentChain.reduce((sum, agent) => {
                        return sum + (parseFloat(agent.rebate_percentage) || 0);
                    }, 0);
                    
                    console.log(`\n📊 Total Rebate Percentage: ${totalRebate} (${(totalRebate * 100).toFixed(1)}%)`);
                    
                } else {
                    console.log('❌ No agent chain found for this member');
                }
            } else {
                console.log(`❌ API Response Failed: ${data.message}`);
            }
            
            return data;
        } else {
            console.log(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.log(`Error Response: ${errorText}`);
            return null;
        }
        
    } catch (error) {
        console.error(`❌ Request Failed: ${error.message}`);
        if (error.code === 'ECONNREFUSED') {
            console.log('   → Server is not running or not accessible');
        } else if (error.code === 'ETIMEDOUT') {
            console.log('   → Request timed out');
        }
        return null;
    }
}

async function runTests() {
    console.log('='.repeat(60));
    console.log('Agent Chain API - Rebate Percentage Test');
    console.log('='.repeat(60));
    console.log(`Test Time: ${new Date().toISOString()}`);
    
    for (const env of TEST_ENVIRONMENTS) {
        console.log('\n' + '='.repeat(60));
        console.log(`Testing ${env.name} Environment: ${env.url}`);
        console.log('='.repeat(60));
        
        for (const username of TEST_USERS) {
            console.log('\n' + '-'.repeat(40));
            await testAgentChainAPI(env.url, username);
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Test Complete');
    console.log('='.repeat(60));
}

// Run the tests
runTests().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});