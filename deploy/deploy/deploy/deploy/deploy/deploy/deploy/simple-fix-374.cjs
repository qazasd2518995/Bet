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

async function simpleFix374() {
    const client = new Client(dbConfig);
    
    try {
        await client.connect();
        console.log('Connected to database\n');
        
        // Start transaction
        await client.query('BEGIN');
        
        // 1. Get the bet that should have won
        const betQuery = await client.query(`
            SELECT * FROM bet_history 
            WHERE id = 2373
        `);
        
        const bet = betQuery.rows[0];
        console.log('Current bet status:');
        console.log('  Win:', bet.win);
        console.log('  Win amount:', bet.win_amount);
        
        if (bet.win) {
            console.log('\nBet is already marked as won. Nothing to do.');
            return;
        }
        
        // 2. Calculate win amount
        const winAmount = parseFloat(bet.amount) * parseFloat(bet.odds);
        console.log('\nWin amount to credit:', winAmount);
        
        // 3. Update bet
        await client.query(`
            UPDATE bet_history 
            SET win = true, win_amount = $1
            WHERE id = 2373
        `, [winAmount]);
        
        console.log('✅ Updated bet_history');
        
        // 4. Update member balance
        const memberQuery = await client.query(
            'SELECT id, balance FROM members WHERE username = $1',
            [bet.username]
        );
        
        const member = memberQuery.rows[0];
        const oldBalance = parseFloat(member.balance);
        const newBalance = oldBalance + winAmount;
        
        await client.query(
            'UPDATE members SET balance = $1 WHERE id = $2',
            [newBalance, member.id]
        );
        
        console.log('✅ Updated member balance from', oldBalance, 'to', newBalance);
        
        // 5. Add transaction record
        await client.query(`
            INSERT INTO transaction_records 
            (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, ['member', member.id, 'win', winAmount, oldBalance, newBalance, `期號 20250714374 中獎補正`]);
        
        console.log('✅ Added transaction record');
        
        // Commit
        await client.query('COMMIT');
        
        console.log('\n🎉 Successfully fixed the settlement!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error:', error);
    } finally {
        await client.end();
    }
}

simpleFix374();