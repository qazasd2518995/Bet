-- 創建登錄日誌表
CREATE TABLE IF NOT EXISTS user_login_logs (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    user_type VARCHAR(20) DEFAULT 'agent', -- agent, member, admin
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET NOT NULL,
    ip_location TEXT,
    user_agent TEXT,
    session_token VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引優化查詢性能
CREATE INDEX IF NOT EXISTS idx_user_login_logs_username ON user_login_logs(username);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_login_time ON user_login_logs(login_time DESC);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_ip ON user_login_logs(ip_address);

-- 註釋
COMMENT ON TABLE user_login_logs IS '用戶登錄日誌表';
COMMENT ON COLUMN user_login_logs.username IS '用戶名';
COMMENT ON COLUMN user_login_logs.user_type IS '用戶類型：agent-代理, member-會員, admin-管理員';
COMMENT ON COLUMN user_login_logs.login_time IS '登錄時間';
COMMENT ON COLUMN user_login_logs.ip_address IS 'IP地址';
COMMENT ON COLUMN user_login_logs.ip_location IS 'IP歸屬地';
COMMENT ON COLUMN user_login_logs.user_agent IS '瀏覽器用戶代理字串';
COMMENT ON COLUMN user_login_logs.session_token IS '會話令牌';

-- 插入一些示例數據用於測試
INSERT INTO user_login_logs (username, user_type, login_time, ip_address, ip_location) VALUES
('ti2025', 'agent', NOW() - INTERVAL '1 hour', '123.193.88.143', '台湾省台北市 亚太电信集团公司'),
('ti2025', 'agent', NOW() - INTERVAL '2 hours', '123.193.88.143', '台湾省台北市 亚太电信集团公司'),
('ti2025', 'agent', NOW() - INTERVAL '1 day', '140.123.45.67', '台湾省台中市 中华电信'),
('ti2025', 'agent', NOW() - INTERVAL '2 days', '61.216.89.123', '台湾省高雄市 远传电信'),
('ti2025', 'agent', NOW() - INTERVAL '3 days', '203.74.156.89', '台湾省新北市 台湾大哥大')
ON CONFLICT DO NOTHING; 