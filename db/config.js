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

// 設置資料庫連接配置
let databaseConfig;

if (process.env.DATABASE_URL) {
  // 使用環境變量中的完整連接字串
  databaseConfig = process.env.DATABASE_URL;
  console.log('使用環境變量數據庫連接 (DATABASE_URL)');
} else if (isRenderEnvironment || process.env.DB_HOST) {
  // 使用提供的 Render PostgreSQL 資料庫資訊
  databaseConfig = {
    host: process.env.DB_HOST || 'dpg-d0e2imc9c44c73che3kg-a',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'bet_game',
    user: process.env.DB_USER || 'bet_game_user',
    password: process.env.DB_PASSWORD || 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
    ssl: {
      rejectUnauthorized: false // 允許自簽名證書，Render 需要這個設定
    },
    // 增加連接穩定性的參數
    max: 30, // 連接池最大連接數
    idleTimeoutMillis: 30000, // 連接最大閒置時間
    connectionTimeoutMillis: 15000, // 連接超時增加到15秒
    query_timeout: 15000, // 查詢超時增加到15秒
    // Render 專用設置
    application_name: 'bet_game_app',
    keepAlive: true,
    keepAliveInitialDelayMillis: 0
  };
  console.log('使用 Render PostgreSQL 配置:', {
    host: databaseConfig.host,
    port: databaseConfig.port,
    database: databaseConfig.database,
    user: databaseConfig.user,
    ssl: '已啟用'
  });
} else {
  // 本地開發環境
  databaseConfig = {
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
  console.log('使用本地配置數據庫連接:', JSON.stringify(databaseConfig, null, 2));
}

// 重要：輸出所有環境變量名稱以進行調試
console.log('是否為Render環境:', isRenderEnvironment);
console.log('NODE_ENV:', process.env.NODE_ENV);

// 創建數據庫連接
const db = pgInstance(databaseConfig);

// 測試連接
db.connect()
  .then(obj => {
    console.log('✅ 數據庫連接成功!');
    obj.done(); // 釋放連接
  })
  .catch(error => {
    console.error('❌ 數據庫連接失敗:', error);
    // 不要在這裡結束進程，讓應用能夠嘗試重新連接
  });

// 導出數據庫實例
export default db; 