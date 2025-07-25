// db/models/user.js - 用户模型
import db from '../config.js';

// 用户模型
const UserModel = {
  // 创建或更新用户
  async createOrUpdate(userData) {
    const { username, balance = 0, status = 1 } = userData;
    
    try {
      // 检查用户是否存在
      const existingUser = await this.findByUsername(username);
      
      if (existingUser) {
        // 更新现有用户
        return await db.one(`
          UPDATE users 
          SET balance = $1, status = $2, last_login_at = CURRENT_TIMESTAMP 
          WHERE username = $3 
          RETURNING *
        `, [balance, status, username]);
      } else {
        // 创建新用户
        return await db.one(`
          INSERT INTO users (username, balance, status, last_login_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
          RETURNING *
        `, [username, balance, status]);
      }
    } catch (error) {
      console.error('创建或更新用户出错:', error);
      throw error;
    }
  },
  
  // 查询用户
  async findByUsername(username) {
    try {
      return await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
    } catch (error) {
      console.error('查询用户出错:', error);
      throw error;
    }
  },
  
  // 更新用户余额
  async updateBalance(username, amount) {
    try {
      return await db.one(`
        UPDATE users 
        SET balance = balance + $1 
        WHERE username = $2 
        RETURNING *
      `, [amount, username]);
    } catch (error) {
      console.error('更新用户余额出错:', error);
      throw error;
    }
  },
  
  // 设置用户余额（绝对值）
  async setBalance(username, balance) {
    try {
      return await db.one(`
        UPDATE users 
        SET balance = $1 
        WHERE username = $2 
        RETURNING *
      `, [balance, username]);
    } catch (error) {
      console.error('设置用户余额出错:', error);
      throw error;
    }
  },
  
  // 原子性扣除余额（解决并发安全问题）
  async deductBalance(username, amount) {
    try {
      const result = await db.oneOrNone(`
        UPDATE users 
        SET balance = balance - $1 
        WHERE username = $2 AND balance >= $1
        RETURNING balance
      `, [amount, username]);
      
      if (!result) {
        throw new Error('余额不足或用户不存在');
      }
      
      return result.balance;
    } catch (error) {
      console.error('扣除用户余额出错:', error);
      throw error;
    }
  },
  
  // 原子性增加余额（解决并发安全问题）
  async addBalance(username, amount) {
    try {
      const result = await db.one(`
        UPDATE users 
        SET balance = balance + $1 
        WHERE username = $2 
        RETURNING balance
      `, [amount, username]);
      
      return result.balance;
    } catch (error) {
      console.error('增加用户余额出错:', error);
      throw error;
    }
  },
  
  // 获取所有用户
  async findAll() {
    try {
      return await db.any('SELECT * FROM users');
    } catch (error) {
      console.error('获取所有用户出错:', error);
      throw error;
    }
  }
};

export default UserModel; 