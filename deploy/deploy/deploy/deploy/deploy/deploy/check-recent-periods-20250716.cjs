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
            console.log('Period\t\tBets\tUsers\tTotal Amount\tSettled\tFirst Bet\t\t\tLast Settlement');
            console.log('-'.repeat(120));
            
            betResults.rows.forEach(row => {
                console.log(`${row.period}\t${row.total_bets}\t${row.unique_users}\t${row.total_amount}\t\t${row.settled_bets}\t${new Date(row.first_bet).toLocaleString()}\t${row.last_settlement ? new Date(row.last_settlement).toLocaleString() : 'Not settled'}`);
            });
        }
        
        // 2. Check transaction_records for rebates
        console.log('\n\n2. Checking transaction_records for rebates in periods 20250716120-20250716130:\n');
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
                period = '20250716120' OR period = '20250716121' OR period = '20250716122' OR
                period = '20250716123' OR period = '20250716124' OR period = '20250716125' OR
                period = '20250716126' OR period = '20250716127' OR period = '20250716128' OR
                period = '20250716129' OR period = '20250716130' OR
                CAST(REGEXP_REPLACE(period, '[^0-9]', '', 'g') AS bigint) BETWEEN 20250716120 AND 20250716130
            )
            GROUP BY period
            ORDER BY period
        `;
        
        const rebateResults = await pool.query(rebateQuery);
        
        if (rebateResults.rows.length === 0) {
            console.log('No rebates found for periods 20250716120-20250716130');
        } else {
            console.log('Rebate Summary:');
            console.log('Period\t\t\tRebates\tUsers\tTotal Rebate\tFirst Rebate\t\t\tLast Rebate');
            console.log('-'.repeat(120));
            
            rebateResults.rows.forEach(row => {
                console.log(`${row.period}\t${row.rebate_count}\t${row.unique_users}\t${row.total_rebate}\t\t${new Date(row.first_rebate).toLocaleString()}\t${new Date(row.last_rebate).toLocaleString()}`);
            });
        }
        
        // 3. Find periods with bets but no rebates
        console.log('\n\n3. Checking for periods with bets but no rebates:\n');
        const missingRebatesQuery = `
            WITH bet_periods AS (
                SELECT DISTINCT period
                FROM bet_history
                WHERE period >= 20250716120 AND period <= 20250716130
                AND settled = true
            ),
            rebate_periods AS (
                SELECT DISTINCT CAST(REGEXP_REPLACE(period, '[^0-9]', '', 'g') AS bigint) as period
                FROM transaction_records
                WHERE transaction_type = 'rebate'
                AND CAST(REGEXP_REPLACE(period, '[^0-9]', '', 'g') AS bigint) BETWEEN 20250716120 AND 20250716130
            )
            SELECT 
                bp.period,
                COUNT(bh.id) as bet_count,
                SUM(bh.amount) as total_bet_amount
            FROM bet_periods bp
            LEFT JOIN rebate_periods rp ON bp.period = rp.period
            LEFT JOIN bet_history bh ON bh.period = bp.period AND bh.settled = true
            WHERE rp.period IS NULL
            GROUP BY bp.period
            ORDER BY bp.period
        `;
        
        const missingRebates = await pool.query(missingRebatesQuery);
        
        if (missingRebates.rows.length === 0) {
            console.log('All settled periods have corresponding rebates.');
        } else {
            console.log('Periods with settled bets but NO rebates:');
            console.log('Period\t\tSettled Bets\tTotal Amount');
            console.log('-'.repeat(50));
            
            missingRebates.rows.forEach(row => {
                console.log(`${row.period}\t${row.bet_count}\t\t${row.total_bet_amount}`);
            });
        }
        
        // 4. Detailed view of specific periods
        console.log('\n\n4. Detailed breakdown for each period:\n');
        const detailQuery = `
            SELECT 
                bh.period,
                bh.username,
                bh.amount as bet_amount,
                bh.settled,
                bh.created_at as bet_time,
                bh.settled_at,
                tr.amount as rebate_amount,
                tr.created_at as rebate_time
            FROM bet_history bh
            LEFT JOIN transaction_records tr ON 
                tr.member_username = bh.username 
                AND tr.transaction_type = 'rebate'
                AND CAST(REGEXP_REPLACE(tr.period, '[^0-9]', '', 'g') AS bigint) = bh.period
            WHERE bh.period >= 20250716120 AND bh.period <= 20250716130
            ORDER BY bh.period, bh.username, bh.created_at
        `;
        
        const details = await pool.query(detailQuery);
        
        let currentPeriod = null;
        details.rows.forEach(row => {
            if (row.period !== currentPeriod) {
                currentPeriod = row.period;
                console.log(`\n--- Period ${currentPeriod} ---`);
                console.log('Username\tBet Amount\tSettled\tBet Time\t\t\tSettlement Time\t\t\tRebate Amount\tRebate Time');
                console.log('-'.repeat(140));
            }
            
            console.log(`${row.username}\t${row.bet_amount}\t\t${row.settled}\t${new Date(row.bet_time).toLocaleString()}\t${row.settled_at ? new Date(row.settled_at).toLocaleString() : 'Not settled'}\t${row.rebate_amount || 'No rebate'}\t${row.rebate_time ? new Date(row.rebate_time).toLocaleString() : ''}`);
        });
        
    } catch (error) {
        console.error('Error during check:', error);
    } finally {
        await pool.end();
    }
}

// Execute the check
checkRecentPeriods();