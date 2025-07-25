// db/test-connection.js
// 简单测试PostgreSQL连接的脚本

import pgp from 'pg-promise';
import os from 'os';

// 获取当前系统用户名
const username = os.userInfo().username;

// 初始化pg-promise
const pgInstance = pgp();

// 使用不同的连接方式尝试
const connectionOptions = {
  host: 'localhost',
  port: 5432,
  database: 'bet_game',
  user: username
};

console.log('测试连接 (使用物件配置)...');
console.log('连接选项:', connectionOptions);

const db1 = pgInstance(connectionOptions);

// 测试物件连接
db1.connect()
  .then(obj => {
    console.log('使用物件配置连接成功!');
    obj.done(); // 释放连接
    
    // 尝试执行简单查询
    return db1.any('SELECT current_timestamp')
      .then(data => {
        console.log('查询结果:', data);
      });
  })
  .catch(error => {
    console.error('使用物件配置连接失败:', error);
  })
  .finally(() => {
    // 尝试连接字符串方式
    console.log('\n测试连接 (使用连接字符串)...');
    const connectionString = `postgres://${username}@localhost:5432/bet_game`;
    console.log('连接字符串:', connectionString);
    
    const db2 = pgInstance(connectionString);
    
    db2.connect()
      .then(obj => {
        console.log('使用连接字符串连接成功!');
        obj.done();
        process.exit(0);
      })
      .catch(error => {
        console.error('使用连接字符串连接失败:', error);
        process.exit(1);
      });
  }); 