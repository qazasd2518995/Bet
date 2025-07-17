// debug-settlement-issue.js - Add logging to understand why quickCheckWin failed

// This is a patch to add to optimized-betting-system.js to debug the issue

// Enhanced quickCheckWin with debugging
export function debugQuickCheckWin(bet, winResult) {
    console.log('\n=== DEBUG quickCheckWin ===');
    console.log('Bet:', {
        id: bet.id,
        bet_type: bet.bet_type,
        bet_value: bet.bet_value,
        position: bet.position
    });
    console.log('WinResult:', winResult);
    
    if (!winResult || !winResult.positions) {
        console.log('❌ No winResult or positions');
        return false;
    }
    
    const positions = winResult.positions;
    const betType = bet.bet_type;
    const betValue = bet.bet_value;
    
    console.log('Positions array:', positions);
    console.log('Bet type:', betType);
    console.log('Bet value:', betValue);
    
    // 處理 'number' 類型的投注（包含所有位置的號碼投注）
    if (betType === 'number' && bet.position) {
        console.log('Processing number bet with position');
        console.log('Position:', bet.position, 'Type:', typeof bet.position);
        
        // position 從 1 開始，陣列索引從 0 開始
        const positionIndex = bet.position - 1;
        console.log('Position index:', positionIndex);
        
        const winningNumber = positions[positionIndex];
        console.log('Winning number at position:', winningNumber);
        
        const betNumber = parseInt(betValue);
        console.log('Bet number (parsed):', betNumber);
        
        const isWin = winningNumber === betNumber;
        console.log('Is win?', isWin);
        
        return isWin;
    }
    
    // ... rest of the function
    console.log('❌ Did not match any winning condition');
    return false;
}

// Patch to add to optimized-betting-system.js temporarily:
/*
// At the top of quickCheckWin function, add:
console.log(`[DEBUG] Checking bet ${bet.id}: type=${bet.bet_type}, value=${bet.bet_value}, position=${bet.position}`);
console.log(`[DEBUG] Win positions:`, winResult?.positions);

// Before returning in the number type check:
console.log(`[DEBUG] Number bet: winningNumber=${winningNumber}, betNumber=${betNumber}, match=${winningNumber === betNumber}`);
*/