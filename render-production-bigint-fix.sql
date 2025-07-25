-- Render生产环境BigInt错误完整诊断和修复
-- 解决 "invalid input syntax for type bigint: NaN" 错误

-- 1. 诊断问题数据
SELECT 'Diagnosing win_loss_control table...' as status;

-- 检查表结构
\d win_loss_control;

-- 检查所有数据，特别关注target_id栏位
SELECT 
    id,
    control_mode,
    target_type,
    target_id,
    target_username,
    CASE 
        WHEN target_id IS NULL THEN 'NULL'
        WHEN target_id::text ~ '^[0-9]+$' THEN 'VALID_INTEGER'
        ELSE 'INVALID: ' || target_id::text
    END as target_id_status
FROM win_loss_control
ORDER BY id;

-- 2. 查找有问题的数据
SELECT 'Checking for problematic data...' as status;

-- 检查是否有非数字的target_id
SELECT id, target_id, target_type, target_username
FROM win_loss_control 
WHERE target_id IS NOT NULL 
AND target_id::text !~ '^[0-9]+$';

-- 检查逻辑不一致的数据
SELECT id, target_type, target_id, target_username,
       CASE 
           WHEN target_type IS NOT NULL AND target_id IS NULL THEN 'TYPE_SET_BUT_ID_NULL'
           WHEN target_type IS NULL AND target_id IS NOT NULL THEN 'ID_SET_BUT_TYPE_NULL'
           WHEN target_type IS NOT NULL AND target_username IS NULL THEN 'TYPE_SET_BUT_USERNAME_NULL'
           ELSE 'OK'
       END as issue
FROM win_loss_control
WHERE NOT (
    (target_type IS NULL AND target_id IS NULL AND target_username IS NULL) OR
    (target_type IS NOT NULL AND target_id IS NOT NULL AND target_username IS NOT NULL)
);

-- 3. 修复数据
SELECT 'Starting data cleanup...' as status;

-- 修复逻辑不一致的数据
DO $$
DECLARE
    fixed_count INTEGER := 0;
BEGIN
    -- 修复target_type不为NULL但target_id为NULL的情况
    UPDATE win_loss_control 
    SET target_type = NULL, target_username = NULL
    WHERE target_type IS NOT NULL AND target_id IS NULL;
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE '修复了 % 笔 target_type/target_id 不一致的数据', fixed_count;
    
    -- 修复target_id不为NULL但target_type为NULL的情况
    UPDATE win_loss_control 
    SET target_id = NULL, target_username = NULL
    WHERE target_type IS NULL AND target_id IS NOT NULL;
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE '修复了 % 笔 target_id/target_type 不一致的数据', fixed_count;
    
    -- 清理可能的无效target_id（非数字字符）
    -- 这个查询会安全地处理任何无效的target_id
    UPDATE win_loss_control 
    SET target_id = NULL, target_type = NULL, target_username = NULL
    WHERE target_id IS NOT NULL 
    AND target_id::text ~ '[^0-9]';
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE '清理了 % 笔包含非数字字符的 target_id', fixed_count;
    
END $$;

-- 4. 确保数据类型正确
SELECT 'Ensuring correct data types...' as status;

DO $$
BEGIN
    -- 确保target_id是INTEGER类型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN target_id TYPE INTEGER;
        RAISE NOTICE '✅ target_id 类型已确认为 INTEGER';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ target_id 类型修改失败: %', SQLERRM;
    END;
    
    -- 确保control_percentage是DECIMAL类型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN control_percentage TYPE DECIMAL(5,2);
        RAISE NOTICE '✅ control_percentage 类型已确认为 DECIMAL(5,2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ control_percentage 类型修改失败: %', SQLERRM;
    END;
    
END $$;

-- 5. 修复CHECK约束
SELECT 'Fixing CHECK constraints...' as status;

DO $$
BEGIN
    -- 移除旧约束
    ALTER TABLE win_loss_control 
    DROP CONSTRAINT IF EXISTS win_loss_control_target_type_check;
    
    -- 添加新约束（允许NULL）
    ALTER TABLE win_loss_control 
    ADD CONSTRAINT win_loss_control_target_type_check 
    CHECK (target_type IS NULL OR target_type IN ('agent', 'member'));
    
    RAISE NOTICE '✅ target_type CHECK约束已修复（允许NULL）';
    
    -- 确保win_loss_control_logs的control_id允许NULL
    ALTER TABLE win_loss_control_logs 
    ALTER COLUMN control_id DROP NOT NULL;
    
    RAISE NOTICE '✅ win_loss_control_logs.control_id 已设置为允许NULL';
    
END $$;

-- 6. 验证修复结果
SELECT 'Verification...' as status;

-- 检查修复后的数据
SELECT 
    'win_loss_control' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN target_id IS NULL THEN 1 END) as null_target_id,
    COUNT(CASE WHEN target_type IS NULL THEN 1 END) as null_target_type,
    COUNT(CASE WHEN control_mode = 'normal' THEN 1 END) as normal_mode_records
FROM win_loss_control;

-- 检查是否还有问题数据
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 没有发现数据不一致问题'
        ELSE '❌ 仍有 ' || COUNT(*) || ' 笔数据不一致'
    END as consistency_check
FROM win_loss_control
WHERE NOT (
    (target_type IS NULL AND target_id IS NULL AND target_username IS NULL) OR
    (target_type IS NOT NULL AND target_id IS NOT NULL AND target_username IS NOT NULL)
);

-- 最终测试查询（模拟前端会执行的查询）
SELECT 'Testing final query...' as status;

SELECT wlc.*, 
    CASE 
        WHEN wlc.target_type = 'agent' THEN a.username
        WHEN wlc.target_type = 'member' THEN m.username
        ELSE wlc.target_username
    END as target_display_name
FROM win_loss_control wlc
LEFT JOIN agents a ON wlc.target_type = 'agent' AND wlc.target_id IS NOT NULL AND wlc.target_id = a.id
LEFT JOIN members m ON wlc.target_type = 'member' AND wlc.target_id IS NOT NULL AND wlc.target_id = m.id
ORDER BY wlc.created_at DESC
LIMIT 5;

SELECT '🎉 BigInt错误修复完成！' as final_status; 