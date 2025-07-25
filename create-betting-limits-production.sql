-- =====================================================
-- 生产环境限红配置表创建脚本
-- =====================================================

-- 1. 创建限红配置表
CREATE TABLE IF NOT EXISTS betting_limit_configs (
    id SERIAL PRIMARY KEY,
    level_name VARCHAR(20) UNIQUE NOT NULL,
    level_display_name VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_betting_limit_configs_level_name ON betting_limit_configs(level_name);

-- 3. 为members表添加限红等级栏位
ALTER TABLE members ADD COLUMN IF NOT EXISTS betting_limit_level VARCHAR(20) DEFAULT 'level1';

-- 4. 为members表的限红等级栏位创建索引
CREATE INDEX IF NOT EXISTS idx_members_betting_limit_level ON members(betting_limit_level);

-- 5. 插入6个预设限红配置
INSERT INTO betting_limit_configs (level_name, level_display_name, config, description) VALUES
('level1', '新手限红', '{
  "number": {"minBet": 1, "maxBet": 500, "periodLimit": 1000},
  "twoSide": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValueSize": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValue": {"minBet": 1, "maxBet": 200, "periodLimit": 400},
  "dragonTiger": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000}
}', '适合新手会员的基础限红'),

('level2', '一般限红', '{
  "number": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "twoSide": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValueSize": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValue": {"minBet": 1, "maxBet": 400, "periodLimit": 800},
  "dragonTiger": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000}
}', '适合一般会员的标准限红'),

('level3', '标准限红', '{
  "number": {"minBet": 1, "maxBet": 2500, "periodLimit": 5000},
  "twoSide": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueSize": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValue": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "dragonTiger": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000}
}', '标准会员的限红配置，与原系统相同'),

('level4', '进阶限红', '{
  "number": {"minBet": 1, "maxBet": 5000, "periodLimit": 10000},
  "twoSide": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueSize": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValue": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "dragonTiger": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000}
}', '进阶会员的限红配置'),

('level5', '高级限红', '{
  "number": {"minBet": 1, "maxBet": 10000, "periodLimit": 20000},
  "twoSide": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueSize": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValue": {"minBet": 1, "maxBet": 4000, "periodLimit": 8000},
  "dragonTiger": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000}
}', '高级会员的限红配置'),

('level6', 'VIP限红', '{
  "number": {"minBet": 1, "maxBet": 20000, "periodLimit": 40000},
  "twoSide": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueSize": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValue": {"minBet": 1, "maxBet": 8000, "periodLimit": 16000},
  "dragonTiger": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000}
}', 'VIP会员的最高限红配置')

ON CONFLICT (level_name) DO NOTHING;

-- 6. 验证创建结果
SELECT 
    'betting_limit_configs表创建完成' as status,
    COUNT(*) as config_count,
    array_agg(level_name ORDER BY level_name) as levels
FROM betting_limit_configs;

-- 7. 显示配置详情
SELECT 
    level_name,
    level_display_name,
    description,
    created_at
FROM betting_limit_configs 
ORDER BY 
    CASE level_name 
        WHEN 'level1' THEN 1
        WHEN 'level2' THEN 2
        WHEN 'level3' THEN 3
        WHEN 'level4' THEN 4
        WHEN 'level5' THEN 5
        WHEN 'level6' THEN 6
        ELSE 999
    END;

-- 8. 检查members表的新栏位
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'members' 
    AND column_name = 'betting_limit_level';

COMMIT; 