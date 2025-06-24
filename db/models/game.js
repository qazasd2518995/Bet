// db/models/game.js - 遊戲模型
import db from '../config.js';

// 遊戲模型
const GameModel = {
  // 獲取當前遊戲狀態
  async getCurrentState() {
    try {
      const state = await db.oneOrNone(`
        SELECT * FROM game_state 
        ORDER BY id DESC LIMIT 1
      `);
      
      return state;
    } catch (error) {
      console.error('獲取遊戲狀態出錯:', error);
      throw error;
    }
  },
  
  // 更新遊戲狀態
  async updateState(stateData) {
    const { 
      current_period, 
      countdown_seconds, 
      last_result, 
      status 
    } = stateData;
    
    try {
      // 檢查是否已存在遊戲狀態記錄
      const existingState = await this.getCurrentState();
      
      if (existingState) {
        // 更新現有狀態
        return await db.one(`
          UPDATE game_state 
          SET current_period = $1, 
              countdown_seconds = $2, 
              last_result = $3, 
              status = $4, 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = $5 
          RETURNING *
        `, [current_period, countdown_seconds, JSON.stringify(last_result), status, existingState.id]);
      } else {
        // 創建新狀態記錄
        return await db.one(`
          INSERT INTO game_state (
            current_period, countdown_seconds, last_result, status
          ) 
          VALUES ($1, $2, $3, $4) 
          RETURNING *
        `, [current_period, countdown_seconds, JSON.stringify(last_result), status]);
      }
    } catch (error) {
      console.error('更新遊戲狀態出錯:', error);
      throw error;
    }
  },
  
  // 添加新的開獎結果
  async addResult(period, result) {
    try {
      return await db.one(`
        INSERT INTO result_history (period, result) 
        VALUES ($1, $2) 
        RETURNING *
      `, [period, JSON.stringify(result)]);
    } catch (error) {
      console.error('添加開獎結果出錯:', error);
      throw error;
    }
  },
  
  // 獲取開獎結果歷史
  async getResultHistory(limit = 50) {
    try {
      return await db.any(`
        SELECT period, result, created_at 
        FROM result_history 
        ORDER BY period DESC 
        LIMIT $1
      `, [limit]);
    } catch (error) {
      console.error('獲取開獎結果歷史出錯:', error);
      throw error;
    }
  }
};

export default GameModel; 