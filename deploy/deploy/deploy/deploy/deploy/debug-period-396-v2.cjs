const { Pool } = require('pg');

const pool = new Pool({
  user: 'speed_racing_db_user',
  host: 'dpg-cu28gnlds78s739u44og-a.oregon-postgres.render.com',
  database: 'speed_racing_db',
  password: 'TpVgvjJJiCCzeFWGluFqFeLvJCYEQrXn',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 30000,
  query_timeout: 30000
});

async function debugPeriod396() {
  let client;
  try {
    client = await pool.connect();
    
    // 1. First check the results stored in result_history
    console.log('=== CHECKING RESULTS IN result_history FOR PERIOD 20250714396 ===');
    const resultsQuery = `
      SELECT period_number, position, result_data, created_at
      FROM result_history 
      WHERE period_number = '20250714396' 
      ORDER BY position
    `;
    const results = await client.query(resultsQuery);
    console.log('Results by position:');
    results.rows.forEach(r => {
      console.log(`  Position ${r.position}: ${r.result_data}`);
    });
    
    // Find what number was in position 3
    const position3Result = results.rows.find(r => r.position === 3);
    if (position3Result) {
      console.log(`\n⭐ Position 3 result: ${position3Result.result_data}`);
    }
    
    // 2. Check draw_results table which might have the consolidated result
    console.log('\n=== CHECKING draw_results TABLE ===');
    const drawQuery = `
      SELECT * FROM draw_results 
      WHERE period = '20250714396'
    `;
    const drawResults = await client.query(drawQuery);
    if (drawResults.rows.length > 0) {
      console.log('Draw result:', JSON.stringify(drawResults.rows[0], null, 2));
    }
    
    // 3. Check all bets for this period
    console.log('\n=== CHECKING ALL BETS FOR PERIOD 20250714396 ===');
    const allBetsQuery = `
      SELECT 
        id,
        username,
        period,
        bet_type,
        bet_value,
        position,
        amount,
        odds,
        status,
        is_win,
        win_amount,
        settled,
        settlement_time,
        created_at
      FROM bet_history 
      WHERE period = '20250714396'
      ORDER BY created_at
    `;
    const allBets = await client.query(allBetsQuery);
    console.log(`Total bets for period 396: ${allBets.rows.length}`);
    
    // Find justin111's bets
    const justin111Bets = allBets.rows.filter(b => b.username === 'justin111');
    console.log(`\nJustin111's bets: ${justin111Bets.length}`);
    
    justin111Bets.forEach(bet => {
      console.log(`\n--- Bet ID: ${bet.id} ---`);
      console.log(`  Type: ${bet.bet_type}`);
      console.log(`  Value: ${bet.bet_value}`);
      console.log(`  Position: ${bet.position}`);
      console.log(`  Amount: ${bet.amount}`);
      console.log(`  Status: ${bet.status}`);
      console.log(`  Settled: ${bet.settled}`);
      console.log(`  Is Win: ${bet.is_win}`);
      console.log(`  Win Amount: ${bet.win_amount}`);
      
      // Check if this is a position 3 bet
      if (bet.position === 3 || 
          (bet.bet_type === '第三名' || bet.bet_type === '季軍') && bet.bet_value === '1') {
        console.log('\n⚠️  THIS IS A POSITION 3 BET!');
        if (position3Result && position3Result.result_data === 1) {
          console.log('✅ Position 3 was 1 - THIS SHOULD BE A WIN!');
          if (!bet.is_win) {
            console.log('❌ BUT IT\'S MARKED AS A LOSS!');
          }
        }
      }
    });
    
    // 4. Check the bet_numbers format (if stored differently)
    console.log('\n=== CHECKING bet_numbers COLUMN ===');
    const betNumbersQuery = `
      SELECT id, username, bet_numbers, bet_type, bet_value, position, is_win
      FROM bet_history 
      WHERE period = '20250714396' 
        AND username = 'justin111'
        AND (bet_numbers LIKE '%第3名%' OR position = 3 OR bet_type = '第三名' OR bet_type = '季軍')
    `;
    const betNumbers = await client.query(betNumbersQuery);
    if (betNumbers.rows.length > 0) {
      console.log('Bets with position 3 reference:');
      betNumbers.rows.forEach(bet => {
        console.log(`\nBet ${bet.id}:`);
        console.log(`  bet_numbers: ${bet.bet_numbers}`);
        console.log(`  bet_type: ${bet.bet_type}`);
        console.log(`  bet_value: ${bet.bet_value}`);
        console.log(`  position: ${bet.position}`);
        console.log(`  is_win: ${bet.is_win}`);
      });
    }
    
    // 5. Check transaction records
    console.log('\n=== CHECKING TRANSACTIONS ===');
    const transQuery = `
      SELECT * FROM transaction_records 
      WHERE username = 'justin111' 
        AND description LIKE '%20250714396%'
      ORDER BY created_at
    `;
    const trans = await client.query(transQuery);
    console.log(`Found ${trans.rows.length} transactions for period 396`);
    trans.rows.forEach(t => {
      console.log(`\n${t.type}: ${t.amount} - ${t.description}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

debugPeriod396();