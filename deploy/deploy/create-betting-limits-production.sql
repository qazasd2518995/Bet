-- =====================================================
-- 生產環境限紅配置表創建腳本
-- =====================================================

-- 1. 創建限紅配置表
CREATE TABLE IF NOT EXISTS betting_limit_configs (
    id SERIAL PRIMARY KEY,
    level_name VARCHAR(20) UNIQUE NOT NULL,
    level_display_name VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 創建索引
CREATE INDEX IF NOT EXISTS idx_betting_limit_configs_level_name ON betting_limit_configs(level_name);

-- 3. 為members表添加限紅等級欄位
ALTER TABLE members ADD COLUMN IF NOT EXISTS betting_limit_level VARCHAR(20) DEFAULT 'level1';

-- 4. 為members表的限紅等級欄位創建索引
CREATE INDEX IF NOT EXISTS idx_members_betting_limit_level ON members(betting_limit_level);

-- 5. 插入6個預設限紅配置
INSERT INTO betting_limit_configs (level_name, level_display_name, config, description) VALUES
('level1', '新手限紅', '{
  "number": {"minBet": 1, "maxBet": 500, "periodLimit": 1000},
  "twoSide": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValueSize": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000},
  "sumValue": {"minBet": 1, "maxBet": 200, "periodLimit": 400},
  "dragonTiger": {"minBet": 1, "maxBet": 1000, "periodLimit": 1000}
}', '適合新手會員的基礎限紅'),

('level2', '一般限紅', '{
  "number": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "twoSide": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValueSize": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000},
  "sumValue": {"minBet": 1, "maxBet": 400, "periodLimit": 800},
  "dragonTiger": {"minBet": 1, "maxBet": 2000, "periodLimit": 2000}
}', '適合一般會員的標準限紅'),

('level3', '標準限紅', '{
  "number": {"minBet": 1, "maxBet": 2500, "periodLimit": 5000},
  "twoSide": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueSize": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000},
  "sumValue": {"minBet": 1, "maxBet": 1000, "periodLimit": 2000},
  "dragonTiger": {"minBet": 1, "maxBet": 5000, "periodLimit": 5000}
}', '標準會員的限紅配置，與原系統相同'),

('level4', '進階限紅', '{
  "number": {"minBet": 1, "maxBet": 5000, "periodLimit": 10000},
  "twoSide": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueSize": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000},
  "sumValue": {"minBet": 1, "maxBet": 2000, "periodLimit": 4000},
  "dragonTiger": {"minBet": 1, "maxBet": 10000, "periodLimit": 10000}
}', '進階會員的限紅配置'),

('level5', '高級限紅', '{
  "number": {"minBet": 1, "maxBet": 10000, "periodLimit": 20000},
  "twoSide": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueSize": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000},
  "sumValue": {"minBet": 1, "maxBet": 4000, "periodLimit": 8000},
  "dragonTiger": {"minBet": 1, "maxBet": 20000, "periodLimit": 20000}
}', '高級會員的限紅配置'),

('level6', 'VIP限紅', '{
  "number": {"minBet": 1, "maxBet": 20000, "periodLimit": 40000},
  "twoSide": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueSize": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValueOddEven": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000},
  "sumValue": {"minBet": 1, "maxBet": 8000, "periodLimit": 16000},
  "dragonTiger": {"minBet": 1, "maxBet": 40000, "periodLimit": 40000}
}', 'VIP會員的最高限紅配置')

ON CONFLICT (level_name) DO NOTHING;

-- 6. 驗證創建結果
SELECT 
    'betting_limit_configs表創建完成' as status,
    COUNT(*) as config_count,
    array_agg(level_name ORDER BY level_name) as levels
FROM betting_limit_configs;

-- 7. 顯示配置詳情
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

-- 8. 檢查members表的新欄位
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'members' 
    AND column_name = 'betting_limit_level';

COMMIT; 