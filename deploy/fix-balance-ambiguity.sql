-- 修复 balance 栏位模糊性错误的脚本
-- 问题: PostgreSQL 不知道 balance 是指表栏位还是变数

-- 1. 修复 safe_bet_deduction 函数
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
    -- 明确指定表栏位 members.balance 避免模糊性
    SELECT members.id, members.balance INTO v_member_id, v_current_balance
    FROM members
    WHERE members.username = p_username
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
    SET balance = members.balance - p_amount
    WHERE members.id = v_member_id
    RETURNING members.balance INTO v_new_balance;
    
    -- 返回成功结果
    RETURN QUERY SELECT TRUE, '扣款成功'::VARCHAR, v_new_balance;
END;
$$ LANGUAGE plpgsql;

-- 2. 修复 atomic_update_member_balance 函数
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
    -- 明确指定表栏位 members.balance 避免模糊性
    SELECT members.id, members.balance INTO v_member_id, v_before_balance
    FROM members
    WHERE members.username = p_username
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
    SET balance = members.balance + p_amount
    WHERE members.id = v_member_id
    RETURNING members.balance INTO v_after_balance;
    
    -- 返回成功结果
    RETURN QUERY SELECT TRUE, '更新成功'::VARCHAR, v_after_balance, v_before_balance;
END;
$$ LANGUAGE plpgsql;

-- 3. 修复 batch_bet_deduction 函数
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
    -- 明确指定表栏位 members.balance 避免模糊性
    SELECT members.id, members.balance INTO v_member_id, v_current_balance
    FROM members
    WHERE members.username = p_username
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
    SET balance = members.balance - v_total_amount
    WHERE members.id = v_member_id
    RETURNING members.balance INTO v_new_balance;
    
    -- 返回成功结果
    RETURN QUERY SELECT TRUE, '批量扣款成功'::VARCHAR, v_new_balance, v_total_amount, v_failed_bets;
END;
$$ LANGUAGE plpgsql;

-- 4. 输出完成信息
DO $$
BEGIN
    RAISE NOTICE '✅ Balance 栏位模糊性错误修复完成';
    RAISE NOTICE '✅ 已修复 safe_bet_deduction 函数';
    RAISE NOTICE '✅ 已修复 atomic_update_member_balance 函数';
    RAISE NOTICE '✅ 已修复 batch_bet_deduction 函数';
    RAISE NOTICE '✅ 所有函数现在明确指定表栏位，避免模糊性';
END $$; 