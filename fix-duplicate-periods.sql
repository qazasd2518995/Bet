-- 修復重複期號問題
-- 為 result_history 表添加唯一約束，防止重複期號

-- 首先檢查是否已有重複的期號
SELECT period, COUNT(*) as count 
FROM result_history 
GROUP BY period 
HAVING COUNT(*) > 1;

-- 如果有重複，保留最早的記錄，刪除重複項
WITH duplicate_periods AS (
    SELECT period, MIN(id) as keep_id
    FROM result_history
    WHERE period IN (
        SELECT period
        FROM result_history
        GROUP BY period
        HAVING COUNT(*) > 1
    )
    GROUP BY period
)
DELETE FROM result_history 
WHERE period IN (SELECT period FROM duplicate_periods)
  AND id NOT IN (SELECT keep_id FROM duplicate_periods);

-- 添加唯一約束防止將來重複
ALTER TABLE result_history 
ADD CONSTRAINT unique_period 
UNIQUE (period);

-- 檢查約束是否添加成功
SELECT conname, contype 
FROM pg_constraint 
WHERE conrelid = 'result_history'::regclass;
