// db/config.js - PostgreSQL數據庫配置
import pgp from 'pg-promise';
import dotenv from 'dotenv';
import os from 'os';

// 載入環境變量
dotenv.config();

// 獲取當前系統用戶名
const username = os.userInfo().username;

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

// 如果存在環境變量，使用它，否則使用本地配置
let databaseUrl;

if (process.env.DATABASE_URL) {
  databaseUrl = process.env.DATABASE_URL;
  console.log('使用環境變量數據庫連接');
} else {
  // 使用與測試成功的配置相同的連接參數
  databaseUrl = {
    host: 'localhost',
    port: 5432,
    database: 'bet_game',
    user: username,
    // 增加連接穩定性的參數
    max: 30, // 連接池最大連接數
    idleTimeoutMillis: 30000, // 連接最大閒置時間
    connectionTimeoutMillis: 10000, // 連接超時
    query_timeout: 10000 // 查詢超時
  };
  console.log('使用本地配置數據庫連接:', JSON.stringify(databaseUrl, null, 2));
}

// 創建數據庫連接
const db = pgInstance(databaseUrl);

// 測試連接
db.connect()
  .then(obj => {
    console.log('數據庫連接成功!');
    obj.done(); // 釋放連接
  })
  .catch(error => {
    console.error('數據庫連接失敗:', error);
    // 不要在這裡結束進程，讓應用能夠嘗試重新連接
  });

// 導出數據庫實例
export default db; 