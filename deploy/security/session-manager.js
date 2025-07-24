// security/session-manager.js - 會話管理系統
import db from '../db/config.js';
import crypto from 'crypto';
import wsManager from '../websocket/ws-manager.js';

/**
 * 會話管理器
 * 用於控制同一帳號不能同時在不同裝置登入
 */
class SessionManager {
  
  /**
   * 創建新會話
   * @param {string} userType - 用戶類型 ('agent' 或 'member')
   * @param {number} userId - 用戶ID
   * @param {string} ipAddress - IP地址
   * @param {string} userAgent - 用戶代理字符串
   * @param {number} expiresInMinutes - 會話過期時間（分鐘）
   * @returns {string} session token
   */
  static async createSession(userType, userId, ipAddress, userAgent, expiresInMinutes = 480) {
    try {
      // 生成唯一的會話token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      
      // 檢查是否已有活躍會話
      const existingSessions = await this.getActiveSessions(userType, userId);
      
      if (existingSessions.length > 0) {
        console.log(`用戶 ${userType}:${userId} 已有活躍會話，將強制登出其他裝置`);
        
        // 通知所有現有會話即時登出
        for (const session of existingSessions) {
          wsManager.notifySessionInvalidated(session.session_token);
        }
        
        // 強制登出所有現有會話
        await this.invalidateUserSessions(userType, userId);
      }
      
      // 創建新會話
      await db.none(`
        INSERT INTO user_sessions (
          session_token, user_type, user_id, ip_address, user_agent, 
          expires_at, is_active, created_at, last_activity
        ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      `, [sessionToken, userType, userId, ipAddress, userAgent, expiresAt]);
      
      console.log(`✅ 創建新會話: ${userType}:${userId}, token: ${sessionToken.substring(0, 8)}...`);
      
      return sessionToken;
      
    } catch (error) {
      console.error('創建會話失敗:', error);
      throw new Error('會話創建失敗');
    }
  }
  
  /**
   * 驗證會話
   * @param {string} sessionToken - 會話token
   * @returns {Object|null} 會話信息或null
   */
  static async validateSession(sessionToken) {
    try {
      if (!sessionToken) {
        return null;
      }
      
      const session = await db.oneOrNone(`
        SELECT * FROM user_sessions 
        WHERE session_token = $1 
        AND is_active = true 
        AND expires_at > NOW()
      `, [sessionToken]);
      
      if (!session) {
        return null;
      }
      
      // 更新最後活動時間
      await db.none(`
        UPDATE user_sessions 
        SET last_activity = NOW() 
        WHERE session_token = $1
      `, [sessionToken]);
      
      return {
        userType: session.user_type,
        userId: session.user_id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        createdAt: session.created_at,
        lastActivity: session.last_activity
      };
      
    } catch (error) {
      console.error('驗證會話失敗:', error);
      return null;
    }
  }
  
  /**
   * 獲取用戶的活躍會話
   * @param {string} userType - 用戶類型
   * @param {number} userId - 用戶ID
   * @returns {Array} 活躍會話列表
   */
  static async getActiveSessions(userType, userId) {
    try {
      const sessions = await db.any(`
        SELECT session_token, ip_address, user_agent, created_at, last_activity
        FROM user_sessions 
        WHERE user_type = $1 
        AND user_id = $2 
        AND is_active = true 
        AND expires_at > NOW()
        ORDER BY last_activity DESC
      `, [userType, userId]);
      
      return sessions;
      
    } catch (error) {
      console.error('獲取活躍會話失敗:', error);
      return [];
    }
  }
  
  /**
   * 強制登出用戶的所有會話
   * @param {string} userType - 用戶類型
   * @param {number} userId - 用戶ID
   */
  static async invalidateUserSessions(userType, userId) {
    try {
      // 獲取所有活躍會話的 token
      const sessions = await db.any(`
        SELECT session_token 
        FROM user_sessions 
        WHERE user_type = $1 
        AND user_id = $2 
        AND is_active = true
      `, [userType, userId]);
      
      // 通知每個會話被強制登出
      for (const session of sessions) {
        wsManager.notifySessionInvalidated(session.session_token);
      }
      
      // 更新資料庫標記為無效
      await db.none(`
        UPDATE user_sessions 
        SET is_active = false 
        WHERE user_type = $1 
        AND user_id = $2 
        AND is_active = true
      `, [userType, userId]);
      
      console.log(`✅ 已強制登出用戶 ${userType}:${userId} 的所有會話`);
      
    } catch (error) {
      console.error('強制登出會話失敗:', error);
      throw new Error('強制登出失敗');
    }
  }
  
