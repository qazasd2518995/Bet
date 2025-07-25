// Test the quickCheckWin function logic

// Simulate the quickCheckWin function
function quickCheckWin(bet, winResult) {
    if (!winResult || !winResult.positions) {
        console.log('No winResult or positions');
        return false;
    }
    
    const positions = winResult.positions;
    const betType = bet.bet_type;
    const betValue = bet.bet_value;
    
    console.log('Checking bet:', {
        betType,
        betValue,
        position: bet.position,
        positions: positions
    });
    
    // 處理 'number' 類型的投注（包含所有位置的號碼投注）
    if (betType === 'number' && bet.position) {
        // position 從 1 開始，陣列索引從 0 開始
        const winningNumber = positions[bet.position - 1];
        const betNumber = parseInt(betValue);
        
        console.log(`Position ${bet.position} winning number: ${winningNumber}`);
        console.log(`Bet number: ${betNumber}`);
        console.log(`Match: ${winningNumber === betNumber}`);
        
        return winningNumber === betNumber;
    }
    
    return false;
}

// Test with actual data from period 374
const bet = {
    id: 2373,
    username: 'justin111',
    bet_type: 'number',
    bet_value: '5',
    position: 1,
    amount: '100.00',
    odds: '9.89'
};

const winResult = {
    positions: [5, 2, 7, 9, 10, 8, 3, 6, 1, 4]
};

console.log('Testing quickCheckWin with period 374 data:\n');
const result = quickCheckWin(bet, winResult);
console.log(`\nResult: ${result} (should be true)`);

// Also test with string position
console.log('\n--- Testing with string position ---');
bet.position = '1';
const result2 = quickCheckWin(bet, winResult);
console.log(`Result with string position: ${result2}`);