-- PostgreSQL 時區設定指南

-- 1. 檢查當前資料庫時區設定
SHOW timezone;

-- 2. 檢查當前時間
SELECT NOW();
SELECT NOW() AT TIME ZONE 'Asia/Taipei';
SELECT CURRENT_TIMESTAMP;

-- 3. 設定資料庫時區為台北時間（會話層級）
SET timezone = 'Asia/Taipei';

-- 4. 設定資料庫時區為台北時間（資料庫層級）
ALTER DATABASE bet_game SET timezone TO 'Asia/Taipei';

-- 5. 設定所有新連接的預設時區（需要超級用戶權限）
-- ALTER SYSTEM SET timezone = 'Asia/Taipei';

-- 6. 重新載入配置（需要超級用戶權限）
-- SELECT pg_reload_conf();

-- 7. 驗證時區設定
SHOW timezone;
SELECT NOW();

-- 8. 修改表格欄位為 TIMESTAMP WITH TIME ZONE（推薦）
-- 這樣可以正確處理時區轉換
ALTER TABLE result_history 
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN draw_time TYPE TIMESTAMP WITH TIME ZONE;

-- 9. 如果要修改預設值為台北時間
ALTER TABLE result_history 
ALTER COLUMN created_at SET DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei'),
ALTER COLUMN draw_time SET DEFAULT (NOW() AT TIME ZONE 'Asia/Taipei');

-- 10. 創建一個函數來獲取台北時間
CREATE OR REPLACE FUNCTION taipei_now() 
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN NOW() AT TIME ZONE 'Asia/Taipei';
END;
$$ LANGUAGE plpgsql;

-- 使用函數作為預設值
ALTER TABLE result_history 
ALTER COLUMN created_at SET DEFAULT taipei_now(),
ALTER COLUMN draw_time SET DEFAULT taipei_now();