// test-period-416-settlement.js - Test settlement logic for period 416
import settlementSystem from './comprehensive-settlement-system.js';
const { checkBetWin, normalizeDrawResult } = settlementSystem;

// Test data for period 416
const period = '20250714416';
const result = [1, 2, 3, 7, 9, 10, 4, 6, 5, 8];

console.log('Testing Period 416 Settlement Logic');
console.log('Result:', result);
console.log('');

// Test the normalize function
const normalizedResult = normalizeDrawResult({ positions: result });
console.log('Normalized result:', normalizedResult);

// Test sample bets that should have won
const testBets = [
    { id: 1, bet_type: 'champion', bet_value: 'small', amount: '1.00', odds: '1.98' },
    { id: 2, bet_type: 'champion', bet_value: 'odd', amount: '1.00', odds: '1.98' },
    { id: 3, bet_type: 'champion', bet_value: 'big', amount: '1.00', odds: '1.98' },
    { id: 4, bet_type: 'champion', bet_value: 'even', amount: '1.00', odds: '1.98' },
    { id: 5, bet_type: 'runnerup', bet_value: 'small', amount: '1.00', odds: '1.98' },
    { id: 6, bet_type: 'runnerup', bet_value: 'even', amount: '1.00', odds: '1.98' },
    { id: 7, bet_type: 'runnerup', bet_value: 'big', amount: '1.00', odds: '1.98' },
    { id: 8, bet_type: 'runnerup', bet_value: 'odd', amount: '1.00', odds: '1.98' },
    { id: 9, bet_type: 'third', bet_value: 'small', amount: '1.00', odds: '1.98' },
    { id: 10, bet_type: 'third', bet_value: 'odd', amount: '1.00', odds: '1.98' },
    { id: 11, bet_type: 'fourth', bet_value: 'big', amount: '1.00', odds: '1.98' },
    { id: 12, bet_type: 'fourth', bet_value: 'odd', amount: '1.00', odds: '1.98' },
    { id: 13, bet_type: 'fifth', bet_value: 'big', amount: '1.00', odds: '1.98' },
    { id: 14, bet_type: 'fifth', bet_value: 'odd', amount: '1.00', odds: '1.98' },
];

console.log('Testing individual bets:');
testBets.forEach(bet => {
    const winCheck = checkBetWin(bet, normalizedResult);
    console.log(`Bet ${bet.id}: ${bet.bet_type} ${bet.bet_value} - ${winCheck.isWin ? 'WIN' : 'LOSE'} (${winCheck.reason})`);
});