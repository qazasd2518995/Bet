-- Render生產環境BigInt錯誤完整診斷和修復
-- 解決 "invalid input syntax for type bigint: NaN" 錯誤

-- 1. 診斷問題數據
SELECT 'Diagnosing win_loss_control table...' as status;

-- 檢查表結構
\d win_loss_control;

-- 檢查所有數據，特別關注target_id欄位
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

-- 2. 查找有問題的數據
SELECT 'Checking for problematic data...' as status;

-- 檢查是否有非數字的target_id
SELECT id, target_id, target_type, target_username
FROM win_loss_control 
WHERE target_id IS NOT NULL 
AND target_id::text !~ '^[0-9]+$';

-- 檢查邏輯不一致的數據
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

-- 3. 修復數據
SELECT 'Starting data cleanup...' as status;

-- 修復邏輯不一致的數據
DO $$
DECLARE
    fixed_count INTEGER := 0;
BEGIN
    -- 修復target_type不為NULL但target_id為NULL的情況
    UPDATE win_loss_control 
    SET target_type = NULL, target_username = NULL
    WHERE target_type IS NOT NULL AND target_id IS NULL;
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE '修復了 % 筆 target_type/target_id 不一致的數據', fixed_count;
    
    -- 修復target_id不為NULL但target_type為NULL的情況
    UPDATE win_loss_control 
    SET target_id = NULL, target_username = NULL
    WHERE target_type IS NULL AND target_id IS NOT NULL;
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE '修復了 % 筆 target_id/target_type 不一致的數據', fixed_count;
    
    -- 清理可能的無效target_id（非數字字符）
    -- 這個查詢會安全地處理任何無效的target_id
    UPDATE win_loss_control 
    SET target_id = NULL, target_type = NULL, target_username = NULL
    WHERE target_id IS NOT NULL 
    AND target_id::text ~ '[^0-9]';
    
    GET DIAGNOSTICS fixed_count = ROW_COUNT;
    RAISE NOTICE '清理了 % 筆包含非數字字符的 target_id', fixed_count;
    
END $$;

-- 4. 確保數據類型正確
SELECT 'Ensuring correct data types...' as status;

DO $$
BEGIN
    -- 確保target_id是INTEGER類型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN target_id TYPE INTEGER;
        RAISE NOTICE '✅ target_id 類型已確認為 INTEGER';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ target_id 類型修改失敗: %', SQLERRM;
    END;
    
    -- 確保control_percentage是DECIMAL類型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN control_percentage TYPE DECIMAL(5,2);
        RAISE NOTICE '✅ control_percentage 類型已確認為 DECIMAL(5,2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ control_percentage 類型修改失敗: %', SQLERRM;
    END;
    
END $$;

-- 5. 修復CHECK約束
SELECT 'Fixing CHECK constraints...' as status;

DO $$
BEGIN
    -- 移除舊約束
    ALTER TABLE win_loss_control 
    DROP CONSTRAINT IF EXISTS win_loss_control_target_type_check;
    
    -- 添加新約束（允許NULL）
    ALTER TABLE win_loss_control 
    ADD CONSTRAINT win_loss_control_target_type_check 
    CHECK (target_type IS NULL OR target_type IN ('agent', 'member'));
    
    RAISE NOTICE '✅ target_type CHECK約束已修復（允許NULL）';
    
    -- 確保win_loss_control_logs的control_id允許NULL
    ALTER TABLE win_loss_control_logs 
    ALTER COLUMN control_id DROP NOT NULL;
    
    RAISE NOTICE '✅ win_loss_control_logs.control_id 已設置為允許NULL';
    
END $$;

-- 6. 驗證修復結果
SELECT 'Verification...' as status;

-- 檢查修復後的數據
SELECT 
    'win_loss_control' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN target_id IS NULL THEN 1 END) as null_target_id,
    COUNT(CASE WHEN target_type IS NULL THEN 1 END) as null_target_type,
    COUNT(CASE WHEN control_mode = 'normal' THEN 1 END) as normal_mode_records
FROM win_loss_control;

-- 檢查是否還有問題數據
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ 沒有發現數據不一致問題'
        ELSE '❌ 仍有 ' || COUNT(*) || ' 筆數據不一致'
    END as consistency_check
FROM win_loss_control
WHERE NOT (
    (target_type IS NULL AND target_id IS NULL AND target_username IS NULL) OR
    (target_type IS NOT NULL AND target_id IS NOT NULL AND target_username IS NOT NULL)
);

-- 最終測試查詢（模擬前端會執行的查詢）
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

SELECT '🎉 BigInt錯誤修復完成！' as final_status; 