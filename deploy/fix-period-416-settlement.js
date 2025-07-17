// fix-period-416-settlement.js - Fix the incorrect settlement for period 416
import { Pool } from 'pg';
import { comprehensiveSettlement } from './comprehensive-settlement-system.js';

const pool = new Pool({
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
  ssl: { rejectUnauthorized: false }
});

const period = '20250714416';
const correctResult = [1, 2, 3, 7, 9, 10, 4, 6, 5, 8];

console.log('🔧 Fixing settlement for period 416...');
console.log('Correct result:', correctResult);

async function fixSettlement() {
  try {
    console.log('\n📋 Current bets status:');
    const currentBets = await pool.query(`
      SELECT id, bet_type, bet_value, amount, win, win_amount, settled 
      FROM bet_history 
      WHERE period = $1 
      ORDER BY id
    `, [period]);
    
    console.log('Total bets:', currentBets.rows.length);
    const winningBets = currentBets.rows.filter(bet => bet.win);
    console.log('Currently winning bets:', winningBets.length);
    
    // Reset all bets to unsettled
    console.log('\n🔄 Resetting all bets to unsettled...');
    await pool.query(`
      UPDATE bet_history 
      SET settled = false, win = false, win_amount = 0, settled_at = NULL 
      WHERE period = $1
    `, [period]);
    
    // Re-run settlement with correct result
    console.log('\n🎯 Running settlement with correct result...');
    const settlementResult = await comprehensiveSettlement(period, { positions: correctResult });
    
    console.log('Settlement result:', settlementResult);
    
    // Check final status
    console.log('\n📊 Final bets status:');
    const finalBets = await pool.query(`
      SELECT bet_type, bet_value, win, win_amount, COUNT(*) as count 
      FROM bet_history 
      WHERE period = $1 
      GROUP BY bet_type, bet_value, win, win_amount
      ORDER BY bet_type, bet_value
    `, [period]);
    
    console.log('Final bet results:');
    finalBets.rows.forEach(row => {
      console.log(`  ${row.bet_type} ${row.bet_value}: ${row.win ? 'WIN' : 'LOSE'} (${row.count} bets, win_amount: ${row.win_amount})`);
    });
    
    // Summary
    const totalWins = finalBets.rows.filter(row => row.win).reduce((sum, row) => sum + parseInt(row.count), 0);
    const totalLosses = finalBets.rows.filter(row => !row.win).reduce((sum, row) => sum + parseInt(row.count), 0);
    
    console.log(`\n✅ Settlement complete: ${totalWins} wins, ${totalLosses} losses`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixSettlement();