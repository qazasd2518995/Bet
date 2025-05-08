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
    
    console.log('數據庫初始化完成');
  } catch (error) {
    console.error('初始化數據庫時出錯:', error);
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