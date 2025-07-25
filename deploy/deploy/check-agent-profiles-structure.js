// check-agent-profiles-structure.js - Check agent_profiles table structure
import db from './db/config.js';

async function checkAgentProfilesStructure() {
    console.log('\n=== CHECKING AGENT_PROFILES TABLE STRUCTURE ===\n');
    
    try {
        // 1. Check table structure
        console.log('1. AGENT_PROFILES TABLE COLUMNS:');
        const columns = await db.any(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'agent_profiles'
            ORDER BY ordinal_position
        `);
        
        if (columns.length > 0) {
            columns.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
            });
        } else {
            console.log('agent_profiles table not found!');
        }
        
        // 2. Check existing data
        console.log('\n2. EXISTING AGENT PROFILES DATA:');
        const profiles = await db.any(`
            SELECT * FROM agent_profiles LIMIT 10
        `);
        
        console.log(`Found ${profiles.length} profiles`);
        if (profiles.length > 0) {
            console.log('Sample data:');
            console.log(profiles[0]);
        }
        
        // 3. Check agents table for rebate fields
        console.log('\n3. CHECKING AGENTS TABLE FOR REBATE FIELDS:');
        const agentColumns = await db.any(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'agents' 
            AND column_name LIKE '%rebate%'
            ORDER BY ordinal_position
        `);
        
        if (agentColumns.length > 0) {
            console.log('Rebate-related columns in agents table:');
            agentColumns.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type})`);
            });
        } else {
            console.log('No rebate-related columns found in agents table');
        }
        
        // 4. Check members table for rebate fields
        console.log('\n4. CHECKING MEMBERS TABLE FOR REBATE FIELDS:');
        const memberColumns = await db.any(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'members' 
            AND column_name LIKE '%rebate%'
            ORDER BY ordinal_position
        `);
        
        if (memberColumns.length > 0) {
            console.log('Rebate-related columns in members table:');
            memberColumns.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type})`);
            });
        } else {
            console.log('No rebate-related columns found in members table');
        }
        
        // 5. Check for any table with rebate information
        console.log('\n5. SEARCHING FOR REBATE-RELATED TABLES:');
        const rebateTables = await db.any(`
            SELECT DISTINCT table_name 
            FROM information_schema.columns 
            WHERE column_name LIKE '%rebate%' 
            AND table_schema = 'public'
            ORDER BY table_name
        `);
        
        console.log('Tables containing rebate columns:');
        rebateTables.forEach(t => console.log(`- ${t.table_name}`));
        
        // 6. Check transaction_records for rebate transactions
        console.log('\n6. CHECKING RECENT REBATE TRANSACTIONS:');
        const recentRebates = await db.any(`
            SELECT period, COUNT(*) as count, SUM(amount) as total
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND created_at > NOW() - INTERVAL '7 days'
            GROUP BY period
            ORDER BY period DESC
            LIMIT 10
        `);
        
        if (recentRebates.length > 0) {
            console.log('Recent rebate periods:');
            recentRebates.forEach(r => {
                console.log(`- Period ${r.period}: ${r.count} rebates, total: ${r.total}`);
            });
        } else {
            console.log('No recent rebate transactions found');
        }
        
    } catch (error) {
        console.error('Error checking agent profiles structure:', error);
    } finally {
        await db.$pool.end();
    }
}

checkAgentProfilesStructure();