// db/config.js - PostgreSQL数据库配置
import pgp from 'pg-promise';
import dotenv from 'dotenv';
import os from 'os';

// 载入环境变量
dotenv.config();

// 强制设定为 production 环境
process.env.NODE_ENV = 'production';

// 初始化pg-promise，添加错误处理
const pgInstance = pgp({
  error: (err, e) => {
    if (e.cn) {
      console.error('连接错误:', err);
    } else if (e.query) {
      console.error('查询错误:', err);
    } else {
      console.error('未知错误:', err);
    }
  }
});

// 强制使用 Render PostgreSQL 资料库配置
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
  ssl: '已启用'
});

console.log(`🔥 强制使用 Render PostgreSQL 资料库，不允许本地 fallback`);

// 创建数据库实例
const db = pgInstance(databaseConfig);

// 导出数据库实例
export default db;

// 也导出原始配置供 pg Client 使用
export { databaseConfig }; 