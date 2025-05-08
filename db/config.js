// db/config.js - PostgreSQL數據庫配置
import pgp from 'pg-promise';
import dotenv from 'dotenv';
import os from 'os';

// 載入環境變量
dotenv.config();

// 檢測是否在Render環境中
const isRenderEnvironment = process.env.RENDER || process.env.RENDER_EXTERNAL_URL || process.env.NODE_ENV === 'production';

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

// 獲取當前系統用戶名
const username = os.userInfo().username;

// 如果存在環境變量或在Render環境中，使用DATABASE_URL環境變量
let databaseUrl;

if (process.env.DATABASE_URL) {
  databaseUrl = process.env.DATABASE_URL;
  console.log('使用環境變量數據庫連接:', process.env.DATABASE_URL);
} else if (isRenderEnvironment) {
  // 如果在Render環境但沒有環境變量，拋出明顯的錯誤
  const errorMsg = 'Render環境未設置DATABASE_URL環境變量!';
  console.error(errorMsg);
  // 創建一個特殊的連接物件，它將始終拋出相同的錯誤
  databaseUrl = {
    connect: () => Promise.reject(new Error(errorMsg))
  };
} else {
  // 本地開發環境
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

// 重要：輸出所有環境變量名稱以進行調試
console.log('環境變量列表 (僅名稱):', Object.keys(process.env).join(', '));
console.log('是否為Render環境:', isRenderEnvironment);
console.log('NODE_ENV:', process.env.NODE_ENV);

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