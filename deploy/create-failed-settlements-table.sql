
-- Create failed_settlements table for tracking settlement failures
CREATE TABLE IF NOT EXISTS failed_settlements (
    id SERIAL PRIMARY KEY,
    period BIGINT UNIQUE NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_failed_settlements_period ON failed_settlements(period);
CREATE INDEX IF NOT EXISTS idx_failed_settlements_created_at ON failed_settlements(created_at);
