-- 修复下注扣款系统的SQL脚本
-- 添加下注锁定机制，防止并行下注时的竞态条件

-- 1. 创建下注锁定表（如果不存在）
CREATE TABLE IF NOT EXISTS betting_locks (
    username VARCHAR(50) PRIMARY KEY,
    locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    locked_by VARCHAR(100),
    CONSTRAINT betting_locks_username_fkey FOREIGN KEY (username) 
        REFERENCES members(username) ON DELETE CASCADE
);

-- 2. 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_betting_locks_locked_at ON betting_locks(locked_at);

-- 3. 创建清理过期锁定的函数
CREATE OR REPLACE FUNCTION clean_expired_betting_locks()
RETURNS void AS $$
BEGIN
    -- 删除超过5秒的锁定（防止死锁）
    DELETE FROM betting_locks 
    WHERE locked_at < NOW() - INTERVAL '5 seconds';
END;
$$ LANGUAGE plpgsql;

-- 4. 创建自动清理触发器（每次插入时清理过期锁定）
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

-- 5. 创建安全的下注扣款函数
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
    -- 清理过期锁定
    PERFORM clean_expired_betting_locks();
    
    -- 尝试获取锁定
    BEGIN
        INSERT INTO betting_locks (username, locked_by) 
        VALUES (p_username, p_bet_id);
        v_lock_acquired := TRUE;
    EXCEPTION WHEN unique_violation THEN
        -- 锁定已存在，返回错误
        RETURN QUERY SELECT FALSE, '正在处理其他下注，请稍后再试'::TEXT, 0::DECIMAL;
        RETURN;
    END;
    
    -- 如果成功获取锁定，执行扣款
    IF v_lock_acquired THEN
        -- 获取当前余额（使用FOR UPDATE锁定行）
        SELECT balance INTO v_current_balance
        FROM members
        WHERE username = p_username
        FOR UPDATE;
        
        -- 检查余额是否足够
        IF v_current_balance < p_amount THEN
            -- 释放锁定
            DELETE FROM betting_locks WHERE username = p_username;
            RETURN QUERY SELECT FALSE, '余额不足'::TEXT, v_current_balance;
            RETURN;
        END IF;
        
        -- 计算新余额
        v_new_balance := v_current_balance - p_amount;
        
        -- 更新余额
        UPDATE members 
        SET balance = v_new_balance
        WHERE username = p_username;
        
        -- 释放锁定
        DELETE FROM betting_locks WHERE username = p_username;
        
        -- 返回成功结果
        RETURN QUERY SELECT TRUE, '扣款成功'::TEXT, v_new_balance;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 6. 授予执行权限
GRANT EXECUTE ON FUNCTION safe_bet_deduction TO PUBLIC;
GRANT EXECUTE ON FUNCTION clean_expired_betting_locks TO PUBLIC;

-- 7. 创建批量下注扣款函数（处理多笔下注）
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
    -- 计算总下注金额
    FOR v_bet IN SELECT * FROM jsonb_array_elements(p_bets)
    LOOP
        v_total_amount := v_total_amount + (v_bet->>'amount')::DECIMAL;
    END LOOP;
    
    -- 使用行级锁定获取并更新余额
    UPDATE members 
    SET balance = balance - v_total_amount
    WHERE username = p_username 
    AND balance >= v_total_amount
    RETURNING balance INTO v_new_balance;
    
    -- 检查是否成功更新
    IF v_new_balance IS NULL THEN
        -- 获取当前余额用于错误讯息
        SELECT balance INTO v_current_balance FROM members WHERE username = p_username;
        RETURN QUERY SELECT FALSE, '余额不足'::TEXT, v_current_balance, 0;
        RETURN;
    END IF;
    
    -- 计算处理的下注数量
    v_processed := jsonb_array_length(p_bets);
    
    -- 返回成功结果
    RETURN QUERY SELECT TRUE, '批量扣款成功'::TEXT, v_new_balance, v_processed;
END;
$$ LANGUAGE plpgsql;

-- 8. 测试查询
-- SELECT * FROM safe_bet_deduction('test_user', 100.00, 'bet_123');
-- SELECT * FROM batch_bet_deduction('test_user', '[{"amount": 100}, {"amount": 200}, {"amount": 300}]'::jsonb);

COMMENT ON TABLE betting_locks IS '下注锁定表，防止并行下注时的竞态条件';
COMMENT ON FUNCTION safe_bet_deduction IS '安全的下注扣款函数，使用锁定机制防止并行冲突';
COMMENT ON FUNCTION batch_bet_deduction IS '批量下注扣款函数，一次性处理多笔下注';

