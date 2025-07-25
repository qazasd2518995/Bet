-- 為代理表添加限紅等級欄位
BEGIN;

-- 1. 為 agents 表添加限紅等級欄位
ALTER TABLE agents ADD COLUMN IF NOT EXISTS betting_limit_level VARCHAR(20) DEFAULT 'level3';

-- 2. 為 agents 表的限紅等級欄位創建索引
CREATE INDEX IF NOT EXISTS idx_agents_betting_limit_level ON agents(betting_limit_level);

-- 3. 更新現有代理的限紅等級
-- 將所有現有代理設定為 level6 (VVIP)，讓他們有最大權限
UPDATE agents SET betting_limit_level = 'level6' WHERE betting_limit_level IS NULL OR betting_limit_level = '';

-- 4. 添加註釋
COMMENT ON COLUMN agents.betting_limit_level IS '代理限紅等級，決定該代理可創建的會員和下級代理的最高限紅等級';

-- 5. 驗證欄位是否成功添加
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'agents' 
    AND column_name = 'betting_limit_level';

COMMIT;