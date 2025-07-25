-- 修复生产环境 win_loss_control 表结构
-- 添加缺少的 start_period 栏位

-- 检查并添加 start_period 栏位（如果不存在）
DO $$ 
BEGIN
    -- 检查 start_period 栏位是否存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control' 
        AND column_name = 'start_period'
    ) THEN
        -- 添加 start_period 栏位
        ALTER TABLE win_loss_control 
        ADD COLUMN start_period VARCHAR(20);
        
        RAISE NOTICE '✅ start_period 栏位已成功添加到 win_loss_control 表';
    ELSE
        RAISE NOTICE 'ℹ️ start_period 栏位已存在，无需添加';
    END IF;
    
    -- 确保其他必要栏位存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control' 
        AND column_name = 'operator_id'
    ) THEN
        ALTER TABLE win_loss_control 
        ADD COLUMN operator_id INTEGER;
        
        RAISE NOTICE '✅ operator_id 栏位已添加';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control' 
        AND column_name = 'operator_username'
    ) THEN
        ALTER TABLE win_loss_control 
        ADD COLUMN operator_username VARCHAR(100);
        
        RAISE NOTICE '✅ operator_username 栏位已添加';
    END IF;
    
    -- 确保 control_percentage 是 DECIMAL 类型
    BEGIN
        ALTER TABLE win_loss_control 
        ALTER COLUMN control_percentage TYPE DECIMAL(5,2) USING control_percentage::DECIMAL(5,2);
        
        RAISE NOTICE '✅ control_percentage 栏位类型已更新为 DECIMAL(5,2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ control_percentage 栏位类型转换警告: %', SQLERRM;
    END;
    
END $$;

-- 创建输赢控制日志表（如果不存在）
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

-- 确保 win_loss_control_logs 表有所有必要栏位
DO $$ 
BEGIN
    -- 检查并添加 control_id 栏位
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control_logs' 
        AND column_name = 'control_id'
    ) THEN
        ALTER TABLE win_loss_control_logs 
        ADD COLUMN control_id INTEGER;
        
        RAISE NOTICE '✅ win_loss_control_logs.control_id 栏位已添加';
    END IF;
    
    -- 确保 control_id 栏位允许 NULL（用于删除操作日志）
    BEGIN
        ALTER TABLE win_loss_control_logs 
        ALTER COLUMN control_id DROP NOT NULL;
        
        RAISE NOTICE '✅ win_loss_control_logs.control_id 栏位设置为允许 NULL';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️ win_loss_control_logs.control_id 栏位已允许 NULL';
    END;
    
    -- 检查并添加 operator_id 栏位
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control_logs' 
        AND column_name = 'operator_id'
    ) THEN
        ALTER TABLE win_loss_control_logs 
        ADD COLUMN operator_id INTEGER;
        
        RAISE NOTICE '✅ win_loss_control_logs.operator_id 栏位已添加';
    END IF;
    
    -- 检查并添加 operator_username 栏位
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'win_loss_control_logs' 
        AND column_name = 'operator_username'
    ) THEN
        ALTER TABLE win_loss_control_logs 
        ADD COLUMN operator_username VARCHAR(100);
        
        RAISE NOTICE '✅ win_loss_control_logs.operator_username 栏位已添加';
    END IF;
    
END $$;

-- 显示最终表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'win_loss_control'
ORDER BY ordinal_position; 