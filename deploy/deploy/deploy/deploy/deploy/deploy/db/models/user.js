// db/models/user.js - 用戶模型
import db from '../config.js';

// 用戶模型
const UserModel = {
  // 創建或更新用戶
  async createOrUpdate(userData) {
    const { username, balance = 0, status = 1 } = userData;
    
    try {
      // 檢查用戶是否存在
      const existingUser = await this.findByUsername(username);
      
      if (existingUser) {
        // 更新現有用戶
        return await db.one(`
          UPDATE users 
          SET balance = $1, status = $2, last_login_at = CURRENT_TIMESTAMP 
          WHERE username = $3 
          RETURNING *
        `, [balance, status, username]);
      } else {
        // 創建新用戶
        return await db.one(`
          INSERT INTO users (username, balance, status, last_login_at) 
          VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
          RETURNING *
        `, [username, balance, status]);
      }
    } catch (error) {
      console.error('創建或更新用戶出錯:', error);
      throw error;
    }
  },
  
  // 查詢用戶
  async findByUsername(username) {
    try {
      return await db.oneOrNone('SELECT * FROM users WHERE username = $1', [username]);
    } catch (error) {
      console.error('查詢用戶出錯:', error);
      throw error;
    }
  },
  
  // 更新用戶餘額
  async updateBalance(username, amount) {
    try {
      return await db.one(`
        UPDATE users 
        SET balance = balance + $1 
        WHERE username = $2 
        RETURNING *
      `, [amount, username]);
    } catch (error) {
      console.error('更新用戶餘額出錯:', error);
      throw error;
    }
  },
  
  // 設置用戶餘額（絕對值）
  async setBalance(username, balance) {
    try {
      return await db.one(`
        UPDATE users 
        SET balance = $1 
        WHERE username = $2 
        RETURNING *
      `, [balance, username]);
    } catch (error) {
      console.error('設置用戶餘額出錯:', error);
      throw error;
    }
  },
  
  // 原子性扣除餘額（解決並發安全問題）
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
      console.error('扣除用戶餘額出錯:', error);
      throw error;
    }
  },
  
  // 原子性增加餘額（解決並發安全問題）
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
      console.error('增加用戶餘額出錯:', error);
      throw error;
    }
  },
  
  // 獲取所有用戶
  async findAll() {
    try {
      return await db.any('SELECT * FROM users');
    } catch (error) {
      console.error('獲取所有用戶出錯:', error);
      throw error;
    }
  }
};

export default UserModel; 