-- 修正開獎時間 SQL 指令
-- 將錯誤的時間加上 8 小時

-- 1. 先檢查需要修正的記錄
-- 查看最近的開獎記錄，確認時間是否需要修正
SELECT 
    period,
    created_at,
    draw_time,
    created_at AT TIME ZONE 'UTC' as utc_time,
    created_at + INTERVAL '8 hours' as corrected_time
FROM result_history
WHERE period::text LIKE '20250725%'
   OR period::text LIKE '20250724%'
ORDER BY period DESC
LIMIT 10;

-- 2. 備份原始資料（建議先執行）
-- 創建備份表
CREATE TABLE IF NOT EXISTS result_history_backup_20250725 AS
SELECT * FROM result_history
WHERE period::text LIKE '20250725%'
   OR period::text LIKE '20250724%';

-- 3. 修正今天（2025-07-25）的開獎時間
-- 將時間加上 8 小時
UPDATE result_history
SET 
    created_at = created_at + INTERVAL '8 hours',
    draw_time = draw_time + INTERVAL '8 hours'
WHERE period::text LIKE '20250725%'
  AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') < 8;  -- 只修正 UTC 時間小於 8 點的記錄

-- 4. 修正昨天（2025-07-24）的開獎時間
-- 將時間加上 8 小時
UPDATE result_history
SET 
    created_at = created_at + INTERVAL '8 hours',
    draw_time = draw_time + INTERVAL '8 hours'
WHERE period::text LIKE '20250724%'
  AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') < 8;  -- 只修正 UTC 時間小於 8 點的記錄

-- 5. 驗證修正結果
-- 查看修正後的記錄
SELECT 
    period,
    created_at,
    draw_time,
    created_at AT TIME ZONE 'Asia/Taipei' as taipei_time
FROM result_history
WHERE period::text LIKE '20250725%'
ORDER BY period DESC
LIMIT 20;

-- 6. 如果需要回滾（恢復原始資料）
-- UPDATE result_history rh
-- SET 
--     created_at = backup.created_at,
--     draw_time = backup.draw_time
-- FROM result_history_backup_20250725 backup
-- WHERE rh.id = backup.id;

-- 7. 修正所有需要修正的記錄（更全面的方法）
-- 這個方法會檢查所有記錄，並只修正那些時間明顯錯誤的記錄
UPDATE result_history
SET 
    created_at = created_at + INTERVAL '8 hours',
    draw_time = draw_time + INTERVAL '8 hours'
WHERE 
    -- 檢查期號日期部分
    SUBSTRING(period::text, 1, 8) >= '20250724'
    -- 檢查時間是否在合理範圍（如果 created_at 的小時部分小於 7，可能是 UTC 時間）
    AND EXTRACT(HOUR FROM created_at) < 7
    -- 避免重複修正（如果已經是下午時間，就不需要再加 8 小時）
    AND EXTRACT(HOUR FROM created_at + INTERVAL '8 hours') >= 7;

-- 8. 統計修正的記錄數
SELECT 
    SUBSTRING(period::text, 1, 8) as date,
    COUNT(*) as record_count,
    MIN(created_at) as earliest_time,
    MAX(created_at) as latest_time
FROM result_history
WHERE SUBSTRING(period::text, 1, 8) >= '20250724'
GROUP BY SUBSTRING(period::text, 1, 8)
ORDER BY date DESC;