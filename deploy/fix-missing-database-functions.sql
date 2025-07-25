-- 修复缺失的资料库函数脚本
-- 这些函数对下注和余额更新功能至关重要

-- 1. 创建安全的下注扣款函数
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
        RETURN QUERY SELECT FALSE, '会员不存在'::VARCHAR, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- 检查余额是否足够
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT FALSE, '余额不足'::VARCHAR, v_current_balance;
        RETURN;
    END IF;
    
    -- 执行原子性扣款
    UPDATE members 
    SET balance = balance - p_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_new_balance;
    
    -- 返回成功结果
    RETURN QUERY SELECT TRUE, '扣款成功'::VARCHAR, v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- 2. 创建原子性会员余额更新函数
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
        RETURN QUERY SELECT FALSE, '会员不存在'::VARCHAR, 0::DECIMAL, 0::DECIMAL;
        RETURN;
    END IF;
    
    -- 检查扣款后余额是否会小于0
    IF v_before_balance + p_amount < 0 THEN
        RETURN QUERY SELECT FALSE, '余额不足'::VARCHAR, v_before_balance, v_before_balance;
        RETURN;
    END IF;
    
    -- 执行原子性更新
    UPDATE members 
    SET balance = balance + p_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_after_balance;
    
    -- 返回成功结果
    RETURN QUERY SELECT TRUE, '更新成功'::VARCHAR, v_after_balance, v_before_balance;
END;
$$ LANGUAGE plpgsql;

-- 3. 创建批量下注扣款函数
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
        RETURN QUERY SELECT FALSE, '会员不存在'::VARCHAR, 0::DECIMAL, 0::DECIMAL, p_bets;
        RETURN;
    END IF;
    
    -- 检查总余额是否足够
    IF v_current_balance < v_total_amount THEN
        RETURN QUERY SELECT FALSE, '余额不足'::VARCHAR, v_current_balance, 0::DECIMAL, p_bets;
        RETURN;
    END IF;
    
    -- 执行原子性批量扣款
    UPDATE members 
    SET balance = balance - v_total_amount
    WHERE id = v_member_id
    RETURNING balance INTO v_new_balance;
    
    -- 返回成功结果
    RETURN QUERY SELECT TRUE, '批量扣款成功'::VARCHAR, v_new_balance, v_total_amount, v_failed_bets;
END;
$$ LANGUAGE plpgsql;

-- 4. 授予执行权限
GRANT EXECUTE ON FUNCTION safe_bet_deduction TO PUBLIC;
GRANT EXECUTE ON FUNCTION atomic_update_member_balance TO PUBLIC;
GRANT EXECUTE ON FUNCTION batch_bet_deduction TO PUBLIC;

-- 5. 创建下注锁定表（防止重复下注）
CREATE TABLE IF NOT EXISTS bet_locks (
    bet_id VARCHAR PRIMARY KEY,
    username VARCHAR NOT NULL,
    amount DECIMAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR DEFAULT 'pending' -- pending, completed, failed
);

-- 6. 创建清理过期锁定的函数
CREATE OR REPLACE FUNCTION cleanup_expired_bet_locks() RETURNS VOID AS $$
BEGIN
    -- 删除超过5分钟的锁定记录
    DELETE FROM bet_locks 
    WHERE created_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- 7. 创建索引以提高性能
CREATE INDEX IF NOT EXISTS idx_members_username ON members(username);
CREATE INDEX IF NOT EXISTS idx_bet_locks_created_at ON bet_locks(created_at);

-- 8. 添加注释说明
COMMENT ON FUNCTION safe_bet_deduction IS '安全的单笔下注扣款函数，使用行级锁防止竞态条件';
COMMENT ON FUNCTION atomic_update_member_balance IS '原子性更新会员余额函数，替代原有的非原子性实现';
COMMENT ON FUNCTION batch_bet_deduction IS '批量下注扣款函数，支援多笔同时扣款';
COMMENT ON TABLE bet_locks IS '下注锁定表，防止重复下注和竞态条件';

-- 9. 输出完成信息
DO $$
BEGIN
    RAISE NOTICE '✅ 缺失的资料库函数修复完成';
    RAISE NOTICE '✅ 已创建安全扣款函数: safe_bet_deduction';
    RAISE NOTICE '✅ 已创建原子更新函数: atomic_update_member_balance';
    RAISE NOTICE '✅ 已创建批量扣款函数: batch_bet_deduction';
    RAISE NOTICE '✅ 已创建下注锁定表: bet_locks';
    RAISE NOTICE '✅ 系统现在完全支援原子性下注操作';
END $$; 