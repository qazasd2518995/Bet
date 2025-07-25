-- 为会员表添加限红等级栏位
ALTER TABLE members ADD COLUMN IF NOT EXISTS betting_limit_level VARCHAR(20) DEFAULT 'level1';

-- 创建限红配置表
CREATE TABLE IF NOT EXISTS betting_limit_configs (
    id SERIAL PRIMARY KEY,
    level_name VARCHAR(20) UNIQUE NOT NULL,
    level_display_name VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_members_betting_limit_level ON members(betting_limit_level);
CREATE INDEX IF NOT EXISTS idx_betting_limit_configs_level_name ON betting_limit_configs(level_name);

-- 插入预设限红配置
INSERT INTO betting_limit_configs (level_name, level_display_name, config, description) VALUES
('level1', '新手限红', '{
  "number": {"minBet": 1, "maxBet": 500, "periodLimit": 1000},
  "twoSide": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "sumValueSize": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "sumValue": {"minBet": 1, "maxBet": 200, "periodLimit": 400},
  "dragonTiger": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000}
}', '适用于新会员，投注限额较低'),

('level2', '标准限红', '{
  "number": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "twoSide": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "sumValueSize": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "sumValue": {"minBet": 1, "maxBet": 400, "periodLimit": 800},
  "dragonTiger": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000}
}', '适用于一般会员'),

('level3', '高级限红', '{
  "number": {"minBet": 1, "maxBet": 2500, "periodLimit": 5000},
  "twoSide": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueSize": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValue": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "dragonTiger": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000}
}', '适用于VIP会员，原始限红设定'),

('level4', 'VIP限红', '{
  "number": {"minBet": 1, "maxBet": 5000, "periodLimit": 10000},
  "twoSide": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueSize": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValue": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "dragonTiger": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000}
}', '适用于高级VIP会员'),

('level5', '超级VIP限红', '{
  "number": {"minBet": 1, "maxBet": 10000, "periodLimit": 20000},
  "twoSide": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueSize": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValue": {"minBet": 1, "maxBet": 4000, "periodLimit": 8000},
  "dragonTiger": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000}
}', '适用于超级VIP会员'),

('level6', '无限制限红', '{
  "number": {"minBet": 1, "maxBet": 20000, "periodLimit": 40000},
  "twoSide": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueSize": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValue": {"minBet": 1, "maxBet": 8000, "periodLimit": 16000},
  "dragonTiger": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000}
}', '适用于特殊会员，最高限红')

ON CONFLICT (level_name) DO UPDATE SET
  level_display_name = EXCLUDED.level_display_name,
  config = EXCLUDED.config,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- 更新现有会员的限红等级为level3（保持原有设定）
UPDATE members SET betting_limit_level = 'level3' WHERE betting_limit_level IS NULL OR betting_limit_level = '';

COMMIT; 