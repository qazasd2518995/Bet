-- 為會員表添加限紅等級欄位
ALTER TABLE members ADD COLUMN IF NOT EXISTS betting_limit_level VARCHAR(20) DEFAULT 'level1';

-- 創建限紅配置表
CREATE TABLE IF NOT EXISTS betting_limit_configs (
    id SERIAL PRIMARY KEY,
    level_name VARCHAR(20) UNIQUE NOT NULL,
    level_display_name VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_members_betting_limit_level ON members(betting_limit_level);
CREATE INDEX IF NOT EXISTS idx_betting_limit_configs_level_name ON betting_limit_configs(level_name);

-- 插入預設限紅配置
INSERT INTO betting_limit_configs (level_name, level_display_name, config, description) VALUES
('level1', '新手限紅', '{
  "number": {"minBet": 1, "maxBet": 500, "periodLimit": 1000},
  "twoSide": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "sumValueSize": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "sumValue": {"minBet": 1, "maxBet": 200, "periodLimit": 400},
  "dragonTiger": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000}
}', '適用於新會員，投注限額較低'),

('level2', '標準限紅', '{
  "number": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "twoSide": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "sumValueSize": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "sumValue": {"minBet": 1, "maxBet": 400, "periodLimit": 800},
  "dragonTiger": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000}
}', '適用於一般會員'),

('level3', '高級限紅', '{
  "number": {"minBet": 1, "maxBet": 2500, "periodLimit": 5000},
  "twoSide": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueSize": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValue": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "dragonTiger": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000}
}', '適用於VIP會員，原始限紅設定'),

('level4', 'VIP限紅', '{
  "number": {"minBet": 1, "maxBet": 5000, "periodLimit": 10000},
  "twoSide": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueSize": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValue": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "dragonTiger": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000}
}', '適用於高級VIP會員'),

('level5', '超級VIP限紅', '{
  "number": {"minBet": 1, "maxBet": 10000, "periodLimit": 20000},
  "twoSide": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueSize": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValue": {"minBet": 1, "maxBet": 4000, "periodLimit": 8000},
  "dragonTiger": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000}
}', '適用於超級VIP會員'),

('level6', '無限制限紅', '{
  "number": {"minBet": 1, "maxBet": 20000, "periodLimit": 40000},
  "twoSide": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueSize": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValue": {"minBet": 1, "maxBet": 8000, "periodLimit": 16000},
  "dragonTiger": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000}
}', '適用於特殊會員，最高限紅')

ON CONFLICT (level_name) DO UPDATE SET
  level_display_name = EXCLUDED.level_display_name,
  config = EXCLUDED.config,
  description = EXCLUDED.description,
  updated_at = CURRENT_TIMESTAMP;

-- 更新現有會員的限紅等級為level3（保持原有設定）
UPDATE members SET betting_limit_level = 'level3' WHERE betting_limit_level IS NULL OR betting_limit_level = '';

COMMIT; 