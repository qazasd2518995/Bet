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
      // 標準化 JSON 處理 - 確保 last_result 始終是正確的 JSON 字符串
      let jsonResult;
      if (last_result === null || last_result === undefined) {
        jsonResult = null;
      } else if (typeof last_result === 'string') {
        // 如果已經是字符串，先解析再重新序列化確保格式正確
        try {
          const parsed = JSON.parse(last_result);
          jsonResult = JSON.stringify(parsed);
        } catch (e) {
          // 如果解析失敗，直接使用原字符串
          jsonResult = last_result;
        }
      } else {
        // 如果是數組或對象，序列化為 JSON
        jsonResult = JSON.stringify(last_result);
      }
      
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
        `, [current_period, countdown_seconds, jsonResult, status, existingState.id]);
      } else {
        // 創建新狀態記錄
        return await db.one(`
          INSERT INTO game_state (
            current_period, countdown_seconds, last_result, status
          ) 
          VALUES ($1, $2, $3, $4) 
          RETURNING *
        `, [current_period, countdown_seconds, jsonResult, status]);
      }
    } catch (error) {
      console.error('更新遊戲狀態出錯:', error);
      throw error;
    }
  },
  
  // 添加新的開獎結果
  async addResult(period, result) {
    try {
      // 標準化 JSON 處理
      let jsonResult;
      if (result === null || result === undefined) {
        jsonResult = null;
      } else if (typeof result === 'string') {
        try {
          const parsed = JSON.parse(result);
          jsonResult = JSON.stringify(parsed);
        } catch (e) {
          jsonResult = result;
        }
      } else {
        jsonResult = JSON.stringify(result);
      }
      
      return await db.one(`
        INSERT INTO result_history (period, result) 
        VALUES ($1, $2) 
        RETURNING *
      `, [period, jsonResult]);
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
  },
  
  // 檢查特定期號的結果是否存在
  async getResultByPeriod(period) {
    try {
      const result = await db.oneOrNone(`
        SELECT period, result, created_at 
        FROM result_history 
        WHERE period = $1
      `, [period]);
      
      if (result && result.result) {
        // 解析 JSON 結果
        try {
          result.result = JSON.parse(result.result);
        } catch (e) {
          console.warn('解析結果 JSON 失敗:', e);
        }
      }
      
      return result;
    } catch (error) {
      console.error('獲取特定期號結果出錯:', error);
      throw error;
    }
  }
};

export default GameModel; 