// db/init.js - 初始化數據庫表結構
import db from './config.js';

// 創建數據庫表
async function initDatabase() {
  try {
    console.log('開始初始化數據庫...');
    
    // 創建用戶表
    await db.none(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100), -- 僅作為備份，實際應使用代理系統的認證
        balance DECIMAL(15, 2) DEFAULT 0,
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP
      )
    `);
    
    // 創建下注歷史表
    await db.none(`
      CREATE TABLE IF NOT EXISTS bet_history (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        bet_type VARCHAR(20) NOT NULL,
        bet_value VARCHAR(20) NOT NULL,
        position INTEGER,
        amount DECIMAL(15, 2) NOT NULL,
        odds DECIMAL(10, 2) NOT NULL,
        period BIGINT NOT NULL,
        win BOOLEAN DEFAULT FALSE,
        win_amount DECIMAL(15, 2) DEFAULT 0,
        settled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 創建遊戲結果歷史表
    await db.none(`
      CREATE TABLE IF NOT EXISTS result_history (
        id SERIAL PRIMARY KEY,
        period BIGINT NOT NULL,
        result JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 創建遊戲狀態表
    await db.none(`
      CREATE TABLE IF NOT EXISTS game_state (
        id SERIAL PRIMARY KEY,
        current_period BIGINT NOT NULL,
        countdown_seconds INTEGER NOT NULL,
        last_result JSON NOT NULL,
        status VARCHAR(20) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 檢查並添加 phase_start_time 欄位（用於倒數同步修正）
    const phaseStartTimeExists = await db.oneOrNone(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'game_state' AND column_name = 'phase_start_time'
    `);
    
    if (!phaseStartTimeExists) {
      console.log('📋 添加 phase_start_time 欄位...');
      await db.none(`
        ALTER TABLE game_state 
        ADD COLUMN phase_start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      
      // 更新現有記錄
      await db.none(`
        UPDATE game_state 
        SET phase_start_time = CURRENT_TIMESTAMP 
        WHERE phase_start_time IS NULL
      `);
      
      // 設置非空約束
      await db.none(`
        ALTER TABLE game_state 
        ALTER COLUMN phase_start_time SET NOT NULL
      `);
      console.log('✅ phase_start_time 欄位添加完成');
    }

    // 創建代理表
    await db.none(`
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        real_name VARCHAR(100),
        level INTEGER DEFAULT 1,
        parent_id INTEGER REFERENCES agents(id),
        balance DECIMAL(15, 2) DEFAULT 0,
        commission_rate DECIMAL(5, 2) DEFAULT 0,
        total_commission DECIMAL(15, 2) DEFAULT 0,
        status INTEGER DEFAULT 1,
        is_customer_service BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 創建會員表
    await db.none(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        real_name VARCHAR(100),
        agent_id INTEGER REFERENCES agents(id) NOT NULL,
        balance DECIMAL(15, 2) DEFAULT 0,
        total_bet DECIMAL(15, 2) DEFAULT 0,
        total_win DECIMAL(15, 2) DEFAULT 0,
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 創建轉帳記錄表
    await db.none(`
      CREATE TABLE IF NOT EXISTS transfer_records (
        id SERIAL PRIMARY KEY,
        from_user_type VARCHAR(10) NOT NULL, -- 'agent' 或 'member'
        from_user_id INTEGER NOT NULL,
        to_user_type VARCHAR(10) NOT NULL,
        to_user_id INTEGER NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 創建公告表
    await db.none(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT '最新公告',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 創建交易記錄表
    await db.none(`
      CREATE TABLE IF NOT EXISTS transaction_records (
        id SERIAL PRIMARY KEY,
        user_type VARCHAR(10) NOT NULL, -- 'agent' 或 'member'
        user_id INTEGER NOT NULL,
        transaction_type VARCHAR(50) NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        balance_before DECIMAL(15, 2) NOT NULL,
        balance_after DECIMAL(15, 2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 創建開獎記錄表 (用於代理系統)
    await db.none(`
      CREATE TABLE IF NOT EXISTS draw_records (
        id SERIAL PRIMARY KEY,
        period VARCHAR(20) UNIQUE NOT NULL,
        result JSONB NOT NULL,
        draw_time TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 創建索引以提高查詢性能
    await db.none(`CREATE INDEX IF NOT EXISTS idx_bet_history_period ON bet_history(period)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_bet_history_username ON bet_history(username)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_result_history_period ON result_history(period)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_agents_parent_id ON agents(parent_id)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_members_agent_id ON members(agent_id)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_transfer_records_from_user ON transfer_records(from_user_type, from_user_id)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_transfer_records_to_user ON transfer_records(to_user_type, to_user_id)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_transaction_records_user ON transaction_records(user_type, user_id)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_draw_records_period ON draw_records(period)`);

    console.log('✅ 數據庫初始化完成');
  } catch (error) {
    console.error('❌ 初始化數據庫時出錯:', error);
    throw error;
  }
}

// 如果直接執行此文件，則初始化數據庫
if (process.argv[1] === new URL(import.meta.url).pathname) {
  initDatabase()
    .then(() => {
      console.log('數據庫初始化腳本執行完畢');
      process.exit(0);
    })
    .catch(error => {
      console.error('執行數據庫初始化腳本時出錯:', error);
      process.exit(1);
    });
}

export default initDatabase; 