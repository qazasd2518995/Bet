const pgp = require('pg-promise')();
const dbConfig = require('./db/config');

const db = pgp(dbConfig.development);

async function checkRebateValues() {
    console.log('='.repeat(60));
    console.log('Database Rebate Values Check');
    console.log('='.repeat(60));
    console.log(`Check Time: ${new Date().toISOString()}\n`);
    
    try {
        // 1. Check agents table structure
        console.log('1. Checking agents table structure...');
        const agentColumns = await db.any(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'agents'
            AND column_name IN ('rebate_percentage', 'max_rebate_percentage', 'rebate_mode', 'market_type')
            ORDER BY column_name
        `);
        
        console.log('\nAgent table columns:');
        agentColumns.forEach(col => {
            console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
        });
        
        // 2. Check all agents and their rebate values
        console.log('\n2. All agents and their rebate values:');
        const agents = await db.any(`
            SELECT 
                id, username, level, parent_id,
                rebate_mode, rebate_percentage, max_rebate_percentage,
                market_type, status
            FROM agents
            ORDER BY level, username
        `);
        
        console.log(`\nFound ${agents.length} agents:`);
        agents.forEach(agent => {
            console.log(`\n[${agent.username}] (ID: ${agent.id}, Level: ${agent.level})`);
            console.log(`  - Status: ${agent.status === 1 ? 'Active' : 'Inactive'}`);
            console.log(`  - Parent ID: ${agent.parent_id || 'None (Top level)'}`);
            console.log(`  - Rebate Mode: ${agent.rebate_mode || 'NOT SET'}`);
            console.log(`  - Rebate %: ${agent.rebate_percentage} (${agent.rebate_percentage ? (agent.rebate_percentage * 100).toFixed(1) + '%' : 'NULL'})`);
            console.log(`  - Max Rebate %: ${agent.max_rebate_percentage} (${agent.max_rebate_percentage ? (agent.max_rebate_percentage * 100).toFixed(1) + '%' : 'NULL'})`);
            console.log(`  - Market Type: ${agent.market_type || 'NOT SET'}`);
            
            // Check for issues
            if (!agent.rebate_percentage && agent.rebate_percentage !== 0) {
                console.log(`  ⚠️  WARNING: rebate_percentage is NULL`);
            }
            if (agent.rebate_percentage > 1) {
                console.log(`  ⚠️  WARNING: rebate_percentage > 1 (stored as percentage, not decimal?)`);
            }
        });
        
        // 3. Check specific member chains
        console.log('\n' + '='.repeat(60));
        console.log('3. Checking specific member agent chains:');
        
        const testMembers = ['justin111', 'lala222', 'ti2025', 'ti2025a'];
        
        for (const username of testMembers) {
            console.log(`\n${'-'.repeat(40)}`);
            console.log(`Member: ${username}`);
            
            // Get member info
            const member = await db.oneOrNone(`
                SELECT id, username, agent_id, balance
                FROM members
                WHERE username = $1
            `, [username]);
            
            if (!member) {
                console.log('❌ Member not found');
                continue;
            }
            
            console.log(`  - Member ID: ${member.id}`);
            console.log(`  - Direct Agent ID: ${member.agent_id}`);
            console.log(`  - Balance: ${member.balance}`);
            
            // Build agent chain
            console.log('\n  Agent Chain:');
            let currentAgentId = member.agent_id;
            let level = 1;
            let totalRebate = 0;
            
            while (currentAgentId) {
                const agent = await db.oneOrNone(`
                    SELECT id, username, level, parent_id,
                           rebate_mode, rebate_percentage, max_rebate_percentage,
                           market_type, status
                    FROM agents
                    WHERE id = $1
                `, [currentAgentId]);
                
                if (!agent) {
                    console.log(`  ❌ Agent ID ${currentAgentId} not found`);
                    break;
                }
                
                console.log(`\n  [Level ${level}] ${agent.username} (ID: ${agent.id})`);
                console.log(`    - Rebate: ${agent.rebate_percentage} (${agent.rebate_percentage ? (agent.rebate_percentage * 100).toFixed(1) + '%' : 'NULL'})`);
                console.log(`    - Max: ${agent.max_rebate_percentage} (${agent.max_rebate_percentage ? (agent.max_rebate_percentage * 100).toFixed(1) + '%' : 'NULL'})`);
                console.log(`    - Mode: ${agent.rebate_mode || 'NOT SET'}`);
                console.log(`    - Market: ${agent.market_type || 'NOT SET'}`);
                
                if (agent.rebate_percentage) {
                    totalRebate += parseFloat(agent.rebate_percentage);
                }
                
                currentAgentId = agent.parent_id;
                level++;
            }
            
            console.log(`\n  Total Chain Rebate: ${totalRebate} (${(totalRebate * 100).toFixed(1)}%)`);
        }
        
        // 4. Check for common issues
        console.log('\n' + '='.repeat(60));
        console.log('4. Checking for common issues:');
        
        // Agents with NULL rebate_percentage
        const nullRebateAgents = await db.any(`
            SELECT id, username, level
            FROM agents
            WHERE rebate_percentage IS NULL
            AND status = 1
        `);
        
        if (nullRebateAgents.length > 0) {
            console.log(`\n⚠️  Found ${nullRebateAgents.length} active agents with NULL rebate_percentage:`);
            nullRebateAgents.forEach(agent => {
                console.log(`  - ${agent.username} (ID: ${agent.id}, Level: ${agent.level})`);
            });
        } else {
            console.log('\n✅ No active agents with NULL rebate_percentage');
        }
        
        // Agents with rebate_percentage > 1
        const highRebateAgents = await db.any(`
            SELECT id, username, level, rebate_percentage
            FROM agents
            WHERE rebate_percentage > 1
            AND status = 1
        `);
        
        if (highRebateAgents.length > 0) {
            console.log(`\n⚠️  Found ${highRebateAgents.length} active agents with rebate_percentage > 1:`);
            highRebateAgents.forEach(agent => {
                console.log(`  - ${agent.username}: ${agent.rebate_percentage} (ID: ${agent.id})`);
            });
        } else {
            console.log('\n✅ No active agents with rebate_percentage > 1');
        }
        
        // Check agent_profiles if exists
        const hasAgentProfiles = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.tables 
                WHERE table_name = 'agent_profiles'
            )
        `);
        
        if (hasAgentProfiles && hasAgentProfiles.exists) {
            console.log('\n5. Checking agent_profiles table:');
            const profiles = await db.any(`
                SELECT agent_id, rebate_settings, market_type
                FROM agent_profiles
                LIMIT 10
            `);
            
            console.log(`\nFound ${profiles.length} agent profiles (showing first 10):`);
            profiles.forEach(profile => {
                console.log(`\n  Agent ID: ${profile.agent_id}`);
                console.log(`  Market Type: ${profile.market_type || 'NOT SET'}`);
                if (profile.rebate_settings) {
                    console.log(`  Rebate Settings: ${JSON.stringify(profile.rebate_settings, null, 2)}`);
                }
            });
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.detail) {
            console.error('Detail:', error.detail);
        }
    } finally {
        pgp.end();
    }
}

// Run the check
checkRebateValues();