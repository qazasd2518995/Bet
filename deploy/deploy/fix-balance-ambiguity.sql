-- 修復 balance 欄位模糊性錯誤的腳本
-- 問題: PostgreSQL 不知道 balance 是指表欄位還是變數

-- 1. 修復 safe_bet_deduction 函數
CREATE OR REPLACE FUNCTION safe_bet_deduction(
    p_username VARCHAR,
    p_amount DECIMAL,
    p_bet_id VARCHAR
) RETURNS TABLE(
    success BOOLEAN,
    message VARCHAR,
    balance DECIMAL
) AS $$
DECLARE
    v_member_id INTEGER;
    v_current_balance DECIMAL;
    v_new_balance DECIMAL;
BEGIN
    -- 使用 FOR UPDATE 鎖定該會員記錄，防止並發修改
    -- 明確指定表欄位 members.balance 避免模糊性
    SELECT members.id, members.balance INTO v_member_id, v_current_balance
    FROM members
    WHERE members.username = p_username
    FOR UPDATE;
    
    -- 檢查會員是否存在
    IF v_member_id IS NULL THEN
        RETURN QUERY SELECT FALSE, '會員不存在'::VARCHAR, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- 檢查餘額是否足夠
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, '余额不足'::VARCHAR, v_current_balance;
        RETURN;
    END IF;
    
    -- 執行原子性扣款
    UPDATE members 
    SET balance = members.balance - p_amount
    WHERE members.id = v_member_id
    RETURNING members.balance INTO v_new_balance;
    
    -- 返回成功結果
    RETURN QUERY SELECT TRUE, '扣款成功'::VARCHAR, v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- 2. 修復 atomic_update_member_balance 函數
CREATE OR REPLACE FUNCTION atomic_update_member_balance(
    p_username VARCHAR,
    p_amount DECIMAL  -- 正數為增加，負數為扣除
) RETURNS TABLE(
    success BOOLEAN,
    message VARCHAR,
    balance DECIMAL,
    before_balance DECIMAL
) AS $$
DECLARE
    v_member_id INTEGER;
    v_before_balance DECIMAL;
    v_after_balance DECIMAL;
BEGIN
    -- 使用 FOR UPDATE 鎖定該會員記錄
    -- 明確指定表欄位 members.balance 避免模糊性
    SELECT members.id, members.balance INTO v_member_id, v_before_balance
    FROM members
    WHERE members.username = p_username
    FOR UPDATE;
    
    -- 檢查會員是否存在
    IF v_member_id IS NULL THEN
        RETURN QUERY SELECT FALSE, '會員不存在'::VARCHAR, 0::DECIMAL, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- 檢查扣款後餘額是否會小於0
    IF v_before_balance + p_amount < 0 THEN
        RETURN QUERY SELECT FALSE, '余额不足'::VARCHAR, v_before_balance, v_before_balance;
        RETURN;
    END IF;
    
    -- 執行原子性更新
    UPDATE members 
    SET balance = members.balance + p_amount
    WHERE members.id = v_member_id
    RETURNING members.balance INTO v_after_balance;
    
    -- 返回成功結果
    RETURN QUERY SELECT TRUE, '更新成功'::VARCHAR, v_after_balance, v_before_balance;
END;
$$ LANGUAGE plpgsql;

-- 3. 修復 batch_bet_deduction 函數
CREATE OR REPLACE FUNCTION batch_bet_deduction(
    p_username VARCHAR,
    p_bets JSONB  -- 格式: [{"amount": 100, "bet_id": "bet_123"}, ...]
) RETURNS TABLE(
    success BOOLEAN,
    message VARCHAR,
    balance DECIMAL,
    total_deducted DECIMAL,
    failed_bets JSONB
) AS $$
DECLARE
    v_member_id INTEGER;
    v_current_balance DECIMAL;
    v_total_amount DECIMAL := 0;
    v_bet JSONB;
    v_failed_bets JSONB := '[]'::JSONB;
    v_new_balance DECIMAL;
BEGIN
    -- 計算總扣款金額
    FOR v_bet IN SELECT * FROM jsonb_array_elements(p_bets)
    LOOP
        v_total_amount := v_total_amount + (v_bet->>'amount')::DECIMAL;
    END LOOP;
    
    -- 使用 FOR UPDATE 鎖定該會員記錄
    -- 明確指定表欄位 members.balance 避免模糊性
    SELECT members.id, members.balance INTO v_member_id, v_current_balance
    FROM members
    WHERE members.username = p_username
    FOR UPDATE;
    
    -- 檢查會員是否存在
    IF v_member_id IS NULL THEN
        RETURN QUERY SELECT FALSE, '會員不存在'::VARCHAR, 0::DECIMAL, 0::DECIMAL, p_bets;
        RETURN;
    END IF;
    
    -- 檢查總餘額是否足夠
    IF v_current_balance < v_total_amount THEN
        RETURN QUERY SELECT FALSE, '余额不足'::VARCHAR, v_current_balance, 0::DECIMAL, p_bets;
        RETURN;
    END IF;
    
    -- 執行原子性批量扣款
    UPDATE members 
    SET balance = members.balance - v_total_amount
    WHERE members.id = v_member_id
    RETURNING members.balance INTO v_new_balance;
    
    -- 返回成功結果
    RETURN QUERY SELECT TRUE, '批量扣款成功'::VARCHAR, v_new_balance, v_total_amount, v_failed_bets;
END;
$$ LANGUAGE plpgsql;

-- 4. 輸出完成信息
DO $$
BEGIN
    RAISE NOTICE '✅ Balance 欄位模糊性錯誤修復完成';
    RAISE NOTICE '✅ 已修復 safe_bet_deduction 函數';
    RAISE NOTICE '✅ 已修復 atomic_update_member_balance 函數';
    RAISE NOTICE '✅ 已修復 batch_bet_deduction 函數';
    RAISE NOTICE '✅ 所有函數現在明確指定表欄位，避免模糊性';
END $$; 