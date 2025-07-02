-- 修復輸贏控制表約束問題 (簡化版本)

-- 1. 檢查並移除有問題的約束
DO $$
BEGIN
    -- 移除target_type的CHECK約束
    BEGIN
        ALTER TABLE win_loss_control 
        DROP CONSTRAINT IF EXISTS win_loss_control_target_type_check;
        
        RAISE NOTICE '✅ 已嘗試移除 target_type CHECK 約束';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ 移除約束: %', SQLERRM;
    END;
    
    -- 重新添加修正後的約束，允許NULL值
    BEGIN
        ALTER TABLE win_loss_control 
        ADD CONSTRAINT win_loss_control_target_type_check 
        CHECK (target_type IS NULL OR target_type IN ('agent', 'member'));
        
        RAISE NOTICE '✅ 已添加修正後的 target_type CHECK 約束 (允許 NULL)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ 添加約束失敗: %', SQLERRM;
    END;
    
END $$;

-- 2. 確保表結構正確
DO $$
BEGIN
    -- 確保control_percentage為DECIMAL類型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN control_percentage TYPE DECIMAL(5,2);
        
        RAISE NOTICE '✅ control_percentage 類型已確認為 DECIMAL(5,2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ control_percentage 類型: %', SQLERRM;
    END;
    
    -- 確保start_period為VARCHAR類型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN start_period TYPE VARCHAR(20);
        
        RAISE NOTICE '✅ start_period 類型已確認為 VARCHAR(20)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ start_period 類型: %', SQLERRM;
    END;
    
END $$;

-- 3. 確保win_loss_control_logs表的control_id允許NULL
DO $$
BEGIN
    BEGIN
        ALTER TABLE win_loss_control_logs 
        ALTER COLUMN control_id DROP NOT NULL;
        
        RAISE NOTICE '✅ win_loss_control_logs.control_id 已設置為允許 NULL';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ control_id NULL設置: %', SQLERRM;
    END;
END $$;

-- 4. 清理無效數據
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- 檢查無效數據
    SELECT COUNT(*) INTO invalid_count
    FROM win_loss_control 
    WHERE target_type IS NOT NULL 
    AND target_id IS NULL;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE '⚠️ 發現 % 筆無效數據', invalid_count;
        
        -- 修復無效數據
        UPDATE win_loss_control 
        SET target_type = NULL, target_username = NULL
        WHERE target_type IS NOT NULL AND target_id IS NULL;
        
        RAISE NOTICE '✅ 已修復無效數據';
    ELSE
        RAISE NOTICE 'ℹ️ 沒有發現無效數據';
    END IF;
END $$;

-- 5. 顯示最終狀態
SELECT 
    'win_loss_control' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN control_mode = 'normal' THEN 1 END) as normal_mode_records,
    COUNT(CASE WHEN target_type IS NULL THEN 1 END) as null_target_type_records
FROM win_loss_control; 