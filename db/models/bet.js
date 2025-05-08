// db/models/bet.js - 注單模型
import db from '../config.js';

// 注單模型
const BetModel = {
  // 創建新注單
  async create(betData) {
    const { 
      username, 
      bet_type, 
      bet_value, 
      position, 
      amount, 
      odds, 
      period 
    } = betData;
    
    try {
      return await db.one(`
        INSERT INTO bet_history (
          username, bet_type, bet_value, position, 
          amount, odds, period, settled
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, false) 
        RETURNING *
      `, [username, bet_type, bet_value, position, amount, odds, period]);
    } catch (error) {
      console.error('創建注單出錯:', error);
      throw error;
    }
  },
  
  // 獲取指定期數的未結算注單
  async getUnsettledByPeriod(period) {
    try {
      return await db.any(`
        SELECT * FROM bet_history 
        WHERE period = $1 AND settled = false
      `, [period]);
    } catch (error) {
      console.error('獲取未結算注單出錯:', error);
      throw error;
    }
  },
  
  // 更新注單結算結果
  async updateSettlement(id, isWin, winAmount) {
    try {
      return await db.one(`
        UPDATE bet_history 
        SET win = $1, win_amount = $2, settled = true 
        WHERE id = $3 
        RETURNING *
      `, [isWin, winAmount || 0, id]);
    } catch (error) {
      console.error('更新注單結算結果出錯:', error);
      throw error;
    }
  },
  
  // 獲取用戶的注單歷史
  async getByUsername(username, limit = 100) {
    try {
      return await db.any(`
        SELECT * FROM bet_history 
        WHERE username = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [username, limit]);
    } catch (error) {
      console.error('獲取用戶注單歷史出錯:', error);
      throw error;
    }
  },
  
  // 獲取用戶今日的注單統計
  async getUserDailyStats(username) {
    try {
      return await db.one(`
        SELECT 
          COUNT(*) as total_bets,
          SUM(CASE WHEN win = true THEN win_amount - amount ELSE -amount END) as profit
        FROM bet_history 
        WHERE username = $1 
          AND created_at >= CURRENT_DATE
      `, [username]);
    } catch (error) {
      console.error('獲取用戶今日注單統計出錯:', error);
      throw error;
    }
  }
};

export default BetModel; 