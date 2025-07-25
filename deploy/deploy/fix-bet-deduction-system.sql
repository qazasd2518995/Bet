-- 修復下注扣款系統的SQL腳本
-- 添加下注鎖定機制，防止並行下注時的競態條件

-- 1. 創建下注鎖定表（如果不存在）
CREATE TABLE IF NOT EXISTS betting_locks (
    username VARCHAR(50) PRIMARY KEY,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_by VARCHAR(100),
    CONSTRAINT betting_locks_username_fkey FOREIGN KEY (username) 
        REFERENCES members(username) ON DELETE CASCADE
);

-- 2. 創建索引優化查詢性能
CREATE INDEX IF NOT EXISTS idx_betting_locks_locked_at ON betting_locks(locked_at);

-- 3. 創建清理過期鎖定的函數
CREATE OR REPLACE FUNCTION clean_expired_betting_locks()
RETURNS void AS $$
BEGIN
    -- 刪除超過5秒的鎖定（防止死鎖）
    DELETE FROM betting_locks 
    WHERE locked_at < NOW() - INTERVAL '5 seconds';
END;
$$ LANGUAGE plpgsql;

-- 4. 創建自動清理觸發器（每次插入時清理過期鎖定）
CREATE OR REPLACE FUNCTION auto_clean_betting_locks()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM clean_expired_betting_locks();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_clean_betting_locks ON betting_locks;
CREATE TRIGGER trigger_auto_clean_betting_locks
    BEFORE INSERT ON betting_locks
    FOR EACH ROW
    EXECUTE FUNCTION auto_clean_betting_locks();

-- 5. 創建安全的下注扣款函數
CREATE OR REPLACE FUNCTION safe_bet_deduction(
    p_username VARCHAR(50),
    p_amount DECIMAL(10,2),
    p_bet_id VARCHAR(100)
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    balance DECIMAL(10,2)
) AS $$
DECLARE
    v_current_balance DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
    v_lock_acquired BOOLEAN := FALSE;
BEGIN
    -- 清理過期鎖定
    PERFORM clean_expired_betting_locks();
    
    -- 嘗試獲取鎖定
    BEGIN
        INSERT INTO betting_locks (username, locked_by) 
        VALUES (p_username, p_bet_id);
        v_lock_acquired := TRUE;
    EXCEPTION WHEN unique_violation THEN
        -- 鎖定已存在，返回錯誤
        RETURN QUERY SELECT FALSE, '正在處理其他下注，請稍後再試'::TEXT, 0::DECIMAL;
        RETURN;
    END;
    
    -- 如果成功獲取鎖定，執行扣款
    IF v_lock_acquired THEN
        -- 獲取當前餘額（使用FOR UPDATE鎖定行）
        SELECT balance INTO v_current_balance
        FROM members
        WHERE username = p_username
        FOR UPDATE;
        
        -- 檢查餘額是否足夠
        IF v_current_balance < p_amount THEN
            -- 釋放鎖定
            DELETE FROM betting_locks WHERE username = p_username;
            RETURN QUERY SELECT FALSE, '餘額不足'::TEXT, v_current_balance;
            RETURN;
        END IF;
        
        -- 計算新餘額
        v_new_balance := v_current_balance - p_amount;
        
        -- 更新餘額
        UPDATE members 
        SET balance = v_new_balance
        WHERE username = p_username;
        
        -- 釋放鎖定
        DELETE FROM betting_locks WHERE username = p_username;
        
        -- 返回成功結果
        RETURN QUERY SELECT TRUE, '扣款成功'::TEXT, v_new_balance;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. 授予執行權限
GRANT EXECUTE ON FUNCTION safe_bet_deduction TO PUBLIC;
GRANT EXECUTE ON FUNCTION clean_expired_betting_locks TO PUBLIC;

-- 7. 創建批量下注扣款函數（處理多筆下注）
CREATE OR REPLACE FUNCTION batch_bet_deduction(
    p_username VARCHAR(50),
    p_bets JSONB
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    balance DECIMAL(10,2),
    processed_count INTEGER
) AS $$
DECLARE
    v_current_balance DECIMAL(10,2);
    v_total_amount DECIMAL(10,2) := 0;
    v_new_balance DECIMAL(10,2);
    v_bet JSONB;
    v_processed INTEGER := 0;
BEGIN
    -- 計算總下注金額
    FOR v_bet IN SELECT * FROM jsonb_array_elements(p_bets)
    LOOP
        v_total_amount := v_total_amount + (v_bet->>'amount')::DECIMAL;
    END LOOP;
    
    -- 使用行級鎖定獲取並更新餘額
    UPDATE members 
    SET balance = balance - v_total_amount
    WHERE username = p_username 
    AND balance >= v_total_amount
    RETURNING balance INTO v_new_balance;
    
    -- 檢查是否成功更新
    IF v_new_balance IS NULL THEN
        -- 獲取當前餘額用於錯誤訊息
        SELECT balance INTO v_current_balance FROM members WHERE username = p_username;
        RETURN QUERY SELECT FALSE, '餘額不足'::TEXT, v_current_balance, 0;
        RETURN;
    END IF;
    
    -- 計算處理的下注數量
    v_processed := jsonb_array_length(p_bets);
    
    -- 返回成功結果
    RETURN QUERY SELECT TRUE, '批量扣款成功'::TEXT, v_new_balance, v_processed;
