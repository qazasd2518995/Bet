// db/init.js - 初始化数据库表结构
import db from './config.js';

// 创建数据库表
async function initDatabase() {
  try {
    console.log('开始初始化数据库...');
    
    // 创建用户表
    await db.none(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100), -- 仅作为备份，实际应使用代理系统的认证
        balance DECIMAL(15, 2) DEFAULT 0,
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP
      )
    `);
    
    // 创建下注历史表
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
    
    // 创建游戏结果历史表
    await db.none(`
      CREATE TABLE IF NOT EXISTS result_history (
        id SERIAL PRIMARY KEY,
        period BIGINT NOT NULL UNIQUE,
        result JSON NOT NULL,
        position_1 INTEGER,
        position_2 INTEGER,
        position_3 INTEGER,
        position_4 INTEGER,
        position_5 INTEGER,
        position_6 INTEGER,
        position_7 INTEGER,
        position_8 INTEGER,
        position_9 INTEGER,
        position_10 INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建游戏状态表
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

    // 创建代理表
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

    // 创建会员表
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

    // 创建转帐记录表
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

    // 创建公告表
    await db.none(`
      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT '最新公告',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建交易记录表
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

    // 创建开奖记录表 (用于代理系统)
    await db.none(`
      CREATE TABLE IF NOT EXISTS draw_records (
        id SERIAL PRIMARY KEY,
        period VARCHAR(20) UNIQUE NOT NULL,
        result JSONB NOT NULL,
        draw_time TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引以提高查询性能
    await db.none(`CREATE INDEX IF NOT EXISTS idx_bet_history_period ON bet_history(period)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_bet_history_username ON bet_history(username)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_result_history_period ON result_history(period)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_agents_parent_id ON agents(parent_id)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_members_agent_id ON members(agent_id)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_transfer_records_from_user ON transfer_records(from_user_type, from_user_id)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_transfer_records_to_user ON transfer_records(to_user_type, to_user_id)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_transaction_records_user ON transaction_records(user_type, user_id)`);
    await db.none(`CREATE INDEX IF NOT EXISTS idx_draw_records_period ON draw_records(period)`);

    // 检查并添加 result_history 表的 position 列
    console.log('检查 result_history 表的 position 列...');
    for (let i = 1; i <= 10; i++) {
      await db.none(`
        ALTER TABLE result_history 
        ADD COLUMN IF NOT EXISTS position_${i} INTEGER
      `);
    }
    
    // 添加 draw_time 列
    await db.none(`
      ALTER TABLE result_history 
      ADD COLUMN IF NOT EXISTS draw_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    `);
    
    console.log('✅ 数据库初始化完成');
  } catch (error) {
    console.error('❌ 初始化数据库时出错:', error);
    throw error;
  }
}

// 如果直接执行此文件，则初始化数据库
if (process.argv[1] === new URL(import.meta.url).pathname) {
  initDatabase()
    .then(() => {
      console.log('数据库初始化脚本执行完毕');
      process.exit(0);
    })
    .catch(error => {
      console.error('执行数据库初始化脚本时出错:', error);
      process.exit(1);
    });
}

export default initDatabase; 