-- 修复 auto_sync_recent_draws 触发器函数的类型问题

-- 删除旧的触发器和函数
DROP TRIGGER IF EXISTS auto_sync_recent_draws_trigger ON result_history;
DROP FUNCTION IF EXISTS auto_sync_recent_draws();

-- 创建修正后的函数
CREATE OR REPLACE FUNCTION auto_sync_recent_draws()
RETURNS TRIGGER AS $$
DECLARE
    min_period BIGINT;
BEGIN
    -- 只处理有效的新记录
    IF NEW.result IS NOT NULL 
       AND NEW.position_1 IS NOT NULL 
       AND LENGTH(NEW.period::text) = 11 THEN
        
        -- 插入或更新到 recent_draws
        INSERT INTO recent_draws (
            period, result,
            position_1, position_2, position_3, position_4, position_5,
            position_6, position_7, position_8, position_9, position_10,
            draw_time
        )
        VALUES (
            NEW.period::bigint, NEW.result,
            NEW.position_1, NEW.position_2, NEW.position_3, NEW.position_4, NEW.position_5,
            NEW.position_6, NEW.position_7, NEW.position_8, NEW.position_9, NEW.position_10,
            NEW.draw_time
        )
        ON CONFLICT (period) DO UPDATE SET
            result = EXCLUDED.result,
            position_1 = EXCLUDED.position_1,
            position_2 = EXCLUDED.position_2,
            position_3 = EXCLUDED.position_3,
            position_4 = EXCLUDED.position_4,
            position_5 = EXCLUDED.position_5,
            position_6 = EXCLUDED.position_6,
            position_7 = EXCLUDED.position_7,
            position_8 = EXCLUDED.position_8,
            position_9 = EXCLUDED.position_9,
            position_10 = EXCLUDED.position_10,
            draw_time = EXCLUDED.draw_time;
        
        -- 获取第10笔记录的期号（确保类型一致）
        SELECT period INTO min_period
        FROM recent_draws
        ORDER BY period DESC
        LIMIT 1 OFFSET 9;
        
        -- 删除超过10笔的旧记录（确保类型一致）
        IF min_period IS NOT NULL THEN
            DELETE FROM recent_draws
            WHERE period < min_period;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 重新创建触发器
CREATE TRIGGER auto_sync_recent_draws_trigger
AFTER INSERT OR UPDATE ON result_history
FOR EACH ROW
EXECUTE FUNCTION auto_sync_recent_draws();

-- 显示结果
SELECT '✅ 触发器函数已修复' as result;