-- 检查并创建安全的单笔扣款函数
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
    -- 使用 FOR UPDATE 锁定该会员记录，防止并发修改
    SELECT id, balance INTO v_member_id, v_current_balance
    FROM members
    WHERE username = p_username
    FOR UPDATE;
    
    -- 检查会员是否存在
    IF v_member_id IS NULL THEN
        RETURN QUERY SELECT FALSE, '会员不存在', 0::DECIMAL;
        RETURN;
    END IF;
    
    -- 检查余额是否足够
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, '余额不足', v_current_balance;
        RETURN;
    END IF;
    
    -- 执行原子性扣款
    UPDATE members 
    SET balance = balance - p_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_new_balance;
    
    -- 返回成功结果
    RETURN QUERY SELECT TRUE, '扣款成功', v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- 创建批量扣款函数（支援多笔同时扣款）
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
    -- 计算总扣款金额
    FOR v_bet IN SELECT * FROM jsonb_array_elements(p_bets)
    LOOP
        v_total_amount := v_total_amount + (v_bet->>'amount')::DECIMAL;
    END LOOP;
    
    -- 使用 FOR UPDATE 锁定该会员记录
    SELECT id, balance INTO v_member_id, v_current_balance
    FROM members
    WHERE username = p_username
    FOR UPDATE;
    
    -- 检查会员是否存在
    IF v_member_id IS NULL THEN
        RETURN QUERY SELECT FALSE, '会员不存在', 0::DECIMAL, 0::DECIMAL, p_bets;
        RETURN;
    END IF;
    
    -- 检查总余额是否足够
    IF v_current_balance < v_total_amount THEN
        RETURN QUERY SELECT FALSE, '余额不足', v_current_balance, 0::DECIMAL, p_bets;
        RETURN;
    END IF;
    
    -- 执行原子性批量扣款
    UPDATE members 
    SET balance = balance - v_total_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_new_balance;
    
    -- 返回成功结果
    RETURN QUERY SELECT TRUE, '批量扣款成功', v_new_balance, v_total_amount, v_failed_bets;
END;
$$ LANGUAGE plpgsql;

-- 创建改进版的 MemberModel.updateBalance 函数（使用原子操作）
CREATE OR REPLACE FUNCTION atomic_update_member_balance(
    p_username VARCHAR,
    p_amount DECIMAL  -- 正数为增加，负数为扣除
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
    -- 使用 FOR UPDATE 锁定该会员记录
    SELECT id, balance INTO v_member_id, v_before_balance
    FROM members
    WHERE username = p_username
    FOR UPDATE;
    
    -- 检查会员是否存在
    IF v_member_id IS NULL THEN
        RETURN QUERY SELECT FALSE, '会员不存在', 0::DECIMAL, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- 检查扣款后余额是否会小于0
    IF v_before_balance + p_amount < 0 THEN
        RETURN QUERY SELECT FALSE, '余额不足', v_before_balance, v_before_balance;
        RETURN;
    END IF;
    
    -- 执行原子性更新
    UPDATE members 
    SET balance = balance + p_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_after_balance;
    
    -- 返回成功结果
    RETURN QUERY SELECT TRUE, '更新成功', v_after_balance, v_before_balance;
END;
$$ LANGUAGE plpgsql;

-- 创建下注锁定表（防止重复下注）
CREATE TABLE IF NOT EXISTS bet_locks (
    bet_id VARCHAR PRIMARY KEY,
    username VARCHAR NOT NULL,
    amount DECIMAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR DEFAULT 'pending' -- pending, completed, failed
);

-- 创建清理过期锁定的函数
CREATE OR REPLACE FUNCTION cleanup_expired_bet_locks() RETURNS VOID AS $$
BEGIN
    -- 删除超过5分钟的锁定记录
    DELETE FROM bet_locks 
    WHERE created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- 创建索引以提高性能
CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
CREATE INDEX IF NOT EXISTS idx_bet_locks_created_at ON bet_locks(created_at);

-- 添加注释说明
COMMENT ON FUNCTION safe_bet_deduction IS '安全的单笔下注扣款函数，使用行级锁防止竞态条件';
COMMENT ON FUNCTION batch_bet_deduction IS '批量下注扣款函数，支援多笔同时扣款';
COMMENT ON FUNCTION atomic_update_member_balance IS '原子性更新会员余额函数，替代原有的非原子性实现';
COMMENT ON TABLE bet_locks IS '下注锁定表，防止重复下注和竞态条件';

-- 输出完成信息
DO $$
BEGIN
    RAISE NOTICE '✅ 下注扣款系统修复完成';
    RAISE NOTICE '✅ 已创建安全扣款函数: safe_bet_deduction';
    RAISE NOTICE '✅ 已创建批量扣款函数: batch_bet_deduction';
    RAISE NOTICE '✅ 已创建原子更新函数: atomic_update_member_balance';
    RAISE NOTICE '✅ 已创建下注锁定表: bet_locks';
END $$; 