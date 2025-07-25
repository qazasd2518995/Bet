const { Pool } = require('pg');

// Database configuration
const dbConfig = {
    host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bet_game',
    user: 'bet_game_user',
    password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

async function checkRecentPeriods() {
    console.log('===== Checking Periods 20250716120 to 20250716130 =====\n');
    
    try {
        // 1. Check bet_history for these periods
        console.log('1. Checking bet_history table for periods 20250716120-20250716130:\n');
        const betQuery = `
            SELECT 
                period,
                COUNT(*) as total_bets,
                COUNT(DISTINCT username) as unique_users,
                SUM(amount) as total_amount,
                COUNT(CASE WHEN settled = true THEN 1 END) as settled_bets,
                MIN(created_at) as first_bet,
                MAX(created_at) as last_bet,
                MIN(settled_at) as first_settlement,
                MAX(settled_at) as last_settlement
            FROM bet_history
            WHERE period >= 20250716120 AND period <= 20250716130
            GROUP BY period
            ORDER BY period
        `;
        
        const betResults = await pool.query(betQuery);
        
        if (betResults.rows.length === 0) {
            console.log('No bets found for periods 20250716120-20250716130');
        } else {
            console.log('Bet History Summary:');
            console.log('-'.repeat(120));
            
            betResults.rows.forEach(row => {
                console.log(`Period: ${row.period}`);
                console.log(`  Total Bets: ${row.total_bets}`);
                console.log(`  Unique Users: ${row.unique_users}`);
                console.log(`  Total Amount: ${row.total_amount}`);
                console.log(`  Settled Bets: ${row.settled_bets}`);
                console.log(`  First Bet: ${new Date(row.first_bet).toLocaleString()}`);
                console.log(`  Last Bet: ${new Date(row.last_bet).toLocaleString()}`);
                console.log(`  First Settlement: ${row.first_settlement ? new Date(row.first_settlement).toLocaleString() : 'Not settled'}`);
                console.log(`  Last Settlement: ${row.last_settlement ? new Date(row.last_settlement).toLocaleString() : 'Not settled'}`);
                console.log('-'.repeat(50));
            });
        }
        
        // 2. Check transaction_records for rebates (with better handling)
        console.log('\n\n2. Checking transaction_records for rebates in periods 20250716120-20250716130:\n');
        
        // First, let's see what period formats exist in transaction_records
        const periodFormatQuery = `
            SELECT DISTINCT period
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND created_at >= NOW() - INTERVAL '24 hours'
            ORDER BY period DESC
            LIMIT 20
        `;
        
        const periodFormats = await pool.query(periodFormatQuery);
        console.log('Sample period formats in transaction_records:');
        periodFormats.rows.forEach(row => {
            console.log(`  - "${row.period}"`);
        });
        
        // Now check for rebates with various period formats
        const rebateQuery = `
            SELECT 
                period,
                COUNT(*) as rebate_count,
                COUNT(DISTINCT member_username) as unique_users,
                SUM(amount) as total_rebate,
                MIN(created_at) as first_rebate,
                MAX(created_at) as last_rebate
            FROM transaction_records
            WHERE transaction_type = 'rebate'
            AND (
                period IN ('20250716120', '20250716121', '20250716122', '20250716123', '20250716124', 
                          '20250716125', '20250716126', '20250716127', '20250716128', '20250716129', '20250716130')
                OR period LIKE '%20250716120%'
                OR period LIKE '%20250716121%'
                OR period LIKE '%20250716122%'
                OR period LIKE '%20250716123%'
                OR period LIKE '%20250716124%'
                OR period LIKE '%20250716125%'
                OR period LIKE '%20250716126%'
                OR period LIKE '%20250716127%'
                OR period LIKE '%20250716128%'
                OR period LIKE '%20250716129%'
                OR period LIKE '%20250716130%'
            )
            GROUP BY period
            ORDER BY period
        `;
        
        const rebateResults = await pool.query(rebateQuery);
        
        if (rebateResults.rows.length === 0) {
            console.log('\nNo rebates found for periods 20250716120-20250716130');
        } else {
            console.log('\nRebate Summary:');
            console.log('-'.repeat(120));
            
            rebateResults.rows.forEach(row => {
                console.log(`Period: ${row.period}`);
                console.log(`  Rebate Count: ${row.rebate_count}`);
                console.log(`  Unique Users: ${row.unique_users}`);
                console.log(`  Total Rebate: ${row.total_rebate}`);
                console.log(`  First Rebate: ${new Date(row.first_rebate).toLocaleString()}`);
                console.log(`  Last Rebate: ${new Date(row.last_rebate).toLocaleString()}`);
                console.log('-'.repeat(50));
            });
        }
        
        // 3. Check for specific period 20250716121 details
        console.log('\n\n3. Detailed check for period 20250716121 (which has bets):\n');
        
        // Check bets for this period
        const period121BetsQuery = `
            SELECT 
                id, username, amount, bet_type, bet_value, 
                settled, win_amount, created_at, settled_at
            FROM bet_history
            WHERE period = 20250716121
            ORDER BY created_at
        `;
        
        const period121Bets = await pool.query(period121BetsQuery);
        console.log(`Found ${period121Bets.rows.length} bets for period 20250716121:`);
        
        period121Bets.rows.forEach(bet => {
            console.log(`\nBet ID: ${bet.id}`);
            console.log(`  User: ${bet.username}`);
            console.log(`  Amount: ${bet.amount}`);
            console.log(`  Type: ${bet.bet_type}, Value: ${bet.bet_value}`);
            console.log(`  Settled: ${bet.settled}`);
            console.log(`  Win Amount: ${bet.win_amount}`);
            console.log(`  Created: ${new Date(bet.created_at).toLocaleString()}`);
            console.log(`  Settled At: ${bet.settled_at ? new Date(bet.settled_at).toLocaleString() : 'Not settled'}`);
        });
        
        // Check rebates for users who bet in this period
        const period121RebatesQuery = `
            SELECT 
                tr.id, tr.member_username, tr.amount, tr.period, 
                tr.transaction_type, tr.description, tr.created_at
            FROM transaction_records tr
            WHERE tr.transaction_type = 'rebate'
            AND tr.member_username IN (
                SELECT DISTINCT username FROM bet_history WHERE period = 20250716121
            )
            AND tr.created_at >= (SELECT MIN(created_at) FROM bet_history WHERE period = 20250716121)
            ORDER BY tr.created_at DESC
            LIMIT 10
        `;
        
        const period121Rebates = await pool.query(period121RebatesQuery);
        console.log(`\nRecent rebates for users who bet in period 20250716121:`);
        
        if (period121Rebates.rows.length === 0) {
            console.log('No rebates found for these users');
        } else {
            period121Rebates.rows.forEach(rebate => {
                console.log(`\nRebate ID: ${rebate.id}`);
                console.log(`  User: ${rebate.member_username}`);
                console.log(`  Amount: ${rebate.amount}`);
                console.log(`  Period: "${rebate.period}"`);
                console.log(`  Description: ${rebate.description}`);
                console.log(`  Created: ${new Date(rebate.created_at).toLocaleString()}`);
            });
        }
        
    } catch (error) {
        console.error('Error during check:', error);
    } finally {
        await pool.end();
    }
}

// Execute the check
checkRecentPeriods();