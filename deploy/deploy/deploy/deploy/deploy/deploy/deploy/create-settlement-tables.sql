-- create-settlement-tables.sql
-- 創建結算系統所需的表

-- 1. 創建結算鎖表（防止重複結算）
CREATE TABLE IF NOT EXISTS settlement_locks (
    lock_key VARCHAR(100) PRIMARY KEY,
    locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_settlement_locks_expires_at ON settlement_locks(expires_at);

-- 2. 創建結算日誌表（記錄結算歷史）
CREATE TABLE IF NOT EXISTS settlement_logs (
    id SERIAL PRIMARY KEY,
    period BIGINT NOT NULL,
    settled_count INTEGER NOT NULL,
    total_win_amount DECIMAL(15, 2) NOT NULL,
    settlement_details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_settlement_logs_period ON settlement_logs(period);
CREATE INDEX IF NOT EXISTS idx_settlement_logs_created_at ON settlement_logs(created_at);

-- 3. 為 bet_history 添加結算時間欄位（如果不存在）
ALTER TABLE bet_history 
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP;

-- 4. 創建複合索引以提高查詢性能
CREATE INDEX IF NOT EXISTS idx_bet_history_period_settled 
ON bet_history(period, settled);

-- 5. 創建防重複結算的唯一約束（確保每筆注單只能結算一次）
-- 注意：這需要先確保沒有重複的已結算記錄
CREATE UNIQUE INDEX IF NOT EXISTS idx_bet_history_unique_settlement 
ON bet_history(id) WHERE settled = true;

-- 6. 創建結算異常記錄表（記錄結算過程中的異常）
CREATE TABLE IF NOT EXISTS settlement_errors (
    id SERIAL PRIMARY KEY,
    period BIGINT NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_settlement_errors_period ON settlement_errors(period);
CREATE INDEX IF NOT EXISTS idx_settlement_errors_created_at ON settlement_errors(created_at);

-- 7. 創建結算統計表（用於監控和報表）
CREATE TABLE IF NOT EXISTS settlement_statistics (
    id SERIAL PRIMARY KEY,
    period BIGINT NOT NULL UNIQUE,
    total_bets INTEGER NOT NULL DEFAULT 0,
    settled_bets INTEGER NOT NULL DEFAULT 0,
    total_bet_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_win_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    settlement_start_time TIMESTAMP,
    settlement_end_time TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_settlement_statistics_status ON settlement_statistics(status);
CREATE INDEX IF NOT EXISTS idx_settlement_statistics_created_at ON settlement_statistics(created_at);

-- 授權說明
COMMENT ON TABLE settlement_locks IS '結算鎖表，防止同一期號被多次結算';
COMMENT ON TABLE settlement_logs IS '結算日誌表，記錄每次結算的詳細信息';
COMMENT ON TABLE settlement_errors IS '結算異常記錄表，記錄結算過程中的錯誤';
COMMENT ON TABLE settlement_statistics IS '結算統計表，用於監控和生成報表';

-- 顯示創建結果
SELECT 
    'settlement_locks' as table_name, 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settlement_locks') as created
UNION ALL
SELECT 
    'settlement_logs', 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settlement_logs')
UNION ALL
SELECT 
    'settlement_errors', 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settlement_errors')
UNION ALL
SELECT 
    'settlement_statistics', 
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settlement_statistics');