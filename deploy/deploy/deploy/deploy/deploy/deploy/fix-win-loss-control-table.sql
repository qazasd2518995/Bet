-- 修復生產環境 win_loss_control 表結構
-- 添加缺少的 start_period 欄位

-- 檢查並添加 start_period 欄位（如果不存在）
DO $$ 
BEGIN
    -- 檢查 start_period 欄位是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control' 
        AND column_name = 'start_period'
    ) THEN
        -- 添加 start_period 欄位
        ALTER TABLE win_loss_control 
        ADD COLUMN start_period VARCHAR(20);
        
        RAISE NOTICE '✅ start_period 欄位已成功添加到 win_loss_control 表';
    ELSE
        RAISE NOTICE 'ℹ️ start_period 欄位已存在，無需添加';
    END IF;
    
    -- 確保其他必要欄位存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control' 
        AND column_name = 'operator_id'
    ) THEN
        ALTER TABLE win_loss_control 
        ADD COLUMN operator_id INTEGER;
        
        RAISE NOTICE '✅ operator_id 欄位已添加';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control' 
        AND column_name = 'operator_username'
    ) THEN
        ALTER TABLE win_loss_control 
        ADD COLUMN operator_username VARCHAR(100);
        
        RAISE NOTICE '✅ operator_username 欄位已添加';
    END IF;
    
    -- 確保 control_percentage 是 DECIMAL 類型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN control_percentage TYPE DECIMAL(5,2) USING control_percentage::DECIMAL(5,2);
        
        RAISE NOTICE '✅ control_percentage 欄位類型已更新為 DECIMAL(5,2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ control_percentage 欄位類型轉換警告: %', SQLERRM;
    END;
    
END $$;

-- 創建輸贏控制日誌表（如果不存在）
CREATE TABLE IF NOT EXISTS win_loss_control_logs (
    id SERIAL PRIMARY KEY,
    control_id INTEGER,
    action VARCHAR(20) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    operator_id INTEGER,
    operator_username VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 確保 win_loss_control_logs 表有所有必要欄位
DO $$ 
BEGIN
    -- 檢查並添加 control_id 欄位
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control_logs' 
        AND column_name = 'control_id'
    ) THEN
        ALTER TABLE win_loss_control_logs 
        ADD COLUMN control_id INTEGER;
        
        RAISE NOTICE '✅ win_loss_control_logs.control_id 欄位已添加';
    END IF;
    
    -- 確保 control_id 欄位允許 NULL（用於刪除操作日誌）
    BEGIN
        ALTER TABLE win_loss_control_logs 
        ALTER COLUMN control_id DROP NOT NULL;
        
        RAISE NOTICE '✅ win_loss_control_logs.control_id 欄位設置為允許 NULL';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ win_loss_control_logs.control_id 欄位已允許 NULL';
    END;
    
    -- 檢查並添加 operator_id 欄位
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control_logs' 
        AND column_name = 'operator_id'
    ) THEN
        ALTER TABLE win_loss_control_logs 
        ADD COLUMN operator_id INTEGER;
        
        RAISE NOTICE '✅ win_loss_control_logs.operator_id 欄位已添加';
    END IF;
    
    -- 檢查並添加 operator_username 欄位
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control_logs' 
        AND column_name = 'operator_username'
    ) THEN
        ALTER TABLE win_loss_control_logs 
        ADD COLUMN operator_username VARCHAR(100);
        
        RAISE NOTICE '✅ win_loss_control_logs.operator_username 欄位已添加';
    END IF;
    
END $$;

-- 顯示最終表結構
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'win_loss_control'
ORDER BY ordinal_position; 