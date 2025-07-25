
-- 創建失敗期號結果表
CREATE TABLE IF NOT EXISTS failed_period_results (
    id SERIAL PRIMARY KEY,
    period VARCHAR(20) UNIQUE NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_failed_period_results_period ON failed_period_results(period);
CREATE INDEX IF NOT EXISTS idx_failed_period_results_created_at ON failed_period_results(created_at);
