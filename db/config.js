// db/config.js - PostgreSQL數據庫配置
import pgp from 'pg-promise';
import dotenv from 'dotenv';

// 載入環境變量
dotenv.config();

// 初始化pg-promise
const pgInstance = pgp();

// 獲取數據庫URL（從環境變量或使用本地默認值）
const databaseUrl = process.env.DATABASE_URL || 'postgres://localhost:5432/bet_game';

// 創建數據庫連接
const db = pgInstance(databaseUrl);

// 測試連接
db.connect()
  .then(obj => {
    console.log('數據庫連接成功');
    obj.done(); // 釋放連接
  })
  .catch(error => {
    console.error('數據庫連接失敗:', error);
  });

export default db; 