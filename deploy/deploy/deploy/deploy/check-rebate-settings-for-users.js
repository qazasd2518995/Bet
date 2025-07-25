// check-rebate-settings-for-users.js - Check what the rebate settings should be for users 28 and 30
import db from './db/config.js';

async function checkRebateSettings() {
    console.log('\n=== CHECKING REBATE SETTINGS FOR USERS 28 AND 30 ===\n');
    
    try {
        // 1. Check if these are agents or members
        console.log('1. IDENTIFYING USER TYPES:');
        
        // Check agents table
        const agent28 = await db.oneOrNone(`
            SELECT id, username, level, parent_id 
            FROM agents 
            WHERE id = 28
        `);
        
        const agent30 = await db.oneOrNone(`
            SELECT id, username, level, parent_id 
            FROM agents 
            WHERE id = 30
        `);
        
        if (agent28) {
            console.log(`User 28 is an agent: ${agent28.username} (Level ${agent28.level})`);
        }
        if (agent30) {
            console.log(`User 30 is an agent: ${agent30.username} (Level ${agent30.level})`);
        }
        
        // 2. Check agent_profiles for rebate settings
        console.log('\n2. CHECKING AGENT REBATE SETTINGS:');
        
        const profiles = await db.any(`
            SELECT 
                ap.*,
                a.username,
                a.level
            FROM agent_profiles ap
            JOIN agents a ON ap.agent_id = a.id
            WHERE ap.agent_id IN (28, 30)
        `);
        
        profiles.forEach(profile => {
            console.log(`\nAgent: ${profile.username} (ID: ${profile.agent_id}, Level: ${profile.level})`);
            console.log(`- A盤退水: ${profile.a_rebate_rate}%`);
            console.log(`- D盤退水: ${profile.d_rebate_rate}%`);
        });
        
        // 3. Check the bet that triggered these rebates
        console.log('\n3. CHECKING THE ORIGINAL BET:');
        
        const bet = await db.oneOrNone(`
            SELECT 
                bet_id,
                member_id,
                amount,
                market_type
            FROM bet_history 
            WHERE period = '20250716121'
        `);
        
        if (bet) {
            console.log(`Bet found:`);
            console.log(`- Bet ID: ${bet.bet_id}`);
            console.log(`- Member ID: ${bet.member_id}`);
            console.log(`- Amount: ${bet.amount}`);
            console.log(`- Market Type: ${bet.market_type}`);
            
            // Check member details
            const member = await db.oneOrNone(`
                SELECT member_id, username, agent_id, market_type
                FROM members 
                WHERE member_id = $1
            `, [bet.member_id]);
            
            if (member) {
                console.log(`\nMember details:`);
                console.log(`- Username: ${member.username}`);
                console.log(`- Agent ID: ${member.agent_id}`);
                console.log(`- Market Type: ${member.market_type}`);
            }
        }
        
        // 4. Calculate what the rebates should have been
        console.log('\n4. REBATE CALCULATION ANALYSIS:');
        
        if (bet && profiles.length > 0) {
            const betAmount = parseFloat(bet.amount);
            const marketType = bet.market_type || 'A';
            
            console.log(`\nFor bet amount: ${betAmount} on ${marketType}盤`);
            
            for (const profile of profiles) {
                const rebateRate = marketType === 'A' ? profile.a_rebate_rate : profile.d_rebate_rate;
                const expectedRebate = betAmount * (rebateRate / 100);
                
                console.log(`\n${profile.username} (ID: ${profile.agent_id}):`);
                console.log(`- Rebate Rate: ${rebateRate}%`);
                console.log(`- Expected Rebate: ${expectedRebate.toFixed(2)}`);
                
                // Compare with actual
                const actualRecord = await db.oneOrNone(`
                    SELECT amount, rebate_percentage
                    FROM transaction_records
                    WHERE period = '20250716121' 
                    AND user_id = $1 
                    AND transaction_type = 'rebate'
                `, [profile.agent_id]);
                
                if (actualRecord) {
                    console.log(`- Actual Rebate: ${actualRecord.amount}`);
                    console.log(`- Recorded Percentage: ${actualRecord.rebate_percentage}%`);
                    console.log(`- ERROR: Percentage recorded as ${actualRecord.rebate_percentage}% instead of ${rebateRate}%`);
                }
            }
        }
        
        // 5. Check if this is a systematic issue
        console.log('\n5. CHECKING OTHER RECENT REBATE RECORDS:');
        
        const recentRebates = await db.any(`
            SELECT 
                period,
                user_id,
                amount,
                rebate_percentage,
                created_at
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND created_at > NOW() - INTERVAL '24 hours'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        console.log(`\nRecent rebate records (last 24 hours):`);
        recentRebates.forEach(r => {
            console.log(`- Period ${r.period}: User ${r.user_id}, Amount: ${r.amount}, Percentage: ${r.rebate_percentage}%`);
        });
        
    } catch (error) {
        console.error('Error checking rebate settings:', error);
    } finally {
        await db.$pool.end();
    }
}

// Run the check
checkRebateSettings();