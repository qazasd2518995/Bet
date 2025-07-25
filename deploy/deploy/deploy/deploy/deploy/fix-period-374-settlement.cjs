const { Client } = require('pg');

// Database configuration
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: {
        rejectUnauthorized: false
    }
};

async function fixPeriod374Settlement() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('Connected to database\n');
        
        // Start transaction
        await client.query('BEGIN');
        
        // 1. First verify the winning result
        const resultQuery = await client.query(
            'SELECT period, result FROM result_history WHERE period = $1',
            ['20250714374']
        );
        
        if (resultQuery.rows.length === 0) {
            throw new Error('No result found for period 20250714374');
        }
        
        const result = resultQuery.rows[0];
        console.log('Period:', result.period);
        console.log('Result:', result.result);
        console.log('Champion (position 1):', result.result[0]);
        console.log('');
        
        // 2. Get the bet that should have won
        const betQuery = await client.query(`
            SELECT * FROM bet_history 
            WHERE period = '20250714374'
            AND bet_type = 'number'
            AND bet_value = '5'
            AND position = 1
        `);
        
        if (betQuery.rows.length === 0) {
            throw new Error('No bet found for number 5 on position 1');
        }
        
        const bet = betQuery.rows[0];
        console.log('Found bet to fix:');
        console.log('  Bet ID:', bet.id);
        console.log('  Username:', bet.username);
        console.log('  Amount:', bet.amount);
        console.log('  Odds:', bet.odds);
        console.log('  Current win status:', bet.win);
        console.log('  Current win amount:', bet.win_amount);
        
        // 3. Calculate correct win amount
        const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
        console.log('\nCalculated win amount:', winAmount);
        
        // 4. Update the bet to mark it as won
        await client.query(`
            UPDATE bet_history 
            SET win = true,
                win_amount = $1,
                settled_at = NOW()
            WHERE id = $2
        `, [winAmount, bet.id]);
        
        console.log('\n✅ Updated bet_history');
        
        // 5. Get member's current balance
        const memberQuery = await client.query(
            'SELECT id, balance FROM members WHERE username = $1',
            [bet.username]
        );
        
        if (memberQuery.rows.length === 0) {
            throw new Error(`Member ${bet.username} not found`);
        }
        
        const member = memberQuery.rows[0];
        const oldBalance = parseFloat(member.balance);
        const newBalance = oldBalance + winAmount;
        
        console.log('\nMember balance update:');
        console.log('  Old balance:', oldBalance);
        console.log('  Win amount:', winAmount);
        console.log('  New balance:', newBalance);
        
        // 6. Update member balance
        await client.query(
            'UPDATE members SET balance = $1 WHERE id = $2',
            [newBalance, member.id]
        );
        
        console.log('✅ Updated member balance');
        
        // 7. Add transaction record
        await client.query(`
            INSERT INTO transaction_records 
            (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, ['member', member.id, 'win', winAmount, oldBalance, newBalance, `期號 20250714374 中獎補正`]);
        
        console.log('✅ Added transaction record');
        
        // 8. Update settlement log
        await client.query(`
            UPDATE settlement_logs 
            SET total_win_amount = total_win_amount + $1,
                settlement_details = jsonb_build_object(
                    'fixed_at', NOW()::text,
                    'fixed_bet_id', $2::integer,
                    'fixed_win_amount', $1::numeric,
                    'reason', 'Manual fix for incorrectly settled bet'::text
                )
            WHERE period = $3
        `, [winAmount, bet.id, '20250714374']);
        
        console.log('✅ Updated settlement log');
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('\n🎉 Successfully fixed period 374 settlement!');
        console.log(`User ${bet.username} has been credited ${winAmount} for winning bet on number 5`);
        
        // Verify the fix
        console.log('\n=== Verification ===');
        const verifyBet = await client.query(
            'SELECT win, win_amount FROM bet_history WHERE id = $1',
            [bet.id]
        );
        const verifyMember = await client.query(
            'SELECT balance FROM members WHERE username = $1',
            [bet.username]
        );
        
        console.log('Bet win status:', verifyBet.rows[0].win);
        console.log('Bet win amount:', verifyBet.rows[0].win_amount);
        console.log('Member new balance:', verifyMember.rows[0].balance);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error fixing settlement:', error);
    } finally {
        await client.end();
    }
}

// Ask for confirmation before running
console.log('This script will fix the incorrect settlement for period 20250714374.');
console.log('It will credit the winning amount to the user who bet on number 5.');
console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');

setTimeout(() => {
    fixPeriod374Settlement();
}, 5000);