-- 修復 result_history 表的所有問題

-- 1. 添加所有 position 列
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_1 INTEGER;
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_2 INTEGER;
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_3 INTEGER;
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_4 INTEGER;
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_5 INTEGER;
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_6 INTEGER;
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_7 INTEGER;
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_8 INTEGER;
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_9 INTEGER;
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS position_10 INTEGER;

-- 2. 添加 draw_time 列
ALTER TABLE result_history ADD COLUMN IF NOT EXISTS draw_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 3. 從現有的 result JSON 欄位更新 position 值（如果有的話）
UPDATE result_history 
SET 
  position_1 = (result::json->0)::int,
  position_2 = (result::json->1)::int,
  position_3 = (result::json->2)::int,
  position_4 = (result::json->3)::int,
  position_5 = (result::json->4)::int,
  position_6 = (result::json->5)::int,
  position_7 = (result::json->6)::int,
  position_8 = (result::json->7)::int,
  position_9 = (result::json->8)::int,
  position_10 = (result::json->9)::int
WHERE result IS NOT NULL 
  AND jsonb_typeof(result::jsonb) = 'array'
  AND jsonb_array_length(result::jsonb) = 10
  AND position_1 IS NULL;

-- 4. 查看表結構確認
\d result_history