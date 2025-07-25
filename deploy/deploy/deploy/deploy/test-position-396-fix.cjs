// Test the fix for position betting settlement

// For now, let's copy the logic here to test

function getPositionIndex(betType, position) {
    if (betType === 'position' && position) {
        return parseInt(position) - 1;
    }
    
    const positionMap = {
        'champion': 0, 'runnerup': 1, 'third': 2, 'fourth': 3,
        'fifth': 4, 'sixth': 5, 'seventh': 6, 'eighth': 7,
        'ninth': 8, 'tenth': 9,
        // 中文位置名稱
        '冠軍': 0, '亞軍': 1, '季軍': 2, '第三名': 2,
        '第四名': 3, '第五名': 4, '第六名': 5, '第七名': 6,
        '第八名': 7, '第九名': 8, '第十名': 9
    };
    
    return positionMap[betType] !== undefined ? positionMap[betType] : -1;
}

function quickCheckWin(bet, winResult) {
    if (!winResult || !winResult.positions) {
        console.log(`[DEBUG] quickCheckWin: No winResult or positions for bet ${bet.id}`);
        return false;
    }
    
    const positions = winResult.positions;
    const betType = bet.bet_type;
    const betValue = bet.bet_value;
    
    console.log(`[DEBUG] Bet ${bet.id}: type=${betType}, value=${betValue}, position=${bet.position}`);
    console.log(`[DEBUG] Win positions:`, positions);
    
    // 簡化的中獎檢查邏輯 - 包含中文位置名稱
    const positionTypes = ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
                          '冠軍', '亞軍', '季軍', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'];
    
    if (betType === 'position' || positionTypes.includes(betType)) {
        const positionIndex = getPositionIndex(betType, bet.position);
        
        console.log(`[DEBUG] Position bet check: betType=${betType}, positionIndex=${positionIndex}`);
        
        if (positionIndex === -1) return false;
        
        const number = positions[positionIndex];
        
        console.log(`[DEBUG] Position ${positionIndex + 1} has number ${number}, betting on ${betValue}`);
        
        switch (betValue) {
            case 'big':
            case '大':
                return number >= 6;
            case 'small':
            case '小':
                return number <= 5;
            case 'odd':
            case '單':
                return number % 2 === 1;
            case 'even':
            case '雙':
                return number % 2 === 0;
            default: 
                return number === parseInt(betValue);
        }
    }
    
    return false;
}

// Test data
const winResult = {
    positions: [9, 4, 1, 3, 2, 7, 6, 10, 8, 5]  // Period 396 actual result
};

console.log('=== TESTING POSITION BETTING FIX FOR PERIOD 396 ===');
console.log('Period 396 results:', winResult.positions);
console.log('Position 3 (third) result: ' + winResult.positions[2]);

// Test cases that should win
const testBets = [
    { id: 1, bet_type: '季軍', bet_value: '1', position: null, period: '20250714396' },
    { id: 2, bet_type: '第三名', bet_value: '1', position: null, period: '20250714396' },
    { id: 3, bet_type: 'third', bet_value: '1', position: null, period: '20250714396' },
    // Test cases that should lose
    { id: 4, bet_type: '季軍', bet_value: '2', position: null, period: '20250714396' },
    { id: 5, bet_type: '冠軍', bet_value: '9', position: null, period: '20250714396' },  // Should win
    { id: 6, bet_type: '冠軍', bet_value: '1', position: null, period: '20250714396' },  // Should lose
];

testBets.forEach(bet => {
    console.log(`\n--- Testing Bet ${bet.id} ---`);
    const isWin = quickCheckWin(bet, winResult);
    console.log(`Result: ${isWin ? 'WIN' : 'LOSE'}`);
    if (bet.id <= 3 && !isWin) {
        console.log('❌ ERROR: This bet should have won!');
    } else if (bet.id === 4 && isWin) {
        console.log('❌ ERROR: This bet should have lost!');
    } else if (bet.id === 5 && !isWin) {
        console.log('❌ ERROR: This bet should have won!');
    } else if (bet.id === 6 && isWin) {
        console.log('❌ ERROR: This bet should have lost!');
    } else {
        console.log('✅ Correct result');
    }
});