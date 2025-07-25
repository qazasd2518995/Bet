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
  
  // 添加新的開獎結果 - 修正重複期號導致卡住的問題
  async addResult(period, result) {
    try {
      console.log(`🎲 嘗試添加開獎結果: 期號=${period}, 結果=${JSON.stringify(result)}`);
      
      // 先檢查該期號是否已存在
      const existing = await db.oneOrNone(`
        SELECT period, result FROM result_history WHERE period = $1
      `, [period]);
      
      if (existing) {
        console.log(`⚠️ 期號 ${period} 的開獎結果已存在: ${JSON.stringify(existing.result)}`);
        console.log(`🔄 準備用新結果覆蓋: ${JSON.stringify(result)}`);
        
        // 🎯 關鍵修復：如果結果不同，更新為新結果
        const existingResultStr = Array.isArray(existing.result) ? JSON.stringify(existing.result) : existing.result;
        const newResultStr = JSON.stringify(result);
        
        if (existingResultStr !== newResultStr) {
          console.log(`🔧 結果不同，執行更新操作`);
          
          const updatedResult = await db.one(`
            UPDATE result_history 
            SET result = $1,
                position_1 = $3, position_2 = $4, position_3 = $5, position_4 = $6, position_5 = $7,
                position_6 = $8, position_7 = $9, position_8 = $10, position_9 = $11, position_10 = $12,
                created_at = CURRENT_TIMESTAMP 
            WHERE period = $2 
            RETURNING *
          `, [JSON.stringify(result), period, ...result]);
          
          console.log(`✅ 成功更新期號 ${period} 的開獎結果`);
          return {
            ...updatedResult,
            wasUpdated: true // 標記為已更新
          };
        } else {
          console.log(`✅ 期號 ${period} 結果相同，無需更新`);
          return {
            ...existing,
            isDuplicate: true // 標記為重複期號
          };
        }
      }
      
      // 嘗試使用INSERT ... ON CONFLICT來處理併發情況
      try {
        const insertedResult = await db.one(`
          INSERT INTO result_history (
            period, result,
            position_1, position_2, position_3, position_4, position_5,
            position_6, position_7, position_8, position_9, position_10
          ) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
          ON CONFLICT (period) DO UPDATE SET
            result = EXCLUDED.result,
            position_1 = EXCLUDED.position_1, position_2 = EXCLUDED.position_2,
            position_3 = EXCLUDED.position_3, position_4 = EXCLUDED.position_4,
            position_5 = EXCLUDED.position_5, position_6 = EXCLUDED.position_6,
            position_7 = EXCLUDED.position_7, position_8 = EXCLUDED.position_8,
            position_9 = EXCLUDED.position_9, position_10 = EXCLUDED.position_10,
            created_at = EXCLUDED.created_at
          RETURNING *
        `, [period, JSON.stringify(result), ...result]);
        
        console.log(`✅ 成功添加期號 ${period} 的開獎結果`);
        return insertedResult;
      } catch (onConflictError) {
        // 如果ON CONFLICT失敗（約束不存在），使用普通INSERT
        if (onConflictError.code === '42P10') {
          console.log(`⚠️ 約束不存在，使用普通INSERT插入期號 ${period}`);
          const insertedResult = await db.one(`
            INSERT INTO result_history (
              period, result,
              position_1, position_2, position_3, position_4, position_5,
              position_6, position_7, position_8, position_9, position_10
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING *
          `, [period, JSON.stringify(result), ...result]);
          
          console.log(`✅ 成功添加期號 ${period} 的開獎結果（普通INSERT）`);
          return insertedResult;
        }
        throw onConflictError;
      }
    } catch (error) {
      // 如果是唯一約束違反，不要返回null，而是重新檢查
      if (error.code === '23505') {
        console.log(`⚠️ 唯一約束違反，期號 ${period} 可能已被其他進程插入`);
        const existing = await db.oneOrNone(`
          SELECT period, result FROM result_history WHERE period = $1
        `, [period]);
        
        if (existing) {
          // 🎯 關鍵修復：併發衝突時也要檢查結果是否需要更新
          const existingResultStr = Array.isArray(existing.result) ? JSON.stringify(existing.result) : existing.result;
          const newResultStr = JSON.stringify(result);
          
          if (existingResultStr !== newResultStr) {
            console.log(`🔧 併發衝突後發現結果不同，執行更新操作`);
            
            const updatedResult = await db.one(`
              UPDATE result_history 
              SET result = $1,
                  position_1 = $3, position_2 = $4, position_3 = $5, position_4 = $6, position_5 = $7,
                  position_6 = $8, position_7 = $9, position_8 = $10, position_9 = $11, position_10 = $12,
                  created_at = CURRENT_TIMESTAMP 
              WHERE period = $2 
              RETURNING *
            `, [JSON.stringify(result), period, ...result]);
            
            console.log(`✅ 成功更新期號 ${period} 的開獎結果（併發情況）`);
            return {
              ...updatedResult,
              wasUpdated: true
            };
          }
          
          return {
            ...existing,
            isDuplicate: true
          };
        }
      }
      
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