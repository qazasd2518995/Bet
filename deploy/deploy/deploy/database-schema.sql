-- security/database-schema.sql - 安全相關資料庫表結構

-- ========================================
-- 1. 安全日誌表
-- ========================================
CREATE TABLE IF NOT EXISTS security_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id INTEGER,
    username VARCHAR(50),
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path VARCHAR(255),
    request_body TEXT,
    response_status INTEGER,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 創建索引以提升查詢效能
CREATE INDEX idx_security_logs_event_type ON security_logs(event_type);
CREATE INDEX idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX idx_security_logs_ip_address ON security_logs(ip_address);
CREATE INDEX idx_security_logs_created_at ON security_logs(created_at);

-- ========================================
-- 2. 登入嘗試記錄表
-- ========================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_login_attempts_username ON login_attempts(username);
CREATE INDEX idx_login_attempts_ip_address ON login_attempts(ip_address);
CREATE INDEX idx_login_attempts_created_at ON login_attempts(created_at);

-- ========================================
-- 3. IP 黑名單表
-- ========================================
CREATE TABLE IF NOT EXISTS ip_blacklist (
    id SERIAL PRIMARY KEY,
    ip_address INET UNIQUE NOT NULL,
    reason VARCHAR(255),
    blocked_by INTEGER REFERENCES agents(id),
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_permanent BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_ip_blacklist_ip_address ON ip_blacklist(ip_address);
CREATE INDEX idx_ip_blacklist_expires_at ON ip_blacklist(expires_at);

-- ========================================
-- 4. API 密鑰管理表
-- ========================================
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    rate_limit INTEGER DEFAULT 1000,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER REFERENCES agents(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);

-- ========================================
-- 5. 兩步驗證設置表
-- ========================================
CREATE TABLE IF NOT EXISTS two_factor_auth (
    id SERIAL PRIMARY KEY,
    user_type VARCHAR(10) NOT NULL, -- 'agent' or 'member'
    user_id INTEGER NOT NULL,
    secret VARCHAR(255) NOT NULL,
    backup_codes TEXT[],
    is_enabled BOOLEAN DEFAULT FALSE,
    enabled_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_type, user_id)
);

CREATE INDEX idx_two_factor_auth_user ON two_factor_auth(user_type, user_id);

-- ========================================
-- 6. 會話管理表
-- ========================================
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    user_type VARCHAR(10) NOT NULL,
    user_id INTEGER NOT NULL,
    ip_address INET,
    user_agent TEXT,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_type, user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- ========================================
-- 7. 審計日誌表（記錄所有敏感操作）
-- ========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    changed_by_type VARCHAR(10),
    changed_by_id INTEGER,
    change_reason TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_operation ON audit_logs(operation);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_changed_by ON audit_logs(changed_by_type, changed_by_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ========================================
-- 8. 權限管理表
-- ========================================
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_name, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id SERIAL PRIMARY KEY,
    user_type VARCHAR(10) NOT NULL,
    user_id INTEGER NOT NULL,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    granted_by_type VARCHAR(10),
    granted_by_id INTEGER,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_type, user_id, permission_id)
);

-- ========================================
-- 9. 資料加密密鑰表
-- ========================================
CREATE TABLE IF NOT EXISTS encryption_keys (
    id SERIAL PRIMARY KEY,
    key_name VARCHAR(100) UNIQUE NOT NULL,
    key_version INTEGER NOT NULL,
    encrypted_key TEXT NOT NULL,
    algorithm VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(key_name, key_version)
);

-- ========================================
-- 10. 安全警報表
-- ========================================
CREATE TABLE IF NOT EXISTS security_alerts (
    id SERIAL PRIMARY KEY,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    source_ip INET,
    user_type VARCHAR(10),
    user_id INTEGER,
    metadata JSONB,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_by INTEGER,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX idx_security_alerts_is_resolved ON security_alerts(is_resolved);
CREATE INDEX idx_security_alerts_created_at ON security_alerts(created_at);

-- ========================================
-- 觸發器：自動記錄審計日誌
-- ========================================
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs(table_name, operation, record_id, new_values)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs(table_name, operation, record_id, old_values, new_values)
        VALUES (TG_TABLE_NAME, TG_OP, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs(table_name, operation, record_id, old_values)
        VALUES (TG_TABLE_NAME, TG_OP, OLD.id, to_jsonb(OLD));
        RETURN OLD;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 為敏感表添加審計觸發器
CREATE TRIGGER audit_agents_trigger
AFTER INSERT OR UPDATE OR DELETE ON agents
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_members_trigger
AFTER INSERT OR UPDATE OR DELETE ON members
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_transactions_trigger
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_point_transfers_trigger
AFTER INSERT OR UPDATE OR DELETE ON point_transfers
FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ========================================
-- 預設權限設置
-- ========================================
INSERT INTO permissions (name, description, category) VALUES
('view_all_agents', '查看所有代理', 'agent_management'),
('create_agent', '創建代理', 'agent_management'),
('edit_agent', '編輯代理', 'agent_management'),
('delete_agent', '刪除代理', 'agent_management'),
('view_all_members', '查看所有會員', 'member_management'),
('create_member', '創建會員', 'member_management'),
('edit_member', '編輯會員', 'member_management'),
('delete_member', '刪除會員', 'member_management'),
('manage_balance', '管理餘額', 'financial'),
('view_reports', '查看報表', 'reporting'),
('manage_system', '系統管理', 'system'),
('view_security_logs', '查看安全日誌', 'security'),
('manage_security', '安全管理', 'security')
ON CONFLICT (name) DO NOTHING;

-- ========================================
-- 創建視圖：活躍會話
-- ========================================
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
    s.*,
    CASE 
        WHEN s.user_type = 'agent' THEN a.username
        WHEN s.user_type = 'member' THEN m.username
    END as username
FROM user_sessions s
LEFT JOIN agents a ON s.user_type = 'agent' AND s.user_id = a.id
LEFT JOIN members m ON s.user_type = 'member' AND s.user_id = m.id
WHERE s.is_active = TRUE AND s.expires_at > CURRENT_TIMESTAMP;

-- ========================================
-- 創建視圖：最近的安全事件
-- ========================================
CREATE OR REPLACE VIEW recent_security_events AS
SELECT 
    'login_failure' as event_type,
    created_at,
    username,
    ip_address,
    failure_reason as details
FROM login_attempts
WHERE success = FALSE AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
UNION ALL
SELECT 
    'security_alert' as event_type,
    created_at,
    NULL as username,
    source_ip as ip_address,
    title as details
FROM security_alerts
WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
ORDER BY created_at DESC; 