  /**
   * 登出特定會話
   * @param {string} sessionToken - 會話token
   */
  static async logout(sessionToken) {
    try {
      if (!sessionToken) {
        return;
      }
      
      await db.none(`
        UPDATE user_sessions 
        SET is_active = false 
        WHERE session_token = $1
      `, [sessionToken]);
      
      console.log(`✅ 會話已登出: ${sessionToken.substring(0, 8)}...`);
      
    } catch (error) {
      console.error('登出會話失敗:', error);
      throw new Error('登出失敗');
    }
  }
  
  /**
   * 清理過期會話
   */
  static async cleanupExpiredSessions() {
    try {
      const result = await db.result(`
        DELETE FROM user_sessions 
        WHERE expires_at < NOW() 
        OR (is_active = false AND created_at < NOW() - INTERVAL '7 days')
      `);
      
      if (result.rowCount > 0) {
        console.log(`🗑️ 清理了 ${result.rowCount} 個過期會話`);
      }
      
    } catch (error) {
      console.error('清理過期會話失敗:', error);
    }
  }
  
  /**
   * 獲取會話統計信息
   * @returns {Object} 統計信息
   */
  static async getSessionStats() {
    try {
      const stats = await db.one(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_sessions,
          COUNT(CASE WHEN user_type = 'agent' AND is_active = true THEN 1 END) as active_agents,
          COUNT(CASE WHEN user_type = 'member' AND is_active = true THEN 1 END) as active_members
        FROM user_sessions 
        WHERE expires_at > NOW()
      `);
      
      return {
        totalSessions: parseInt(stats.total_sessions),
        activeSessions: parseInt(stats.active_sessions),
        activeAgents: parseInt(stats.active_agents),
        activeMembers: parseInt(stats.active_members)
      };
      
    } catch (error) {
      console.error('獲取會話統計失敗:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        activeAgents: 0,
        activeMembers: 0
      };
    }
  }
  
  /**
   * 檢查IP是否有異常登入行為
   * @param {string} ipAddress - IP地址
   * @param {number} timeWindowMinutes - 時間窗口（分鐘）
   * @returns {boolean} 是否異常
   */
  static async checkSuspiciousActivity(ipAddress, timeWindowMinutes = 60) {
    try {
      const count = await db.one(`
        SELECT COUNT(DISTINCT user_id) as unique_users
        FROM user_sessions 
        WHERE ip_address = $1 
        AND created_at > NOW() - INTERVAL '${timeWindowMinutes} minutes'
      `, [ipAddress]);
      
      // 如果同一IP在時間窗口內登入了超過3個不同用戶，標記為可疑
      return parseInt(count.unique_users) > 3;
      
    } catch (error) {
      console.error('檢查可疑活動失敗:', error);
      return false;
    }
  }
  
  /**
   * 初始化會話管理系統
   * 創建必要的資料庫表和定時清理任務
   */
  static async initialize() {
    try {
      // 確保user_sessions表存在
      await db.none(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id SERIAL PRIMARY KEY,
          session_token VARCHAR(255) UNIQUE NOT NULL,
          user_type VARCHAR(10) NOT NULL,
          user_id INTEGER NOT NULL,
          ip_address INET,
          user_agent TEXT,
          last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // 創建索引
      await db.none(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token)`);
      await db.none(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_type, user_id)`);
      await db.none(`CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)`);
      await db.none(`CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active)`);
      
      console.log('✅ 會話管理系統初始化完成');
      
      // 設定定時清理過期會話（每30分鐘執行一次）
      setInterval(() => {
        this.cleanupExpiredSessions();
      }, 30 * 60 * 1000);
      
    } catch (error) {
      console.error('初始化會話管理系統失敗:', error);
      throw error;
    }
  }
}

export default SessionManager; 