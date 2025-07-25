-- 检查 draw_time 与 created_at 差异很大的记录
-- 这可能表示 draw_time 储存的是错误的时区

-- 1. 查看问题记录
SELECT 
    period,
    created_at,
    draw_time,
    created_at::text as created_at_str,
    draw_time::text as draw_time_str,
    EXTRACT(HOUR FROM created_at) as created_hour,
    EXTRACT(HOUR FROM draw_time) as draw_hour,
    ABS(EXTRACT(HOUR FROM created_at) - EXTRACT(HOUR FROM draw_time)) as hour_diff
FROM result_history
WHERE period::text LIKE '20250725%'
AND ABS(EXTRACT(HOUR FROM created_at) - EXTRACT(HOUR FROM draw_time)) >= 7
ORDER BY period DESC
LIMIT 20;

-- 2. 修复方案：如果 draw_time 的小时数比 created_at 小很多（差距约8小时），
-- 表示 draw_time 可能储存的是本地时间而不是 UTC
-- 我们需要将 draw_time 设置为与 created_at 相同

-- 备份原始数据
CREATE TABLE IF NOT EXISTS result_history_backup_draw_time AS
SELECT period, created_at, draw_time
FROM result_history
WHERE period::text LIKE '20250725%';

-- 3. 修复 draw_time - 将其设置为 created_at 的值
-- 只修复那些 draw_time 明显错误的记录
UPDATE result_history
SET draw_time = created_at
WHERE period::text LIKE '20250725%'
AND (
    -- draw_time 为 NULL
    draw_time IS NULL
    OR
    -- draw_time 的小时数明显错误（例如显示为 00:xx 而 created_at 是 08:xx UTC）
    (EXTRACT(HOUR FROM draw_time) < 5 AND EXTRACT(HOUR FROM created_at) > 5)
);

-- 4. 验证修复结果
SELECT 
    period,
    created_at,
    draw_time,
    created_at AT TIME ZONE 'Asia/Taipei' as taipei_time
FROM result_history
WHERE period::text LIKE '20250725%'
ORDER BY period DESC
LIMIT 20;