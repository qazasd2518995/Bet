// db/models/bet.js - 注单模型
import db from '../config.js';

// 注单模型
const BetModel = {
  // 创建新注单
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
      console.error('创建注单出错:', error);
      throw error;
    }
  },
  
  // 获取指定期数的未结算注单
  async getUnsettledByPeriod(period) {
    try {
      return await db.any(`
        SELECT * FROM bet_history 
        WHERE period = $1 AND settled = false
      `, [period]);
    } catch (error) {
      console.error('获取未结算注单出错:', error);
      throw error;
    }
  },
  
  // 更新注单结算结果
  async updateSettlement(id, isWin, winAmount) {
    try {
      // 首先检查该注单是否已经结算，避免重复结算
      const existingBet = await db.oneOrNone(`
        SELECT id, settled FROM bet_history WHERE id = $1
      `, [id]);
      
      // 如果注单不存在或已经结算，则跳过
      if (!existingBet) {
        console.warn(`⚠️ 警告: 注单ID ${id} 不存在，无法结算`);
        return null;
      }
      
      if (existingBet.settled) {
        console.warn(`⚠️ 警告: 注单ID ${id} 已经结算过，避免重复结算`);
        // 返回现有的注单数据
        return await db.one(`SELECT * FROM bet_history WHERE id = $1`, [id]);
      }
      
      // 使用事务保证原子性
      return await db.tx(async t => {
        // 更新注单为已结算
        const updatedBet = await t.one(`
          UPDATE bet_history 
          SET win = $1, win_amount = $2, settled = true 
          WHERE id = $3 AND settled = false
          RETURNING *
        `, [isWin, winAmount || 0, id]);
        
        console.log(`✅ 注单ID ${id} 结算成功，赢钱金额: ${winAmount || 0}`);
        return updatedBet;
      });
    } catch (error) {
      console.error('更新注单结算结果出错:', error);
      throw error;
    }
  },
  
  // 获取用户的注单历史
  async getByUsername(username, limit = 100) {
    try {
      return await db.any(`
        SELECT * FROM bet_history 
        WHERE username = $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `, [username, limit]);
    } catch (error) {
      console.error('获取用户注单历史出错:', error);
      throw error;
    }
  },
  
  // 获取用户今日的注单统计
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
      console.error('获取用户今日注单统计出错:', error);
      throw error;
    }
  },
  
  // 获取最近几期的已结算注单
  async getRecentSettledBets(periods = 10) {
    try {
      // 首先获取最近几期的期数
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
      
      // 获取这些期数的所有已结算注单
      const values = periodList;
      const placeholders = periodList.map((_, i) => `$${i+1}`).join(',');
      const betRows = await db.any(`
        SELECT * FROM bet_history
        WHERE period IN (${placeholders}) AND settled = true
        ORDER BY period DESC
      `, values);
      
      return betRows;
    } catch (error) {
      console.error('获取最近已结算注单出错:', error);
      return [];
    }
  },
  
  // 获取用户指定期数的投注记录（用于限红检查）
  async findByUserAndPeriod(username, period) {
    try {
      return await db.any(`
        SELECT bet_type as betType, bet_value as value, amount, position
        FROM bet_history 
        WHERE username = $1 AND period = $2
      `, [username, period]);
    } catch (error) {
      console.error('获取用户当期投注记录出错:', error);
      return [];
    }
  }
};

export default BetModel; 