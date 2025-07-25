-- 检查 result_history 表中的时间栏位
-- 查看最近的开奖记录，比较 created_at 和 draw_time

SELECT 
    period,
    created_at,
    draw_time,
    created_at AT TIME ZONE 'UTC' as created_at_utc,
    draw_time AT TIME ZONE 'UTC' as draw_time_utc,
    created_at AT TIME ZONE 'Asia/Taipei' as created_at_taipei,
    draw_time AT TIME ZONE 'Asia/Taipei' as draw_time_taipei,
    -- 检查两个时间的差异
    EXTRACT(EPOCH FROM (draw_time - created_at))/3600 as hours_diff
FROM result_history
WHERE period::text LIKE '20250725%'
ORDER BY period DESC
LIMIT 10;

-- 检查是否有 draw_time 为 NULL 的记录
SELECT COUNT(*) as null_draw_time_count
FROM result_history
WHERE draw_time IS NULL
AND period::text LIKE '20250725%';

-- 检查 draw_time 和 created_at 是否有显著差异
SELECT 
    period,
    created_at,
    draw_time,
    ABS(EXTRACT(EPOCH FROM (draw_time - created_at))) as seconds_diff
FROM result_history
WHERE period::text LIKE '20250725%'
AND ABS(EXTRACT(EPOCH FROM (draw_time - created_at))) > 60  -- 差异超过60秒
ORDER BY seconds_diff DESC
LIMIT 10;