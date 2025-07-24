-- 創建跑馬燈訊息表
CREATE TABLE IF NOT EXISTS marquee_messages (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0, -- 優先級，數字越大越優先
    created_by INTEGER REFERENCES agents(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引
CREATE INDEX idx_marquee_active ON marquee_messages(is_active);
CREATE INDEX idx_marquee_priority ON marquee_messages(priority DESC);

-- 添加更新時間觸發器
CREATE OR REPLACE FUNCTION update_marquee_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_marquee_messages_updated_at
    BEFORE UPDATE ON marquee_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_marquee_updated_at();