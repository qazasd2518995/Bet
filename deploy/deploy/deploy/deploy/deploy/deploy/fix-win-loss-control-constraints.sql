-- 修復輸贏控制表約束問題
-- 解決兩個主要問題:
-- 1. target_type CHECK約束不允許NULL值，但normal模式需要NULL
-- 2. BigInt NaN錯誤（雖然已修復但需確保生產環境生效）

-- 首先檢查並移除有問題的約束
DO $$
BEGIN
    -- 檢查並移除target_type的CHECK約束
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%target_type%' 
        AND table_name = 'win_loss_control'
    ) THEN
        ALTER TABLE win_loss_control 
        DROP CONSTRAINT IF EXISTS win_loss_control_target_type_check;
        
        RAISE NOTICE '✅ 已移除 target_type CHECK 約束';
    END IF;
    
    -- 重新添加修正後的約束，允許NULL值
    ALTER TABLE win_loss_control 
    ADD CONSTRAINT win_loss_control_target_type_check 
    CHECK (target_type IS NULL OR target_type IN ('agent', 'member'));
    
    RAISE NOTICE '✅ 已添加修正後的 target_type CHECK 約束 (允許 NULL)';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ 約束修復失敗: %', SQLERRM;
END $$;

-- 確保win_loss_control表結構正確
DO $$
BEGIN
    -- 確保control_percentage為DECIMAL類型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN control_percentage TYPE DECIMAL(5,2);
        
        RAISE NOTICE '✅ control_percentage 類型已確認為 DECIMAL(5,2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ control_percentage 類型修改: %', SQLERRM;
    END;
    
    -- 確保start_period為VARCHAR類型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN start_period TYPE VARCHAR(20);
        
        RAISE NOTICE '✅ start_period 類型已確認為 VARCHAR(20)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ start_period 類型修改: %', SQLERRM;
    END;
    
END $$;

-- 確保win_loss_control_logs表的control_id允許NULL
DO $$
BEGIN
    -- 確保control_id欄位允許NULL (用於刪除操作日誌)
    BEGIN
        ALTER TABLE win_loss_control_logs 
        ALTER COLUMN control_id DROP NOT NULL;
        
        RAISE NOTICE '✅ win_loss_control_logs.control_id 已設置為允許 NULL';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ win_loss_control_logs.control_id NULL設置: %', SQLERRM;
    END;
    
END $$;

-- 檢查並清理可能有問題的數據
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    -- 檢查是否有無效的target_id數據
    SELECT COUNT(*) INTO invalid_count
    FROM win_loss_control 
    WHERE target_type IS NOT NULL 
    AND target_id IS NULL;
    
    IF invalid_count > 0 THEN
        RAISE NOTICE '⚠️ 發現 % 筆無效數據：target_type 不為空但 target_id 為空', invalid_count;
        
        -- 修復無效數據：如果target_type不為NULL但target_id為NULL，設置target_type為NULL
        UPDATE win_loss_control 
        SET target_type = NULL, target_username = NULL
        WHERE target_type IS NOT NULL AND target_id IS NULL;
        
        RAISE NOTICE '✅ 已修復無效數據';
    END IF;
    
END $$;

-- 驗證修復結果
DO $$
DECLARE
    constraint_count INTEGER;
    normal_mode_count INTEGER;
BEGIN
    -- 檢查約束是否正確
    SELECT COUNT(*) INTO constraint_count
    FROM information_schema.check_constraints 
    WHERE constraint_name = 'win_loss_control_target_type_check';
    
    IF constraint_count > 0 THEN
        RAISE NOTICE '✅ target_type 約束已正確設置';
    ELSE
        RAISE NOTICE '❌ target_type 約束設置失敗';
    END IF;
    
    -- 檢查normal模式記錄
    SELECT COUNT(*) INTO normal_mode_count
    FROM win_loss_control 
    WHERE control_mode = 'normal' AND target_type IS NULL;
    
    RAISE NOTICE 'ℹ️ 當前有 % 筆 normal 模式控制記錄', normal_mode_count;
    
END $$;

-- 輸出最終狀態
SELECT 
    'win_loss_control' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN control_mode = 'normal' THEN 1 END) as normal_mode_records,
    COUNT(CASE WHEN target_type IS NULL THEN 1 END) as null_target_type_records
FROM win_loss_control;

RAISE NOTICE '🎉 輸贏控制表約束修復完成！'; 