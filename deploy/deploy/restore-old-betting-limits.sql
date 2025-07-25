-- 恢復舊的限紅配置表
-- 包含6個等級：新手、一般、標準、進階、高級、VIP

-- 先備份現有資料
CREATE TABLE IF NOT EXISTS betting_limit_configs_backup AS 
SELECT * FROM betting_limit_configs;

-- 清空現有配置
TRUNCATE TABLE betting_limit_configs;

-- 插入舊的6級限紅配置
INSERT INTO betting_limit_configs (level_name, level_display_name, level_order, description, config) VALUES
-- Level 1: 新手限紅
('level1', '新手限紅', 1, '適合新手玩家的最低限額', 
'{
  "number": {"minBet": 1, "maxBet": 500, "periodLimit": 1000},
  "twoSide": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValueSize": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValue": {"minBet": 1, "maxBet": 200, "periodLimit": 400},
  "dragonTiger": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000}
}'::jsonb),

-- Level 2: 一般限紅
('level2', '一般限紅', 2, '一般會員標準限額',
'{
  "number": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "twoSide": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValueSize": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValue": {"minBet": 1, "maxBet": 400, "periodLimit": 800},
  "dragonTiger": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000}
}'::jsonb),

-- Level 3: 標準限紅
('level3', '標準限紅', 3, '標準會員限額',
'{
  "number": {"minBet": 1, "maxBet": 2500, "periodLimit": 5000},
  "twoSide": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueSize": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValue": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "dragonTiger": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000}
}'::jsonb),

-- Level 4: 進階限紅
('level4', '進階限紅', 4, '進階會員限額',
'{
  "number": {"minBet": 1, "maxBet": 5000, "periodLimit": 10000},
  "twoSide": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueSize": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValue": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "dragonTiger": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000}
}'::jsonb),

-- Level 5: 高級限紅
('level5', '高級限紅', 5, '高級會員限額',
'{
  "number": {"minBet": 1, "maxBet": 10000, "periodLimit": 20000},
  "twoSide": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueSize": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValue": {"minBet": 1, "maxBet": 4000, "periodLimit": 8000},
  "dragonTiger": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000}
}'::jsonb),

-- Level 6: VIP限紅
('level6', 'VIP限紅', 6, 'VIP會員最高限額',
'{
  "number": {"minBet": 1, "maxBet": 20000, "periodLimit": 40000},
  "twoSide": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueSize": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValue": {"minBet": 1, "maxBet": 8000, "periodLimit": 16000},
  "dragonTiger": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000}
}'::jsonb);

-- 更新現有會員和代理的限紅等級對應
UPDATE members 
SET betting_limit_level = CASE 
  WHEN betting_limit_level = 'mini' THEN 'level1'
  WHEN betting_limit_level = 'basic' THEN 'level2'
  WHEN betting_limit_level = 'standard' THEN 'level3'
  WHEN betting_limit_level = 'premium' THEN 'level4'
  WHEN betting_limit_level = 'vip' THEN 'level6'
  ELSE 'level3' -- 預設標準
END
WHERE betting_limit_level IS NOT NULL;

UPDATE agents 
SET betting_limit_level = CASE 
  WHEN betting_limit_level = 'mini' THEN 'level1'
  WHEN betting_limit_level = 'basic' THEN 'level2'
  WHEN betting_limit_level = 'standard' THEN 'level3'
  WHEN betting_limit_level = 'premium' THEN 'level4'
  WHEN betting_limit_level = 'vip' THEN 'level6'
  ELSE 'level3' -- 預設標準
END
WHERE betting_limit_level IS NOT NULL;

-- 顯示更新後的配置
SELECT 
  level_name,
  level_display_name,
  level_order,
  description,
  jsonb_pretty(config) as config
FROM betting_limit_configs 
ORDER BY level_order;