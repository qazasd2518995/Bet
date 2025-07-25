-- 創建代理個人資料表
CREATE TABLE IF NOT EXISTS agent_profiles (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
    real_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    line_id VARCHAR(50),
    telegram VARCHAR(50),
    address TEXT,
    remark TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_agent_profiles_agent_id ON agent_profiles(agent_id);

-- 檢查表是否創建成功
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'agent_profiles';

-- 查看表結構
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'agent_profiles' 
ORDER BY ordinal_position; 