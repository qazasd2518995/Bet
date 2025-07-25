-- create-settlement-tables.sql
-- 创建结算系统所需的表

-- 1. 创建结算锁表（防止重复结算）
CREATE TABLE IF NOT EXISTS settlement_locks (
    lock_key VARCHAR(100) PRIMARY KEY,
    locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_settlement_locks_expires_at ON settlement_locks(expires_at);

-- 2. 创建结算日志表（记录结算历史）
CREATE TABLE IF NOT EXISTS settlement_logs (
    id SERIAL PRIMARY KEY,
    period BIGINT NOT NULL,
    settled_count INTEGER NOT NULL,
    total_win_amount DECIMAL(15, 2) NOT NULL,
    settlement_details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_settlement_logs_period ON settlement_logs(period);
CREATE INDEX IF NOT EXISTS idx_settlement_logs_created_at ON settlement_logs(created_at);

-- 3. 为 bet_history 添加结算时间栏位（如果不存在）
ALTER TABLE bet_history 
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP;

-- 4. 创建复合索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_bet_history_period_settled 
ON bet_history(period, settled);

-- 5. 创建防重复结算的唯一约束（确保每笔注单只能结算一次）
-- 注意：这需要先确保没有重复的已结算记录
CREATE UNIQUE INDEX IF NOT EXISTS idx_bet_history_unique_settlement 
ON bet_history(id) WHERE settled = true;

-- 6. 创建结算异常记录表（记录结算过程中的异常）
CREATE TABLE IF NOT EXISTS settlement_errors (
    id SERIAL PRIMARY KEY,
    period BIGINT NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_settlement_errors_period ON settlement_errors(period);
CREATE INDEX IF NOT EXISTS idx_settlement_errors_created_at ON settlement_errors(created_at);

-- 7. 创建结算统计表（用于监控和报表）
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_settlement_statistics_status ON settlement_statistics(status);
CREATE INDEX IF NOT EXISTS idx_settlement_statistics_created_at ON settlement_statistics(created_at);

-- 授权说明
COMMENT ON TABLE settlement_locks IS '结算锁表，防止同一期号被多次结算';
COMMENT ON TABLE settlement_logs IS '结算日志表，记录每次结算的详细信息';
COMMENT ON TABLE settlement_errors IS '结算异常记录表，记录结算过程中的错误';
COMMENT ON TABLE settlement_statistics IS '结算统计表，用于监控和生成报表';

-- 显示创建结果
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