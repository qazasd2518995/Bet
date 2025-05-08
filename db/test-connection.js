// db/test-connection.js
// 簡單測試PostgreSQL連接的腳本

import pgp from 'pg-promise';
import os from 'os';

// 獲取當前系統用戶名
const username = os.userInfo().username;

// 初始化pg-promise
const pgInstance = pgp();

// 使用不同的連接方式嘗試
const connectionOptions = {
  host: 'localhost',
  port: 5432,
  database: 'bet_game',
  user: username
};

console.log('測試連接 (使用物件配置)...');
console.log('連接選項:', connectionOptions);

const db1 = pgInstance(connectionOptions);

// 測試物件連接
db1.connect()
  .then(obj => {
    console.log('使用物件配置連接成功!');
    obj.done(); // 釋放連接
    
    // 嘗試執行簡單查詢
    return db1.any('SELECT current_timestamp')
      .then(data => {
        console.log('查詢結果:', data);
      });
  })
  .catch(error => {
    console.error('使用物件配置連接失敗:', error);
  })
  .finally(() => {
    // 嘗試連接字符串方式
    console.log('\n測試連接 (使用連接字符串)...');
    const connectionString = `postgres://${username}@localhost:5432/bet_game`;
    console.log('連接字符串:', connectionString);
    
    const db2 = pgInstance(connectionString);
    
    db2.connect()
      .then(obj => {
        console.log('使用連接字符串連接成功!');
        obj.done();
        process.exit(0);
      })
      .catch(error => {
        console.error('使用連接字符串連接失敗:', error);
        process.exit(1);
      });
  }); 