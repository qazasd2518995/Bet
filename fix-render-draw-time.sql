-- 修复 Render 上的 draw_time 显示问题
-- 问题：某些 draw_time 储存的是台北时间（16:xx）而不是 UTC 时间

-- 1. 先检查问题记录
SELECT 
    period,
    draw_time,
    draw_time::text as draw_time_str,
    EXTRACT(HOUR FROM draw_time) as hour,
    -- 如果小时数 >= 16，可能是错误地储存了台北时间
    CASE 
        WHEN EXTRACT(HOUR FROM draw_time) >= 16 THEN '可能是台北时间'
        WHEN EXTRACT(HOUR FROM draw_time) < 8 THEN '可能是正确的UTC'
        ELSE '正确的UTC时间'
    END as time_status
FROM result_history
WHERE period::text LIKE '20250725%'
ORDER BY period DESC
LIMIT 20;

-- 2. 备份数据
CREATE TABLE IF NOT EXISTS result_history_backup_20250725_v2 AS
SELECT period, created_at, draw_time
FROM result_history
WHERE period::text LIKE '20250725%';

-- 3. 修复错误的 draw_time
-- 如果 draw_time 的小时数是 16-23（台北时间下午），减去8小时转换为UTC
UPDATE result_history
SET draw_time = draw_time - INTERVAL '8 hours'
WHERE period::text LIKE '20250725%'
AND EXTRACT(HOUR FROM draw_time) >= 16
AND EXTRACT(HOUR FROM draw_time) <= 23;

-- 4. 验证修复结果
SELECT 
    period,
    draw_time,
    draw_time AT TIME ZONE 'Asia/Taipei' as taipei_time,
    EXTRACT(HOUR FROM draw_time) as utc_hour,
    EXTRACT(HOUR FROM draw_time AT TIME ZONE 'Asia/Taipei') as taipei_hour
FROM result_history
WHERE period::text LIKE '20250725%'
ORDER BY period DESC
LIMIT 20;

-- 5. 如果需要回滚
-- UPDATE result_history rh
-- SET draw_time = backup.draw_time
-- FROM result_history_backup_20250725_v2 backup
-- WHERE rh.period = backup.period;