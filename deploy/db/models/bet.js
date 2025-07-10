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
      // 首先檢查該注單是否已經結算，避免重複結算
      const existingBet = await db.oneOrNone(`
        SELECT id, settled FROM bet_history WHERE id = $1
      `, [id]);
      
      // 如果注單不存在或已經結算，則跳過
      if (!existingBet) {
        console.warn(`⚠️ 警告: 注單ID ${id} 不存在，無法結算`);
        return null;
      }
      
      if (existingBet.settled) {
        console.warn(`⚠️ 警告: 注單ID ${id} 已經結算過，避免重複結算`);
        // 返回現有的注單數據
        return await db.one(`SELECT * FROM bet_history WHERE id = $1`, [id]);
      }
      
      // 使用事務保證原子性
      return await db.tx(async t => {
        // 更新注單為已結算
        const updatedBet = await t.one(`
          UPDATE bet_history 
          SET win = $1, win_amount = $2, settled = true 
          WHERE id = $3 AND settled = false
          RETURNING *
        `, [isWin, winAmount || 0, id]);
        
        console.log(`✅ 注單ID ${id} 結算成功，贏錢金額: ${winAmount || 0}`);
        return updatedBet;
      });
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
  },
  
  // 獲取最近幾期的已結算注單
  async getRecentSettledBets(periods = 10) {
    try {
      // 首先獲取最近几期的期數
      const periodRows = await db.any(`
        SELECT DISTINCT period FROM bet_history
        WHERE settled = true
        ORDER BY period DESC
        LIMIT $1
      `, [periods]);
      
      if (periodRows.length === 0) {
        return [];
      }
      
      const periodList = periodRows.map(row => row.period);
      
      // 獲取這些期數的所有已結算注單
      const values = periodList;
      const placeholders = periodList.map((_, i) => `$${i+1}`).join(',');
      const betRows = await db.any(`
        SELECT * FROM bet_history
        WHERE period IN (${placeholders}) AND settled = true
        ORDER BY period DESC
      `, values);
      
      return betRows;
    } catch (error) {
      console.error('獲取最近已結算注單出錯:', error);
      return [];
    }
  },
  
  // 獲取用戶指定期數的投注記錄（用於限紅檢查）
  async findByUserAndPeriod(username, period) {
    try {
      return await db.any(`
        SELECT bet_type as betType, bet_value as value, amount, position
        FROM bet_history 
        WHERE username = $1 AND period = $2
      `, [username, period]);
    } catch (error) {
      console.error('獲取用戶當期投注記錄出錯:', error);
      return [];
    }
  }
};

export default BetModel; 