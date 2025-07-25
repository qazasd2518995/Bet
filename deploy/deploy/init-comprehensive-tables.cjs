// init-comprehensive-tables.cjs - 初始化完整結算系統所需的資料表
const { Pool } = require('pg');

// Database config
const dbConfig = {
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
  ssl: {
    rejectUnauthorized: false
  }
};

const pool = new Pool(dbConfig);

async function createTables() {
    try {
        console.log('=== 初始化完整結算系統資料表 ===\n');
        
        // 1. 創建結算日誌表
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settlement_logs (
                id SERIAL PRIMARY KEY,
                period VARCHAR(20) NOT NULL,
                settled_count INTEGER NOT NULL DEFAULT 0,
                win_count INTEGER NOT NULL DEFAULT 0,
                total_win_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
                execution_time INTEGER,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(period)
            )
        `);
        console.log('✓ 建立 settlement_logs 表');
        
        // 2. 創建結算錯誤表
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settlement_errors (
                id SERIAL PRIMARY KEY,
                period VARCHAR(20) NOT NULL,
                bet_id INTEGER,
                error_type VARCHAR(50),
                error_message TEXT,
                bet_data JSONB,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);
        console.log('✓ 建立 settlement_errors 表');
        
        // 3. 創建結算鎖表（防止重複結算）
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settlement_locks (
                lock_key VARCHAR(100) PRIMARY KEY,
                locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMP NOT NULL
            )
        `);
        console.log('✓ 建立 settlement_locks 表');
        
        // 4. 添加必要的索引
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_settlement_logs_period ON settlement_logs(period);
            CREATE INDEX IF NOT EXISTS idx_settlement_errors_period ON settlement_errors(period);
            CREATE INDEX IF NOT EXISTS idx_bet_history_period_settled ON bet_history(period, settled);
            CREATE INDEX IF NOT EXISTS idx_bet_history_period_type_position ON bet_history(period, bet_type, position);
        `);
        console.log('✓ 建立索引');
        
        // 5. 檢查並修復 bet_history 表結構
        const checkColumns = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'bet_history' 
            AND column_name IN ('settled', 'settled_at', 'win', 'win_amount')
        `);
        
        const existingColumns = checkColumns.rows.map(row => row.column_name);
        
        if (!existingColumns.includes('settled')) {
            await pool.query(`
                ALTER TABLE bet_history 
                ADD COLUMN IF NOT EXISTS settled BOOLEAN DEFAULT false
            `);
            console.log('✓ 新增 settled 欄位');
        }
        
        if (!existingColumns.includes('settled_at')) {
            await pool.query(`
                ALTER TABLE bet_history 
                ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP
            `);
            console.log('✓ 新增 settled_at 欄位');
        }
        
        if (!existingColumns.includes('win')) {
            await pool.query(`
                ALTER TABLE bet_history 
                ADD COLUMN IF NOT EXISTS win BOOLEAN DEFAULT false
            `);
            console.log('✓ 新增 win 欄位');
        }
        
        if (!existingColumns.includes('win_amount')) {
            await pool.query(`
                ALTER TABLE bet_history 
                ADD COLUMN IF NOT EXISTS win_amount DECIMAL(10, 2) DEFAULT 0
            `);
            console.log('✓ 新增 win_amount 欄位');
        }
        
        // 6. 更新所有未設定 settled 狀態的舊投注
        const updateResult = await pool.query(`
            UPDATE bet_history 
            SET settled = true 
            WHERE settled IS NULL 
            AND created_at < NOW() - INTERVAL '1 hour'
        `);
        
        if (updateResult.rowCount > 0) {
            console.log(`✓ 更新了 ${updateResult.rowCount} 筆舊投注的結算狀態`);
        }
        
        console.log('\n✅ 完整結算系統資料表初始化完成！');
        
    } catch (error) {
        console.error('建立資料表時發生錯誤:', error);
    } finally {
        await pool.end();
    }
}

createTables();