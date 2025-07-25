-- 修正开奖时间 SQL 指令
-- 将错误的时间加上 8 小时

-- 1. 先检查需要修正的记录
-- 查看最近的开奖记录，确认时间是否需要修正
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

-- 2. 备份原始资料（建议先执行）
-- 创建备份表
CREATE TABLE IF NOT EXISTS result_history_backup_20250725 AS
SELECT * FROM result_history
WHERE period::text LIKE '20250725%'
   OR period::text LIKE '20250724%';

-- 3. 修正今天（2025-07-25）的开奖时间
-- 将时间加上 8 小时
UPDATE result_history
SET 
    created_at = created_at + INTERVAL '8 hours',
    draw_time = draw_time + INTERVAL '8 hours'
WHERE period::text LIKE '20250725%'
  AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') < 8;  -- 只修正 UTC 时间小于 8 点的记录

-- 4. 修正昨天（2025-07-24）的开奖时间
-- 将时间加上 8 小时
UPDATE result_history
SET 
    created_at = created_at + INTERVAL '8 hours',
    draw_time = draw_time + INTERVAL '8 hours'
WHERE period::text LIKE '20250724%'
  AND EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') < 8;  -- 只修正 UTC 时间小于 8 点的记录

-- 5. 验证修正结果
-- 查看修正后的记录
SELECT 
    period,
    created_at,
    draw_time,
    created_at AT TIME ZONE 'Asia/Taipei' as taipei_time
FROM result_history
WHERE period::text LIKE '20250725%'
ORDER BY period DESC
LIMIT 20;

-- 6. 如果需要回滚（恢复原始资料）
-- UPDATE result_history rh
-- SET 
--     created_at = backup.created_at,
--     draw_time = backup.draw_time
-- FROM result_history_backup_20250725 backup
-- WHERE rh.id = backup.id;

-- 7. 修正所有需要修正的记录（更全面的方法）
-- 这个方法会检查所有记录，并只修正那些时间明显错误的记录
UPDATE result_history
SET 
    created_at = created_at + INTERVAL '8 hours',
    draw_time = draw_time + INTERVAL '8 hours'
WHERE 
    -- 检查期号日期部分
    SUBSTRING(period::text, 1, 8) >= '20250724'
    -- 检查时间是否在合理范围（如果 created_at 的小时部分小于 7，可能是 UTC 时间）
    AND EXTRACT(HOUR FROM created_at) < 7
    -- 避免重复修正（如果已经是下午时间，就不需要再加 8 小时）
    AND EXTRACT(HOUR FROM created_at + INTERVAL '8 hours') >= 7;

-- 8. 统计修正的记录数
SELECT 
    SUBSTRING(period::text, 1, 8) as date,
    COUNT(*) as record_count,
    MIN(created_at) as earliest_time,
    MAX(created_at) as latest_time
FROM result_history
WHERE SUBSTRING(period::text, 1, 8) >= '20250724'
GROUP BY SUBSTRING(period::text, 1, 8)
ORDER BY date DESC;