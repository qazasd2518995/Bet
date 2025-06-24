-- 修復result_history表的唯一約束問題
-- 此腳本用於為現有數據庫添加唯一約束

-- 首先刪除可能存在的重複記錄，保留最新的記錄
WITH duplicates AS (
    SELECT id, period, 
           ROW_NUMBER() OVER (PARTITION BY period ORDER BY created_at DESC) as rn
    FROM result_history
)
DELETE FROM result_history 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- 添加唯一約束
ALTER TABLE result_history 
ADD CONSTRAINT unique_period UNIQUE (period);

-- 查看結果
SELECT COUNT(*) as total_records, 
       COUNT(DISTINCT period) as unique_periods 
FROM result_history; 