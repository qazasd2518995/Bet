-- 創建子帳號表
CREATE TABLE IF NOT EXISTS sub_accounts (
    id SERIAL PRIMARY KEY,
    parent_agent_id INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    status INTEGER DEFAULT 1, -- 1: 啟用, 0: 停用
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_sub_accounts_parent_agent_id ON sub_accounts(parent_agent_id);
CREATE INDEX IF NOT EXISTS idx_sub_accounts_username ON sub_accounts(username);

-- 添加觸發器自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_sub_accounts_updated_at 
BEFORE UPDATE ON sub_accounts 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();