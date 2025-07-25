// Test script to verify position bet logic

// Simulate the checkBetWin function logic
function checkBetWin(bet, winResult) {
    const positions = winResult.positions;
    const betType = bet.bet_type;
    const betValue = String(bet.bet_value);
    
    console.log(`Checking bet: type=${betType}, value=${betValue}, position=${bet.position}`);
    console.log('Win positions:', positions);
    
    // Position map from comprehensive-settlement-system.js
    const positionMap = {
        '冠軍': 1, 'champion': 1,
        '亞軍': 2, 'runnerup': 2,
        '季軍': 3, '第三名': 3, 'third': 3,
        '第四名': 4, 'fourth': 4,
        '第五名': 5, 'fifth': 5,
        '第六名': 6, 'sixth': 6,
        '第七名': 7, 'seventh': 7,
        '第八名': 8, 'eighth': 8,
        '第九名': 9, 'ninth': 9,
        '第十名': 10, 'tenth': 10
    };
    
    const positionIndex = positionMap[betType];
    if (positionIndex) {
        const winningNumber = positions[positionIndex - 1];
        console.log(`Position ${positionIndex} winning number: ${winningNumber}`);
        
        // Number bet
        if (/^\d+$/.test(betValue)) {
            const betNumber = parseInt(betValue);
            const isWin = winningNumber === betNumber;
            console.log(`Bet number: ${betNumber}, Win: ${isWin}`);
            return {
                isWin: isWin,
                reason: `${betType}開出${winningNumber}，投注${betNumber}${isWin ? '中獎' : '未中'}`,
                odds: bet.odds || 9.85
            };
        }
    }
    
    // Check if it's a generic number bet with position
    if (betType === 'number' && bet.position) {
        const position = parseInt(bet.position);
        const betNumber = parseInt(betValue);
        
        if (position >= 1 && position <= 10 && !isNaN(betNumber)) {
            const winningNumber = positions[position - 1];
            const isWin = winningNumber === betNumber;
            console.log(`Generic position bet: pos=${position}, number=${betNumber}, winning=${winningNumber}, win=${isWin}`);
            return {
                isWin: isWin,
                reason: `位置${position}開出${winningNumber}，投注${betNumber}${isWin ? '中獎' : '未中'}`
            };
        }
    }
    
    return { isWin: false, reason: 'No matching bet type' };
}

// Test cases
const winResult = {
    positions: [9, 4, 1, 3, 2, 7, 6, 10, 8, 5]  // Period 396 actual result
};

console.log('=== TESTING POSITION 3 BET SCENARIOS ===');
console.log('Period 396 results:', winResult.positions);
console.log('Position 3 result: ' + winResult.positions[2]);

// Test different bet formats
const testBets = [
    { bet_type: '季軍', bet_value: '1', position: null },
    { bet_type: '第三名', bet_value: '1', position: null },
    { bet_type: 'third', bet_value: '1', position: null },
    { bet_type: 'number', bet_value: '1', position: 3 },
    { bet_type: '位置', bet_value: '第3名:1', position: 3 },
    { bet_type: '季軍', bet_value: '2', position: null },  // Should lose
];

testBets.forEach((bet, index) => {
    console.log(`\n--- Test ${index + 1} ---`);
    const result = checkBetWin(bet, winResult);
    console.log('Result:', result);
});