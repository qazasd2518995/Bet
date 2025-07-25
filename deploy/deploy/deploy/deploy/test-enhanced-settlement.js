// test-enhanced-settlement.js - Test enhanced settlement system with all bet types
import { enhancedSettlement } from './enhanced-settlement-system.js';

console.log('🧪 Testing Enhanced Settlement System with All Bet Types');
console.log('='.repeat(60));

// Test result: [1, 2, 3, 7, 9, 10, 4, 6, 5, 8]
const testResult = [1, 2, 3, 7, 9, 10, 4, 6, 5, 8];

console.log('Test Result:', testResult);
console.log('Position Analysis:');
console.log('- Position 1 (champion): 1 (small, odd)');
console.log('- Position 2 (runnerup): 2 (small, even)');
console.log('- Position 3 (third): 3 (small, odd)');
console.log('- Position 4 (fourth): 7 (big, odd)');
console.log('- Position 5 (fifth): 9 (big, odd)');
console.log('- Position 6 (sixth): 10 (big, even)');
console.log('- Position 7 (seventh): 4 (small, even)');
console.log('- Position 8 (eighth): 6 (big, even)');
console.log('- Position 9 (ninth): 5 (small, odd)');
console.log('- Position 10 (tenth): 8 (big, even)');
console.log('- Champion + Runner-up sum: 1 + 2 = 3');
console.log('');

// Test cases for different bet types
const testCases = [
    // 1. Position-based two-sides betting (兩面投注)
    { type: 'Position Two-Sides', bets: [
        { id: 1, bet_type: 'champion', bet_value: 'small', expected: 'WIN' },
        { id: 2, bet_type: 'champion', bet_value: 'big', expected: 'LOSE' },
        { id: 3, bet_type: 'champion', bet_value: 'odd', expected: 'WIN' },
        { id: 4, bet_type: 'champion', bet_value: 'even', expected: 'LOSE' },
        { id: 5, bet_type: 'runnerup', bet_value: 'small', expected: 'WIN' },
        { id: 6, bet_type: 'runnerup', bet_value: 'even', expected: 'WIN' },
        { id: 7, bet_type: 'fourth', bet_value: 'big', expected: 'WIN' },
        { id: 8, bet_type: 'fourth', bet_value: 'odd', expected: 'WIN' },
        { id: 9, bet_type: 'tenth', bet_value: 'big', expected: 'WIN' },
        { id: 10, bet_type: 'tenth', bet_value: 'even', expected: 'WIN' },
    ]},
    
    // 2. Number betting (號碼投注)
    { type: 'Number Betting', bets: [
        { id: 11, bet_type: 'number', bet_value: '1', position: 1, expected: 'WIN' },
        { id: 12, bet_type: 'number', bet_value: '2', position: 2, expected: 'WIN' },
        { id: 13, bet_type: 'number', bet_value: '5', position: 1, expected: 'LOSE' },
        { id: 14, bet_type: 'number', bet_value: '7', position: 4, expected: 'WIN' },
        { id: 15, bet_type: 'number', bet_value: '10', position: 6, expected: 'WIN' },
    ]},
    
    // 3. Champion + Runner-up sum betting (冠亞和投注)
    { type: 'Sum Betting', bets: [
        { id: 16, bet_type: 'sum', bet_value: '3', expected: 'WIN' },
        { id: 17, bet_type: 'sum', bet_value: '4', expected: 'LOSE' },
        { id: 18, bet_type: 'sum', bet_value: 'small', expected: 'WIN' }, // 3 <= 11
        { id: 19, bet_type: 'sum', bet_value: 'big', expected: 'LOSE' }, // 3 < 12
        { id: 20, bet_type: 'sum', bet_value: 'odd', expected: 'WIN' }, // 3 is odd
        { id: 21, bet_type: 'sum', bet_value: 'even', expected: 'LOSE' }, // 3 is not even
    ]},
    
    // 4. Dragon vs Tiger betting (龍虎投注)
    { type: 'Dragon vs Tiger', bets: [
        { id: 22, bet_type: 'dragon_tiger', bet_value: 'dragon_1_2', expected: 'LOSE' }, // 1 < 2
        { id: 23, bet_type: 'dragon_tiger', bet_value: 'tiger_1_2', expected: 'WIN' }, // 1 < 2
        { id: 24, bet_type: 'dragon_tiger', bet_value: 'dragon_4_5', expected: 'LOSE' }, // 7 < 9
        { id: 25, bet_type: 'dragon_tiger', bet_value: 'tiger_4_5', expected: 'WIN' }, // 7 < 9
        { id: 26, bet_type: 'dragon_tiger', bet_value: 'dragon_5_6', expected: 'LOSE' }, // 9 < 10
        { id: 27, bet_type: 'dragon_tiger', bet_value: 'tiger_5_6', expected: 'WIN' }, // 9 < 10
    ]},
    
    // 5. General two-sides betting (一般兩面投注)
    { type: 'General Two-Sides', bets: [
        { id: 28, bet_type: '兩面', bet_value: '1_big', expected: 'LOSE' }, // pos 1 = 1 (small)
        { id: 29, bet_type: '兩面', bet_value: '1_small', expected: 'WIN' }, // pos 1 = 1 (small)
        { id: 30, bet_type: '兩面', bet_value: '6_big', expected: 'WIN' }, // pos 6 = 10 (big)
        { id: 31, bet_type: '兩面', bet_value: '6_even', expected: 'WIN' }, // pos 6 = 10 (even)
        { id: 32, bet_type: '兩面', bet_value: '9_odd', expected: 'WIN' }, // pos 9 = 5 (odd)
    ]},
];

async function runTests() {
    console.log('🚀 Starting comprehensive settlement tests...\n');
    
    let totalTests = 0;
    let passedTests = 0;
    
    for (const testCase of testCases) {
        console.log(`📋 Testing: ${testCase.type}`);
        console.log('-'.repeat(40));
        
        for (const bet of testCase.bets) {
            totalTests++;
            
            try {
                // Create a mock settlement call
                const mockBet = {
                    id: bet.id,
                    bet_type: bet.bet_type,
                    bet_value: bet.bet_value,
                    position: bet.position || null,
                    amount: '1.00',
                    odds: '1.98',
                    username: 'test_user'
                };
                
                // Import the check function directly for testing
                const { checkBetWinEnhanced } = await import('./enhanced-settlement-system.js');
                const result = checkBetWinEnhanced(mockBet, { positions: testResult });
                
                const actualResult = result.isWin ? 'WIN' : 'LOSE';
                const passed = actualResult === bet.expected;
                
                if (passed) {
                    passedTests++;
                    console.log(`✅ Bet ${bet.id}: ${bet.bet_type} ${bet.bet_value} -> ${actualResult} (Expected: ${bet.expected})`);
                } else {
                    console.log(`❌ Bet ${bet.id}: ${bet.bet_type} ${bet.bet_value} -> ${actualResult} (Expected: ${bet.expected})`);
                    console.log(`   Reason: ${result.reason}`);
                }
                
            } catch (error) {
                console.log(`💥 Bet ${bet.id}: ERROR - ${error.message}`);
            }
        }
        
        console.log('');
    }
    
    console.log('='.repeat(60));
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    console.log(`Success Rate: ${((passedTests/totalTests)*100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Enhanced settlement system is working correctly.');
    } else {
        console.log('⚠️ Some tests failed. Please review the settlement logic.');
    }
}

runTests().catch(console.error);