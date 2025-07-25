const { Pool } = require('pg');

const pool = new Pool({
  user: 'speed_racing_db_user',
  host: 'dpg-cu28gnlds78s739u44og-a.oregon-postgres.render.com',
  database: 'speed_racing_db',
  password: 'TpVgvjJJiCCzeFWGluFqFeLvJCYEQrXn',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function debugPeriod396() {
  try {
    // 1. Check the actual results for period 396
    console.log('=== CHECKING RESULTS FOR PERIOD 20250714396 ===');
    const resultsQuery = `
      SELECT period_number, position, result_data 
      FROM result_history 
      WHERE period_number = '20250714396' 
      ORDER BY position
    `;
    const results = await pool.query(resultsQuery);
    console.log('Results:', results.rows);
    
    // Find what number was in position 3
    const position3Result = results.rows.find(r => r.position === 3);
    if (position3Result) {
      console.log(`\nPosition 3 result: ${position3Result.result_data}`);
    }
    
    // 2. Check all bets for this period by justin111
    console.log('\n=== CHECKING BETS FOR PERIOD 20250714396 ===');
    const betsQuery = `
      SELECT 
        bh.id,
        bh.username,
        bh.period_number,
        bh.bet_type,
        bh.bet_numbers,
        bh.bet_amount,
        bh.status,
        bh.result,
        bh.win_amount,
        bh.rebate_amount,
        bh.settlement_time,
        bh.created_at
      FROM bet_history bh
      WHERE bh.period_number = '20250714396'
        AND bh.username = 'justin111'
      ORDER BY bh.created_at
    `;
    const bets = await pool.query(betsQuery);
    console.log(`Found ${bets.rows.length} bets for justin111 in period 396:`);
    bets.rows.forEach(bet => {
      console.log(`\nBet ID: ${bet.id}`);
      console.log(`  Type: ${bet.bet_type}`);
      console.log(`  Numbers: ${bet.bet_numbers}`);
      console.log(`  Amount: ${bet.bet_amount}`);
      console.log(`  Status: ${bet.status}`);
      console.log(`  Result: ${bet.result}`);
      console.log(`  Win Amount: ${bet.win_amount}`);
      console.log(`  Settlement Time: ${bet.settlement_time}`);
    });
    
    // 3. Check if there's a bet specifically on position 3 number 1
    const position3Bet = bets.rows.find(bet => 
      bet.bet_type === '位置' && 
      bet.bet_numbers.includes('第3名:1')
    );
    
    if (position3Bet) {
      console.log('\n=== POSITION 3 NUMBER 1 BET DETAILS ===');
      console.log(JSON.stringify(position3Bet, null, 2));
      
      // Check if this should have won
      if (position3Result && position3Result.result_data === 1) {
        console.log('\n⚠️  BET SHOULD HAVE WON! Position 3 result was 1');
        if (position3Bet.result === 'lose') {
          console.log('❌ BUT BET IS MARKED AS LOSS!');
        }
      } else {
        console.log(`\n✓ Bet correctly marked as loss. Position 3 result was ${position3Result?.result_data}`);
      }
    }
    
    // 4. Check settlement records
    console.log('\n=== CHECKING SETTLEMENT RECORDS ===');
    const settlementQuery = `
      SELECT 
        sr.id,
        sr.period_number,
        sr.bet_id,
        sr.username,
        sr.settlement_type,
        sr.amount,
        sr.description,
        sr.created_at
      FROM settlement_records sr
      WHERE sr.period_number = '20250714396'
        AND sr.username = 'justin111'
      ORDER BY sr.created_at
    `;
    const settlements = await pool.query(settlementQuery);
    console.log(`Found ${settlements.rows.length} settlement records:`);
    settlements.rows.forEach(record => {
      console.log(`\n${record.settlement_type}: ${record.amount} - ${record.description}`);
      console.log(`  Bet ID: ${record.bet_id}, Created: ${record.created_at}`);
    });
    
    // 5. Check transaction records for this period
    console.log('\n=== CHECKING TRANSACTION RECORDS ===');
    const transQuery = `
      SELECT 
        tr.id,
        tr.username,
        tr.type,
        tr.amount,
        tr.balance_before,
        tr.balance_after,
        tr.description,
        tr.created_at
      FROM transaction_records tr
      WHERE tr.username = 'justin111'
        AND tr.description LIKE '%20250714396%'
      ORDER BY tr.created_at
    `;
    const trans = await pool.query(transQuery);
    console.log(`Found ${trans.rows.length} transaction records:`);
    trans.rows.forEach(record => {
      console.log(`\n${record.type}: ${record.amount}`);
      console.log(`  Balance: ${record.balance_before} -> ${record.balance_after}`);
      console.log(`  Description: ${record.description}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

debugPeriod396();