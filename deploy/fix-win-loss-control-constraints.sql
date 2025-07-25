-- 修复输赢控制表约束问题
-- 解决两个主要问题:
-- 1. target_type CHECK约束不允许NULL值，但normal模式需要NULL
-- 2. BigInt NaN错误（虽然已修复但需确保生产环境生效）

-- 首先检查并移除有问题的约束
DO $$
BEGIN
    -- 检查并移除target_type的CHECK约束
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%target_type%' 
        AND table_name = 'win_loss_control'
    ) THEN
        ALTER TABLE win_loss_control 
        DROP CONSTRAINT IF EXISTS win_loss_control_target_type_check;
        
        RAISE NOTICE '✅ 已移除 target_type CHECK 约束';
    END IF;
    
    -- 重新添加修正后的约束，允许NULL值
    ALTER TABLE win_loss_control 
    ADD CONSTRAINT win_loss_control_target_type_check 
    CHECK (target_type IS NULL OR target_type IN ('agent', 'member'));
    
    RAISE NOTICE '✅ 已添加修正后的 target_type CHECK 约束 (允许 NULL)';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ 约束修复失败: %', SQLERRM;
END $$;

-- 确保win_loss_control表结构正确
DO $$
BEGIN
    -- 确保control_percentage为DECIMAL类型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN control_percentage TYPE DECIMAL(5,2);
        
        RAISE NOTICE '✅ control_percentage 类型已确认为 DECIMAL(5,2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ control_percentage 类型修改: %', SQLERRM;
    END;
    
    -- 确保start_period为VARCHAR类型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN start_period TYPE VARCHAR(20);
        
        RAISE NOTICE '✅ start_period 类型已确认为 VARCHAR(20)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ start_period 类型修改: %', SQLERRM;
    END;
    
END $$;

-- 确保win_loss_control_logs表的control_id允许NULL
DO $$
BEGIN
    -- 确保control_id栏位允许NULL (用于删除操作日志)
    BEGIN
        ALTER TABLE win_loss_control_logs 
        ALTER COLUMN control_id DROP NOT NULL;
        
        RAISE NOTICE '✅ win_loss_control_logs.control_id 已设置为允许 NULL';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ win_loss_control_logs.control_id NULL设置: %', SQLERRM;
    END;
    
END $$;

-- 检查并清理可能有问题的数据
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- 检查是否有无效的target_id数据
    SELECT COUNT(*) INTO invalid_count
    FROM win_loss_control 
    WHERE target_type IS NOT NULL 
    AND target_id IS NULL;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE '⚠️ 发现 % 笔无效数据：target_type 不为空但 target_id 为空', invalid_count;
        
        -- 修复无效数据：如果target_type不为NULL但target_id为NULL，设置target_type为NULL
        UPDATE win_loss_control 
        SET target_type = NULL, target_username = NULL
        WHERE target_type IS NOT NULL AND target_id IS NULL;
        
        RAISE NOTICE '✅ 已修复无效数据';
    END IF;
    
END $$;

-- 验证修复结果
DO $$
DECLARE
    constraint_count INTEGER;
    normal_mode_count INTEGER;
BEGIN
    -- 检查约束是否正确
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.check_constraints 
    WHERE constraint_name = 'win_loss_control_target_type_check';
    
    IF constraint_count > 0 THEN
        RAISE NOTICE '✅ target_type 约束已正确设置';
    ELSE
        RAISE NOTICE '❌ target_type 约束设置失败';
    END IF;
    
    -- 检查normal模式记录
    SELECT COUNT(*) INTO normal_mode_count
    FROM win_loss_control 
    WHERE control_mode = 'normal' AND target_type IS NULL;
    
    RAISE NOTICE 'ℹ️ 当前有 % 笔 normal 模式控制记录', normal_mode_count;
    
END $$;

-- 输出最终状态
SELECT 
    'win_loss_control' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN control_mode = 'normal' THEN 1 END) as normal_mode_records,
    COUNT(CASE WHEN target_type IS NULL THEN 1 END) as null_target_type_records
FROM win_loss_control;

RAISE NOTICE '🎉 输赢控制表约束修复完成！'; 