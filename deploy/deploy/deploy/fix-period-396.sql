-- Fix period 396 settlement issues
-- Period 396 results: [9,4,1,3,2,7,6,10,8,5]
-- Position 3 = 1, so bets on position 3 number 1 should win

-- First, let's check the current state
SELECT 
    id,
    username,
    bet_type,
    bet_value,
    position,
    amount,
    odds,
    is_win,
    win_amount,
    status
FROM bet_history 
WHERE period = '20250714396'
AND username = 'justin111'
AND (
    (bet_type IN ('季軍', '第三名') AND bet_value = '1')
    OR (bet_type = 'number' AND position = 3 AND bet_value = '1')
);

-- Update bets that should have won but are marked as losses
-- Position 3 bets on number 1 should win
UPDATE bet_history 
SET 
    is_win = true,
    win = true,
    win_amount = amount * odds,
    status = 'win'
WHERE period = '20250714396'
AND (
    (bet_type IN ('季軍', '第三名') AND bet_value = '1')
    OR (bet_type = 'number' AND position = 3 AND bet_value = '1')
)
AND is_win = false;

-- Get the affected users and amounts for balance updates
WITH winning_bets AS (
    SELECT 
        username,
        SUM(amount * odds) as total_win_amount
    FROM bet_history 
    WHERE period = '20250714396'
    AND (
        (bet_type IN ('季軍', '第三名') AND bet_value = '1')
        OR (bet_type = 'number' AND position = 3 AND bet_value = '1')
    )
    AND is_win = false
    GROUP BY username
)
SELECT * FROM winning_bets;

-- Update member balances
WITH winning_bets AS (
    SELECT 
        username,
        SUM(amount * odds) as total_win_amount
    FROM bet_history 
    WHERE period = '20250714396'
    AND (
        (bet_type IN ('季軍', '第三名') AND bet_value = '1')
        OR (bet_type = 'number' AND position = 3 AND bet_value = '1')
    )
    AND is_win = false
    GROUP BY username
)
UPDATE members m
SET balance = m.balance + wb.total_win_amount
FROM winning_bets wb
WHERE m.username = wb.username;

-- Add transaction records for the fixes
INSERT INTO transaction_records (username, type, amount, balance_before, balance_after, description, created_at)
SELECT 
    bh.username,
    'settlement_fix',
    bh.amount * bh.odds,
    m.balance - (bh.amount * bh.odds),
    m.balance,
    CONCAT('修正期號 20250714396 結算 - ', bh.bet_type, ' ', bh.bet_value),
    NOW()
FROM bet_history bh
JOIN members m ON bh.username = m.username
WHERE bh.period = '20250714396'
AND (
    (bh.bet_type IN ('季軍', '第三名') AND bh.bet_value = '1')
    OR (bh.bet_type = 'number' AND bh.position = 3 AND bh.bet_value = '1')
)
AND bh.is_win = false;

-- Final check - show the updated bets
SELECT 
    id,
    username,
    bet_type,
    bet_value,
    position,
    amount,
    odds,
    is_win,
    win_amount,
    status
FROM bet_history 
WHERE period = '20250714396'
AND username = 'justin111'
ORDER BY id;