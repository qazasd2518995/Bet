-- 修復缺失的資料庫函數腳本
-- 這些函數對下注和餘額更新功能至關重要

-- 1. 創建安全的下注扣款函數
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
    SELECT id, balance INTO v_member_id, v_current_balance
    FROM members
    WHERE username = p_username
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
    SET balance = balance - p_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_new_balance;
    
    -- 返回成功結果
    RETURN QUERY SELECT TRUE, '扣款成功'::VARCHAR, v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- 2. 創建原子性會員餘額更新函數
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
    SELECT id, balance INTO v_member_id, v_before_balance
    FROM members
    WHERE username = p_username
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
    SET balance = balance + p_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_after_balance;
    
    -- 返回成功結果
    RETURN QUERY SELECT TRUE, '更新成功'::VARCHAR, v_after_balance, v_before_balance;
END;
$$ LANGUAGE plpgsql;

-- 3. 創建批量下注扣款函數
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
    SELECT id, balance INTO v_member_id, v_current_balance
    FROM members
    WHERE username = p_username
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
    SET balance = balance - v_total_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_new_balance;
    
    -- 返回成功結果
    RETURN QUERY SELECT TRUE, '批量扣款成功'::VARCHAR, v_new_balance, v_total_amount, v_failed_bets;
END;
$$ LANGUAGE plpgsql;

-- 4. 授予執行權限
GRANT EXECUTE ON FUNCTION safe_bet_deduction TO PUBLIC;
GRANT EXECUTE ON FUNCTION atomic_update_member_balance TO PUBLIC;
GRANT EXECUTE ON FUNCTION batch_bet_deduction TO PUBLIC;

-- 5. 創建下注鎖定表（防止重複下注）
CREATE TABLE IF NOT EXISTS bet_locks (
    bet_id VARCHAR PRIMARY KEY,
    username VARCHAR NOT NULL,
    amount DECIMAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR DEFAULT 'pending' -- pending, completed, failed
);

-- 6. 創建清理過期鎖定的函數
CREATE OR REPLACE FUNCTION cleanup_expired_bet_locks() RETURNS VOID AS $$
BEGIN
    -- 刪除超過5分鐘的鎖定記錄
    DELETE FROM bet_locks 
    WHERE created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- 7. 創建索引以提高性能
CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
CREATE INDEX IF NOT EXISTS idx_bet_locks_created_at ON bet_locks(created_at);

-- 8. 添加註釋說明
COMMENT ON FUNCTION safe_bet_deduction IS '安全的單筆下注扣款函數，使用行級鎖防止競態條件';
COMMENT ON FUNCTION atomic_update_member_balance IS '原子性更新會員餘額函數，替代原有的非原子性實現';
COMMENT ON FUNCTION batch_bet_deduction IS '批量下注扣款函數，支援多筆同時扣款';
COMMENT ON TABLE bet_locks IS '下注鎖定表，防止重複下注和競態條件';

-- 9. 輸出完成信息
DO $$
BEGIN
    RAISE NOTICE '✅ 缺失的資料庫函數修復完成';
    RAISE NOTICE '✅ 已創建安全扣款函數: safe_bet_deduction';
    RAISE NOTICE '✅ 已創建原子更新函數: atomic_update_member_balance';
    RAISE NOTICE '✅ 已創建批量扣款函數: batch_bet_deduction';
    RAISE NOTICE '✅ 已創建下注鎖定表: bet_locks';
    RAISE NOTICE '✅ 系統現在完全支援原子性下注操作';
END $$; 