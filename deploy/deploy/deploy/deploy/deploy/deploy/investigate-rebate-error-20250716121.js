// investigate-rebate-error-20250716121.js - Investigate rebate error for period 20250716121
import db from './db/config.js';

const PERIOD = '20250716121';

async function investigateRebateError() {
    console.log(`\n=== INVESTIGATING REBATE ERROR FOR PERIOD ${PERIOD} ===\n`);
    
    try {
        // 1. Check the exact error - data type mismatch
        console.log('1. CHECKING DATA TYPE ISSUE:');
        console.log('Error: "operator does not exist: character varying = bigint"');
        console.log('This suggests period is stored as VARCHAR in transaction_records but as BIGINT in bet_history\n');
        
        // 2. Check member who placed bet
        console.log('2. CHECKING MEMBER DETAILS:');
        const member = await db.oneOrNone(`
            SELECT m.*, a.username as agent_username, a.level as agent_level
            FROM members m
            LEFT JOIN agents a ON m.agent_id = a.id
            WHERE m.username = 'justin111'
        `);
        
        if (member) {
            console.log('Member details:', {
                id: member.id,
                username: member.username,
                balance: member.balance,
                agent: member.agent_username,
                agent_level: member.agent_level,
                market_type: member.market_type
            });
        }
        
        // 3. Check rebate settings for the member
        console.log('\n3. CHECKING REBATE SETTINGS:');
        const rebateSettings = await db.any(`
            SELECT ap.*, a.username as agent_username, a.level
            FROM agent_profiles ap
            JOIN agents a ON ap.agent_id = a.id
            WHERE ap.agent_id = $1 OR a.id IN (
                WITH RECURSIVE agent_hierarchy AS (
                    SELECT id, parent_id, level FROM agents WHERE id = $1
                    UNION ALL
                    SELECT a.id, a.parent_id, a.level 
                    FROM agents a
                    JOIN agent_hierarchy ah ON a.id = ah.parent_id
                )
                SELECT id FROM agent_hierarchy
            )
            ORDER BY a.level DESC
        `, [member?.agent_id]);
        
        console.log('Rebate settings found:', rebateSettings.length);
        rebateSettings.forEach(setting => {
            console.log(`- Agent: ${setting.agent_username} (Level ${setting.level})`);
            console.log(`  A盤退水: ${setting.a_rebate_rate}%`);
            console.log(`  D盤退水: ${setting.d_rebate_rate}%`);
        });
        
        // 4. Test the rebate calculation manually
        console.log('\n4. TESTING MANUAL REBATE CALCULATION:');
        const bet = await db.one(`
            SELECT * FROM bet_history 
            WHERE period = $1 AND username = 'justin111'
        `, [PERIOD]);
        
        console.log('Bet details:', {
            amount: bet.amount,
            market_type: member?.market_type || 'A'
        });
        
        // 5. Try to process rebate with proper type conversion
        console.log('\n5. ATTEMPTING TO PROCESS REBATE WITH TYPE CONVERSION:');
        
        // First, check if rebate already exists (with type conversion)
        const existingRebate = await db.oneOrNone(`
            SELECT * FROM transaction_records 
            WHERE period = $1::text 
            AND user_id = $2 
            AND user_type = 'member' 
            AND transaction_type = 'rebate'
        `, [PERIOD, member.id]);
        
        if (existingRebate) {
            console.log('Rebate already exists:', existingRebate);
        } else {
            console.log('No existing rebate found');
            
            // Calculate what the rebate should be
            const marketType = member.market_type || 'A';
            const rebateField = marketType === 'A' ? 'a_rebate_rate' : 'd_rebate_rate';
            const relevantSettings = rebateSettings.filter(s => s[rebateField] > 0);
            
            if (relevantSettings.length > 0) {
                console.log('\nRebate calculation:');
                relevantSettings.forEach(setting => {
                    const rebateRate = setting[rebateField];
                    const rebateAmount = parseFloat(bet.amount) * (rebateRate / 100);
                    console.log(`- ${setting.agent_username}: ${rebateRate}% = ${rebateAmount.toFixed(2)}`);
                });
            }
        }
        
        // 6. Check the SQL query that's failing
        console.log('\n6. DEBUGGING THE FAILING QUERY:');
        console.log('The error suggests the query is trying to compare:');
        console.log('transaction_records.period (VARCHAR) = bet_history.period (BIGINT)');
        console.log('\nSolution: Convert the period to the same data type in queries');
        console.log('Example: WHERE t.period = b.period::text OR WHERE t.period::bigint = b.period');
        
    } catch (error) {
        console.error('Error investigating rebate:', error);
    } finally {
        await db.$pool.end();
    }
}

investigateRebateError();