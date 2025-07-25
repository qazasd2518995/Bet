-- 恢复旧的限红配置表
-- 包含6个等级：新手、一般、标准、进阶、高级、VIP

-- 先备份现有资料
CREATE TABLE IF NOT EXISTS betting_limit_configs_backup AS 
SELECT * FROM betting_limit_configs;

-- 清空现有配置
TRUNCATE TABLE betting_limit_configs;

-- 插入旧的6级限红配置
INSERT INTO betting_limit_configs (level_name, level_display_name, level_order, description, config) VALUES
-- Level 1: 新手限红
('level1', '新手限红', 1, '适合新手玩家的最低限额', 
'{
  "number": {"minBet": 1, "maxBet": 500, "periodLimit": 1000},
  "twoSide": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValueSize": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValue": {"minBet": 1, "maxBet": 200, "periodLimit": 400},
  "dragonTiger": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000}
}'::jsonb),

-- Level 2: 一般限红
('level2', '一般限红', 2, '一般会员标准限额',
'{
  "number": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "twoSide": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValueSize": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValue": {"minBet": 1, "maxBet": 400, "periodLimit": 800},
  "dragonTiger": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000}
}'::jsonb),

-- Level 3: 标准限红
('level3', '标准限红', 3, '标准会员限额',
'{
  "number": {"minBet": 1, "maxBet": 2500, "periodLimit": 5000},
  "twoSide": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueSize": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValue": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "dragonTiger": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000}
}'::jsonb),

-- Level 4: 进阶限红
('level4', '进阶限红', 4, '进阶会员限额',
'{
  "number": {"minBet": 1, "maxBet": 5000, "periodLimit": 10000},
  "twoSide": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueSize": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValue": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "dragonTiger": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000}
}'::jsonb),

-- Level 5: 高级限红
('level5', '高级限红', 5, '高级会员限额',
'{
  "number": {"minBet": 1, "maxBet": 10000, "periodLimit": 20000},
  "twoSide": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueSize": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValue": {"minBet": 1, "maxBet": 4000, "periodLimit": 8000},
  "dragonTiger": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000}
}'::jsonb),

-- Level 6: VIP限红
('level6', 'VIP限红', 6, 'VIP会员最高限额',
'{
  "number": {"minBet": 1, "maxBet": 20000, "periodLimit": 40000},
  "twoSide": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueSize": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValue": {"minBet": 1, "maxBet": 8000, "periodLimit": 16000},
  "dragonTiger": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000}
}'::jsonb);

-- 更新现有会员和代理的限红等级对应
UPDATE members 
SET betting_limit_level = CASE 
  WHEN betting_limit_level = 'mini' THEN 'level1'
  WHEN betting_limit_level = 'basic' THEN 'level2'
  WHEN betting_limit_level = 'standard' THEN 'level3'
  WHEN betting_limit_level = 'premium' THEN 'level4'
  WHEN betting_limit_level = 'vip' THEN 'level6'
  ELSE 'level3' -- 预设标准
END
WHERE betting_limit_level IS NOT NULL;

UPDATE agents 
SET betting_limit_level = CASE 
  WHEN betting_limit_level = 'mini' THEN 'level1'
  WHEN betting_limit_level = 'basic' THEN 'level2'
  WHEN betting_limit_level = 'standard' THEN 'level3'
  WHEN betting_limit_level = 'premium' THEN 'level4'
  WHEN betting_limit_level = 'vip' THEN 'level6'
  ELSE 'level3' -- 预设标准
END
WHERE betting_limit_level IS NOT NULL;

-- 显示更新后的配置
SELECT 
  level_name,
  level_display_name,
  level_order,
  description,
  jsonb_pretty(config) as config
FROM betting_limit_configs 
ORDER BY level_order;