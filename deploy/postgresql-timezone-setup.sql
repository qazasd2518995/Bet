-- PostgreSQL 时区设定指南

-- 1. 检查当前资料库时区设定
SHOW timezone;

-- 2. 检查当前时间
SELECT NOW();
SELECT NOW() AT TIME ZONE 'Asia/Taipei';
SELECT CURRENT_TIMESTAMP;

-- 3. 设定资料库时区为台北时间（会话层级）
SET timezone = 'Asia/Taipei';

-- 4. 设定资料库时区为台北时间（资料库层级）
ALTER DATABASE bet_game SET timezone TO 'Asia/Taipei';

-- 5. 设定所有新连接的预设时区（需要超级用户权限）
-- ALTER SYSTEM SET timezone = 'Asia/Taipei';

-- 6. 重新载入配置（需要超级用户权限）
-- SELECT pg_reload_conf();

-- 7. 验证时区设定
SHOW timezone;
SELECT NOW();

-- 8. 修改表格栏位为 TIMESTAMP WITH TIME ZONE（推荐）
-- 这样可以正确处理时区转换
ALTER TABLE result_history 
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN draw_time TYPE TIMESTAMP WITH TIME ZONE;

-- 9. 如果要修改预设值为台北时间
ALTER TABLE result_history 
ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
ALTER COLUMN draw_time SET DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei');

-- 10. 创建一个函数来获取台北时间
CREATE OR REPLACE FUNCTION taipei_now() 
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN NOW() AT TIME ZONE 'Asia/Taipei';
END;
$$ LANGUAGE plpgsql;

-- 使用函数作为预设值
ALTER TABLE result_history 
ALTER COLUMN created_at SET DEFAULT taipei_now(),
ALTER COLUMN draw_time SET DEFAULT taipei_now();