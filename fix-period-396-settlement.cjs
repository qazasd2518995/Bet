// Fix settlement for period 396
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

// Import the fixed logic
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
    const positions = winResult.positions;
    const betType = bet.bet_type;
    const betValue = bet.bet_value;
    
    // 簡化的中獎檢查邏輯 - 包含中文位置名稱
    const positionTypes = ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
                          '冠軍', '亞軍', '季軍', '第三名', '第四名', '第五名', '第六名', '第七名', '第八名', '第九名', '第十名'];
    
    if (betType === 'position' || positionTypes.includes(betType)) {
        const positionIndex = getPositionIndex(betType, bet.position);
        
        if (positionIndex === -1) return false;
        
        const number = positions[positionIndex];
        
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
    
    // Handle number type bets
    if (betType === 'number' && bet.position) {
        const position = parseInt(bet.position);
        if (position >= 1 && position <= 10) {
            const winningNumber = positions[position - 1];
            const betNumber = parseInt(betValue);
            return winningNumber === betNumber;
        }
    }
    
    return false;
}

async function fixPeriod396() {
    let client;
    try {
        client = await pool.connect();
        
        // Start transaction
        await client.query('BEGIN');
        
        console.log('=== FIXING PERIOD 396 SETTLEMENT ===');
        
        // 1. Get the winning result for period 396
        const resultQuery = `
            SELECT array_agg(result_data ORDER BY position) as positions
            FROM result_history 
            WHERE period_number = '20250714396'
        `;
        const resultData = await client.query(resultQuery);
        const winResult = { positions: resultData.rows[0].positions };
        console.log('Period 396 results:', winResult.positions);
        
        // 2. Get all bets for period 396
        const betsQuery = `
            SELECT 
                id,
                username,
                period,
                bet_type,
                bet_value,
                position,
                amount,
                odds,
                is_win as old_is_win,
                win_amount as old_win_amount
            FROM bet_history 
            WHERE period = '20250714396'
            ORDER BY id
        `;
        const bets = await client.query(betsQuery);
        console.log(`\nFound ${bets.rows.length} bets for period 396`);
        
        let fixedCount = 0;
        let totalNewWins = 0;
        
        // 3. Check each bet and fix if necessary
        for (const bet of bets.rows) {
            const shouldWin = quickCheckWin(bet, winResult);
            const winAmount = shouldWin ? parseFloat(bet.amount) * parseFloat(bet.odds) : 0;
            
            console.log(`\nBet ${bet.id} (${bet.username}):`);
            console.log(`  Type: ${bet.bet_type}, Value: ${bet.bet_value}, Position: ${bet.position}`);
            console.log(`  Old result: ${bet.old_is_win ? 'WIN' : 'LOSE'} (${bet.old_win_amount})`);
            console.log(`  New result: ${shouldWin ? 'WIN' : 'LOSE'} (${winAmount})`);
            
            if (shouldWin !== bet.old_is_win) {
                // Need to fix this bet
                console.log(`  ⚠️  FIXING BET!`);
                
                // Update bet record
                await client.query(`
                    UPDATE bet_history 
                    SET is_win = $1, 
                        win = $1,
                        win_amount = $2,
                        status = $3
                    WHERE id = $4
                `, [shouldWin, winAmount, shouldWin ? 'win' : 'lose', bet.id]);
                
                // If changing from lose to win, need to add balance
                if (shouldWin && !bet.old_is_win) {
                    console.log(`  Adding ${winAmount} to ${bet.username}'s balance`);
                    
                    // Update member balance
                    await client.query(`
                        UPDATE members 
                        SET balance = balance + $1
                        WHERE username = $2
                    `, [winAmount, bet.username]);
                    
                    // Add transaction record
                    await client.query(`
                        INSERT INTO transaction_records 
                        (username, type, amount, balance_before, balance_after, description, created_at)
                        SELECT 
                            $1,
                            'settlement_fix',
                            $2,
                            balance - $2,
                            balance,
                            $3,
                            NOW()
                        FROM members WHERE username = $1
                    `, [bet.username, winAmount, `修正期號 20250714396 結算 - ${bet.bet_type} ${bet.bet_value}`]);
                    
                    totalNewWins += winAmount;
                }
                
                // If changing from win to lose, need to deduct balance
                if (!shouldWin && bet.old_is_win) {
                    const oldWinAmount = parseFloat(bet.old_win_amount);
                    console.log(`  Deducting ${oldWinAmount} from ${bet.username}'s balance`);
                    
                    // Update member balance
                    await client.query(`
                        UPDATE members 
                        SET balance = balance - $1
                        WHERE username = $2
                    `, [oldWinAmount, bet.username]);
                    
                    // Add transaction record
                    await client.query(`
                        INSERT INTO transaction_records 
                        (username, type, amount, balance_before, balance_after, description, created_at)
                        SELECT 
                            $1,
                            'settlement_fix',
                            -$2,
                            balance + $2,
                            balance,
                            $3,
                            NOW()
                        FROM members WHERE username = $1
                    `, [bet.username, oldWinAmount, `修正期號 20250714396 結算 - 原中獎金額扣回`]);
                }
                
                fixedCount++;
            } else {
                console.log(`  ✅ Correct - no fix needed`);
            }
        }
        
        // 4. Update period settlement status
        if (fixedCount > 0) {
            await client.query(`
                INSERT INTO settlement_logs (period, action, details, created_at)
                VALUES ($1, 'fix_settlement', $2, NOW())
            `, ['20250714396', JSON.stringify({
                fixed_bets: fixedCount,
                total_new_wins: totalNewWins,
                timestamp: new Date().toISOString()
            })]);
        }
        
        // Commit transaction
        await client.query('COMMIT');
        
        console.log('\n=== SETTLEMENT FIX COMPLETE ===');
        console.log(`Fixed ${fixedCount} bets`);
        console.log(`Total new winnings: ${totalNewWins}`);
        
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('Error fixing settlement:', error);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

fixPeriod396();