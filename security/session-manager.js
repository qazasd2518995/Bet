// security/session-manager.js - 会话管理系统
import db from '../db/config.js';
import crypto from 'crypto';
import wsManager from '../websocket/ws-manager.js';

/**
 * 会话管理器
 * 用于控制同一帐号不能同时在不同装置登入
 */
class SessionManager {
  
  /**
   * 创建新会话
   * @param {string} userType - 用户类型 ('agent' 或 'member')
   * @param {number} userId - 用户ID
   * @param {string} ipAddress - IP地址
   * @param {string} userAgent - 用户代理字符串
   * @param {number} expiresInMinutes - 会话过期时间（分钟）
   * @returns {string} session token
   */
  static async createSession(userType, userId, ipAddress, userAgent, expiresInMinutes = 480) {
    try {
      // 生成唯一的会话token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      
      // 检查是否已有活跃会话
      const existingSessions = await this.getActiveSessions(userType, userId);
      
      if (existingSessions.length > 0) {
        console.log(`用户 ${userType}:${userId} 已有活跃会话，将强制登出其他装置`);
        
        // 通知所有现有会话即时登出
        for (const session of existingSessions) {
          wsManager.notifySessionInvalidated(session.session_token);
        }
        
        // 强制登出所有现有会话
        await this.invalidateUserSessions(userType, userId);
      }
      
      // 创建新会话
      await db.none(`
        INSERT INTO user_sessions (
          session_token, user_type, user_id, ip_address, user_agent, 
          expires_at, is_active, created_at, last_activity
        ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      `, [sessionToken, userType, userId, ipAddress, userAgent, expiresAt]);
      
      console.log(`✅ 创建新会话: ${userType}:${userId}, token: ${sessionToken.substring(0, 8)}...`);
      
      return sessionToken;
      
    } catch (error) {
      console.error('创建会话失败:', error);
      throw new Error('会话创建失败');
    }
  }
  
  /**
   * 验证会话
   * @param {string} sessionToken - 会话token
   * @returns {Object|null} 会话信息或null
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
      
      // 更新最后活动时间
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
      console.error('验证会话失败:', error);
      return null;
    }
  }
  
  /**
   * 获取用户的活跃会话
   * @param {string} userType - 用户类型
   * @param {number} userId - 用户ID
   * @returns {Array} 活跃会话列表
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
      console.error('获取活跃会话失败:', error);
      return [];
    }
  }
  
  /**
   * 强制登出用户的所有会话
   * @param {string} userType - 用户类型
   * @param {number} userId - 用户ID
   */
  static async invalidateUserSessions(userType, userId) {
    try {
      // 获取所有活跃会话的 token
      const sessions = await db.any(`
        SELECT session_token 
        FROM user_sessions 
        WHERE user_type = $1 
        AND user_id = $2 
        AND is_active = true
      `, [userType, userId]);
      
      // 通知每个会话被强制登出
      for (const session of sessions) {
        wsManager.notifySessionInvalidated(session.session_token);
      }
      
      // 更新资料库标记为无效
      await db.none(`
        UPDATE user_sessions 
        SET is_active = false 
        WHERE user_type = $1 
        AND user_id = $2 
        AND is_active = true
      `, [userType, userId]);
      
      console.log(`✅ 已强制登出用户 ${userType}:${userId} 的所有会话`);
      
    } catch (error) {
      console.error('强制登出会话失败:', error);
      throw new Error('强制登出失败');
    }
  }
  
  /**
   * 登出特定会话
   * @param {string} sessionToken - 会话token
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
      
      console.log(`✅ 会话已登出: ${sessionToken.substring(0, 8)}...`);
      
    } catch (error) {
      console.error('登出会话失败:', error);
      throw new Error('登出失败');
    }
  }
  
  /**
   * 清理过期会话
   */
  static async cleanupExpiredSessions() {
    try {
      const result = await db.result(`
        DELETE FROM user_sessions 
        WHERE expires_at < NOW() 
        OR (is_active = false AND created_at < NOW() - INTERVAL '7 days')
      `);
      
      if (result.rowCount > 0) {
        console.log(`🗑️ 清理了 ${result.rowCount} 个过期会话`);
      }
      
    } catch (error) {
      console.error('清理过期会话失败:', error);
    }
  }
  
  /**
   * 获取会话统计信息
   * @returns {Object} 统计信息
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
      console.error('获取会话统计失败:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        activeAgents: 0,
        activeMembers: 0
      };
    }
  }
  
  /**
   * 检查IP是否有异常登入行为
   * @param {string} ipAddress - IP地址
   * @param {number} timeWindowMinutes - 时间窗口（分钟）
   * @returns {boolean} 是否异常
   */
  static async checkSuspiciousActivity(ipAddress, timeWindowMinutes = 60) {
    try {
      const count = await db.one(`
        SELECT COUNT(DISTINCT user_id) as unique_users
        FROM user_sessions 
        WHERE ip_address = $1 
        AND created_at > NOW() - INTERVAL '${timeWindowMinutes} minutes'
      `, [ipAddress]);
      
      // 如果同一IP在时间窗口内登入了超过3个不同用户，标记为可疑
      return parseInt(count.unique_users) > 3;
      
    } catch (error) {
      console.error('检查可疑活动失败:', error);
      return false;
    }
  }
  
  /**
   * 初始化会话管理系统
   * 创建必要的资料库表和定时清理任务
   */
  static async initialize() {
    try {
      // 确保user_sessions表存在
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
      
      // 创建索引
      await db.none(`CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token)`);
      await db.none(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_type, user_id)`);
      await db.none(`CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at)`);
      await db.none(`CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active)`);
      
      console.log('✅ 会话管理系统初始化完成');
      
      // 设定定时清理过期会话（每30分钟执行一次）
      setInterval(() => {
        this.cleanupExpiredSessions();
      }, 30 * 60 * 1000);
      
    } catch (error) {
      console.error('初始化会话管理系统失败:', error);
      throw error;
    }
  }
}

export default SessionManager; 