// db/config.js - PostgreSQL數據庫配置
import pgp from 'pg-promise';
import dotenv from 'dotenv';
import os from 'os';

// 載入環境變量
dotenv.config();

// 強制設定為 production 環境
process.env.NODE_ENV = 'production';

// 初始化pg-promise，添加錯誤處理
const pgInstance = pgp({
  error: (err, e) => {
    if (e.cn) {
      console.error('連接錯誤:', err);
    } else if (e.query) {
      console.error('查詢錯誤:', err);
    } else {
      console.error('未知錯誤:', err);
    }
  }
});

// 強制使用 Render PostgreSQL 資料庫配置
const databaseConfig = {
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
  ssl: true
};

console.log('使用 Render PostgreSQL 配置:', {
  host: databaseConfig.host,
  port: databaseConfig.port,
  database: databaseConfig.database,
  user: databaseConfig.user,
  ssl: '已啟用'
});

console.log(`🔥 強制使用 Render PostgreSQL 資料庫，不允許本地 fallback`);

// 創建數據庫實例
const db = pgInstance(databaseConfig);

// 導出數據庫實例
export default db;

// 也導出原始配置供 pg Client 使用
export { databaseConfig }; 