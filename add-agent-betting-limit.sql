-- 为代理表添加限红等级栏位
BEGIN;

-- 1. 为 agents 表添加限红等级栏位
ALTER TABLE agents ADD COLUMN IF NOT EXISTS betting_limit_level VARCHAR(20) DEFAULT 'level3';

-- 2. 为 agents 表的限红等级栏位创建索引
CREATE INDEX IF NOT EXISTS idx_agents_betting_limit_level ON agents(betting_limit_level);

-- 3. 更新现有代理的限红等级
-- 将所有现有代理设定为 level6 (VVIP)，让他们有最大权限
UPDATE agents SET betting_limit_level = 'level6' WHERE betting_limit_level IS NULL OR betting_limit_level = '';

-- 4. 添加注释
COMMENT ON COLUMN agents.betting_limit_level IS '代理限红等级，决定该代理可创建的会员和下级代理的最高限红等级';

-- 5. 验证栏位是否成功添加
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'agents' 
    AND column_name = 'betting_limit_level';

COMMIT;