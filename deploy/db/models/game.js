// db/models/game.js - 游戏模型
import db from '../config.js';

// 游戏模型
const GameModel = {
  // 获取当前游戏状态
  async getCurrentState() {
    try {
      const state = await db.oneOrNone(`
        SELECT * FROM game_state 
        ORDER BY id DESC LIMIT 1
      `);
      
      return state;
    } catch (error) {
      console.error('获取游戏状态出错:', error);
      throw error;
    }
  },
  
  // 更新游戏状态
  async updateState(stateData) {
    const { 
      current_period, 
      countdown_seconds, 
      last_result, 
      status 
    } = stateData;
    
    try {
      // 检查是否已存在游戏状态记录
      const existingState = await this.getCurrentState();
      
      if (existingState) {
        // 更新现有状态
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
        // 创建新状态记录
        return await db.one(`
          INSERT INTO game_state (
            current_period, countdown_seconds, last_result, status
          ) 
          VALUES ($1, $2, $3, $4) 
          RETURNING *
        `, [current_period, countdown_seconds, JSON.stringify(last_result), status]);
      }
    } catch (error) {
      console.error('更新游戏状态出错:', error);
      throw error;
    }
  },
  
  // 添加新的开奖结果 - 修正重复期号导致卡住的问题
  async addResult(period, result) {
    try {
      console.log(`🎲 尝试添加开奖结果: 期号=${period}, 结果=${JSON.stringify(result)}`);
      
      // 先检查该期号是否已存在
      const existing = await db.oneOrNone(`
        SELECT period, result FROM result_history WHERE period = $1
      `, [period]);
      
      if (existing) {
        console.log(`⚠️ 期号 ${period} 的开奖结果已存在: ${JSON.stringify(existing.result)}`);
        console.log(`🔄 准备用新结果覆盖: ${JSON.stringify(result)}`);
        
        // 🎯 关键修复：如果结果不同，更新为新结果
        const existingResultStr = Array.isArray(existing.result) ? JSON.stringify(existing.result) : existing.result;
        const newResultStr = JSON.stringify(result);
        
        if (existingResultStr !== newResultStr) {
          console.log(`🔧 结果不同，执行更新操作`);
          
          const updatedResult = await db.one(`
            UPDATE result_history 
            SET result = $1,
                position_1 = $3, position_2 = $4, position_3 = $5, position_4 = $6, position_5 = $7,
                position_6 = $8, position_7 = $9, position_8 = $10, position_9 = $11, position_10 = $12,
                created_at = CURRENT_TIMESTAMP 
            WHERE period = $2 
            RETURNING *
          `, [JSON.stringify(result), period, ...result]);
          
          console.log(`✅ 成功更新期号 ${period} 的开奖结果`);
          return {
            ...updatedResult,
            wasUpdated: true // 标记为已更新
          };
        } else {
          console.log(`✅ 期号 ${period} 结果相同，无需更新`);
          return {
            ...existing,
            isDuplicate: true // 标记为重复期号
          };
        }
      }
      
      // 尝试使用INSERT ... ON CONFLICT来处理并发情况
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
        
        console.log(`✅ 成功添加期号 ${period} 的开奖结果`);
        return insertedResult;
      } catch (onConflictError) {
        // 如果ON CONFLICT失败（约束不存在），使用普通INSERT
        if (onConflictError.code === '42P10') {
          console.log(`⚠️ 约束不存在，使用普通INSERT插入期号 ${period}`);
          const insertedResult = await db.one(`
            INSERT INTO result_history (
              period, result,
              position_1, position_2, position_3, position_4, position_5,
              position_6, position_7, position_8, position_9, position_10
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING *
          `, [period, JSON.stringify(result), ...result]);
          
          console.log(`✅ 成功添加期号 ${period} 的开奖结果（普通INSERT）`);
          return insertedResult;
        }
        throw onConflictError;
      }
    } catch (error) {
      // 如果是唯一约束违反，不要返回null，而是重新检查
      if (error.code === '23505') {
        console.log(`⚠️ 唯一约束违反，期号 ${period} 可能已被其他进程插入`);
        const existing = await db.oneOrNone(`
          SELECT period, result FROM result_history WHERE period = $1
        `, [period]);
        
        if (existing) {
          // 🎯 关键修复：并发冲突时也要检查结果是否需要更新
          const existingResultStr = Array.isArray(existing.result) ? JSON.stringify(existing.result) : existing.result;
          const newResultStr = JSON.stringify(result);
          
          if (existingResultStr !== newResultStr) {
            console.log(`🔧 并发冲突后发现结果不同，执行更新操作`);
            
            const updatedResult = await db.one(`
              UPDATE result_history 
              SET result = $1,
                  position_1 = $3, position_2 = $4, position_3 = $5, position_4 = $6, position_5 = $7,
                  position_6 = $8, position_7 = $9, position_8 = $10, position_9 = $11, position_10 = $12,
                  created_at = CURRENT_TIMESTAMP 
              WHERE period = $2 
              RETURNING *
            `, [JSON.stringify(result), period, ...result]);
            
            console.log(`✅ 成功更新期号 ${period} 的开奖结果（并发情况）`);
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
      
      console.error('添加开奖结果出错:', error);
      throw error;
    }
  },
  
  // 获取开奖结果历史
  async getResultHistory(limit = 50) {
    try {
      return await db.any(`
        SELECT period, result, created_at 
        FROM result_history 
        ORDER BY period DESC 
        LIMIT $1
      `, [limit]);
    } catch (error) {
      console.error('获取开奖结果历史出错:', error);
      throw error;
    }
  }
};

export default GameModel; 