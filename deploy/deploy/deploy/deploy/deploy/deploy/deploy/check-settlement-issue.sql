-- check-settlement-issue.sql
-- 檢查 justin111 最近的交易和餘額問題

-- 1. 查看最近的交易記錄
SELECT 
    tr.id,
    tr.transaction_type,
    tr.amount,
    tr.balance_before,
    tr.balance_after,
    tr.description,
    tr.created_at
FROM transaction_records tr
JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
WHERE m.username = 'justin111'
AND tr.created_at > NOW() - INTERVAL '2 hours'
ORDER BY tr.created_at DESC
LIMIT 30;

-- 2. 查看可能的重複交易
WITH potential_duplicates AS (
    SELECT 
        tr.user_id,
        tr.transaction_type,
        tr.amount,
        tr.description,
        DATE_TRUNC('minute', tr.created_at) as minute_bucket,
        COUNT(*) as count,
        STRING_AGG(tr.id::text, ', ' ORDER BY tr.id) as ids,
        STRING_AGG(tr.balance_after::text, ', ' ORDER BY tr.id) as balances
    FROM transaction_records tr
    JOIN members m ON tr.user_id = m.id AND tr.user_type = 'member'
    WHERE m.username = 'justin111'
    AND tr.transaction_type IN ('win', 'adjustment')
    AND tr.created_at > NOW() - INTERVAL '2 hours'
    GROUP BY tr.user_id, tr.transaction_type, tr.amount, tr.description, DATE_TRUNC('minute', tr.created_at)
    HAVING COUNT(*) > 1
)
SELECT * FROM potential_duplicates
ORDER BY minute_bucket DESC;

-- 3. 查看當前餘額
SELECT 
    id,
    username,
    balance,
    total_bet,
    total_win,
    updated_at
FROM members
WHERE username = 'justin111';

-- 4. 計算理論餘額（基於交易記錄）
WITH balance_calculation AS (
    SELECT 
        m.username,
        m.balance as current_balance,
        COALESCE(SUM(
            CASE 
                WHEN tr.transaction_type IN ('deposit', 'win', 'rebate', 'adjustment') AND tr.amount > 0 THEN tr.amount
                WHEN tr.transaction_type IN ('withdraw', 'bet', 'game_bet') THEN -ABS(tr.amount)
                WHEN tr.transaction_type = 'adjustment' AND tr.amount < 0 THEN tr.amount
                ELSE 0
            END
        ), 0) as calculated_change,
        MIN(tr.created_at) as first_transaction,
        MAX(tr.created_at) as last_transaction,
        COUNT(*) as transaction_count
    FROM members m
    LEFT JOIN transaction_records tr ON m.id = tr.user_id AND tr.user_type = 'member'
    WHERE m.username = 'justin111'
    AND tr.created_at > NOW() - INTERVAL '24 hours'
    GROUP BY m.username, m.balance
)
SELECT 
    username,
    current_balance,
    calculated_change,
    current_balance - calculated_change as initial_balance_24h_ago,
    transaction_count,
    first_transaction,
    last_transaction
FROM balance_calculation;

-- 5. 查看今天的下注和中獎情況
SELECT 
    period,
    COUNT(*) as bet_count,
    SUM(amount) as total_bet,
    SUM(CASE WHEN win = true THEN 1 ELSE 0 END) as win_count,
    SUM(win_amount) as total_win,
    MAX(created_at) as bet_time
FROM bet_history
WHERE username = 'justin111'
AND DATE(created_at) = CURRENT_DATE
GROUP BY period
ORDER BY period DESC
LIMIT 10;