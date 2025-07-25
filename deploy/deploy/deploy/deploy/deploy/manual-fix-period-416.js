// manual-fix-period-416.js - Manually fix period 416 settlement
import { Pool } from 'pg';

const pool = new Pool({
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
  ssl: { rejectUnauthorized: false }
});

const period = '20250714416';
const result = [1, 2, 3, 7, 9, 10, 4, 6, 5, 8]; // Result from database

console.log('🔧 Manually fixing period 416 settlement...');
console.log('Result:', result);

// Define what should win based on the results
const winningBets = [
  // Position 1 (champion) = 1 (small, odd)
  { bet_type: 'champion', bet_value: 'small', shouldWin: true },
  { bet_type: 'champion', bet_value: 'odd', shouldWin: true },
  { bet_type: 'champion', bet_value: 'big', shouldWin: false },
  { bet_type: 'champion', bet_value: 'even', shouldWin: false },
  
  // Position 2 (runnerup) = 2 (small, even)
  { bet_type: 'runnerup', bet_value: 'small', shouldWin: true },
  { bet_type: 'runnerup', bet_value: 'even', shouldWin: true },
  { bet_type: 'runnerup', bet_value: 'big', shouldWin: false },
  { bet_type: 'runnerup', bet_value: 'odd', shouldWin: false },
  
  // Position 3 (third) = 3 (small, odd)
  { bet_type: 'third', bet_value: 'small', shouldWin: true },
  { bet_type: 'third', bet_value: 'odd', shouldWin: true },
  { bet_type: 'third', bet_value: 'big', shouldWin: false },
  { bet_type: 'third', bet_value: 'even', shouldWin: false },
  
  // Position 4 (fourth) = 7 (big, odd)
  { bet_type: 'fourth', bet_value: 'big', shouldWin: true },
  { bet_type: 'fourth', bet_value: 'odd', shouldWin: true },
  { bet_type: 'fourth', bet_value: 'small', shouldWin: false },
  { bet_type: 'fourth', bet_value: 'even', shouldWin: false },
  
  // Position 5 (fifth) = 9 (big, odd)
  { bet_type: 'fifth', bet_value: 'big', shouldWin: true },
  { bet_type: 'fifth', bet_value: 'odd', shouldWin: true },
  { bet_type: 'fifth', bet_value: 'small', shouldWin: false },
  { bet_type: 'fifth', bet_value: 'even', shouldWin: false },
];

async function manualFix() {
  try {
    console.log('\n📋 Getting current bet status...');
    const currentBets = await pool.query(`
      SELECT id, bet_type, bet_value, amount, odds, win, win_amount, username
      FROM bet_history 
      WHERE period = $1 
      ORDER BY id
    `, [period]);
    
    console.log(`Found ${currentBets.rows.length} bets`);
    
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      let totalWinAmount = 0;
      let winCount = 0;
      let lossCount = 0;
      
      for (const bet of currentBets.rows) {
        const expectedResult = winningBets.find(w => 
          w.bet_type === bet.bet_type && w.bet_value === bet.bet_value
        );
        
        if (expectedResult) {
          const shouldWin = expectedResult.shouldWin;
          const winAmount = shouldWin ? parseFloat(bet.amount) * parseFloat(bet.odds) : 0;
          
          await client.query(`
            UPDATE bet_history 
            SET win = $1, win_amount = $2, settled = true, settled_at = NOW()
            WHERE id = $3
          `, [shouldWin, winAmount, bet.id]);
          
          if (shouldWin) {
            winCount++;
            totalWinAmount += winAmount;
            console.log(`✅ Bet ${bet.id}: ${bet.bet_type} ${bet.bet_value} -> WIN (${winAmount})`);
          } else {
            lossCount++;
            console.log(`❌ Bet ${bet.id}: ${bet.bet_type} ${bet.bet_value} -> LOSE`);
          }
        } else {
          console.log(`⚠️ Bet ${bet.id}: ${bet.bet_type} ${bet.bet_value} -> Unknown bet type`);
        }
      }
      
      // Update user balance
      if (totalWinAmount > 0) {
        await client.query(`
          UPDATE members 
          SET balance = balance + $1
          WHERE username = 'justin111'
        `, [totalWinAmount]);
        
        // Get current balance for transaction record
        const balanceResult = await client.query(`
          SELECT balance FROM members WHERE username = 'justin111'
        `);
        const currentBalance = parseFloat(balanceResult.rows[0].balance);
        
        // Record transaction
        await client.query(`
          INSERT INTO transaction_records 
          (user_type, user_id, transaction_type, amount, balance_before, balance_after, description, created_at)
          VALUES ('member', (SELECT id FROM members WHERE username = 'justin111'), 'win', $1, $2, $3, $4, NOW())
        `, [totalWinAmount, currentBalance, currentBalance + totalWinAmount, `期號 ${period} 中獎修復 (${winCount}筆)`]);
      }
      
      await client.query('COMMIT');
      
      console.log(`\n✅ Settlement fixed successfully!`);
      console.log(`  - Total bets: ${currentBets.rows.length}`);
      console.log(`  - Wins: ${winCount}`);
      console.log(`  - Losses: ${lossCount}`);
      console.log(`  - Total win amount: ${totalWinAmount}`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

manualFix();