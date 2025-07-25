// check-agent-rebate-settings-20250716121.js - Check agent rebate settings
import db from './db/config.js';

async function checkAgentRebateSettings() {
    console.log('\n=== CHECKING AGENT REBATE SETTINGS ===\n');
    
    try {
        // 1. Get the member and their agent hierarchy
        console.log('1. MEMBER AND AGENT HIERARCHY:');
        const member = await db.one(`
            SELECT m.*, a.username as agent_username, a.id as agent_id, a.parent_id
            FROM members m
            LEFT JOIN agents a ON m.agent_id = a.id
            WHERE m.username = 'justin111'
        `);
        
        console.log('Member:', {
            username: member.username,
            agent: member.agent_username,
            agent_id: member.agent_id
        });
        
        // Get full agent hierarchy
        const hierarchy = await db.any(`
            WITH RECURSIVE agent_hierarchy AS (
                SELECT id, username, parent_id, level, 0 as depth
                FROM agents WHERE id = $1
                UNION ALL
                SELECT a.id, a.username, a.parent_id, a.level, ah.depth + 1
                FROM agents a
                JOIN agent_hierarchy ah ON a.id = ah.parent_id
            )
            SELECT * FROM agent_hierarchy ORDER BY depth
        `, [member.agent_id]);
        
        console.log('\nAgent hierarchy:');
        hierarchy.forEach(agent => {
            console.log(`${'  '.repeat(agent.depth)}- ${agent.username} (ID: ${agent.id}, Level: ${agent.level})`);
        });
        
        // 2. Check agent_profiles table
        console.log('\n2. AGENT PROFILES:');
        const profiles = await db.any(`
            SELECT * FROM agent_profiles
            WHERE agent_id IN ($1:csv)
            ORDER BY agent_id
        `, [hierarchy.map(h => h.id)]);
        
        if (profiles.length === 0) {
            console.log('No agent profiles found!');
            
            // Check all agent profiles
            console.log('\n3. ALL AGENT PROFILES IN SYSTEM:');
            const allProfiles = await db.any(`
                SELECT ap.*, a.username 
                FROM agent_profiles ap
                JOIN agents a ON ap.agent_id = a.id
                ORDER BY a.level, a.username
            `);
            
            console.log(`Total agent profiles: ${allProfiles.length}`);
            if (allProfiles.length > 0) {
                console.log('Sample profiles:');
                allProfiles.slice(0, 5).forEach(p => {
                    console.log(`- ${p.username}: A盤退水=${p.a_rebate_rate}%, D盤退水=${p.d_rebate_rate}%`);
                });
            }
        } else {
            console.log('Agent profiles found:');
            profiles.forEach(p => {
                const agent = hierarchy.find(h => h.id === p.agent_id);
                console.log(`- ${agent?.username || 'Unknown'}: A盤退水=${p.a_rebate_rate}%, D盤退水=${p.d_rebate_rate}%`);
            });
        }
        
        // 4. Check if agent needs profile created
        console.log('\n4. MISSING PROFILES:');
        const agentIds = hierarchy.map(h => h.id);
        const profileIds = profiles.map(p => p.agent_id);
        const missingProfiles = agentIds.filter(id => !profileIds.includes(id));
        
        if (missingProfiles.length > 0) {
            console.log('Agents missing profiles:');
            for (const agentId of missingProfiles) {
                const agent = hierarchy.find(h => h.id === agentId);
                console.log(`- ${agent.username} (ID: ${agentId})`);
            }
            
            console.log('\nCreating missing profiles with default values...');
            for (const agentId of missingProfiles) {
                try {
                    await db.none(`
                        INSERT INTO agent_profiles (agent_id, a_rebate_rate, d_rebate_rate)
                        VALUES ($1, 0.2, 0.2)
                        ON CONFLICT (agent_id) DO NOTHING
                    `, [agentId]);
                    console.log(`Created profile for agent ID ${agentId}`);
                } catch (err) {
                    console.error(`Failed to create profile for agent ID ${agentId}:`, err.message);
                }
            }
        } else {
            console.log('All agents have profiles');
        }
        
        // 5. Manual rebate calculation
        console.log('\n5. MANUAL REBATE CALCULATION:');
        const betAmount = 1000;
        console.log(`Bet amount: ${betAmount}`);
        console.log(`Market type: ${member.market_type}`);
        
        // Recalculate with updated profiles
        const updatedProfiles = await db.any(`
            SELECT ap.*, a.username, a.level
            FROM agent_profiles ap
            JOIN agents a ON ap.agent_id = a.id
            WHERE ap.agent_id IN ($1:csv)
            ORDER BY a.level DESC
        `, [hierarchy.map(h => h.id)]);
        
        let totalRebate = 0;
        console.log('\nRebate breakdown:');
        updatedProfiles.forEach(profile => {
            const rate = member.market_type === 'A' ? profile.a_rebate_rate : profile.d_rebate_rate;
            const rebate = betAmount * (rate / 100);
            totalRebate += rebate;
            console.log(`- ${profile.username} (Level ${profile.level}): ${rate}% = ${rebate.toFixed(2)}`);
        });
        console.log(`Total rebate: ${totalRebate.toFixed(2)}`);
        
    } catch (error) {
        console.error('Error checking agent rebate settings:', error);
    } finally {
        await db.$pool.end();
    }
}

checkAgentRebateSettings();