END;
$$ LANGUAGE plpgsql;

-- 8. 測試查詢
-- SELECT * FROM safe_bet_deduction('test_user', 100.00, 'bet_123');
-- SELECT * FROM batch_bet_deduction('test_user', '[{"amount": 100}, {"amount": 200}, {"amount": 300}]'::jsonb);

COMMENT ON TABLE betting_locks IS '下注鎖定表，防止並行下注時的競態條件';
COMMENT ON FUNCTION safe_bet_deduction IS '安全的下注扣款函數，使用鎖定機制防止並行衝突';
COMMENT ON FUNCTION batch_bet_deduction IS '批量下注扣款函數，一次性處理多筆下注';

-- 檢查並創建安全的單筆扣款函數
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
        RETURN QUERY SELECT FALSE, '會員不存在', 0::DECIMAL;
        RETURN;
    END IF;
    
    -- 檢查餘額是否足夠
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, '余额不足', v_current_balance;
        RETURN;
    END IF;
    
    -- 執行原子性扣款
    UPDATE members 
    SET balance = balance - p_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_new_balance;
    
    -- 返回成功結果
    RETURN QUERY SELECT TRUE, '扣款成功', v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- 創建批量扣款函數（支援多筆同時扣款）
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
        RETURN QUERY SELECT FALSE, '會員不存在', 0::DECIMAL, 0::DECIMAL, p_bets;
        RETURN;
    END IF;
    
    -- 檢查總餘額是否足夠
    IF v_current_balance < v_total_amount THEN
        RETURN QUERY SELECT FALSE, '余额不足', v_current_balance, 0::DECIMAL, p_bets;
        RETURN;
    END IF;
    
    -- 執行原子性批量扣款
    UPDATE members 
    SET balance = balance - v_total_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_new_balance;
    
    -- 返回成功結果
    RETURN QUERY SELECT TRUE, '批量扣款成功', v_new_balance, v_total_amount, v_failed_bets;
END;
$$ LANGUAGE plpgsql;

-- 創建改進版的 MemberModel.updateBalance 函數（使用原子操作）
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
        RETURN QUERY SELECT FALSE, '會員不存在', 0::DECIMAL, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- 檢查扣款後餘額是否會小於0
    IF v_before_balance + p_amount < 0 THEN
        RETURN QUERY SELECT FALSE, '余额不足', v_before_balance, v_before_balance;
        RETURN;
    END IF;
    
    -- 執行原子性更新
    UPDATE members 
    SET balance = balance + p_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_after_balance;
    
    -- 返回成功結果
    RETURN QUERY SELECT TRUE, '更新成功', v_after_balance, v_before_balance;
END;
$$ LANGUAGE plpgsql;

-- 創建下注鎖定表（防止重複下注）
CREATE TABLE IF NOT EXISTS bet_locks (
    bet_id VARCHAR PRIMARY KEY,
    username VARCHAR NOT NULL,
    amount DECIMAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR DEFAULT 'pending' -- pending, completed, failed
);

-- 創建清理過期鎖定的函數
CREATE OR REPLACE FUNCTION cleanup_expired_bet_locks() RETURNS VOID AS $$
BEGIN
    -- 刪除超過5分鐘的鎖定記錄
    DELETE FROM bet_locks 
    WHERE created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- 創建索引以提高性能
CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
CREATE INDEX IF NOT EXISTS idx_bet_locks_created_at ON bet_locks(created_at);

-- 添加註釋說明
COMMENT ON FUNCTION safe_bet_deduction IS '安全的單筆下注扣款函數，使用行級鎖防止競態條件';
COMMENT ON FUNCTION batch_bet_deduction IS '批量下注扣款函數，支援多筆同時扣款';
COMMENT ON FUNCTION atomic_update_member_balance IS '原子性更新會員餘額函數，替代原有的非原子性實現';
COMMENT ON TABLE bet_locks IS '下注鎖定表，防止重複下注和競態條件';

-- 輸出完成信息
DO $$
BEGIN
    RAISE NOTICE '✅ 下注扣款系統修復完成';
    RAISE NOTICE '✅ 已創建安全扣款函數: safe_bet_deduction';
    RAISE NOTICE '✅ 已創建批量扣款函數: batch_bet_deduction';
    RAISE NOTICE '✅ 已創建原子更新函數: atomic_update_member_balance';
    RAISE NOTICE '✅ 已創建下注鎖定表: bet_locks';
END $$; 