-- 添加 phase_start_time 字段到 game_state 表
ALTER TABLE game_state 
ADD COLUMN IF NOT EXISTS phase_start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 如果表中已有数据，更新现有记录的 phase_start_time
UPDATE game_state 
SET phase_start_time = CURRENT_TIMESTAMP 
WHERE phase_start_time IS NULL;

-- 设置字段为非空约束
ALTER TABLE game_state 
ALTER COLUMN phase_start_time SET NOT NULL;
