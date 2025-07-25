-- 修复输赢控制表约束问题 (简化版本)

-- 1. 检查并移除有问题的约束
DO $$
BEGIN
    -- 移除target_type的CHECK约束
    BEGIN
        ALTER TABLE win_loss_control 
        DROP CONSTRAINT IF EXISTS win_loss_control_target_type_check;
        
        RAISE NOTICE '✅ 已尝试移除 target_type CHECK 约束';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ 移除约束: %', SQLERRM;
    END;
    
    -- 重新添加修正后的约束，允许NULL值
    BEGIN
        ALTER TABLE win_loss_control 
        ADD CONSTRAINT win_loss_control_target_type_check 
        CHECK (target_type IS NULL OR target_type IN ('agent', 'member'));
        
        RAISE NOTICE '✅ 已添加修正后的 target_type CHECK 约束 (允许 NULL)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ 添加约束失败: %', SQLERRM;
    END;
    
END $$;

-- 2. 确保表结构正确
DO $$
BEGIN
    -- 确保control_percentage为DECIMAL类型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN control_percentage TYPE DECIMAL(5,2);
        
        RAISE NOTICE '✅ control_percentage 类型已确认为 DECIMAL(5,2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ control_percentage 类型: %', SQLERRM;
    END;
    
    -- 确保start_period为VARCHAR类型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN start_period TYPE VARCHAR(20);
        
        RAISE NOTICE '✅ start_period 类型已确认为 VARCHAR(20)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ start_period 类型: %', SQLERRM;
    END;
    
END $$;

-- 3. 确保win_loss_control_logs表的control_id允许NULL
DO $$
BEGIN
    BEGIN
        ALTER TABLE win_loss_control_logs 
        ALTER COLUMN control_id DROP NOT NULL;
        
        RAISE NOTICE '✅ win_loss_control_logs.control_id 已设置为允许 NULL';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ control_id NULL设置: %', SQLERRM;
    END;
END $$;

-- 4. 清理无效数据
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- 检查无效数据
    SELECT COUNT(*) INTO invalid_count
    FROM win_loss_control 
    WHERE target_type IS NOT NULL 
    AND target_id IS NULL;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE '⚠️ 发现 % 笔无效数据', invalid_count;
        
        -- 修复无效数据
        UPDATE win_loss_control 
        SET target_type = NULL, target_username = NULL
        WHERE target_type IS NOT NULL AND target_id IS NULL;
        
        RAISE NOTICE '✅ 已修复无效数据';
    ELSE
        RAISE NOTICE 'ℹ️ 没有发现无效数据';
    END IF;
END $$;

-- 5. 显示最终状态
SELECT 
    'win_loss_control' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN control_mode = 'normal' THEN 1 END) as normal_mode_records,
    COUNT(CASE WHEN target_type IS NULL THEN 1 END) as null_target_type_records
FROM win_loss_control; 