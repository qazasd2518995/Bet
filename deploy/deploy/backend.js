// backend.js - FS金彩赛车游戏后端
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';
import { createServer } from 'http';
import wsManager from './websocket/ws-manager.js';

// 导入数据库模型
import db from './db/config.js';
import initDatabase from './db/init.js';
import ensureDatabaseConstraints from './ensure-database-constraints.js';
import UserModel from './db/models/user.js';
import BetModel from './db/models/bet.js';
import GameModel from './db/models/game.js';
import SessionManager from './security/session-manager.js';
import { improvedSettleBets, createSettlementTables } from './improved-settlement-system.js';
import { optimizedBatchBet, optimizedSettlement } from './optimized-betting-system.js';
import { comprehensiveSettlement, createSettlementTables as createComprehensiveTables } from './comprehensive-settlement-system.js';
import { enhancedSettlement } from './enhanced-settlement-system.js';
import drawSystemManager from './fixed-draw-system.js';
import { generateBlockchainData } from './utils/blockchain.js';

// 初始化环境变量
dotenv.config();

// 强制设定为 production 环境以使用 Render 资料库
process.env.NODE_ENV = 'production';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 解析开奖结果的工具函数
function parseDrawResult(result) {
    if (!result) return null;
    
    // 如果已经是阵列，直接返回
    if (Array.isArray(result)) {
        return result;
    }
    
    // 如果是字串
    if (typeof result === 'string') {
        try {
            // 首先尝试 JSON 解析
            return JSON.parse(result);
        } catch (e) {
            // 如果失败，尝试逗号分隔格式
            const arr = result.split(',').map(n => {
                const num = parseInt(n.trim());
                return isNaN(num) ? null : num;
            }).filter(n => n !== null);
            
            return arr.length > 0 ? arr : null;
        }
    }
    
    return null;
}

const app = express();
const port = process.env.PORT || 3000;

// 代理后端URL - 强制使用 Render 代理系统
const AGENT_API_URL = 'https://bet-agent.onrender.com';

console.log(`🌐 当前环境: ${process.env.NODE_ENV || 'development'}`);
console.log(`🔗 代理系统API URL: ${AGENT_API_URL} (强制使用 Render)`);

// 立即同步开奖结果到代理系统
async function syncToAgentSystem(period, result) {
  try {
    console.log(`🚀 立即同步开奖结果到代理系统: 期数=${period}`);
    
    // 调用代理系统的内部同步API
    const response = await fetch(`${AGENT_API_URL}/api/agent/sync-draw-record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        period: period.toString(),
        result: result,
        draw_time: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ 开奖结果同步成功: 期数=${period}`, data);
    } else {
      console.error(`❌ 开奖结果同步失败: 期数=${period}, 状态=${response.status}`);
    }
  } catch (error) {
    console.error(`❌ 同步开奖结果到代理系统出错: 期数=${period}`, error.message);
    // 不要抛出错误，避免影响游戏流程
  }
}

// 跨域设置 - 允许前端访问
app.use(cors({
  origin: function(origin, callback) {
    // 允许所有来源的请求
    const allowedOrigins = [
      'https://bet-game.onrender.com', 
      'https://bet-game-vcje.onrender.com',  // 添加实际的Render URL
      'https://bet-agent.onrender.com',
      'http://localhost:3002', 
      'http://localhost:3000', 
      'http://localhost:8082', 
      'http://127.0.0.1:8082',
      'http://localhost:3001',
      'http://127.0.0.1:3001'
    ];
    
    // 在生产环境中，也允许同源请求（没有origin头的请求）
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS错误: 不允许的来源 ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// 处理预检请求
app.options('*', cors());

app.use(express.json());

// 提供静态文件 - 这使得前端文件可以被访问
// 修复 RangeNotSatisfiableError - 禁用范围请求
app.use(express.static(path.join(__dirname, 'frontend'), {
    acceptRanges: false,
    etag: false,
    lastModified: false,
    setHeaders: (res, path, stat) => {
        res.set('Cache-Control', 'no-store');
    }
}));

// 所有路由都导向 index.html (SPA 设置)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Favicon 路由处理
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'favicon.svg'));
});

// 健康检查端点 - 用于 Render 监控
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 会话检查API - 使用新的会话管理系统
app.get('/api/member/check-session', async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'] || req.query.sessionToken;
    const legacyToken = req.headers.authorization?.split(' ')[1];
    
    if (sessionToken) {
      // 使用新的会话管理系统验证
      const session = await SessionManager.validateSession(sessionToken);
      
      if (session && session.userType === 'member') {
        return res.json({ 
          success: true, 
          message: 'Session valid',
          isAuthenticated: true,
          sessionInfo: {
            userId: session.userId,
            lastActivity: session.lastActivity
          }
        });
      } else {
        return res.json({ 
          success: false, 
          message: 'Session expired or invalid',
          needLogin: true,
          isAuthenticated: false,
          reason: 'session_invalid'
        });
      }
    } else if (legacyToken) {
      // 向后兼容旧的token系统
      console.log('使用旧版token检查会话');
      return res.json({ 
        success: true, 
        message: 'Legacy session valid',
        isAuthenticated: true 
      });
    } else {
      // 没有会话凭证
      return res.json({ 
        success: false, 
        message: 'No session found',
        needLogin: true,
        isAuthenticated: false,
        reason: 'no_token'
      });
    }
  } catch (error) {
    console.error('Session check error:', error);
    return res.json({ 
      success: false, 
      message: 'Session check failed',
      needLogin: true,
      isAuthenticated: false,
      reason: 'system_error'
    });
  }
});

// 会员登出API
app.post('/api/member/logout', async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'] || req.body.sessionToken;
    
    if (sessionToken) {
      await SessionManager.logout(sessionToken);
      console.log('✅ 会员登出成功');
    }
    
    res.json({
      success: true,
      message: '登出成功'
    });
    
  } catch (error) {
    console.error('会员登出错误:', error);
    res.json({
      success: true, // 即使出错也返回成功，因为登出应该总是成功
      message: '登出成功'
    });
  }
});

// 会员会话检查API
app.get('/api/member/check-session', async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return res.json({
        success: false,
        message: '没有提供会话令牌'
      });
    }
    
    // 验证会话
    const session = await SessionManager.validateSession(sessionToken);
    if (!session) {
      return res.json({
        success: false,
        message: '会话已过期或无效'
      });
    }
    
    res.json({
      success: true,
      message: '会话有效'
    });
    
  } catch (error) {
    console.error('检查会员会话状态错误:', error);
    res.status(500).json({
      success: false,
      message: '检查会话状态失败'
    });
  }
});

// 会员登入API
app.post('/api/member/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`会员登入请求: ${username}`);
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供帐号和密码'
      });
    }
    
    // 尝试向代理系统查询会员资讯
    let useLocalAuth = false;
    try {
      console.log(`🔄 尝试连接代理系统: ${AGENT_API_URL}/api/agent/member/verify-login`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
      
      const response = await fetch(`${AGENT_API_URL}/api/agent/member/verify-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username,
          password: password
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const memberData = await response.json();
        console.log(`📥 代理系统回应:`, memberData);
        
        if (memberData.success) {
          // 检查会员状态
          if (memberData.member.status !== 1) {
            return res.status(400).json({
              success: false,
              message: '帐号已被停用，请联系客服'
            });
          }
          
          console.log(`✅ 代理系统登入成功: ${username}, ID: ${memberData.member.id}`);
          
          // 获取请求信息
          const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
          const userAgent = req.headers['user-agent'] || '';
          
          // 创建会话（这会自动登出其他装置的会话）
          const sessionToken = await SessionManager.createSession('member', memberData.member.id, ipAddress, userAgent);
          
          console.log(`✅ 会员登入成功: ${username} (ID: ${memberData.member.id}), IP: ${ipAddress}`);
          
          return res.json({
            success: true,
            message: '登入成功',
            member: {
              id: memberData.member.id,
              username: memberData.member.username,
              balance: memberData.member.balance,
              agent_id: memberData.member.agent_id,
              status: memberData.member.status,
              market_type: memberData.member.market_type || 'D'
            },
            sessionToken: sessionToken // 新的会话token
          });
        } else {
          console.log(`❌ 代理系统登入失败: ${memberData.message}`);
          useLocalAuth = true;
        }
      } else {
        console.log(`❌ 代理系统HTTP错误: ${response.status} ${response.statusText}`);
        useLocalAuth = true;
      }
    } catch (agentError) {
      console.log(`❌ 代理系统连接失败: ${agentError.message}`);
      useLocalAuth = true;
    }
    
    // 使用本地验证模式
    if (useLocalAuth) {
      console.log('🔄 切换到本地验证模式');
      
      try {
        // 先从资料库查询会员
        console.log(`🔍 从资料库查询会员: ${username}`);
        const member = await db.oneOrNone('SELECT id, username, password, balance, agent_id, status, market_type FROM members WHERE username = $1 AND status = 1', [username]);
        
        let user = null;
        
        if (member) {
          console.log(`🔍 找到会员记录: ${member.username}, 密码匹配: ${member.password === password}`);
          if (member.password === password) {
            user = {
              id: member.id,
              balance: member.balance,
              agent_id: member.agent_id,
              market_type: member.market_type || 'D'
            };
            console.log(`✅ 资料库验证成功: ${username}, ID: ${member.id}, 余额: ${member.balance}`);
          }
        } else {
          console.log(`❌ 资料库中未找到会员: ${username}`);
        }
        
        if (!user) {
          // 如果资料库中没有，则使用硬编码的测试帐号
          console.log(`🔄 尝试使用测试帐号验证: ${username}`);
          const validUsers = {
            'test': { password: 'test', id: 1, balance: 10000 },
            'demo': { password: 'demo', id: 2, balance: 5000 },
            'user1': { password: '123456', id: 3, balance: 8000 },
            'admin': { password: 'admin123', id: 999, balance: 50000 }
          };
          
          const testUser = validUsers[username];
          if (testUser && testUser.password === password) {
            user = {
              id: testUser.id,
              balance: testUser.balance,
              agent_id: 1,
              market_type: 'D'
            };
            console.log(`✅ 测试帐号验证成功: ${username}, ID: ${testUser.id}`);
          }
        }
        
        if (!user) {
          return res.status(400).json({
            success: false,
            message: '帐号或密码错误'
          });
        }
        // 创建或更新本地用户
        await UserModel.createOrUpdate({
          username: username,
          balance: user.balance,
          status: 1
        });
        
        console.log(`✅ 本地验证登入成功: ${username}, ID: ${user.id}`);
        
        const message = process.env.NODE_ENV === 'production' 
          ? '登入成功' 
          : '登入成功（本地模式）';
        
        // 获取请求信息
        const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
        const userAgent = req.headers['user-agent'] || '';
        
        // 创建会话（这会自动登出其他装置的会话）
        const sessionToken = await SessionManager.createSession('member', user.id, ipAddress, userAgent);
        
        console.log(`✅ 本地模式会员登入成功: ${username} (ID: ${user.id}), IP: ${ipAddress}`);
        
        return res.json({
          success: true,
          message: message,
          member: {
            id: user.id,
            username: username,
            balance: user.balance,
            agent_id: 1,
            status: 1
          },
          sessionToken: sessionToken // 新的会话token
        });
      } catch (dbError) {
        console.error('❌ 创建本地用户失败:', dbError);
        return res.status(500).json({
          success: false,
          message: '登入处理失败，请稍后再试'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: '帐号或密码错误'
      });
    }
    
  } catch (error) {
    console.error('会员登入错误:', error);
    res.status(500).json({
      success: false,
      message: '登入服务暂时不可用，请稍后再试'
    });
  }
});

// 获取会员余额API
app.get('/api/member/balance/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // 向代理系统查询会员余额
    const response = await fetch(`${AGENT_API_URL}/api/agent/member-balance?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    const balanceData = await response.json();
    
    res.json(balanceData);
    
  } catch (error) {
    console.error('获取会员余额错误:', error);
    res.status(500).json({
      success: false,
      message: '获取余额失败'
    });
  }
});

// 会员投注记录API
app.get('/api/member/bet-records/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // 向代理系统查询会员投注记录
    const response = await fetch(`${AGENT_API_URL}/api/agent/member/bet-records/${username}?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: '获取投注记录失败'
      });
    }
    
    const recordsData = await response.json();
    
    res.json(recordsData);
    
  } catch (error) {
    console.error('获取会员投注记录错误:', error);
    res.status(500).json({
      success: false,
      message: '获取投注记录失败'
    });
  }
});

// 会员盈亏统计API
app.get('/api/member/profit-loss/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { period = 'today' } = req.query;
    
    // 向代理系统查询会员盈亏
    const response = await fetch(`${AGENT_API_URL}/api/agent/member/profit-loss/${username}?period=${period}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: '获取盈亏统计失败'
      });
    }
    
    const profitData = await response.json();
    
    res.json(profitData);
    
  } catch (error) {
    console.error('获取会员盈亏统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取盈亏统计失败'
    });
  }
});

// 会员密码修改API
app.post('/api/member/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    
    console.log(`收到会员密码修改请求: ${username}`);
    
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '请提供完整信息'
      });
    }
    
    // 密码验证
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码长度不能少于6个字符'
      });
    }
    
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: '新密码不能与当前密码相同'
      });
    }
    
    // 尝试连接代理系统修改密码
    try {
      console.log(`🔄 向代理系统发送密码修改请求: ${AGENT_API_URL}/api/agent/member/change-password`);
      
      const response = await fetch(`${AGENT_API_URL}/api/agent/member/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username,
          currentPassword: currentPassword,
          newPassword: newPassword
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`📥 代理系统密码修改回应:`, result);
        
        if (result.success) {
          console.log(`✅ 代理系统密码修改成功: ${username}`);
          return res.json({
            success: true,
            message: '密码修改成功'
          });
        } else {
          return res.status(400).json({
            success: false,
            message: result.message || '密码修改失败'
          });
        }
      } else {
        console.log(`❌ 代理系统HTTP错误: ${response.status} ${response.statusText}`);
      }
    } catch (agentError) {
      console.log(`❌ 代理系统连接失败: ${agentError.message}`);
    }
    
    // 如果代理系统失败，使用本地验证和修改
    try {
      console.log('🔄 使用本地密码修改模式');
      
      // 验证当前密码
      const member = await db.oneOrNone('SELECT id, username, password FROM members WHERE username = $1', [username]);
      
      if (!member || member.password !== currentPassword) {
        return res.status(400).json({
          success: false,
          message: '当前密码错误'
        });
      }
      
      // 更新密码
      await db.none('UPDATE members SET password = $1, updated_at = NOW() WHERE username = $2', [newPassword, username]);
      
      console.log(`✅ 本地密码修改成功: ${username}`);
      
      return res.json({
        success: true,
        message: '密码修改成功'
      });
    } catch (dbError) {
      console.error('❌ 本地密码修改失败:', dbError);
      return res.status(500).json({
        success: false,
        message: '密码修改失败，请稍后再试'
      });
    }
    
  } catch (error) {
    console.error('会员密码修改错误:', error);
    res.status(500).json({
      success: false,
      message: '密码修改服务暂时不可用，请稍后再试'
    });
  }
});

// 会话状态检查API (GET)
app.get('/api/check-session', async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'];
    
    if (!sessionToken) {
      return res.json({
        success: false,
        message: '没有提供会话令牌'
      });
    }
    
    // 验证会话
    const session = await SessionManager.validateSession(sessionToken);
    if (!session) {
      return res.json({
        success: false,
        message: '会话已过期或无效'
      });
    }
    
    res.json({
      success: true,
      message: '会话有效'
    });
    
  } catch (error) {
    console.error('检查会话状态错误:', error);
    res.status(500).json({
      success: false,
      message: '检查会话状态失败'
    });
  }
});

// 会话状态检查API (POST - 保留旧版本兼容)
app.post('/api/check-session', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.json({
        success: false,
        isValid: false,
        reason: 'no_username'
      });
    }
    
    // 向代理系统查询会员状态
    try {
      const response = await fetch(`${AGENT_API_URL}/api/agent/member/check-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username
        })
      });
      
      if (!response.ok) {
        console.error(`代理系统会话检查API回应错误: ${response.status}`);
        throw new Error(`代理系统API错误: ${response.status}`);
      }
      
      const agentResponse = await response.json();
      
      if (agentResponse.success) {
        res.json({
          success: true,
          isValid: agentResponse.isValid,
          reason: agentResponse.reason,
          sessionId: agentResponse.sessionId
        });
      } else {
        res.json({
          success: false,
          isValid: false,
          reason: agentResponse.reason || 'unknown_error'
        });
      }
      
    } catch (agentError) {
      console.error('代理系统连接错误:', agentError);
      
      // 如果代理系统不可用，假设会话有效（避免误判）
      res.json({
        success: true,
        isValid: true,
        reason: 'agent_system_unavailable'
      });
    }
    
  } catch (error) {
    console.error('会话检查错误:', error);
    res.status(500).json({
      success: false,
      isValid: false,
      reason: 'system_error'
    });
  }
});

// 新增重启游戏循环端点 - 用于手动重启游戏循环
app.get('/api/restart-game-cycle', async (req, res) => {
  try {
    console.log('手动重启游戏循环...');
    
    // 重启游戏循环
    await startGameCycle();
    
    res.json({ 
      success: true, 
      message: '游戏循环已重启',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('重启游戏循环失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '重启游戏循环失败', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 新增数据库初始化端点 - 用于手动触发数据库初始化
app.get('/api/init-db', async (req, res) => {
  try {
    console.log('手动触发数据库初始化...');
    await initDatabase();
    
    // 初始化游戏状态
    const gameState = await GameModel.getCurrentState();
    if (!gameState) {
      // 如果不存在，创建初始游戏状态
      await GameModel.updateState({
        current_period: 202505051077,
        countdown_seconds: 60,
        last_result: [4, 2, 7, 9, 8, 10, 6, 3, 5, 1],
        status: 'betting'
      });
      console.log('创建初始游戏状态成功');
    }
    
    res.json({ 
      success: true, 
      message: '数据库初始化成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('数据库手动初始化失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '数据库初始化失败', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 盘口配置系统 - 使用精确数学公式计算
const MARKET_CONFIG = {
  A: {
    name: 'A盘',
    rebatePercentage: 0.011, // 1.1%退水
    description: '高赔率盘口',
    // 单号赔率：10 × (1 - 0.011) = 9.89
    numberOdds: parseFloat((10 * (1 - 0.011)).toFixed(3)),
    // 两面赔率：2 × (1 - 0.011) = 1.978
    twoSideOdds: parseFloat((2 * (1 - 0.011)).toFixed(3)),
    // 龙虎赔率：2 × (1 - 0.011) = 1.978
    dragonTigerOdds: parseFloat((2 * (1 - 0.011)).toFixed(3))
  },
  D: {
    name: 'D盘', 
    rebatePercentage: 0.041, // 4.1%退水
    description: '标准盘口',
    // 单号赔率：10 × (1 - 0.041) = 9.59
    numberOdds: parseFloat((10 * (1 - 0.041)).toFixed(3)),
    // 两面赔率：2 × (1 - 0.041) = 1.918
    twoSideOdds: parseFloat((2 * (1 - 0.041)).toFixed(3)),
    // 龙虎赔率：2 × (1 - 0.041) = 1.918
    dragonTigerOdds: parseFloat((2 * (1 - 0.041)).toFixed(3))
  }
};

// 动态生成赔率数据函数
function generateOdds(marketType = 'D') {
  const config = MARKET_CONFIG[marketType] || MARKET_CONFIG.D;
  const rebatePercentage = config.rebatePercentage;
  
  // 冠亚和值基础赔率表 - 使用用户提供的新赔率表
  const sumValueBaseOdds = {
    '3': 45.0, '4': 23.0, '5': 15.0, '6': 11.5, '7': 9.0,
    '8': 7.5, '9': 6.5, '10': 5.7, '11': 5.7, '12': 6.5,
    '13': 7.5, '14': 9.0, '15': 11.5, '16': 15.0, '17': 23.0,
    '18': 45.0, '19': 90.0
  };
  
  // 计算冠亚和值赔率（扣除退水）
  const sumValueOdds = {};
  Object.keys(sumValueBaseOdds).forEach(key => {
    sumValueOdds[key] = parseFloat((sumValueBaseOdds[key] * (1 - rebatePercentage)).toFixed(3));
  });
  
  return {
    // 冠亚和值赔率
    sumValue: {
      ...sumValueOdds,
      big: config.twoSideOdds,
      small: config.twoSideOdds,
      odd: config.twoSideOdds,
      even: config.twoSideOdds
    },
    // 单号赔率
    number: {
      first: config.numberOdds,
      second: config.numberOdds,
      third: config.numberOdds,
      fourth: config.numberOdds,
      fifth: config.numberOdds,
      sixth: config.numberOdds,
      seventh: config.numberOdds,
      eighth: config.numberOdds,
      ninth: config.numberOdds,
      tenth: config.numberOdds
    },
    // 各位置两面赔率
    champion: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
    runnerup: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
    third: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
    fourth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
    fifth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
    sixth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
    seventh: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
    eighth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
    ninth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
    tenth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
    // 龙虎赔率
    dragonTiger: {
      dragon: config.dragonTigerOdds,
      tiger: config.dragonTigerOdds
    }
  };
}

// 预设使用D盘赔率
let odds = generateOdds('D');

// 限红配置
const BET_LIMITS = {
  // 1-10车号
  number: {
    minBet: 1,      // 单注最低
    maxBet: 2500,   // 单注最高
    periodLimit: 5000 // 单期限额
  },
  // 两面 (大小单双)
  twoSide: {
    minBet: 1,
    maxBet: 5000,
    periodLimit: 5000
  },
  // 冠亚军和大小
  sumValueSize: {
    minBet: 1,
    maxBet: 5000,
    periodLimit: 5000
  },
  // 冠亚军和单双
  sumValueOddEven: {
    minBet: 1,
    maxBet: 5000,
    periodLimit: 5000
  },
  // 冠亚军和
  sumValue: {
    minBet: 1,
    maxBet: 1000,
    periodLimit: 2000
  },
  // 龙虎
  dragonTiger: {
    minBet: 1,
    maxBet: 5000,
    periodLimit: 5000
  }
};

// 初始化一个特定用户的本地资料
async function initializeUserData(username) {
  console.log('初始化用户资料:', username);
  
  try {
    // 检查用户是否已在数据库中存在
    const existingUser = await UserModel.findByUsername(username);
    if (existingUser) {
      console.log('用户已存在于数据库:', username);
      return existingUser;
    }
    
    // 从代理系统获取会员资料
    const response = await fetch(`${AGENT_API_URL}/api/agent/member-balance?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('从代理系统获取会员资料失败:', response.status);
      // 初始化一个新用户
      const newUser = await UserModel.createOrUpdate({
        username,
        balance: 0,
        status: 1
      });
      return newUser;
    }
    
    const data = await response.json();
    
    if (data.success) {
      // 设定初始用户资料
      const newUser = await UserModel.createOrUpdate({
        username,
        balance: data.balance,
        status: 1
      });
      console.log('成功从代理系统初始化用户资料:', newUser);
      return newUser;
    } else {
      // 初始化一个新用户
      const newUser = await UserModel.createOrUpdate({
        username,
        balance: 0,
        status: 1
      });
      console.log('从代理系统获取资料失败，初始化空资料:', newUser);
      return newUser;
    }
  } catch (error) {
    console.error('初始化用户资料出错:', error);
    // 出错时也尝试创建用户
    try {
      const newUser = await UserModel.createOrUpdate({
        username,
        balance: 0,
        status: 1
      });
      return newUser;
    } catch (innerError) {
      console.error('创建用户时出错:', innerError);
      throw error;
    }
  }
}

// 注册API
app.post('/api/register', async (req, res) => {
  const { username, password, confirmPassword } = req.body;
  
  // 基本验证
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: '帐号和密码不能为空'
    });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: '两次输入的密码不一致'
    });
  }
  
  // 用户名格式验证
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({
      success: false,
      message: '用户名长度必须在3-20个字符之间'
    });
  }
  
  // 密码强度验证
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: '密码长度不能少于6个字符'
    });
  }
  
  try {
    // 检查用户名是否已存在
    const existingUser = await UserModel.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '该帐号已被注册'
      });
    }
    
    // 创建新用户
    await UserModel.createOrUpdate({
      username,
      password,
      balance: 10000 // 新用户初始余额
    });
    
    // 尝试同步到代理系统
    try {
      await fetch(`${AGENT_API_URL}/api/agent/sync-new-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username,
          balance: 10000,
          reason: '新用户注册'
        })
      });
    } catch (syncError) {
      console.warn('同步新用户到代理系统失败:', syncError);
    }
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      username: username
    });
  } catch (error) {
    console.error('注册用户出错:', error);
    res.status(500).json({
      success: false,
      message: '注册失败，系统错误'
    });
  }
});

// 全局变量
let gameLoopInterval = null;
let drawingTimeoutId = null;
let hotBetsInterval = null;
let isDrawingInProgress = false; // 防止重复开奖的标志

// 内存游戏状态（减少数据库I/O）
let memoryGameState = {
  current_period: null,
  countdown_seconds: 60,
  last_result: null,
  status: 'betting'
};

// 清理定时器
function cleanupTimers() {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
    console.log('游戏循环定时器已清理');
  }
  
  if (drawingTimeoutId) {
    clearTimeout(drawingTimeoutId);
    drawingTimeoutId = null;
    console.log('开奖定时器已清理');
  }
  
  if (hotBetsInterval) {
    clearInterval(hotBetsInterval);
    hotBetsInterval = null;
    console.log('热门投注定时器已清理');
  }
}

// 处理进程结束信号
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在清理资源...');
  cleanupTimers();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在清理资源...');
  cleanupTimers();
  process.exit(0);
});

// 模拟游戏循环
async function startGameCycle() {
  try {
    // 如果已经有一个游戏循环在运行，先清除它
    if (gameLoopInterval) {
      console.log('清除现有游戏循环...');
      clearInterval(gameLoopInterval);
      gameLoopInterval = null;
    }
    
    // 如果有开奖过程在进行，也清除它
    if (drawingTimeoutId) {
      console.log('清除未完成的开奖过程...');
      clearTimeout(drawingTimeoutId);
      drawingTimeoutId = null;
    }
    
    // 重置开奖标志
    isDrawingInProgress = false;
    
    // 初始化游戏状态
    let gameState = await GameModel.getCurrentState();
    if (!gameState) {
      // 如果不存在，创建初始游戏状态
      const today = new Date();
      const currentPeriod = parseInt(`${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}001`);
      
      gameState = await GameModel.updateState({
        current_period: currentPeriod, // 格式: YYYYMMDD001
        countdown_seconds: 60,
        last_result: [4, 2, 7, 9, 8, 10, 6, 3, 5, 1],
        status: 'betting'
      });
      console.log('创建初始游戏状态成功');
    } else {
      // 如果是重启，且状态为drawing，重设为betting
      if (gameState.status === 'drawing') {
        console.log('游戏之前卡在开奖状态，重设为投注状态');
        
        // 生成新结果
        const newResult = generateRaceResult();
        const current_period = parseInt(gameState.current_period) + 1;
        
        await GameModel.updateState({
          current_period,
          countdown_seconds: 60,
          last_result: newResult,
          status: 'betting'
        });
        
        // 更新游戏状态
        gameState = await GameModel.getCurrentState();
        console.log(`重设后的游戏状态: 期数=${gameState.current_period}, 状态=${gameState.status}`);
      }
    }
    
    // 初始化内存状态
    memoryGameState = {
      current_period: gameState.current_period,
      countdown_seconds: gameState.countdown_seconds,
      last_result: gameState.last_result,
      status: gameState.status
    };
    
    console.log(`启动游戏循环: 当前期数=${memoryGameState.current_period}, 状态=${memoryGameState.status}`);
    
    // 每秒更新内存状态，减少数据库写入
    gameLoopInterval = setInterval(async () => {
      try {
        // 检查是否在维修时间
        if (isMaintenanceTime()) {
          // 如果在维修时间，停止游戏循环
          if (memoryGameState.status !== 'maintenance') {
            memoryGameState.status = 'maintenance';
            memoryGameState.countdown_seconds = 0;
            console.log('🔧 系统进入维修时间（6:00-7:00）');
            
            await GameModel.updateState({
              current_period: memoryGameState.current_period,
              countdown_seconds: 0,
              last_result: memoryGameState.last_result,
              status: 'maintenance'
            });
          }
          return; // 维修期间不执行任何游戏逻辑
        }
        
        // 如果刚从维修时间恢复（台北时间7点或之后）
        if (memoryGameState.status === 'maintenance' && !isMaintenanceTime()) {
          // 获取台北时间的小时
          const taipeiTime = new Date().toLocaleString('en-US', { 
            timeZone: 'Asia/Taipei',
            hour12: false,
            hour: '2-digit'
          });
          const hour = parseInt(taipeiTime.split(':')[0]);
          // 修改：7点或之后都可以恢复（不只是正好7点）
          if (hour >= 7 || hour < 6) {  // 7点到隔天6点之间都可以恢复
            console.log('🌅 维修结束，恢复游戏运行');
            // 获取新的期号
            const nextPeriod = getNextPeriod(memoryGameState.current_period);
            memoryGameState.current_period = nextPeriod;
            memoryGameState.countdown_seconds = 60;
            memoryGameState.status = 'betting';
            
            await GameModel.updateState({
              current_period: memoryGameState.current_period,
              countdown_seconds: 60,
              last_result: memoryGameState.last_result,
              status: 'betting'
            });
          }
        }
        
        if (memoryGameState.countdown_seconds > 0) {
          // 只更新内存计数器
          memoryGameState.countdown_seconds--;
          
          // 在开奖倒计时剩余3秒时，提前生成开奖结果
          if (memoryGameState.status === 'drawing' && memoryGameState.countdown_seconds === 3 && !isDrawingInProgress) {
            console.log('🎯 [提前开奖] 倒计时3秒，开始生成开奖结果...');
            isDrawingInProgress = true;
            
            const currentDrawPeriod = memoryGameState.current_period;
            
            // 异步生成开奖结果
            setImmediate(async () => {
              try {
                const drawResult = await drawSystemManager.executeDrawing(currentDrawPeriod);
                
                if (drawResult.success) {
                  console.log(`✅ [提前开奖] 第${currentDrawPeriod}期开奖结果已生成`);
                  
                  // 暂存开奖结果，等倒计时结束时使用
                  memoryGameState.pendingResult = drawResult.result;
                } else {
                  console.error(`❌ [提前开奖] 第${currentDrawPeriod}期开奖失败: ${drawResult.error}`);
                }
              } catch (error) {
                console.error('❌ [提前开奖] 生成开奖结果出错:', error);
              }
            });
          }
          
          // 每10秒同步一次到数据库，确保数据一致性
          if (memoryGameState.countdown_seconds % 10 === 0) {
            await GameModel.updateState({
              current_period: memoryGameState.current_period,
              countdown_seconds: memoryGameState.countdown_seconds,
              last_result: memoryGameState.last_result,
              status: memoryGameState.status
            });
            console.log(`同步游戏状态到数据库: 期数=${memoryGameState.current_period}, 倒计时=${memoryGameState.countdown_seconds}, 状态=${memoryGameState.status}`);
          }
        } else {
          // 根据当前状态处理倒计时结束
          if (memoryGameState.status === 'betting') {
            // betting状态倒计时结束 -> 切换到drawing状态
            memoryGameState.status = 'drawing';
            memoryGameState.countdown_seconds = 15; // 设置开奖倒计时为15秒
            console.log('开奖中...开奖倒计时15秒');
            
            // 写入数据库（关键状态变更）
            await GameModel.updateState({
              current_period: memoryGameState.current_period,
              countdown_seconds: 15, // 开奖阶段倒计时15秒
              last_result: memoryGameState.last_result,
              status: 'drawing'
            });
          } else if (memoryGameState.status === 'drawing') {
            console.log('🎯 [开奖结束] 15秒开奖时间到...');
            
            try {
              // 保存当前期号
              const currentDrawPeriod = memoryGameState.current_period;
              
              // 检查是否有预先生成的结果
              if (memoryGameState.pendingResult) {
                console.log('✅ [开奖结束] 使用预先生成的开奖结果');
                
                // 立即更新最后开奖结果
                memoryGameState.last_result = memoryGameState.pendingResult;
                
                // 检查是否可以开始新的一期
                if (!canStartNewPeriod()) {
                  console.log('🔧 接近维修时间，停止开新期');
                  memoryGameState.status = 'waiting';
                  memoryGameState.countdown_seconds = 0;
                  
                  await GameModel.updateState({
                    current_period: memoryGameState.current_period,
                    countdown_seconds: 0,
                    last_result: memoryGameState.last_result,
                    status: 'waiting'
                  });
                  
                  // 清理预存结果
                  delete memoryGameState.pendingResult;
                  return;
                }
                
                // 更新期数和状态
                const nextPeriod = getNextPeriod(currentDrawPeriod);
                memoryGameState.current_period = nextPeriod;
                memoryGameState.countdown_seconds = 60;
                memoryGameState.status = 'betting';
                
                // 一次性更新数据库，包含新期号和开奖结果
                await GameModel.updateState({
                  current_period: memoryGameState.current_period,
                  countdown_seconds: 60,
                  last_result: memoryGameState.last_result, // 使用新的开奖结果
                  status: 'betting'
                });
                
                console.log(`🎉 [开奖结束] 已进入第${nextPeriod}期，开奖结果已更新`);
                
                // 清理预存结果
                delete memoryGameState.pendingResult;
                
                // 每5期执行一次系统监控与自动调整
                if (memoryGameState.current_period % 5 === 0) {
                  monitorAndAdjustSystem();
                }
              } else {
                // 如果没有预先生成的结果，立即生成（紧急情况）
                console.warn('⚠️ [开奖结束] 没有预先生成的结果，立即生成...');
                
                // 先更新到下一期，避免前端显示问号
                const nextPeriod = getNextPeriod(currentDrawPeriod);
                memoryGameState.current_period = nextPeriod;
                memoryGameState.countdown_seconds = 60;
                memoryGameState.status = 'betting';
                
                // 立即写入数据库
                await GameModel.updateState({
                  current_period: memoryGameState.current_period,
                  countdown_seconds: 60,
                  last_result: memoryGameState.last_result, // 保留上一期结果
                  status: 'betting'
                });
                
                // 异步生成开奖结果
                setImmediate(async () => {
                  try {
                    const drawResult = await drawSystemManager.executeDrawing(currentDrawPeriod);
                    
                    if (drawResult.success) {
                      console.log(`✅ [紧急开奖] 第${currentDrawPeriod}期开奖完成`);
                      
                      // 更新最后开奖结果
                      memoryGameState.last_result = drawResult.result;
                      
                      // 生成区块链资料
                      const blockchainData = generateBlockchainData(currentDrawPeriod, drawResult.result);
                      
                      // 更新到数据库，包含区块链资料
                      await db.none(`
                        UPDATE game_state 
                        SET last_result = $1, 
                            current_block_height = $2,
                            current_block_hash = $3,
                            updated_at = CURRENT_TIMESTAMP 
                        WHERE id = 1
                      `, [JSON.stringify(drawResult.result), blockchainData.blockHeight, blockchainData.blockHash]);
                    }
                  } catch (error) {
                    console.error('❌ [紧急开奖] 开奖过程出错:', error);
                  }
                });
              }
              
            } catch (error) {
              console.error('❌ [开奖结束] 状态更新出错:', error);
              // 如果状态更新出错，重置状态
              memoryGameState.status = 'betting';
              memoryGameState.countdown_seconds = 60;
            } finally {
              // 重置开奖标志
              isDrawingInProgress = false;
            }
          }
        }
      } catch (error) {
        console.error('游戏循环出错:', error);
      }
    }, 1000);
    
    return { success: true, message: '游戏循环已启动' };
  } catch (error) {
    console.error('启动游戏循环出错:', error);
    throw error;
  }
}

// 生成赛车比赛结果(1-10不重复的随机数)
function generateRaceResult() {
  const numbers = Array.from({length: 10}, (_, i) => i + 1);
  const result = [];
  
  while (numbers.length > 0) {
    const randomIndex = Math.floor(Math.random() * numbers.length);
    result.push(numbers[randomIndex]);
    numbers.splice(randomIndex, 1);
  }
  
  return result;
}

// 检查是否在维修时间内（每天早上6-7点台北时间）
function isMaintenanceTime() {
  // 获取台北时间
  const taipeiTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit'
  });
  const hour = parseInt(taipeiTime.split(':')[0]);
  return hour === 6; // 台北时间6点整到7点整为维修时间
}

// 检查当前时间是否可以开始新的一期
function canStartNewPeriod() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // 如果是早上6点之后，不能开始新期
  if (hour === 6 || (hour === 5 && minute >= 58)) {
    // 5:58之后不开始新期，因为一期需要75秒
    return false;
  }
  
  return true;
}

// 获取游戏日期（台北时间 7:00 AM 为分界线）
function getGameDate() {
  // 获取台北时间
  const taipeiTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false
  });
  
  const [date, time] = taipeiTime.split(', ');
  const [month, day, year] = date.split('/');
  const hour = parseInt(time.split(':')[0]);
  
  // 创建日期对象
  const gameDate = new Date(year, month - 1, day);
  
  // 如果是凌晨0点到早上7点之前，算作前一天的游戏日
  if (hour < 7) {
    gameDate.setDate(gameDate.getDate() - 1);
  }
  
  // 7点之后算作当天的游戏日
  return gameDate;
}

// 智能期号管理 - 确保期号正确递增并在每日重置，支持超过999场
function getNextPeriod(currentPeriod) {
  // 获取台北时间的小时
  const taipeiTime = new Date().toLocaleString('en-US', { 
    timeZone: 'Asia/Taipei',
    hour12: false,
    hour: '2-digit'
  });
  const hour = parseInt(taipeiTime.split(':')[0]);
  const currentPeriodStr = currentPeriod.toString();
  
  // 获取游戏日期
  const gameDate = getGameDate();
  const gameDateStr = `${gameDate.getFullYear()}${(gameDate.getMonth()+1).toString().padStart(2,'0')}${gameDate.getDate().toString().padStart(2,'0')}`;
  
  // 提取当前期号的日期部分
  const currentDatePart = currentPeriodStr.substring(0, 8);
  
  // 检查是否需要开始新的游戏日
  // 只在从维修状态恢复时（7点后的第一次调用）重置期号
  if (hour >= 7 && currentDatePart !== gameDateStr) {
    // 额外检查：确保不是昨天的游戏日正在进行中
    const yesterday = new Date(gameDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}${(yesterday.getMonth()+1).toString().padStart(2,'0')}${yesterday.getDate().toString().padStart(2,'0')}`;
    
    // 如果当前期号是昨天的，说明需要切换到今天
    if (currentDatePart === yesterdayStr) {
      const newPeriod = parseInt(`${gameDateStr}001`);
      console.log(`🌅 新的游戏日开始，期号重置: ${currentPeriod} → ${newPeriod}`);
      return newPeriod;
    }
  }
  
  // 如果当前期号的日期部分等于游戏日期，则递增
  if (currentDatePart === gameDateStr) {
    // 提取期号后缀并递增
    const suffix = parseInt(currentPeriodStr.substring(8)) + 1;
    
    // 如果超过999场，使用4位数字，但保持日期部分不变
    if (suffix > 999) {
      const newPeriod = `${gameDateStr}${suffix.toString().padStart(4, '0')}`;
      console.log(`🔄 期号递增(超过999): ${currentPeriod} → ${newPeriod}`);
      return newPeriod;
    } else {
      const newPeriod = parseInt(`${gameDateStr}${suffix.toString().padStart(3, '0')}`);
      console.log(`🔄 期号递增: ${currentPeriod} → ${newPeriod}`);
      return newPeriod;
    }
  } else {
    // 如果日期不匹配，但不是7点整，继续使用当前的游戏日期递增
    // 这种情况发生在跨越午夜但还没到7点的时候
    const suffix = parseInt(currentPeriodStr.substring(8)) + 1;
    const currentGameDatePart = currentPeriodStr.substring(0, 8);
    
    if (suffix > 999) {
      const newPeriod = `${currentGameDatePart}${suffix.toString().padStart(4, '0')}`;
      console.log(`🔄 期号递增(保持游戏日): ${currentPeriod} → ${newPeriod}`);
      return newPeriod;
    } else {
      const newPeriod = parseInt(`${currentGameDatePart}${suffix.toString().padStart(3, '0')}`);
      console.log(`🔄 期号递增(保持游戏日): ${currentPeriod} → ${newPeriod}`);
      return newPeriod;
    }
  }
}

// 控制参数 - 决定杀大赔小策略的强度和平衡
const CONTROL_PARAMS = {
  // 下注额判定阈值（超过此值视为大额下注）
  thresholdAmount: 3000,
  
  // 权重调整系数 (较大的值表示更强的干预)
  adjustmentFactor: 0.7,
  
  // 随机性保留比例 (确保系统不会完全可预测)
  randomnessFactor: 0.3,
  
  // 单场损益控制 (平台单场最大可接受的亏损率)
  maxLossRate: 0.3,
  
  // 是否启用杀大赔小机制 - 改为预设关闭
  enabled: false
};

// 检查输赢控制设定
async function checkWinLossControl(period) {
  try {
    console.log(`🔍 [侦错] 开始检查期数 ${period} 的输赢控制设定...`);
    console.log(`🔍 [侦错] 代理系统API URL: ${AGENT_API_URL}/api/agent/internal/win-loss-control/active`);
    
    // 调用代理系统内部API获取活跃的输赢控制设定
    const response = await fetch(`${AGENT_API_URL}/api/agent/internal/win-loss-control/active`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ [侦错] 期数 ${period} 无法获取输赢控制设定，HTTP状态: ${response.status}`);
              console.log(`❌ [侦错] API URL: ${AGENT_API_URL}/api/agent/internal/win-loss-control/active`);
      console.log(`❌ [侦错] 响应状态文本: ${response.statusText}`);
      return { mode: 'normal', enabled: false };
    }

    const result = await response.json();
    console.log(`🔍 [侦错] API响应结果:`, JSON.stringify(result, null, 2));
    
    if (!result.success || !result.data) {
      console.log(`❌ [侦错] 期数 ${period} 无活跃的输赢控制设定`);
      console.log(`❌ [侦错] API响应: success=${result.success}, data=${result.data ? '存在' : '不存在'}`);
      return { mode: 'normal', enabled: false };
    }

    // 处理多个控制设定的情况
    let activeControls = [];
    if (result.multiple) {
      activeControls = result.data;
      console.log(`✅ [侦错] 找到 ${activeControls.length} 个活跃控制设定`);
    } else if (result.data.is_active !== false) {
      activeControls = [result.data];
    }

    if (activeControls.length === 0) {
      console.log(`❌ [侦错] 没有找到活跃的控制设定`);
      return { mode: 'normal', enabled: false };
    }

    // 如果有多个控制设定，需要智能选择最适合的
    let activeControl = activeControls[0];
    
    if (activeControls.length > 1) {
      console.log(`🤖 [侦错] 检测到 ${activeControls.length} 个控制设定，开始智能选择...`);
      
      // 获取每个控制设定的目标下注情况
      const controlsWithBetInfo = await Promise.all(activeControls.map(async (control) => {
        try {
          let betInfo = { totalAmount: 0, betCount: 0, currentPL: 0 };
          
          if (control.target_type === 'member' && control.target_username) {
            // 获取会员当期下注金额
            const memberBets = await db.oneOrNone(`
              SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
              FROM bet_history 
              WHERE period = $1 AND username = $2 AND settled = false
            `, [period, control.target_username]);
            
            if (memberBets) {
              betInfo.totalAmount = parseFloat(memberBets.total_amount);
              betInfo.betCount = parseInt(memberBets.count);
            }
            
            // 获取会员今日输赢
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            
            const memberPL = await db.oneOrNone(`
              SELECT COALESCE(SUM(
                CASE 
                  WHEN won = true THEN (win_amount - amount)
                  ELSE -amount
                END
              ), 0) as today_pl
              FROM bet_history 
              WHERE username = $1 
              AND settled = true 
              AND created_at >= $2
            `, [control.target_username, todayStart]);
            
            if (memberPL) {
              betInfo.currentPL = parseFloat(memberPL.today_pl);
            }
          }
          
          return {
            ...control,
            betInfo
          };
        } catch (error) {
          console.error(`❌ 获取控制设定 ${control.id} 的下注信息失败:`, error);
          return {
            ...control,
            betInfo: { totalAmount: 0, betCount: 0, currentPL: 0 }
          };
        }
      }));
      
      // 智能选择优先级最高的控制设定
      activeControl = controlsWithBetInfo.reduce((best, current) => {
        console.log(`📊 控制设定 ${current.id} (${current.target_username}): 下注金额=${current.betInfo.totalAmount}, 今日输赢=${current.betInfo.currentPL}, 控制类型=${current.win_control ? '赢' : '输'}`);
        
        // 优先级规则：
        // 1. 优先处理当期有下注的控制
        if (current.betInfo.totalAmount > 0 && best.betInfo.totalAmount === 0) {
          return current;
        }
        if (current.betInfo.totalAmount === 0 && best.betInfo.totalAmount > 0) {
          return best;
        }
        
        // 2. 都有下注时，根据控制类型和当前输赢状况判断
        if (current.betInfo.totalAmount > 0 && best.betInfo.totalAmount > 0) {
          // 输控制：优先处理赢钱多的目标
          if (current.loss_control && best.loss_control) {
            if (current.betInfo.currentPL > best.betInfo.currentPL) return current;
          }
          // 赢控制：优先处理输钱多的目标
          else if (current.win_control && best.win_control) {
            if (current.betInfo.currentPL < best.betInfo.currentPL) return current;
          }
          // 混合情况：优先处理下注金额大的
          else {
            if (current.betInfo.totalAmount > best.betInfo.totalAmount) return current;
          }
        }
        
        return best;
      });
      
      console.log(`✅ [侦错] 智能选择了控制设定 ${activeControl.id} (${activeControl.target_username})，下注金额=${activeControl.betInfo.totalAmount}，今日输赢=${activeControl.betInfo.currentPL}`);
    }
    console.log(`✅ [侦错] 找到活跃控制设定:`, {
      id: activeControl.id,
      control_mode: activeControl.control_mode,
      target_username: activeControl.target_username,
      start_period: activeControl.start_period,
      control_percentage: activeControl.control_percentage,
      win_control: activeControl.win_control,
      loss_control: activeControl.loss_control,
      is_active: activeControl.is_active
    });
    
    // 检查期数是否符合控制范围
    // 统一期数格式进行比较（只比较数字部分）
    const currentPeriodNum = parseInt(period.toString());
    const startPeriodNum = parseInt(activeControl.start_period);
    
    if (activeControl.start_period && currentPeriodNum < startPeriodNum) {
      console.log(`❌ [侦错] 期数检查失败: 当前期数=${currentPeriodNum}, 控制开始期数=${startPeriodNum}`);
      console.log(`❌ [侦错] 期数 ${period} 未达到控制开始期数 ${activeControl.start_period}，使用正常模式`);
      return { mode: 'normal', enabled: false };
    }

    console.log(`🎯 [侦错] 期数检查通过: 当前期数=${period} >= 控制开始期数=${activeControl.start_period || '无限制'}`);
    console.log(`🎯 期数 ${period} 使用输赢控制模式: ${activeControl.control_mode}，目标: ${activeControl.target_username || '系统'}，机率: ${activeControl.control_percentage}%`);
    
    return {
      mode: activeControl.control_mode,
      enabled: true,
      target_type: activeControl.target_type,
      target_username: activeControl.target_username,
      control_percentage: activeControl.control_percentage,
      win_control: activeControl.win_control,
      loss_control: activeControl.loss_control,
      start_period: activeControl.start_period
    };
  } catch (error) {
    console.error('❌ [侦错] 检查输赢控制设定错误:', error.message);
            console.error('❌ [侦错] API URL:', `${AGENT_API_URL}/api/agent/internal/win-loss-control/active`);
    console.error('❌ [侦错] 完整错误:', error);
    return { mode: 'normal', enabled: false };
  }
}

// 根据下注情况生成智能结果
async function generateSmartRaceResult(period) {
  try {
    console.log(`🎲 [侦错] 期数 ${period} 开始智能开奖过程...`);
    
    // 首先检查输赢控制设定
    const winLossControl = await checkWinLossControl(period);
    console.log(`🎲 [侦错] 输赢控制检查结果:`, {
      mode: winLossControl.mode,
      enabled: winLossControl.enabled,
      target_username: winLossControl.target_username,
      control_percentage: winLossControl.control_percentage,
      start_period: winLossControl.start_period
    });
    
    // 如果是正常模式，使用纯随机
    if (winLossControl.mode === 'normal' || !winLossControl.enabled) {
      console.log(`🎲 [侦错] 期数 ${period} 使用正常机率模式，原因: mode=${winLossControl.mode}, enabled=${winLossControl.enabled}`);
      return generateRaceResult();
    }
    
    console.log(`🎯 [侦错] 期数 ${period} 进入控制模式分析...`);
    
    // 分析该期下注情况
    const betStats = await analyzeBetsForPeriod(period);
    console.log(`📊 [侦错] 期数 ${period} 下注分析完成:`, {
      totalAmount: betStats.totalAmount,
      numberBets: Object.keys(betStats.number || {}).length,
      sumValueBets: Object.keys(betStats.sumValue || {}).length
    });
    
    // 记录下注统计
    console.log(`期数 ${period} 的下注统计:`, 
      { 
        totalAmount: betStats.totalAmount, 
        controlMode: winLossControl.mode,
        target: winLossControl.target_username
      }
    );
    
    // 根据控制模式决定策略
    let shouldApplyControl = false;
    
    if (winLossControl.mode === 'auto_detect') {
      console.log(`🤖 [自动侦测] 开始智能分析全体玩家输赢比例...`);
      
      
      // 自动侦测模式：分析全体玩家与平台的输赢比例
      const autoDetectResult = await performAutoDetectAnalysis(period, betStats);
      
      console.log(`🤖 [自动侦测] 分析完成:`, {
        shouldApplyControl: autoDetectResult.shouldApplyControl,
        reason: autoDetectResult.reason,
        playerWinProbability: autoDetectResult.playerWinProbability,
        platformAdvantage: autoDetectResult.platformAdvantage
      });
      
      if (autoDetectResult.shouldApplyControl) {
        console.log(`✅ [自动侦测] 触发智能控制策略: ${autoDetectResult.reason}`);
        const controlWeights = calculateAutoDetectWeights(autoDetectResult, betStats);
        const controlledResult = generateWeightedResult(controlWeights);
        console.log(`🎯 [自动侦测] 智能控制后的开奖结果: ${JSON.stringify(controlledResult)}`);
        return controlledResult;
      } else {
        console.log(`📊 [自动侦测] 维持正常机率: ${autoDetectResult.reason}`);
      }
    } else if (winLossControl.mode === 'agent_line' || winLossControl.mode === 'single_member') {
      console.log(`🔍 [侦错] 使用 ${winLossControl.mode} 控制模式，目标: ${winLossControl.target_username}`);
      
      // 代理线控制或单会员控制
      shouldApplyControl = await checkTargetBets(period, winLossControl);
      
      console.log(`🔍 [侦错] 目标下注检查结果: shouldApplyControl=${shouldApplyControl}`);
      
      if (shouldApplyControl) {
        console.log(`✅ [侦错] 对目标 ${winLossControl.target_username} 套用控制策略`);
        const weights = await calculateTargetControlWeights(period, winLossControl, betStats);
        const controlledResult = generateWeightedResult(weights);
        console.log(`🎯 [侦错] 控制后的开奖结果已生成: ${JSON.stringify(controlledResult)}`);
        return controlledResult;
      } else {
        console.log(`❌ [侦错] 目标 ${winLossControl.target_username} 没有下注，不套用控制`);
      }
    } else {
      console.log(`⚠️ [侦错] 未知的控制模式: ${winLossControl.mode}`);
    }
    
    // 没有触发控制条件，使用正常机率
    console.log(`🎲 [侦错] 期数 ${period} 未触发控制条件，使用正常机率，原因: shouldApplyControl=${shouldApplyControl}`);
    const normalResult = generateRaceResult();
    console.log(`🎲 [侦错] 正常机率开奖结果: ${JSON.stringify(normalResult)}`);
    return normalResult;
    
  } catch (error) {
    console.error('❌ [侦错] 智能开奖过程出错:', error);
    console.error('❌ [侦错] 错误堆栈:', error.stack);
    // 出错时使用正常机率
    const fallbackResult = generateRaceResult();
    console.log(`🆘 [侦错] 出错时的备用结果: ${JSON.stringify(fallbackResult)}`);
    return fallbackResult;
  }
}

// 检查目标用户是否有下注
async function checkTargetBets(period, control) {
  try {
    console.log(`🔍 [侦错] 检查目标下注 - 期数: ${period}, 模式: ${control.mode}, 目标: ${control.target_username}`);
    
    if (control.mode === 'single_member') {
      console.log(`🔍 [侦错] 执行单会员下注查询...`);
      // 单会员控制：检查该会员是否有下注
      const memberBets = await db.oneOrNone(`
        SELECT SUM(amount) as total_amount 
        FROM bet_history 
        WHERE period = $1 AND username = $2
      `, [period, control.target_username]);
      
      const totalAmount = memberBets ? parseFloat(memberBets.total_amount) || 0 : 0;
      const hasTargetBets = totalAmount > 0;
      
      console.log(`🔍 [侦错] 单会员下注查询结果: 用户=${control.target_username}, 总金额=${totalAmount}, 有下注=${hasTargetBets}`);
      
      return hasTargetBets;
    } else if (control.mode === 'agent_line') {
      console.log(`🔍 [侦错] 执行代理线下注查询...`);
      // 代理线控制：检查该代理下所有会员（包括下级代理的会员）是否有下注
      
      // 首先获取目标代理的ID
      const targetAgent = await db.oneOrNone('SELECT id FROM agents WHERE username = $1', [control.target_username]);
      if (!targetAgent) {
        console.log(`❌ [侦错] 找不到代理: ${control.target_username}`);
        return false;
      }
      
      // 使用递归CTE查询获取所有下线代理ID（包括多层级）
      const agentLineBets = await db.oneOrNone(`
        WITH RECURSIVE agent_hierarchy AS (
          -- 起始：目标代理本身
          SELECT id, username, parent_id FROM agents WHERE id = $2
          UNION ALL
          -- 递归：所有下级代理
          SELECT a.id, a.username, a.parent_id 
          FROM agents a
          INNER JOIN agent_hierarchy ah ON a.parent_id = ah.id
        )
        SELECT SUM(b.amount) as total_amount, COUNT(DISTINCT b.username) as member_count
        FROM bet_history b
        JOIN members m ON b.username = m.username
        JOIN agent_hierarchy ah ON m.agent_id = ah.id
        WHERE b.period = $1 AND b.settled = false
      `, [period, targetAgent.id]);
      
      const totalAmount = agentLineBets ? parseFloat(agentLineBets.total_amount) || 0 : 0;
      const memberCount = agentLineBets ? parseInt(agentLineBets.member_count) || 0 : 0;
      const hasTargetBets = totalAmount > 0;
      
      console.log(`🔍 [侦错] 代理线下注查询结果: 代理=${control.target_username}, 总金额=${totalAmount}, 会员数=${memberCount}, 有下注=${hasTargetBets}`);
      
      return hasTargetBets;
    }
    
    console.log(`⚠️ [侦错] 未知的控制模式: ${control.mode}`);
    return false;
  } catch (error) {
    console.error('❌ [侦错] 检查目标下注错误:', error);
    console.error('❌ [侦错] SQL参数:', [period, control.target_username]);
    console.error('❌ [侦错] 错误堆栈:', error.stack);
    return false;
  }
}

// 计算目标控制权重
async function calculateTargetControlWeights(period, control, betStats) {
  const weights = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
    sumValue: Array(17).fill(1)
  };
  
  try {
    let targetBets = [];
    
    if (control.mode === 'single_member') {
      // 获取该会员的下注
      targetBets = await db.any(`
        SELECT bet_type, bet_value, position, amount
        FROM bet_history 
        WHERE period = $1 AND username = $2 AND settled = false
      `, [period, control.target_username]);
    } else if (control.mode === 'agent_line') {
      // 获取该代理下所有会员的下注（包括下级代理的会员）
      
      // 首先获取目标代理的ID
      const targetAgent = await db.oneOrNone('SELECT id FROM agents WHERE username = $1', [control.target_username]);
      if (!targetAgent) {
        console.log(`❌ [计算权重] 找不到代理: ${control.target_username}`);
        return weights;
      }
      
      // 使用递归CTE查询获取所有下线的下注
      targetBets = await db.any(`
        WITH RECURSIVE agent_hierarchy AS (
          -- 起始：目标代理本身
          SELECT id, username, parent_id FROM agents WHERE id = $2
          UNION ALL
          -- 递归：所有下级代理
          SELECT a.id, a.username, a.parent_id 
          FROM agents a
          INNER JOIN agent_hierarchy ah ON a.parent_id = ah.id
        )
        SELECT b.bet_type, b.bet_value, b.position, b.amount, b.username
        FROM bet_history b
        JOIN members m ON b.username = m.username
        JOIN agent_hierarchy ah ON m.agent_id = ah.id
        WHERE b.period = $1 AND b.settled = false
      `, [period, targetAgent.id]);
    }
    
    // 根据控制设定调整权重 - 使用更强的控制逻辑
    const controlFactor = (control.control_percentage / 100);
    
    console.log(`🎯 目标控制详情: 用户=${control.target_username}, 模式=${control.mode}, 赢控制=${control.win_control}, 输控制=${control.loss_control}, 机率=${control.control_percentage}%`);
    console.log(`📊 找到 ${targetBets.length} 笔目标下注`);
    
    // 统计下注分布以处理多人下注冲突
    const betConflicts = {};
    targetBets.forEach(bet => {
      let betKey;
      if (bet.bet_type === 'number') {
        betKey = `number_${bet.position}_${bet.bet_value}`;
      } else if (bet.bet_type === 'sumValue') {
        betKey = `sumValue_${bet.bet_value}`;
      } else {
        betKey = `${bet.bet_type}_${bet.bet_value}`;
      }
      
      if (!betConflicts[betKey]) {
        betConflicts[betKey] = { 
          totalAmount: 0, 
          userCount: 0, 
          users: new Set(),
          bets: []
        };
      }
      
      betConflicts[betKey].totalAmount += parseFloat(bet.amount);
      betConflicts[betKey].users.add(bet.username);
      betConflicts[betKey].userCount = betConflicts[betKey].users.size;
      betConflicts[betKey].bets.push(bet);
    });
    
    // 记录冲突情况
    Object.entries(betConflicts).forEach(([key, conflict]) => {
      if (conflict.userCount > 1) {
        console.log(`⚠️ 多人下注冲突: ${key}, 用户数=${conflict.userCount}, 总金额=${conflict.totalAmount}, 用户=[${Array.from(conflict.users).join(', ')}]`);
      }
    });
    
    // 使用合并后的下注资料进行权重调整，避免重复处理
    Object.entries(betConflicts).forEach(([betKey, conflict]) => {
      const bet = conflict.bets[0]; // 使用第一笔下注的资料做类型判断
      const totalAmount = conflict.totalAmount;
      const userCount = conflict.userCount;
      
      // 🎯 计算统一的控制系数，包含冲突处理
      const baseControlFactor = parseFloat(control.control_percentage) / 100; // 基础控制系数 (0-1)
      const conflictMultiplier = Math.min(1.0 + (userCount - 1) * 0.2, 2.0); // 冲突倍数：每多1人增加20%，最高200%
      const finalControlFactor = Math.min(baseControlFactor * conflictMultiplier, 1.0); // 最终控制系数，不超过100%
      
      console.log(`📋 处理合并下注: ${betKey}, 类型=${bet.bet_type}, 值=${bet.bet_value}, 位置=${bet.position}`);
      console.log(`💰 总金额=${totalAmount}, 用户数=${userCount}, 基础控制=${(baseControlFactor*100).toFixed(1)}%, 冲突倍数=${conflictMultiplier.toFixed(2)}, 最终控制=${(finalControlFactor*100).toFixed(1)}%`);
      
      if (bet.bet_type === 'number') {
        const position = parseInt(bet.position) - 1;
        const value = parseInt(bet.bet_value) - 1;
        if (position >= 0 && position < 10 && value >= 0 && value < 10) {
          if (control.win_control) {
            // 赢控制：确保目标下注更容易中奖
            if (finalControlFactor >= 0.95) {
              weights.positions[position][value] = 10000; // 95%以上控制时使用极高权重
            } else if (finalControlFactor <= 0.05) {
              weights.positions[position][value] = 1; // 5%以下控制时不调整权重
            } else {
              // 使用指数函数增强控制效果
              const k = 6; // 放大系数，让控制效果更明显
              const exponentialFactor = Math.exp(k * finalControlFactor);
              
              // 计算该位置的目标号码数量
              const samePositionBets = Object.keys(betConflicts).filter(key => 
                key.startsWith(`number_${bet.position}_`)
              ).length;
              
              const targetCount = samePositionBets;
              const nonTargetCount = 10 - targetCount;
              
              // 结合指数放大和原有的权重公式
              const baseWeight = (finalControlFactor * nonTargetCount) / ((1 - finalControlFactor) * Math.max(targetCount, 1));
              const targetWeight = baseWeight * exponentialFactor / 10; // 除以10避免权重过大
              
              weights.positions[position][value] = Math.max(targetWeight, 0.1);
              
              console.log(`📊 [赢控制] 位置${position+1}: ${targetCount}个目标号码, ${nonTargetCount}个非目标号码`);
              console.log(`    基础权重=${baseWeight.toFixed(3)}, 指数因子=${exponentialFactor.toFixed(2)}, 最终权重=${targetWeight.toFixed(3)}`);
            }
            
            console.log(`✅ 增加位置${position+1}号码${value+1}的权重 (赢控制), 最终权重=${weights.positions[position][value].toFixed(3)}, 用户数=${userCount}`);
          } else if (control.loss_control) {
            // 输控制：确保目标下注更难中奖
            if (finalControlFactor >= 0.95) {
              weights.positions[position][value] = 0.0001; // 95%以上控制时使用极低权重
            } else if (finalControlFactor <= 0.05) {
              weights.positions[position][value] = 1; // 5%以下控制时不调整权重
            } else {
              // 使用负指数函数增强输控制效果
              const k = 6; // 放大系数
              const exponentialFactor = Math.exp(-k * finalControlFactor);
              
              const samePositionBets = Object.keys(betConflicts).filter(key => 
                key.startsWith(`number_${bet.position}_`)
              ).length;
              
              const targetCount = samePositionBets;
              const nonTargetCount = 10 - targetCount;
              const winProbability = 1 - finalControlFactor; // 会员实际中奖机率
              
              // 计算输控制权重
              const baseWeight = (winProbability * nonTargetCount) / ((1 - winProbability) * Math.max(targetCount, 1));
              const targetWeight = baseWeight * exponentialFactor;
              
              weights.positions[position][value] = Math.max(targetWeight, 0.0001);
              
              console.log(`📊 [输控制] 位置${position+1}: ${targetCount}个目标号码, 中奖机率=${(winProbability*100).toFixed(1)}%`);
              console.log(`    基础权重=${baseWeight.toFixed(3)}, 指数因子=${exponentialFactor.toFixed(2)}, 最终权重=${targetWeight.toFixed(3)}`);
            }
            
            console.log(`❌ 设置位置${position+1}号码${value+1}的权重 (输控制), 最终权重=${weights.positions[position][value].toFixed(3)}, 用户数=${userCount}`);
          }
        }
      } else if (bet.bet_type === 'sumValue') {
        if (!isNaN(parseInt(bet.bet_value))) {
          const sumIndex = parseInt(bet.bet_value) - 3;
          if (sumIndex >= 0 && sumIndex < 17) {
            if (control.win_control) {
              // 赢控制：增加该和值的权重（使用指数函数）
              if (finalControlFactor >= 0.95) {
                weights.sumValue[sumIndex] = 10000; // 极高控制时使用极高权重
              } else if (finalControlFactor <= 0.05) {
                weights.sumValue[sumIndex] = 1; // 极低控制时不调整
              } else {
                const k = 5; // 和值的放大系数
                const exponentialFactor = Math.exp(k * finalControlFactor);
                weights.sumValue[sumIndex] *= exponentialFactor;
              }
              console.log(`✅ 增加和值${bet.bet_value}的权重 (赢控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
            } else if (control.loss_control) {
              // 输控制：减少该和值的权重（使用负指数函数）
              if (finalControlFactor >= 0.95) {
                weights.sumValue[sumIndex] = 0.0001; // 极高控制时使用极低权重
              } else if (finalControlFactor <= 0.05) {
                weights.sumValue[sumIndex] = 1; // 极低控制时不调整
              } else {
                const k = 5; // 和值的放大系数
                const exponentialFactor = Math.exp(-k * finalControlFactor);
                weights.sumValue[sumIndex] *= exponentialFactor;
              }
              console.log(`❌ 减少和值${bet.bet_value}的权重 (输控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
            }
          }
        } else if (['big', 'small', 'odd', 'even'].includes(bet.bet_value)) {
          // 处理冠亚和大小单双
          if (control.win_control) {
            // 赢控制：调整相应范围的和值权重
            for (let i = 0; i < 17; i++) {
              const sumValue = i + 3; // 实际和值 3-19
              let shouldIncrease = false;
              
              if (bet.bet_value === 'big' && sumValue >= 12) shouldIncrease = true;
              else if (bet.bet_value === 'small' && sumValue <= 11) shouldIncrease = true;
              else if (bet.bet_value === 'odd' && sumValue % 2 === 1) shouldIncrease = true;
              else if (bet.bet_value === 'even' && sumValue % 2 === 0) shouldIncrease = true;
              
              if (shouldIncrease) {
                if (finalControlFactor >= 0.95) {
                  weights.sumValue[i] *= 1000;
                } else {
                  weights.sumValue[i] *= (1 + finalControlFactor * 15);
                }
              }
            }
            console.log(`✅ 增加冠亚和${bet.bet_value}的权重 (赢控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
          } else if (control.loss_control) {
            // 输控制：调整相应范围的和值权重
            for (let i = 0; i < 17; i++) {
              const sumValue = i + 3;
              let shouldDecrease = false;
              
              if (bet.bet_value === 'big' && sumValue >= 11) shouldDecrease = true;
              else if (bet.bet_value === 'small' && sumValue <= 10) shouldDecrease = true;
              else if (bet.bet_value === 'odd' && sumValue % 2 === 1) shouldDecrease = true;
              else if (bet.bet_value === 'even' && sumValue % 2 === 0) shouldDecrease = true;
              
              if (shouldDecrease) {
                if (finalControlFactor >= 0.95) {
                  weights.sumValue[i] = 0.001;
                } else {
                  weights.sumValue[i] *= Math.max(1 - finalControlFactor * 0.95, 0.001);
                }
              }
            }
            console.log(`❌ 减少冠亚和${bet.bet_value}的权重 (输控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
          }
        }
      } else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(bet.bet_type)) {
        // 处理位置投注（包括号码投注和大小单双）
        const positionMap = {
          'champion': 0, 'runnerup': 1, 'third': 2, 'fourth': 3, 'fifth': 4,
          'sixth': 5, 'seventh': 6, 'eighth': 7, 'ninth': 8, 'tenth': 9
        };
        const position = positionMap[bet.bet_type];
        
        if (!isNaN(parseInt(bet.bet_value))) {
          // 号码投注
          const value = parseInt(bet.bet_value) - 1;
          if (value >= 0 && value < 10) {
            if (control.win_control) {
              if (finalControlFactor >= 0.95) {
                weights.positions[position][value] *= 1000;
              } else {
                weights.positions[position][value] *= (1 + finalControlFactor * 15);
              }
              console.log(`✅ 增加${bet.bet_type}号码${bet.bet_value}的权重 (赢控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
            } else if (control.loss_control) {
              if (finalControlFactor >= 0.95) {
                weights.positions[position][value] = 0.001;
              } else {
                weights.positions[position][value] *= Math.max(1 - finalControlFactor * 0.95, 0.001);
              }
              console.log(`❌ 减少${bet.bet_type}号码${bet.bet_value}的权重 (输控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
            }
          }
        } else if (['big', 'small', 'odd', 'even'].includes(bet.bet_value)) {
          // 两面投注（大小单双）
          if (control.win_control) {
            // 赢控制：调整该位置符合条件的号码权重
            for (let value = 0; value < 10; value++) {
              const actualValue = value + 1; // 实际号码 1-10
              let shouldIncrease = false;
              
              if (bet.bet_value === 'big' && actualValue >= 6) shouldIncrease = true;
              else if (bet.bet_value === 'small' && actualValue <= 5) shouldIncrease = true;
              else if (bet.bet_value === 'odd' && actualValue % 2 === 1) shouldIncrease = true;
              else if (bet.bet_value === 'even' && actualValue % 2 === 0) shouldIncrease = true;
              
              if (shouldIncrease) {
                if (finalControlFactor >= 0.95) {
                  weights.positions[position][value] *= 1000;
                } else {
                  weights.positions[position][value] *= (1 + finalControlFactor * 15);
                }
              }
            }
            console.log(`✅ 增加${bet.bet_type}${bet.bet_value}的权重 (赢控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
          } else if (control.loss_control) {
            // 输控制：调整该位置符合条件的号码权重
            for (let value = 0; value < 10; value++) {
              const actualValue = value + 1;
              let shouldDecrease = false;
              
              if (bet.bet_value === 'big' && actualValue >= 6) shouldDecrease = true;
              else if (bet.bet_value === 'small' && actualValue <= 5) shouldDecrease = true;
              else if (bet.bet_value === 'odd' && actualValue % 2 === 1) shouldDecrease = true;
              else if (bet.bet_value === 'even' && actualValue % 2 === 0) shouldDecrease = true;
              
              if (shouldDecrease) {
                if (finalControlFactor >= 0.95) {
                  weights.positions[position][value] = 0.001;
                } else {
                  weights.positions[position][value] *= Math.max(1 - finalControlFactor * 0.95, 0.001);
                }
              }
            }
            console.log(`❌ 减少${bet.bet_type}${bet.bet_value}的权重 (输控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
          }
        }

      } else if (bet.bet_type === 'dragonTiger') {
        // 处理龙虎投注 - 支援所有位置对比
        // 格式：dragon, tiger (传统冠军vs亚军) 或 dragon_pos1_pos2, tiger_pos1_pos2
        
        let dragonTigerType, pos1, pos2;
        
        if (bet.bet_value === 'dragon' || bet.bet_value === 'tiger') {
          // 传统格式：默认冠军vs亚军
          dragonTigerType = bet.bet_value;
          pos1 = 0; // 冠军
          pos2 = 1; // 亚军
        } else if (typeof bet.bet_value === 'string' && 
                   (bet.bet_value.startsWith('dragon_') || bet.bet_value.startsWith('tiger_'))) {
          // 复杂格式：dragon_4_7 表示第4名vs第7名
          const parts = bet.bet_value.split('_');
          if (parts.length === 3) {
            dragonTigerType = parts[0];
            pos1 = parseInt(parts[1]) - 1; // 转为0-9索引
            pos2 = parseInt(parts[2]) - 1;
            
            // 验证位置有效性
            if (isNaN(pos1) || isNaN(pos2) || pos1 < 0 || pos1 > 9 || pos2 < 0 || pos2 > 9 || pos1 === pos2) {
              console.warn(`⚠️ 无效的龙虎投注格式: ${bet.bet_value}`);
              return weights;
            }
          } else {
            console.warn(`⚠️ 无法解析龙虎投注格式: ${bet.bet_value}`);
            return weights;
          }
        } else {
          console.warn(`⚠️ 未知的龙虎投注格式: ${bet.bet_value}`);
          return weights;
        }
        
        if (control.win_control) {
          if (dragonTigerType === 'dragon') {
            // 龙赢：pos1 > pos2，增加pos1大号码权重，减少pos2大号码权重
            for (let value = 5; value < 10; value++) {
              if (finalControlFactor >= 0.95) {
                weights.positions[pos1][value] *= 1000; // pos1大号码
                weights.positions[pos2][value] = 0.001; // pos2大号码
              } else {
                weights.positions[pos1][value] *= (1 + finalControlFactor * 15);
                weights.positions[pos2][value] *= Math.max(1 - finalControlFactor * 0.8, 0.001);
              }
            }
            // 同时增加pos1小号码的反向权重，减少pos2小号码权重
            for (let value = 0; value < 5; value++) {
              if (finalControlFactor >= 0.95) {
                weights.positions[pos1][value] = 0.001; // pos1小号码
                weights.positions[pos2][value] *= 1000; // pos2小号码
              } else {
                weights.positions[pos1][value] *= Math.max(1 - finalControlFactor * 0.8, 0.001);
                weights.positions[pos2][value] *= (1 + finalControlFactor * 15);
              }
            }
            console.log(`✅ 增加龙的获胜权重 (第${pos1+1}名vs第${pos2+1}名) (赢控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
          } else if (dragonTigerType === 'tiger') {
            // 虎赢：pos2 > pos1，增加pos2大号码权重，减少pos1大号码权重
            for (let value = 5; value < 10; value++) {
              if (finalControlFactor >= 0.95) {
                weights.positions[pos2][value] *= 1000; // pos2大号码
                weights.positions[pos1][value] = 0.001; // pos1大号码
              } else {
                weights.positions[pos2][value] *= (1 + finalControlFactor * 15);
                weights.positions[pos1][value] *= Math.max(1 - finalControlFactor * 0.8, 0.001);
              }
            }
            // 同时处理小号码
            for (let value = 0; value < 5; value++) {
              if (finalControlFactor >= 0.95) {
                weights.positions[pos2][value] = 0.001; // pos2小号码
                weights.positions[pos1][value] *= 1000; // pos1小号码
              } else {
                weights.positions[pos2][value] *= Math.max(1 - finalControlFactor * 0.8, 0.001);
                weights.positions[pos1][value] *= (1 + finalControlFactor * 15);
              }
            }
            console.log(`✅ 增加虎的获胜权重 (第${pos1+1}名vs第${pos2+1}名) (赢控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
          }
        } else if (control.loss_control) {
          // 输控制：反向操作
          if (dragonTigerType === 'dragon') {
            // 龙输：让虎赢，增加pos2大号码权重
            for (let value = 5; value < 10; value++) {
              if (finalControlFactor >= 0.95) {
                weights.positions[pos2][value] *= 1000;
                weights.positions[pos1][value] = 0.001;
              } else {
                weights.positions[pos2][value] *= (1 + finalControlFactor * 15);
                weights.positions[pos1][value] *= Math.max(1 - finalControlFactor * 0.8, 0.001);
              }
            }
            for (let value = 0; value < 5; value++) {
              if (finalControlFactor >= 0.95) {
                weights.positions[pos2][value] = 0.001;
                weights.positions[pos1][value] *= 1000;
              } else {
                weights.positions[pos2][value] *= Math.max(1 - finalControlFactor * 0.8, 0.001);
                weights.positions[pos1][value] *= (1 + finalControlFactor * 15);
              }
            }
            console.log(`❌ 减少龙的获胜权重 (第${pos1+1}名vs第${pos2+1}名) (输控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
          } else if (dragonTigerType === 'tiger') {
            // 虎输：让龙赢，增加pos1大号码权重
            for (let value = 5; value < 10; value++) {
              if (finalControlFactor >= 0.95) {
                weights.positions[pos1][value] *= 1000;
                weights.positions[pos2][value] = 0.001;
              } else {
                weights.positions[pos1][value] *= (1 + finalControlFactor * 15);
                weights.positions[pos2][value] *= Math.max(1 - finalControlFactor * 0.8, 0.001);
              }
            }
            for (let value = 0; value < 5; value++) {
              if (finalControlFactor >= 0.95) {
                weights.positions[pos1][value] = 0.001;
                weights.positions[pos2][value] *= 1000;
              } else {
                weights.positions[pos1][value] *= Math.max(1 - finalControlFactor * 0.8, 0.001);
                weights.positions[pos2][value] *= (1 + finalControlFactor * 15);
              }
            }
            console.log(`❌ 减少虎的获胜权重 (第${pos1+1}名vs第${pos2+1}名) (输控制), 用户数=${userCount}, 控制系数=${finalControlFactor.toFixed(3)}`);
          }
        }
      } else {
        // 其他未知下注类型
        console.log(`⚠️ 未处理的下注类型: ${bet.bet_type}=${bet.bet_value}, 位置=${bet.position || 'N/A'}`);
      }
    });
    
    console.log(`目标控制权重调整完成: ${control.target_username}, 控制比例: ${control.control_percentage}%`);
    
  } catch (error) {
    console.error('计算目标控制权重错误:', error);
  }
  
  return weights;
}

// 在开奖前分析此期所有注单
async function analyzeBetsForPeriod(period) {
  // 获取该期所有注单（包括已结算和未结算）
  const allBets = await db.manyOrNone(`
    SELECT * FROM bet_history 
    WHERE period = $1
  `, [period]);
  
  // 初始化统计
  const betStats = {
    sumValue: {}, // 冠亚和
    number: {}, // 号码玩法
    champion: {}, // 冠军
    runnerup: {}, // 亚军
    third: {}, // 第三
    fourth: {}, // 第四
    fifth: {}, // 第五
    sixth: {}, // 第六
    seventh: {}, // 第七
    eighth: {}, // 第八
    ninth: {}, // 第九
    tenth: {}, // 第十
    dragonTiger: {}, // 龙虎
    totalAmount: 0 // 总下注金额
  };
  
  // 统计每种投注类型和值的下注总额
  allBets.forEach(bet => {
    const betType = bet.bet_type;
    const betValue = bet.bet_value;
    const position = bet.position ? bet.position : null;
    const amount = parseFloat(bet.amount);
    
    // 增加总金额
    betStats.totalAmount += amount;
    
    // 根据注单类型进行分类统计
    if (betType === 'number') {
      // 号码玩法需要考虑位置
      const key = `${position}_${betValue}`;
      if (!betStats.number[key]) betStats.number[key] = 0;
      betStats.number[key] += amount;
    } else {
      // 其他类型直接按值统计
      if (!betStats[betType][betValue]) betStats[betType][betValue] = 0;
      betStats[betType][betValue] += amount;
    }
  });
  
  return betStats;
}

// 找出大额下注组合
function findHighBetCombinations(betStats) {
  const highBets = [];
  const threshold = CONTROL_PARAMS.thresholdAmount;
  
  // 检查号码玩法
  for (const [key, amount] of Object.entries(betStats.number)) {
    if (amount >= threshold) {
      const [position, value] = key.split('_');
      highBets.push({
        type: 'number',
        position: parseInt(position),
        value: parseInt(value),
        amount: amount
      });
    }
  }
  
  // 检查冠亚和值
  for (const [value, amount] of Object.entries(betStats.sumValue)) {
    if (amount >= threshold) {
      highBets.push({
        type: 'sumValue',
        value: value,
        amount: amount
      });
    }
  }
  
  // 检查冠军
  for (const [value, amount] of Object.entries(betStats.champion)) {
    if (amount >= threshold) {
      highBets.push({
        type: 'champion',
        value: value,
        amount: amount
      });
    }
  }
  
  // 检查亚军
  for (const [value, amount] of Object.entries(betStats.runnerup)) {
    if (amount >= threshold) {
      highBets.push({
        type: 'runnerup',
        value: value,
        amount: amount
      });
    }
  }
  
  // 检查龙虎
  for (const [value, amount] of Object.entries(betStats.dragonTiger)) {
    if (amount >= threshold) {
      highBets.push({
        type: 'dragonTiger',
        value: value,
        amount: amount
      });
    }
  }
  
  return highBets;
}

// 计算开奖结果的权重
function calculateResultWeights(highBets, betStats) {
  // 初始化权重，所有位置和号码的起始权重为1
  const weights = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
    sumValue: Array(17).fill(1) // 冠亚和值3-19的权重（3到19共17个值）
  };
  
  // 根据大额下注调整权重
  highBets.forEach(bet => {
    const adjustmentFactor = CONTROL_PARAMS.adjustmentFactor;
    const randomnessFactor = CONTROL_PARAMS.randomnessFactor;
    
    if (bet.type === 'number') {
      // 减少该位置该号码的权重，使其不太可能中奖
      const position = bet.position - 1; // 转换为0-based索引
      const value = bet.value - 1;
      weights.positions[position][value] *= randomnessFactor;
    } 
    else if (bet.type === 'champion') {
      // 大小单双处理
      if (bet.value === 'big') {
        // 减少冠军为大(6-10)的权重
        for (let i = 5; i < 10; i++) {
          weights.positions[0][i] *= randomnessFactor;
        }
      } else if (bet.value === 'small') {
        // 减少冠军为小(1-5)的权重
        for (let i = 0; i < 5; i++) {
          weights.positions[0][i] *= randomnessFactor;
        }
      } else if (bet.value === 'odd') {
        // 减少冠军为单数的权重
        for (let i = 0; i < 10; i += 2) {
          weights.positions[0][i] *= randomnessFactor;
        }
      } else if (bet.value === 'even') {
        // 减少冠军为双数的权重
        for (let i = 1; i < 10; i += 2) {
          weights.positions[0][i] *= randomnessFactor;
        }
      }
    }
    else if (bet.type === 'runnerup') {
      // 与冠军类似的处理，但是对亚军
      if (bet.value === 'big') {
        for (let i = 5; i < 10; i++) {
          weights.positions[1][i] *= randomnessFactor;
        }
      } else if (bet.value === 'small') {
        for (let i = 0; i < 5; i++) {
          weights.positions[1][i] *= randomnessFactor;
        }
      } else if (bet.value === 'odd') {
        for (let i = 0; i < 10; i += 2) {
          weights.positions[1][i] *= randomnessFactor;
        }
      } else if (bet.value === 'even') {
        for (let i = 1; i < 10; i += 2) {
          weights.positions[1][i] *= randomnessFactor;
        }
      }
    }
    else if (bet.type === 'sumValue') {
      // 减少该和值的组合权重
      if (bet.value === 'big') {
        // 减少大值(12-19)的权重
        for (let i = 12 - 3; i <= 19 - 3; i++) {
          if (i < weights.sumValue.length) {
            weights.sumValue[i] *= randomnessFactor;
          }
        }
      } else if (bet.value === 'small') {
        // 减少小值(3-11)的权重
        for (let i = 0; i <= 11 - 3; i++) {
          if (i < weights.sumValue.length) {
            weights.sumValue[i] *= randomnessFactor;
          }
        }
      } else if (bet.value === 'odd') {
        // 减少单数和值的权重
        for (let i = 0; i < weights.sumValue.length; i++) {
          if ((i + 3) % 2 === 1) weights.sumValue[i] *= randomnessFactor;
        }
      } else if (bet.value === 'even') {
        // 减少双数和值的权重
        for (let i = 0; i < weights.sumValue.length; i++) {
          if ((i + 3) % 2 === 0) weights.sumValue[i] *= randomnessFactor;
        }
      } else {
        // 具体和值
        const sumIndex = parseInt(bet.value) - 3;
        if (sumIndex >= 0 && sumIndex < weights.sumValue.length) {
          weights.sumValue[sumIndex] *= randomnessFactor;
        }
      }
    }
    else if (bet.type === 'dragonTiger') {
      // 龙虎处理
      if (bet.value === 'dragon') {
        // 减少龙(冠军>亚军)的可能性
        // 策略：增加冠军小值和亚军大值的权重
        for (let i = 0; i < 5; i++) {
          weights.positions[0][i] *= randomnessFactor;
          weights.positions[1][i+5] *= (2 - randomnessFactor);
        }
      } else if (bet.value === 'tiger') {
        // 减少虎(冠军<亚军)的可能性
        // 策略：增加冠军大值和亚军小值的权重
        for (let i = 5; i < 10; i++) {
          weights.positions[0][i] *= (2 - randomnessFactor);
          weights.positions[1][i-5] *= randomnessFactor;
        }
      }
    }
  });
  
  return weights;
}

// 基于权重生成结果
function generateWeightedResult(weights, attempts = 0) {
  const MAX_ATTEMPTS = 50; // 增加最大尝试次数以确保100%控制效果
  const numbers = Array.from({length: 10}, (_, i) => i + 1);
  const result = [];
  let availableNumbers = [...numbers];
  
  console.log(`🎲 生成权重结果 (第${attempts + 1}次尝试)`);
  
  // 🔥 修复：检查真正的100%位置控制，包括赢控制和输控制
  // 检查是否有真正独立的100%位置控制（权重超高或超低且不是范围权重）
  const extremePositionControls = [];
  for (let position = 0; position < 10; position++) {
    let extremeHighCount = 0;
    let extremeLowCount = 0;
    let extremeHighNumbers = [];
    let extremeLowNumbers = [];
    
    // 计算该位置的极高权重和极低权重号码
    for (let num = 0; num < 10; num++) {
      const weight = weights.positions[position][num];
      if (weight > 100) {
        extremeHighCount++;
        extremeHighNumbers.push(num + 1);
      } else if (weight < 0.01) {
        extremeLowCount++;
        extremeLowNumbers.push(num + 1);
      }
    }
    
    // 检查赢控制：只有1-2个极高权重号码时，认为是真正的位置控制
    if (extremeHighCount > 0 && extremeHighCount <= 2) {
      for (const num of extremeHighNumbers) {
        const weight = weights.positions[position][num - 1];
        extremePositionControls.push({
          position: position,
          number: num,
          weight: weight,
          type: 'win'
        });
      }
      console.log(`🎯 位置${position + 1}检测到${extremeHighCount}个100%赢控制号码[${extremeHighNumbers.join(',')}]`);
    }
    
    // 检查输控制：如果有多个极低权重号码，认为是100%输控制
    if (extremeLowCount >= 3) {
      // 100%输控制：让会员输钱，选择正常权重号码（用户未下注的号码）
      const normalWeightNumbers = [];
      for (let num = 0; num < 10; num++) {
        const weight = weights.positions[position][num];
        if (weight >= 1) { // 正常权重（用户未下注的号码）
          normalWeightNumbers.push(num + 1);
        }
      }
      
      if (normalWeightNumbers.length > 0) {
        const randomNormalNumber = normalWeightNumbers[Math.floor(Math.random() * normalWeightNumbers.length)];
        extremePositionControls.push({
          position: position,
          number: randomNormalNumber,
          weight: 1,
          type: 'loss'
        });
        console.log(`💰 位置${position + 1}检测到100%输控制[用户下注:${extremeLowNumbers.join(',')}]，选择未下注号码${randomNormalNumber}让会员输钱`);
      } else {
        console.log(`⚠️ 位置${position + 1}输控制：无正常权重号码可选，跳过预先分配`);
      }
    }
    
    // 龙虎控制检测
    if (extremeHighCount > 2 || extremeLowCount > 2) {
      if (extremeHighCount === 5 && extremeLowCount === 5) {
        console.log(`🐉🐅 位置${position + 1}检测到龙虎控制权重设置，不进行预先分配`);
      } else if (extremeHighCount > 2) {
        console.log(`🐉🐅 位置${position + 1}检测到${extremeHighCount}个极高权重号码[${extremeHighNumbers.join(',')}]，判断为范围控制，不进行预先分配`);
      }
    }
  }
  
  // 如果有真正的100%位置控制，按权重排序并优先处理
  if (extremePositionControls.length > 0) {
    extremePositionControls.sort((a, b) => b.weight - a.weight);
    console.log(`🎯 检测到${extremePositionControls.length}个真正的100%位置控制:`, extremePositionControls.map(c => `位置${c.position+1}号码${c.number}(权重:${c.weight})`).join(', '));
    
    // 预先分配100%控制的位置
    const reservedNumbers = new Set();
    const positionAssignments = Array(10).fill(null);
    
    for (const control of extremePositionControls) {
      if (!reservedNumbers.has(control.number)) {
        positionAssignments[control.position] = control.number;
        reservedNumbers.add(control.number);
        console.log(`🔒 预先分配位置${control.position + 1}号码${control.number}`);
      } else {
        console.log(`⚠️ 号码${control.number}已被其他位置预先分配，位置${control.position + 1}将使用随机选择`);
      }
    }
    
    // 更新可用号码列表
    availableNumbers = numbers.filter(num => !reservedNumbers.has(num));
    
    // 按位置顺序生成结果
    for (let position = 0; position < 10; position++) {
      if (positionAssignments[position] !== null) {
        // 使用预先分配的号码
        const assignedNumber = positionAssignments[position];
        result.push(assignedNumber);
        console.log(`🎯 位置${position + 1}使用预先分配号码${assignedNumber}`);
      } else {
        // 从剩余号码中选择
        if (availableNumbers.length > 0) {
          let numberWeights = [];
          for (let i = 0; i < availableNumbers.length; i++) {
            const num = availableNumbers[i];
            numberWeights.push(weights.positions[position][num-1] || 1);
          }
          
          const selectedIndex = weightedRandomIndex(numberWeights);
          const selectedNumber = availableNumbers[selectedIndex];
          console.log(`🎲 位置${position + 1}权重选择号码${selectedNumber} (权重:${numberWeights[selectedIndex]})`);
          result.push(selectedNumber);
          availableNumbers.splice(selectedIndex, 1);
        } else {
          console.error(`❌ 位置${position + 1}没有可用号码！`);
          // 紧急情况：使用任意号码
          result.push(1);
        }
      }
    }
    
    console.log(`🏁 预先分配结果: [${result.join(', ')}]`);
    return result;
  }
  
  // 原有逻辑：步骤1：生成前两名(冠军和亚军)，用于检查冠亚和控制
  for (let position = 0; position < 2; position++) {
    // 根据权重选择位置上的号码
    let numberWeights = [];
    for (let i = 0; i < availableNumbers.length; i++) {
      const num = availableNumbers[i];
      numberWeights.push(weights.positions[position][num-1] || 1);
    }
    
    // 检查是否有极高权重的号码（100%控制的情况）
    const maxWeight = Math.max(...numberWeights);
    const hasExtremeWeight = maxWeight > 100; // 极高权重阈值
    
    if (hasExtremeWeight) {
      // 100%控制情况，直接选择最高权重的号码
      const maxIndex = numberWeights.indexOf(maxWeight);
      const selectedNumber = availableNumbers[maxIndex];
      console.log(`🎯 位置${position + 1}强制选择号码${selectedNumber} (权重:${maxWeight})`);
      result.push(selectedNumber);
      availableNumbers.splice(maxIndex, 1);
    } else {
      // 使用权重进行选择
      const selectedIndex = weightedRandomIndex(numberWeights);
      const selectedNumber = availableNumbers[selectedIndex];
      console.log(`🎲 位置${position + 1}权重选择号码${selectedNumber} (权重:${numberWeights[selectedIndex]})`);
      result.push(selectedNumber);
      availableNumbers.splice(selectedIndex, 1);
    }
  }
  
  // 检查是否符合目标和值权重
  const sumValue = result[0] + result[1];
  const sumValueIndex = sumValue - 3;
  const sumWeight = weights.sumValue[sumValueIndex] || 1;
  
  console.log(`📊 当前冠亚军: ${result[0]}, ${result[1]}, 和值: ${sumValue}, 和值权重: ${sumWeight}`);
  
  // 检查和值控制逻辑
  const hasHighSumWeight = sumWeight > 100; // 极高和值权重
  const hasLowSumWeight = sumWeight < 0.1; // 极低和值权重
  
  // 🎯 新增智能和值控制逻辑
  if (hasLowSumWeight && attempts < MAX_ATTEMPTS) {
    // 100%输控制的和值，必须重新生成
    console.log(`❌ 检测到100%输控制和值${sumValue}，重新生成 (第${attempts + 1}次尝试)`);
    return generateWeightedResult(weights, attempts + 1);
  } else if (hasHighSumWeight) {
    // 100%赢控制的和值，接受结果
    console.log(`✅ 检测到100%赢控制和值${sumValue}，接受结果`);
  } else {
    // 检查是否有其他高权重和值，如果有，优先生成那些和值
    const maxSumWeight = Math.max(...weights.sumValue);
    if (maxSumWeight > 100 && attempts < MAX_ATTEMPTS) {
      // 找到所有高权重和值
      const highWeightSums = [];
      for (let i = 0; i < weights.sumValue.length; i++) {
        if (weights.sumValue[i] > 100) {
          highWeightSums.push(i + 3); // 实际和值
        }
      }
      
      if (highWeightSums.length > 0 && !highWeightSums.includes(sumValue)) {
        const targetSum = highWeightSums[Math.floor(Math.random() * highWeightSums.length)];
        console.log(`🎯 检测到高权重和值${highWeightSums.join(',')}，当前${sumValue}不符合，重新生成目标和值${targetSum} (第${attempts + 1}次尝试)`);
        
        // 智能生成目标和值
        return generateTargetSumResult(weights, targetSum, attempts + 1);
      }
    } else if (sumWeight < 0.5 && Math.random() < 0.7 && attempts < MAX_ATTEMPTS) {
      // 一般控制情况
      console.log(`🔄 和值${sumValue}权重较低，尝试重新生成 (第${attempts + 1}次尝试)`);
      return generateWeightedResult(weights, attempts + 1);
    }
  }

  // 🐉🐅 修复龙虎控制检查逻辑 - 在结果完全生成后进行完整检查
  // 检查是否需要龙虎控制
  let needsDragonTigerCheck = false;
  
  // 先检查是否有龙虎控制权重设置
  for (let pos1 = 0; pos1 < 10; pos1++) {
    for (let pos2 = 0; pos2 < 10; pos2++) {
      if (pos1 !== pos2) {
        // 检查是否有龙虎控制的极端权重设置
        let pos1HasDragonTigerWeight = false;
        let pos2HasDragonTigerWeight = false;
        
        // 检查pos1是否有龙虎控制权重（5个大号码权重高或5个小号码权重低）
        let pos1HighCount = 0, pos1LowCount = 0;
        for (let num = 0; num < 10; num++) {
          const weight = weights.positions[pos1][num];
          if (weight > 100) pos1HighCount++;
          if (weight < 0.01) pos1LowCount++;
        }
        pos1HasDragonTigerWeight = (pos1HighCount === 5 && pos1LowCount === 5);
        
        // 检查pos2是否有龙虎控制权重
        let pos2HighCount = 0, pos2LowCount = 0;
        for (let num = 0; num < 10; num++) {
          const weight = weights.positions[pos2][num];
          if (weight > 100) pos2HighCount++;
          if (weight < 0.01) pos2LowCount++;
        }
        pos2HasDragonTigerWeight = (pos2HighCount === 5 && pos2LowCount === 5);
        
        if (pos1HasDragonTigerWeight && pos2HasDragonTigerWeight) {
          needsDragonTigerCheck = true;
          console.log(`🐉🐅 检测到第${pos1+1}名vs第${pos2+1}名的龙虎控制权重设置`);
          break;
        }
      }
    }
    if (needsDragonTigerCheck) break;
  }
  
  // 如果达到最大尝试次数，记录警告但接受当前结果
  if (attempts >= MAX_ATTEMPTS) {
    console.warn(`⚠️ 达到最大尝试次数(${MAX_ATTEMPTS})，使用当前结果 - 和值: ${sumValue}`);
  }
  
  // 步骤2：生成剩余位置(第3-10名)，每个位置都使用权重控制
  for (let position = 2; position < 10; position++) {
    let attempts = 0;
    const MAX_POSITION_ATTEMPTS = 10; // 每个位置最多尝试10次
    let selectedNumber = null;
    
    while (attempts < MAX_POSITION_ATTEMPTS && selectedNumber === null) {
      // 根据权重选择位置上的号码
      let numberWeights = [];
      for (let i = 0; i < availableNumbers.length; i++) {
        const num = availableNumbers[i];
        numberWeights.push(weights.positions[position][num-1] || 1);
      }
      
      // 检查是否有极高权重的号码（100%控制的情况）
      const maxWeight = Math.max(...numberWeights);
      const minWeight = Math.min(...numberWeights);
      const hasExtremeWeight = maxWeight > 100; // 极高权重阈值
      const hasExtremelyLowWeight = minWeight < 0.01; // 极低权重阈值（100%输控制）
      
      if (hasExtremeWeight) {
        // 100%赢控制情况，直接选择最高权重的号码
        const maxIndex = numberWeights.indexOf(maxWeight);
        selectedNumber = availableNumbers[maxIndex];
        console.log(`🎯 位置${position + 1}强制选择号码${selectedNumber} (权重:${maxWeight})`);
      } else if (hasExtremelyLowWeight) {
        // 🔥 修复：100%输控制情况，应该选择极低权重的号码
        const lowWeightIndices = [];
        const normalWeightIndices = [];
        
        for (let i = 0; i < numberWeights.length; i++) {
          if (numberWeights[i] < 0.01) { // 极低权重号码（被控制的号码）
            lowWeightIndices.push(i);
          } else {
            normalWeightIndices.push(i);
          }
        }
        
        if (lowWeightIndices.length > 0) {
          // 优先从极低权重号码中选择，实现100%输控制
          const randomLowIndex = lowWeightIndices[Math.floor(Math.random() * lowWeightIndices.length)];
          selectedNumber = availableNumbers[randomLowIndex];
          console.log(`❌ 位置${position + 1}输控制：选择低权重号码${selectedNumber} (权重:${numberWeights[randomLowIndex]})`);
        } else if (normalWeightIndices.length > 0) {
          // 如果没有极低权重号码，从正常权重中选择
          const randomNormalIndex = normalWeightIndices[Math.floor(Math.random() * normalWeightIndices.length)];
          selectedNumber = availableNumbers[randomNormalIndex];
          console.log(`⚠️ 位置${position + 1}输控制：无低权重号码，选择正常权重${selectedNumber} (权重:${numberWeights[randomNormalIndex]})`);
        } else {
          // 所有号码权重都很低，随机选择一个
          const randomIndex = Math.floor(Math.random() * availableNumbers.length);
          selectedNumber = availableNumbers[randomIndex];
          console.log(`⚠️ 位置${position + 1}输控制：所有权重都很低，随机选择${selectedNumber} (权重:${numberWeights[randomIndex]})`);
        }
      } else {
        // 使用权重进行选择
        const selectedIndex = weightedRandomIndex(numberWeights);
        const candidateNumber = availableNumbers[selectedIndex];
        const candidateWeight = numberWeights[selectedIndex];
        
        // 检查是否需要重新选择（针对中等权重的控制）
        if (candidateWeight < 0.5 && Math.random() < 0.7 && attempts < MAX_POSITION_ATTEMPTS - 1) {
          console.log(`🔄 位置${position + 1}号码${candidateNumber}权重较低(${candidateWeight})，重新选择 (第${attempts + 1}次尝试)`);
          attempts++;
          continue;
        }
        
        selectedNumber = candidateNumber;
        console.log(`🎲 位置${position + 1}权重选择号码${selectedNumber} (权重:${candidateWeight})`);
      }
      
      attempts++;
    }
    
    // 如果经过多次尝试还是没有选到合适的号码，使用最后选择的号码
    if (selectedNumber === null && availableNumbers.length > 0) {
      selectedNumber = availableNumbers[0]; // 使用第一个可用号码
      console.warn(`⚠️ 位置${position + 1}经过${MAX_POSITION_ATTEMPTS}次尝试，使用默认号码${selectedNumber}`);
    }
    
    // 将选中的号码加入结果并从可用号码中移除
    if (selectedNumber !== null) {
      result.push(selectedNumber);
      const removeIndex = availableNumbers.indexOf(selectedNumber);
      if (removeIndex > -1) {
        availableNumbers.splice(removeIndex, 1);
      }
    }
  }
  
  // 🐉🐅 在完整结果生成后进行龙虎控制检查
  if (needsDragonTigerCheck) {
    console.log(`🐉🐅 开始检查龙虎控制结果: [${result.join(', ')}]`);
    
    // 检查所有位置的龙虎控制
    for (let pos1 = 0; pos1 < 10; pos1++) {
      for (let pos2 = 0; pos2 < 10; pos2++) {
        if (pos1 !== pos2 && result[pos1] && result[pos2]) {
          // 检查该位置对是否有龙虎控制权重
          let pos1HighCount = 0, pos1LowCount = 0;
          let pos2HighCount = 0, pos2LowCount = 0;
          
          for (let num = 0; num < 10; num++) {
            const weight1 = weights.positions[pos1][num];
            const weight2 = weights.positions[pos2][num];
            if (weight1 > 100) pos1HighCount++;
            if (weight1 < 0.01) pos1LowCount++;
            if (weight2 > 100) pos2HighCount++;
            if (weight2 < 0.01) pos2LowCount++;
          }
          
          const pos1HasDragonTigerWeight = (pos1HighCount === 5 && pos1LowCount === 5);
          const pos2HasDragonTigerWeight = (pos2HighCount === 5 && pos2LowCount === 5);
          
          if (pos1HasDragonTigerWeight && pos2HasDragonTigerWeight) {
            const pos1Value = result[pos1];
            const pos2Value = result[pos2];
            const pos1Weight = weights.positions[pos1][pos1Value - 1] || 1;
            const pos2Weight = weights.positions[pos2][pos2Value - 1] || 1;
            
            // 判断期望的龙虎结果
            let shouldDragonWin = false;
            if (pos1Weight > 100 && pos2Weight < 0.01) {
              shouldDragonWin = true; // pos1应该大于pos2（龙胜）
            } else if (pos1Weight < 0.01 && pos2Weight > 100) {
              shouldDragonWin = false; // pos1应该小于pos2（虎胜）
            } else {
              continue; // 没有明确的龙虎控制要求
            }
            
            const actualDragonWins = pos1Value > pos2Value;
            
            if (shouldDragonWin !== actualDragonWins && attempts < MAX_ATTEMPTS) {
              console.log(`🐉🐅 龙虎控制失效: 第${pos1+1}名(${pos1Value})vs第${pos2+1}名(${pos2Value})，期望龙${shouldDragonWin ? '赢' : '输'}，实际龙${actualDragonWins ? '赢' : '输'}，重新生成 (第${attempts + 1}次尝试)`);
              return generateWeightedResult(weights, attempts + 1);
            } else if (shouldDragonWin === actualDragonWins) {
              console.log(`✅ 龙虎控制生效: 第${pos1+1}名(${pos1Value})vs第${pos2+1}名(${pos2Value})，龙${actualDragonWins ? '赢' : '输'}，符合预期`);
            }
          }
        }
      }
    }
  }

  console.log(`🏁 最终开奖结果: [${result.join(', ')}]`);
  return result;
}

// 根据权重随机选择索引
function weightedRandomIndex(weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  // 如果总权重为0，直接返回0
  if (totalWeight === 0) {
    console.warn('权重总和为0，返回索引0');
    return 0;
  }
  
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return i;
    }
  }
  
  return weights.length - 1; // 防止浮点误差
}

// 智能生成目标和值的开奖结果
function generateTargetSumResult(weights, targetSum, attempts = 0) {
  const MAX_ATTEMPTS = 50;
  const numbers = Array.from({length: 10}, (_, i) => i + 1);
  const result = [];
  let availableNumbers = [...numbers];
  
  console.log(`🎯 智能生成目标和值${targetSum} (第${attempts}次尝试)`);
  
  // 找到所有可能的冠军+亚军组合
  const possiblePairs = [];
  for (let i = 1; i <= 10; i++) {
    for (let j = 1; j <= 10; j++) {
      if (i !== j && i + j === targetSum) {
        possiblePairs.push([i, j]);
      }
    }
  }
  
  if (possiblePairs.length === 0) {
    console.warn(`⚠️ 无法生成和值${targetSum}的有效组合，使用普通生成`);
    return generateWeightedResult(weights, attempts);
  }
  
  // 根据位置权重选择最优组合
  let bestPair = possiblePairs[0];
  let bestWeight = 0;
  
  for (const [champion, runnerup] of possiblePairs) {
    const championWeight = weights.positions[0][champion - 1] || 1;
    const runnerupWeight = weights.positions[1][runnerup - 1] || 1;
    const combinedWeight = championWeight * runnerupWeight;
    
    if (combinedWeight > bestWeight) {
      bestWeight = combinedWeight;
      bestPair = [champion, runnerup];
    }
  }
  
  const [selectedChampion, selectedRunnerup] = bestPair;
  console.log(`🏆 选择冠军${selectedChampion}，亚军${selectedRunnerup}，和值=${selectedChampion + selectedRunnerup}`);
  
  result.push(selectedChampion);
  result.push(selectedRunnerup);
  
  // 从可用号码中移除已选择的
  availableNumbers = availableNumbers.filter(num => num !== selectedChampion && num !== selectedRunnerup);
  
  // 生成剩余位置(第3-10名)，同样使用权重控制
  for (let position = 2; position < 10; position++) {
    let attempts = 0;
    const MAX_POSITION_ATTEMPTS = 10; // 每个位置最多尝试10次
    let selectedNumber = null;
    
    while (attempts < MAX_POSITION_ATTEMPTS && selectedNumber === null) {
      // 根据权重选择位置上的号码
      let numberWeights = [];
      for (let i = 0; i < availableNumbers.length; i++) {
        const num = availableNumbers[i];
        numberWeights.push(weights.positions[position][num-1] || 1);
      }
      
      // 检查是否有极高权重的号码（100%控制的情况）
      const maxWeight = Math.max(...numberWeights);
      const minWeight = Math.min(...numberWeights);
      const hasExtremeWeight = maxWeight > 100; // 极高权重阈值
      const hasExtremelyLowWeight = minWeight < 0.01; // 极低权重阈值（100%输控制）
      
      if (hasExtremeWeight) {
        // 100%赢控制情况，直接选择最高权重的号码
        const maxIndex = numberWeights.indexOf(maxWeight);
        selectedNumber = availableNumbers[maxIndex];
        console.log(`🎯 目标和值-位置${position + 1}强制选择号码${selectedNumber} (权重:${maxWeight})`);
      } else if (hasExtremelyLowWeight) {
        // 100%输控制情况，避免选择极低权重的号码
        const validIndices = [];
        for (let i = 0; i < numberWeights.length; i++) {
          if (numberWeights[i] >= 0.1) { // 只选择权重不太低的号码
            validIndices.push(i);
          }
        }
        
        if (validIndices.length > 0) {
          // 从有效号码中随机选择
          const randomValidIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
          selectedNumber = availableNumbers[randomValidIndex];
          console.log(`🚫 目标和值-位置${position + 1}避开低权重号码，选择${selectedNumber} (权重:${numberWeights[randomValidIndex]})`);
        } else {
          // 如果所有号码权重都很低，强制选择权重最高的
          const maxIndex = numberWeights.indexOf(maxWeight);
          selectedNumber = availableNumbers[maxIndex];
          console.log(`⚠️ 目标和值-位置${position + 1}所有权重都很低，强制选择${selectedNumber} (权重:${maxWeight})`);
        }
      } else {
        // 使用权重进行选择
        const selectedIndex = weightedRandomIndex(numberWeights);
        const candidateNumber = availableNumbers[selectedIndex];
        const candidateWeight = numberWeights[selectedIndex];
        
        // 检查是否需要重新选择（针对中等权重的控制）
        if (candidateWeight < 0.5 && Math.random() < 0.7 && attempts < MAX_POSITION_ATTEMPTS - 1) {
          console.log(`🔄 目标和值-位置${position + 1}号码${candidateNumber}权重较低(${candidateWeight})，重新选择 (第${attempts + 1}次尝试)`);
          attempts++;
          continue;
        }
        
        selectedNumber = candidateNumber;
        console.log(`🎲 目标和值-位置${position + 1}权重选择号码${selectedNumber} (权重:${candidateWeight})`);
      }
      
      attempts++;
    }
    
    // 如果经过多次尝试还是没有选到合适的号码，使用最后选择的号码
    if (selectedNumber === null && availableNumbers.length > 0) {
      selectedNumber = availableNumbers[0]; // 使用第一个可用号码
      console.warn(`⚠️ 目标和值-位置${position + 1}经过${MAX_POSITION_ATTEMPTS}次尝试，使用默认号码${selectedNumber}`);
    }
    
    // 将选中的号码加入结果并从可用号码中移除
    if (selectedNumber !== null) {
      result.push(selectedNumber);
      const removeIndex = availableNumbers.indexOf(selectedNumber);
      if (removeIndex > -1) {
        availableNumbers.splice(removeIndex, 1);
      }
    }
  }
  
  console.log(`🎯 目标和值${targetSum}生成完成: [${result.join(', ')}]`);
  return result;
}

// 监控并调整系统
async function monitorAndAdjustSystem() {
  try {
    // 计算近期平台盈亏情况(最近10期)
    const recentProfitLoss = await calculateRecentProfitLoss(10);
    
    console.log('系统监控 - 近期平台盈亏:', recentProfitLoss);
    
    // 设定调整阈值
    const THRESHOLD = 5000;
    
    // 如果平台连续亏损，适当调整控制参数
    if (recentProfitLoss < -THRESHOLD) {
      CONTROL_PARAMS.adjustmentFactor += 0.05;
      CONTROL_PARAMS.randomnessFactor -= 0.05;
      console.log('系统监控 - 平台亏损过多，加强控制');
    } 
    // 如果平台获利过多，适当放宽控制
    else if (recentProfitLoss > THRESHOLD * 2) {
      CONTROL_PARAMS.adjustmentFactor -= 0.03;
      CONTROL_PARAMS.randomnessFactor += 0.03;
      console.log('系统监控 - 平台获利过多，放宽控制');
    }
    
    // 确保参数在合理范围内
    CONTROL_PARAMS.adjustmentFactor = Math.max(0.3, Math.min(0.9, CONTROL_PARAMS.adjustmentFactor));
    CONTROL_PARAMS.randomnessFactor = Math.max(0.1, Math.min(0.5, CONTROL_PARAMS.randomnessFactor));
    
    console.log('系统监控 - 当前控制参数:', CONTROL_PARAMS);
  } catch (error) {
    console.error('监控与调整系统出错:', error);
  }
}

// 计算近期平台盈亏
async function calculateRecentProfitLoss(periods = 10) {
  try {
    // 获取最近几期的所有已结算注单
    const recentBets = await BetModel.getRecentSettledBets(periods);
    
    // 计算平台净收益
    let platformProfit = 0;
    
    recentBets.forEach(bet => {
      if (bet.win) {
        // 玩家赢钱，平台亏损
        platformProfit -= parseFloat(bet.win_amount) - parseFloat(bet.amount);
      } else {
        // 玩家输钱，平台获利
        platformProfit += parseFloat(bet.amount);
      }
    });
    
    return platformProfit;
  } catch (error) {
    console.error('计算近期盈亏出错:', error);
    return 0;
  }
}

// 在游戏结算逻辑中处理点数发放和退水分配


// 非阻塞式结算系统 - 游戏继续，后台补偿
let pendingSettlements = new Map(); // 追踪待补偿的结算

async function settleBetsNonBlocking(period, winResult) {
    console.log(`🎯 开始非阻塞结算第${period}期注单...`);
    
    try {
        // 立即尝试结算
        const result = await enhancedSettlement(period, winResult);
        
        if (result && result.success) {
            console.log(`✅ 第${period}期结算成功`);
            
            // 异步验证结算完整性（不阻塞游戏）
            setImmediate(() => verifyAndCompensateSettlement(period));
            
            return { success: true };
        } else {
            throw new Error(`Enhanced settlement failed: ${result?.message || 'Unknown error'}`);
        }
        
    } catch (error) {
        console.error(`❌ 第${period}期结算失败:`, error.message);
        
        // 记录失败，异步处理补偿
        pendingSettlements.set(period, {
            winResult,
            error: error.message,
            timestamp: new Date(),
            retryCount: 0
        });
        
        // 立即启动后台补偿（不阻塞游戏）
        setImmediate(() => compensateFailedSettlement(period));
        
        // 游戏继续运行
        return { success: false, compensating: true };
    }
}

async function verifyAndCompensateSettlement(period) {
    console.log(`🔍 异步验证第${period}期结算完整性...`);
    
    try {
        const verification = await verifySettlementCompleteness(period);
        
        if (!verification.isComplete) {
            console.log(`⚠️ 第${period}期结算不完整: ${verification.issues.join(', ')}`);
            
            // 加入补偿队列
            if (!pendingSettlements.has(period)) {
                pendingSettlements.set(period, {
                    issues: verification.issues,
                    timestamp: new Date(),
                    retryCount: 0
                });
            }
            
            // 启动补偿
            await compensateFailedSettlement(period);
        } else {
            console.log(`✅ 第${period}期结算验证通过`);
        }
        
    } catch (error) {
        console.error(`验证第${period}期结算时出错:`, error);
    }
}

async function compensateFailedSettlement(period) {
    console.log(`🔄 开始补偿第${period}期结算...`);
    
    try {
        const pendingData = pendingSettlements.get(period);
        if (!pendingData) {
            console.log(`第${period}期没有待补偿的结算`);
            return;
        }
        
        // 增加重试次数
        pendingData.retryCount++;
        
        if (pendingData.retryCount > 5) {
            console.error(`💥 第${period}期补偿重试次数超限，记录到失败表`);
            await recordFailedSettlement(period, `Max retries exceeded: ${pendingData.error}`);
            pendingSettlements.delete(period);
            return;
        }
        
        console.log(`🔄 第${period}期补偿尝试 ${pendingData.retryCount}/5`);
        
        // 重新尝试结算
        if (pendingData.winResult) {
            const result = await enhancedSettlement(period, pendingData.winResult);
            if (result && result.success) {
                console.log(`✅ 第${period}期补偿结算成功`);
                pendingSettlements.delete(period);
                return;
            }
        }
        
        // 如果enhancedSettlement还是失败，尝试手动处理退水
        console.log(`🔧 尝试手动补偿第${period}期退水...`);
        const manualResult = await manuallyProcessPeriodRebates(period);
        
        if (manualResult.success) {
            console.log(`✅ 第${period}期手动退水补偿成功`);
            pendingSettlements.delete(period);
        } else {
            console.log(`❌ 第${period}期手动补偿失败，将重试`);
            
            // 延迟重试（避免频繁重试）
            const retryDelay = pendingData.retryCount * 5000; // 5s, 10s, 15s...
            setTimeout(() => compensateFailedSettlement(period), retryDelay);
        }
        
    } catch (error) {
        console.error(`补偿第${period}期结算时出错:`, error);
        
        // 延迟重试
        setTimeout(() => compensateFailedSettlement(period), 10000);
    }
}

async function manuallyProcessPeriodRebates(period) {
    console.log(`🛠️ 手动处理第${period}期退水...`);
    
    try {
        // 检查是否有已结算的注单
        const settledBets = await db.any(`
            SELECT 
                bh.id,
                bh.username,
                bh.amount,
                bh.win_amount,
                m.id as member_id,
                m.agent_id,
                m.market_type
            FROM bet_history bh
            JOIN members m ON bh.username = m.username
            WHERE bh.period = $1 AND bh.settled = true
        `, [period]);
        
        if (settledBets.length === 0) {
            console.log(`第${period}期没有已结算的注单`);
            return { success: true, reason: 'no_settled_bets' };
        }
        
        // 检查是否已有退水记录
        const existingRebates = await db.any(`
            SELECT COUNT(*) as count
            FROM transaction_records
            WHERE period = $1 AND transaction_type = 'rebate'
        `, [period]);
        
        if (parseInt(existingRebates[0].count) > 0) {
            console.log(`第${period}期退水记录已存在`);
            
            // 只需要创建结算日志
            const existingLog = await db.oneOrNone(`
                SELECT id FROM settlement_logs WHERE period = $1
            `, [period]);
            
            if (!existingLog) {
                await createSettlementLogForPeriod(period, settledBets);
                console.log(`✅ 第${period}期结算日志已创建`);
            }
            
            return { success: true, reason: 'rebates_existed' };
        }
        
        // 处理退水
        await db.tx(async t => {
            for (const bet of settledBets) {
                await processRebatesForBet(t, bet, period);
            }
            
            // 创建结算日志
            await createSettlementLogForPeriod(period, settledBets, t);
        });
        
        console.log(`✅ 第${period}期手动退水处理完成`);
        return { success: true };
        
    } catch (error) {
        console.error(`手动处理第${period}期退水失败:`, error);
        return { success: false, error: error.message };
    }
}

async function processRebatesForBet(t, bet, period) {
    // 获取代理链 - 新逻辑：只给总代理退水
    const agentChain = await t.any(`
        WITH RECURSIVE agent_chain AS (
            SELECT id, username, parent_id, rebate_percentage, market_type, 0 as level
            FROM agents 
            WHERE id = $1
            
            UNION ALL
            
            SELECT a.id, a.username, a.parent_id, a.rebate_percentage, a.market_type, ac.level + 1
            FROM agents a
            JOIN agent_chain ac ON a.id = ac.parent_id
            WHERE ac.level < 10
        )
        SELECT * FROM agent_chain ORDER BY level DESC
    `, [bet.agent_id]);
    
    if (agentChain.length === 0) return;
    
    // 找到总代理（最顶层的代理）
    const topAgent = agentChain[0]; // DESC排序，第一个就是最顶层
    const marketType = topAgent.market_type || 'D';
    
    // 计算退水金额（根据盘口类型）
    const rebatePercentage = marketType === 'A' ? 0.011 : 0.041; // A盘1.1%, D盘4.1%
    const rebateAmount = Math.round(parseFloat(bet.amount) * rebatePercentage * 100) / 100;
    
    if (rebateAmount >= 0.01) {
        const currentBalance = await t.oneOrNone(`
            SELECT balance FROM agents WHERE id = $1
        `, [topAgent.id]);
        
        if (currentBalance) {
            const balanceBefore = parseFloat(currentBalance.balance);
            const balanceAfter = balanceBefore + rebateAmount;
            
            await t.none(`
                UPDATE agents SET balance = balance + $1 WHERE id = $2
            `, [rebateAmount, topAgent.id]);
            
            await t.none(`
                INSERT INTO transaction_records (
                    user_type, user_id, transaction_type, amount, 
                    balance_before, balance_after, description, 
                    member_username, bet_amount, rebate_percentage, period
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            `, [
                'agent', topAgent.id, 'rebate', rebateAmount,
                balanceBefore, balanceAfter,
                `退水 - 期号 ${period} 会员 ${bet.username} 下注 ${bet.amount} (${marketType}盘 ${(rebatePercentage*100).toFixed(1)}%)`,
                bet.username, parseFloat(bet.amount), rebatePercentage, period.toString()
            ]);
            
            console.log(`✅ 分配退水 ${rebateAmount} 给总代理 ${topAgent.username} (${marketType}盘)`);
        }
    }
}

async function createSettlementLogForPeriod(period, settledBets, t = null) {
    const query = `
        INSERT INTO settlement_logs (
            period, settled_count, total_win_amount, settlement_details
        ) VALUES ($1, $2, $3, $4)
    `;
    
    const params = [
        parseInt(period),
        settledBets.length,
        settledBets.reduce((sum, bet) => sum + parseFloat(bet.win_amount || 0), 0),
        JSON.stringify(settledBets.map(bet => ({
            betId: bet.id,
            username: bet.username,
            amount: bet.amount,
            settled: true,
            compensated: true,
            compensatedAt: new Date().toISOString()
        })))
    ];
    
    if (t) {
        await t.none(query, params);
    } else {
        await db.none(query, params);
    }
}

// 定期清理补偿队列（每5分钟）
setInterval(() => {
    console.log(`🧹 检查补偿队列状态...`);
    
    if (pendingSettlements.size > 0) {
        console.log(`当前有 ${pendingSettlements.size} 个期号在补偿队列:`);
        for (const [period, data] of pendingSettlements) {
            console.log(`  - 期号 ${period}: 重试 ${data.retryCount} 次`);
        }
    } else {
        console.log(`✅ 补偿队列为空`);
    }
}, 5 * 60 * 1000);

async function verifySettlementCompleteness(period) {
    console.log(`🔍 验证第${period}期结算完整性...`);
    
    try {
        const issues = [];
        
        // 检查未结算注单
        const unsettledBets = await db.any(`
            SELECT COUNT(*) as count 
            FROM bet_history 
            WHERE period = $1 AND settled = false
        `, [period]);
        
        if (parseInt(unsettledBets[0].count) > 0) {
            issues.push(`${unsettledBets[0].count} unsettled bets`);
        }
        
        // 检查结算日志
        const settlementLog = await db.oneOrNone(`
            SELECT id FROM settlement_logs 
            WHERE period = $1
        `, [period]);
        
        if (!settlementLog) {
            issues.push('missing settlement log');
        }
        
        // 检查退水记录
        const [betsCount, rebatesCount] = await Promise.all([
            db.one('SELECT COUNT(*) as count FROM bet_history WHERE period = $1 AND settled = true', [period]),
            db.one('SELECT COUNT(*) as count FROM transaction_records WHERE period = $1 AND transaction_type = \'rebate\'', [period])
        ]);
        
        if (parseInt(betsCount.count) > 0 && parseInt(rebatesCount.count) === 0) {
            issues.push('missing rebate records');
        }
        
        const isComplete = issues.length === 0;
        
        return { isComplete, issues };
        
    } catch (error) {
        console.error('结算验证过程出错:', error);
        return { isComplete: false, issues: ['verification_error'] };
    }
}

async function recordFailedSettlement(period, error) {
    try {
        await db.none(`
            INSERT INTO failed_settlements (period, error_message, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (period) DO UPDATE SET
                error_message = $2,
                retry_count = failed_settlements.retry_count + 1,
                updated_at = NOW()
        `, [period, error]);
        
        console.log(`📝 已记录失败结算: 期号 ${period}`);
    } catch (dbError) {
        console.error('记录失败结算时出错:', dbError);
    }
}

// ORIGINAL SETTLЕБETS FUNCTION (KEPT FOR REFERENCE)
async function settleBets(period, winResult) {
  console.log(`🎯 使用完整结算系统结算第${period}期注单...`);
  
  try {
    // 使用增强的结算系统支援所有投注类型
    const result = await enhancedSettlement(period, winResult);
    
    if (result.success) {
      console.log(`✅ 第${period}期结算完成:`);
      console.log(`  - 结算注单数: ${result.settledCount}`);
      console.log(`  - 中奖注单数: ${result.winCount}`);
      console.log(`  - 总中奖金额: ${result.totalWinAmount}`);
      console.log(`  - 执行时间: ${result.executionTime}ms`);
      
      // 同步中奖数据到代理系统
      // 注意：余额已经在游戏系统更新，不需要再同步到代理系统
      // 这里只记录日志
      if (result.userWinnings && Object.keys(result.userWinnings).length > 0) {
        for (const [username, data] of Object.entries(result.userWinnings)) {
          console.log(`💰 用户 ${username} 中奖 ${data.winAmount} 元（${data.winBets.length}笔）`);
          // 不再同步余额到代理系统，避免重复计算
        }
      }
    } else {
      console.error(`❌ 第${period}期结算失败:`, result.error || '未知错误');
      
      // 如果新版失败，尝试优化版
      console.log('尝试使用优化版结算系统...');
      try {
        const fallbackResult = await optimizedSettlement(period, winResult);
        if (fallbackResult.success) {
          console.log('✅ 优化版结算系统成功完成结算');
        } else {
          // 最后尝试旧版
          console.log('尝试使用旧版结算系统...');
          const oldResult = await improvedSettleBets(period, winResult);
          if (oldResult.success) {
            console.log('✅ 旧版结算系统成功完成结算');
          }
        }
      } catch (fallbackError) {
        console.error('备用结算系统也失败了:', fallbackError);
      }
    }
  } catch (error) {
    console.error(`❌ 结算第${period}期时发生错误:`, error);
    // 可以考虑发送告警通知
  }
  
  // 独立的退水检查机制 - 确保无论使用哪个结算系统都不会遗漏退水
  try {
    // 检查是否有已结算的注单
    const settledBets = await db.oneOrNone(`
      SELECT COUNT(*) as count, SUM(amount) as total_amount
      FROM bet_history
      WHERE period = $1 AND settled = true
    `, [period]);
    
    if (settledBets && parseInt(settledBets.count) > 0) {
      // 检查是否已经处理过退水
      const hasRebates = await db.oneOrNone(`
        SELECT COUNT(*) as count 
        FROM transaction_records
        WHERE period = $1 AND transaction_type = 'rebate'
      `, [period]);
      
      if (!hasRebates || parseInt(hasRebates.count) === 0) {
        console.log(`⚠️ 检测到期号 ${period} 有 ${settledBets.count} 笔已结算注单但未处理退水，立即处理...`);
        console.log(`  总下注金额: $${settledBets.total_amount}`);
        
        // 引入并执行退水处理
        const { processRebates } = await import('./enhanced-settlement-system.js');
        await processRebates(period);
        
        console.log(`✅ 期号 ${period} 的退水补充处理完成`);
      } else {
        console.log(`✅ 期号 ${period} 的退水已经处理过 (${hasRebates.count} 笔记录)`);
      }
    }
  } catch (rebateCheckError) {
    console.error(`退水检查失败 (期号 ${period}):`, rebateCheckError.message);
    // 退水检查失败不应影响主要结算流程
  }
}

// 保留原有的结算函数作为备份
// ⚠️ 警告：此函数已停用！请使用 improvedSettleBets
// 此函数包含会导致重复结算的逻辑，已被注释
async function legacySettleBets(period, winResult) {
  console.warn(`⚠️ 警告：legacySettleBets 被调用了！这个函数已经停用，应该使用 improvedSettleBets`);
  console.log(`结算第${period}期注单...`);
  
  // 获取系统时间内未结算的注单
  const bets = await BetModel.getUnsettledByPeriod(period);
  
  console.log(`找到${bets.length}个未结算注单`);
  
  if (bets.length === 0) {
    console.log(`第${period}期注单结算完成`);
    return;
  }
  
  // 获取总代理ID
  const adminAgent = await getAdminAgentId();
  if (!adminAgent) {
    console.error('结算注单失败: 找不到总代理帐户');
    return;
  }
  
  // 遍历并结算每个注单
  for (const bet of bets) {
    try {
      const username = bet.username;
      
      // 计算赢钱金额
      const winAmount = calculateWinAmount(bet, winResult);
      const isWin = winAmount > 0;
      
      console.log(`结算用户 ${username} 的注单 ${bet.id}，下注类型: ${bet.bet_type}，下注值: ${bet.bet_value}，赢钱金额: ${winAmount}`);
      
      // 标记为已结算
      await BetModel.updateSettlement(bet.id, isWin, winAmount);
      
      // 如果赢了，记录日志（余额更新已在 improvedSettleBets 中处理）
      if (isWin) {
        console.log(`[legacySettleBets] 用户 ${username} 中奖，金额 ${winAmount}（注意：此函数已停用，余额更新应在 improvedSettleBets 中处理）`);
        
        // 🚨 重要：以下代码已被注释以防止重复结算
        // 余额更新现在完全由 improvedSettleBets 处理
        /*
        try {
          // 获取当前余额用于日志记录
          const currentBalance = await getBalance(username);
          
          // 🔧 修正：用户下注时已扣除本金，中奖时应返还总奖金
          const betAmount = parseFloat(bet.amount);
          const totalWinAmount = parseFloat(winAmount); // 这是总回报（含本金）
          const netProfit = totalWinAmount - betAmount; // 纯奖金部分
          
          console.log(`🎯 结算详情: 下注 ${betAmount} 元，总回报 ${totalWinAmount} 元，纯奖金 ${netProfit} 元`);
          
          // 原子性增加会员余额（增加总回报，因为下注时已扣除本金）
          const newBalance = await UserModel.addBalance(username, totalWinAmount);
          
          // 只同步余额到代理系统（不扣代理点数）
          try {
            await fetch(`${AGENT_API_URL}/api/agent/sync-member-balance`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                username: username,
                balance: newBalance,
                reason: `第${period}期中奖 ${bet.bet_type}:${bet.bet_value} (下注${betAmount}元，总回报${totalWinAmount}元，纯奖金${netProfit}元)`
              })
            });
          } catch (syncError) {
            console.warn('同步余额到代理系统失败，但会员余额已更新:', syncError);
          }
          
          console.log(`用户 ${username} 中奖结算: 下注${betAmount}元 → 总回报${totalWinAmount}元 → 纯奖金${netProfit}元，余额从 ${currentBalance} 更新为 ${newBalance}`);
        } catch (error) {
          console.error(`更新用户 ${username} 中奖余额失败:`, error);
        }
        */
      }
      
      // 在结算时分配退水给代理（不论输赢，基于下注金额）
      try {
        await distributeRebate(username, parseFloat(bet.amount), period);
        console.log(`已为会员 ${username} 的注单 ${bet.id} 分配退水到代理`);
      } catch (rebateError) {
        console.error(`分配退水失败 (注单ID=${bet.id}):`, rebateError);
      }
        } catch (error) {
      console.error(`结算用户注单出错 (ID=${bet.id}):`, error);
      }
    }
    
    console.log(`第${period}期注单结算完成`);
}

// 退水分配函数
async function distributeRebate(username, betAmount, period) {
  try {
    console.log(`开始为会员 ${username} 分配退水，下注金额: ${betAmount}`);
    
    // 获取会员的代理链来确定最大退水比例
    const agentChain = await getAgentChain(username);
    if (!agentChain || agentChain.length === 0) {
      console.log(`会员 ${username} 没有代理链，退水归平台所有`);
      return;
    }
    
    // 🔧 修正：计算固定的总退水池（根据盘口类型）
    const directAgent = agentChain[0]; // 第一个是直属代理
    const maxRebatePercentage = directAgent.market_type === 'A' ? 0.011 : 0.041; // A盘1.1%, D盘4.1%
    const totalRebatePool = parseFloat(betAmount) * maxRebatePercentage; // 固定总池
    
    console.log(`会员 ${username} 的代理链:`, agentChain.map(a => `${a.username}(L${a.level}-${a.rebate_mode}:${(a.rebate_percentage*100).toFixed(1)}%)`));
    console.log(`固定退水池: ${totalRebatePool.toFixed(2)} 元 (${(maxRebatePercentage*100).toFixed(1)}%)`);
    
    // 🔧 修正：按层级顺序分配退水，上级只拿差额
    let remainingRebate = totalRebatePool;
    let distributedPercentage = 0; // 已经分配的退水比例
    
    for (let i = 0; i < agentChain.length; i++) {
      const agent = agentChain[i];
      let agentRebateAmount = 0;
      
      // 如果没有剩余退水，结束分配
      if (remainingRebate <= 0.01) {
        console.log(`退水池已全部分配完毕`);
        break;
      }
      
      const rebatePercentage = parseFloat(agent.rebate_percentage);
      
      if (isNaN(rebatePercentage) || rebatePercentage <= 0) {
        // 退水比例为0，该代理不拿退水，全部给上级
        agentRebateAmount = 0;
        console.log(`代理 ${agent.username} 退水比例为 ${(rebatePercentage*100).toFixed(1)}%，不拿任何退水，剩余 ${remainingRebate.toFixed(2)} 元继续向上分配`);
      } else {
        // 🔧 修正：计算该代理实际能拿的退水比例（不能超过已分配的）
        const actualRebatePercentage = Math.max(0, rebatePercentage - distributedPercentage);
        
        if (actualRebatePercentage <= 0) {
          console.log(`代理 ${agent.username} 退水比例 ${(rebatePercentage*100).toFixed(1)}% 已被下级分完，不能再获得退水`);
          agentRebateAmount = 0;
        } else {
          // 计算该代理实际获得的退水金额
          agentRebateAmount = parseFloat(betAmount) * actualRebatePercentage;
          // 确保不超过剩余退水池
          agentRebateAmount = Math.min(agentRebateAmount, remainingRebate);
          // 四舍五入到小数点后2位
          agentRebateAmount = Math.round(agentRebateAmount * 100) / 100;
          remainingRebate -= agentRebateAmount;
          distributedPercentage += actualRebatePercentage;
          
          console.log(`代理 ${agent.username} 退水比例为 ${(rebatePercentage*100).toFixed(1)}%，实际获得 ${(actualRebatePercentage*100).toFixed(1)}% = ${agentRebateAmount.toFixed(2)} 元，剩余池额 ${remainingRebate.toFixed(2)} 元`);
        }
        
        // 如果该代理的比例达到或超过最大值，说明是全拿模式
        if (rebatePercentage >= maxRebatePercentage) {
          console.log(`代理 ${agent.username} 拿了全部退水池，结束分配`);
          remainingRebate = 0;
        }
      }
      
      if (agentRebateAmount > 0) {
        // 分配退水给代理
        await allocateRebateToAgent(agent.id, agent.username, agentRebateAmount, username, betAmount, period);
        console.log(`✅ 分配退水 ${agentRebateAmount.toFixed(2)} 给代理 ${agent.username} (比例: ${(parseFloat(agent.rebate_percentage)*100).toFixed(1)}%, 剩余: ${remainingRebate.toFixed(2)})`);
        
        // 如果没有剩余退水了，结束分配
        if (remainingRebate <= 0.01) {
          break;
        }
      }
    }
    
    // 剩余退水归平台所有
    if (remainingRebate > 0.01) { // 考虑浮点数精度问题
      console.log(`剩余退水池 ${remainingRebate.toFixed(2)} 元归平台所有`);
    }
    
    console.log(`✅ 退水分配完成，总池: ${totalRebatePool.toFixed(2)}元，已分配: ${(totalRebatePool - remainingRebate).toFixed(2)}元，平台保留: ${remainingRebate.toFixed(2)}元`);
    
  } catch (error) {
    console.error('分配退水时发生错误:', error);
  }
}

// 获取会员的代理链（从直属代理到总代理）
async function getAgentChain(username) {
  try {
    // 从代理系统获取会员所属的代理
    const response = await fetch(`${AGENT_API_URL}/api/agent/member-agent-chain?username=${username}`);
    const data = await response.json();
    
    if (data.success && data.agentChain) {
      return data.agentChain;
    }
    
    console.log(`无法获取会员 ${username} 的代理链`);
    return [];
  } catch (error) {
    console.error('获取代理链时发生错误:', error);
    return [];
  }
}

// 分配退水给代理
async function allocateRebateToAgent(agentId, agentUsername, rebateAmount, memberUsername, betAmount, period) {
  try {
    // 调用代理系统的退水分配API
    const response = await fetch(`${AGENT_API_URL}/api/agent/allocate-rebate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agentId: agentId,
        agentUsername: agentUsername,
        rebateAmount: rebateAmount,
        memberUsername: memberUsername,
        betAmount: betAmount,
        reason: period
      })
    });
    
    // 检查HTTP状态码
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      console.error(`分配退水给代理 ${agentUsername} 失败:`, result.message);
    }
  } catch (error) {
    console.error(`分配退水给代理 ${agentUsername} 时发生错误:`, error);
  }
}

// 修改获取余额的API端点
app.get('/api/balance', async (req, res) => {
  const { username } = req.query;
  
  try {
    // 参数验证
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供用户名' 
      });
    }
    
    // 验证会话
    const sessionToken = req.headers['x-session-token'];
    if (sessionToken) {
      const session = await SessionManager.validateSession(sessionToken);
      if (!session) {
        return res.status(401).json({ success: false, message: '会话已过期' });
      }
    }

    // 获取用户信息
    const user = await UserModel.findByUsername(username);
    if (!user) {
      console.log(`用户不存在: ${username}`);
      return res.json({ 
          success: false,
        message: '用户不存在', 
        balance: 0 
        });
    }
    
    console.log(`为用户 ${username} 获取余额`);

    try {
      // 从代理系统获取余额
      const response = await fetch(`${AGENT_API_URL}/api/agent/member-balance?username=${username}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('代理系统返回的余额数据:', data);
        
        // 更新本地余额
        await UserModel.setBalance(username, data.balance);
        console.log('更新本地余额为:', data.balance);
        
        return res.json({ 
          success: true, 
          balance: data.balance,
          source: 'agent_system'
        });
      } else {
        console.log('代理系统回应失败，使用本地余额:', user.balance);
        return res.json({ 
          success: true, 
          balance: user.balance,
          source: 'local_db' 
        });
      }
    } catch (error) {
      console.error('获取代理系统余额出错:', error);
      console.log('发生错误，使用本地余额:', user.balance);
      return res.json({ 
        success: true, 
        balance: user.balance,
        source: 'local_db_error' 
      });
    }
  } catch (error) {
    console.error('获取余额出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '系统错误，请稍后再试' 
    });
  }
});

// 获取今日盈亏的API端点
app.get('/api/daily-profit', async (req, res) => {
  const { username } = req.query;
  
  try {
    // 参数验证
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供用户名' 
      });
    }

    // 先检查代理系统中的会员信息
    try {
      const memberResponse = await fetch(`${AGENT_API_URL}/api/agent/member/info/${username}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!memberResponse.ok) {
        return res.json({ 
          success: false,
          message: '用户不存在', 
          profit: 0 
        });
      }
      
      const memberData = await memberResponse.json();
      if (!memberData.success) {
        return res.json({ 
          success: false,
          message: '用户不存在', 
          profit: 0 
        });
      }
    } catch (error) {
      console.error('检查会员信息失败:', error);
      return res.json({ 
        success: false,
        message: '用户不存在', 
        profit: 0 
      });
    }

    // 获取今日开始和结束时间（使用UTC时间）
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));

    // 查询今日投注记录 - 修正盈亏计算逻辑
    const result = await db.oneOrNone(
      `SELECT 
        COALESCE(SUM(amount), 0) as total_bet,
        COALESCE(SUM(CASE WHEN win = true THEN win_amount ELSE 0 END), 0) as total_win,
        COALESCE(SUM(CASE WHEN win = true THEN (win_amount - amount) ELSE -amount END), 0) as net_profit
      FROM bet_history 
      WHERE username = $1 
        AND settled = true 
        AND created_at >= $2 
        AND created_at < $3`,
      [username, startOfDay, endOfDay]
    );

    const totalBet = result ? parseFloat(result.total_bet) || 0 : 0;
    const totalWin = result ? parseFloat(result.total_win) || 0 : 0;
    const dailyProfit = result ? parseFloat(result.net_profit) || 0 : 0;

    console.log(`用户 ${username} 今日盈亏: 投注 ${totalBet}, 赢得 ${totalWin}, 盈亏 ${dailyProfit}`);

    res.json({ 
      success: true, 
      profit: dailyProfit,
      totalBet: totalBet,
      totalWin: totalWin
    });

  } catch (error) {
    console.error('获取今日盈亏出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '系统错误，请稍后再试' 
    });
  }
});

// 获取盈亏记录的API端点
app.get('/api/profit-records', async (req, res) => {
  const { username, days = 7 } = req.query;
  
  try {
    // 参数验证
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供用户名' 
      });
    }

    // 先检查代理系统中的会员信息
    try {
      const memberResponse = await fetch(`${AGENT_API_URL}/api/agent/member/info/${username}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!memberResponse.ok) {
        return res.json({ 
          success: false,
          message: '用户不存在',
          records: [],
          totalBetCount: 0,
          totalProfit: 0
        });
      }
      
      const memberData = await memberResponse.json();
      if (!memberData.success) {
        return res.json({ 
          success: false,
          message: '用户不存在',
          records: [],
          totalBetCount: 0,
          totalProfit: 0
        });
      }
    } catch (error) {
      console.error('检查会员信息失败:', error);
      return res.json({ 
        success: false,
        message: '用户不存在',
        records: [],
        totalBetCount: 0,
        totalProfit: 0
      });
    }

    // 计算日期范围
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));

    // 获取指定天数内的每日盈亏记录 - 修正win_amount问题
    const query = `
      SELECT 
        DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei') as date,
        COUNT(*) as bet_count,
        COALESCE(SUM(amount), 0) as total_bet,
        COALESCE(SUM(CASE WHEN win = true THEN win_amount ELSE 0 END), 0) as total_win
      FROM bet_history 
      WHERE username = $1 
        AND settled = true 
        AND created_at >= $2 
        AND created_at < $3
      GROUP BY DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei')
      ORDER BY date DESC
    `;

    // 执行查询
    const result = await db.any(query, [username, startDate, endDate]);
    
    // 处理查询结果 - 修正盈亏计算
    const records = result && result.length > 0 ? result.map(row => {
      const totalBet = parseFloat(row.total_bet);
      const totalWin = parseFloat(row.total_win);
      // 正确计算盈亏：实际获得的钱减去投注的钱
      const profit = totalWin - totalBet;
      return {
        date: row.date,
        betCount: parseInt(row.bet_count),
        profit: profit
      };
    }) : [];
    
    // 计算总计
    const totalBetCount = records.reduce((sum, record) => sum + record.betCount, 0);
    const totalProfit = records.reduce((sum, record) => sum + record.profit, 0);
    
    console.log(`获取用户 ${username} 的 ${days} 天盈亏记录: ${records.length} 天记录`);
    
    res.json({
      success: true,
      records,
      totalBetCount,
      totalProfit
    });

  } catch (error) {
    console.error('获取盈亏记录出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取盈亏记录失败',
      records: [],
      totalBetCount: 0,
      totalProfit: 0
    });
  }
});

// 获取周盈亏记录的API端点
app.get('/api/weekly-profit-records', async (req, res) => {
  const { username, startDate, endDate } = req.query;
  
  try {
    // 参数验证
    if (!username || !startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供用户名、开始日期和结束日期' 
      });
    }

    // 先检查代理系统中的会员信息
    try {
      const memberResponse = await fetch(`${AGENT_API_URL}/api/agent/member/info/${username}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!memberResponse.ok) {
        return res.json({ 
          success: false,
          message: '用户不存在',
          records: [],
          totalBetCount: 0,
          totalProfit: 0
        });
      }
      
      const memberData = await memberResponse.json();
      if (!memberData.success) {
        return res.json({ 
          success: false,
          message: '用户不存在',
          records: [],
          totalBetCount: 0,
          totalProfit: 0
        });
      }
    } catch (error) {
      console.error('检查会员信息失败:', error);
      return res.json({ 
        success: false,
        message: '用户不存在',
        records: [],
        totalBetCount: 0,
        totalProfit: 0
      });
    }

    // 转换日期为Date对象
    const start = new Date(startDate);
    const end = new Date(endDate);

    console.log(`获取用户 ${username} 的周盈亏记录，时间范围: ${start.toISOString()} 到 ${end.toISOString()}`);

    // 获取指定周期内的每日盈亏记录 - 使用正确的盈亏计算公式
    const query = `
      SELECT 
        DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei') as date,
        COUNT(*) as bet_count,
        COALESCE(SUM(amount), 0) as total_bet,
        COALESCE(SUM(CASE WHEN win = true THEN win_amount ELSE 0 END), 0) as total_win,
        COALESCE(SUM(CASE WHEN win = true THEN (win_amount - amount) ELSE -amount END), 0) as net_profit
      FROM bet_history 
      WHERE username = $1 
        AND settled = true 
        AND created_at >= $2 
        AND created_at <= $3
      GROUP BY DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei')
      ORDER BY date ASC
    `;

    // 执行查询
    const result = await db.any(query, [username, start, end]);
    
    // 处理查询结果，填充缺失的日期
    const records = [];
    const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    
    // 生成一周内每一天的记录
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      
      // 计算当前日期对应的星期几
      const weekdayIndex = currentDate.getDay(); // 0=星期日, 1=星期一, ..., 6=星期六
      const weekdayName = weekDays[weekdayIndex];
      
      // 查找该日期的实际记录
      const dayRecord = result.find(row => {
        // row.date 是Date对象（台北时间），需要正确转换为字符串比较
        let rowDateStr;
        if (row.date instanceof Date) {
          // 由于date已经是台北时间的日期，直接格式化
          const year = row.date.getFullYear();
          const month = String(row.date.getMonth() + 1).padStart(2, '0');
          const day = String(row.date.getDate()).padStart(2, '0');
          rowDateStr = `${year}-${month}-${day}`;
        } else {
          rowDateStr = String(row.date).split('T')[0];
        }
        return rowDateStr === dateStr;
      });
      
      if (dayRecord) {
        const totalBet = parseFloat(dayRecord.total_bet);
        const totalWin = parseFloat(dayRecord.total_win);
        const netProfit = parseFloat(dayRecord.net_profit); // 使用正确的净盈亏
        records.push({
          date: dateStr,
          weekday: weekdayName,
          betCount: parseInt(dayRecord.bet_count),
          totalBet: totalBet,
          totalWin: totalWin,
          profit: netProfit // 使用正确计算的盈亏
        });
      } else {
        // 如果该日期没有记录，填充空记录
        records.push({
          date: dateStr,
          weekday: weekdayName,
          betCount: 0,
          totalBet: 0,
          totalWin: 0,
          profit: 0
        });
      }
    }
    
    // 计算总计
    const totalBetCount = records.reduce((sum, record) => sum + record.betCount, 0);
    const totalBetAmount = records.reduce((sum, record) => sum + record.totalBet, 0);
    const totalProfit = records.reduce((sum, record) => sum + record.profit, 0);
    
    console.log(`获取用户 ${username} 的周盈亏记录: ${records.length} 天记录，总注数 ${totalBetCount}，总投注金额 ${totalBetAmount}，总盈亏 ${totalProfit}`);
    
    res.json({
      success: true,
      records,
      totalBetCount,
      totalBetAmount,
      totalProfit
    });

  } catch (error) {
    console.error('获取周盈亏记录出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取周盈亏记录失败',
      records: [],
      totalBetCount: 0,
      totalProfit: 0
    });
  }
});

// 获取单日详细记录的API端点
app.get('/api/day-detail', async (req, res) => {
  const { username, date } = req.query;
  
  try {
    // 参数验证
    if (!username || !date) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供用户名和日期' 
      });
    }

    // 检查用户名是否有效
    if (!username || username.trim() === '') {
      return res.json({ 
        success: false,
        message: '无效的用户名',
        records: [],
        stats: { betCount: 0, profit: 0 }
      });
    }

    // 计算日期范围（当日的开始和结束，使用台北时区）
    const inputDate = new Date(date);
    
    // 如果输入的是ISO字符串，需要正确解析
    let targetDate;
    if (typeof date === 'string' && date.includes('T')) {
      // 如果是完整的ISO字符串，转换为台北时区的日期部分
      targetDate = new Date(date);
      targetDate.setHours(targetDate.getHours() + 8); // 转换为台北时间
    } else {
      // 如果是简单的日期字符串，直接使用
      targetDate = new Date(date);
    }
    
    // 计算台北时区的日期边界
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();
    
    // 台北时间的当日开始和结束
    const startOfDayTaipei = new Date(year, month, day, 0, 0, 0);
    const endOfDayTaipei = new Date(year, month, day + 1, 0, 0, 0);
    
    // 转换为UTC时间（台北时间减去8小时）
    const startOfDay = new Date(startOfDayTaipei.getTime() - 8 * 60 * 60 * 1000);
    const endOfDay = new Date(endOfDayTaipei.getTime() - 8 * 60 * 60 * 1000);

    console.log(`查询用户 ${username} 在 ${date} 的记录，时间范围: ${startOfDay.toISOString()} 到 ${endOfDay.toISOString()}`);

    // 获取当日的所有注单记录，包含开奖结果
    const query = `
      SELECT 
        bh.id, 
        bh.period, 
        bh.bet_type, 
        bh.bet_value, 
        bh.position, 
        bh.amount, 
        bh.odds,
        bh.win, 
        bh.win_amount, 
        bh.created_at,
        rh.result as draw_result
      FROM bet_history bh
      LEFT JOIN result_history rh ON bh.period = rh.period
      WHERE bh.username = $1 
        AND bh.settled = true 
        AND bh.created_at >= $2 
        AND bh.created_at < $3
      ORDER BY bh.created_at DESC
    `;

    console.log(`执行查询: ${query}`);
    console.log(`查询参数: [${username}, ${startOfDay.toISOString()}, ${endOfDay.toISOString()}]`);

    // 执行查询
    const result = await db.any(query, [username, startOfDay, endOfDay]);
    console.log(`查询结果: ${result ? result.length : 0} 条记录`);
    
    // 处理查询结果
    const records = result && result.length > 0 ? result.map(row => {
      const drawResult = parseDrawResult(row.draw_result);
      
      return {
        id: row.id,
        period: row.period,
        betType: row.bet_type,
        value: row.bet_value,
        position: row.position,
        amount: parseFloat(row.amount),
        odds: parseFloat(row.odds) || 1.0,
        win: row.win,
        winAmount: parseFloat(row.win_amount) || 0,
        time: row.created_at,
        drawResult: drawResult
      };
    }) : [];
    
    // 计算统计数据
    const stats = {
      betCount: records.length,
      profit: records.reduce((sum, record) => {
        return sum + (record.win ? record.winAmount : 0) - record.amount;
      }, 0)
    };
    
    console.log(`获取用户 ${username} 在 ${date} 的详细记录: ${records.length} 条记录`);

    res.json({
      success: true,
      records,
      stats
    });

  } catch (error) {
    console.error('获取单日详细记录出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取单日详细记录失败',
      records: [],
      stats: { betCount: 0, profit: 0 }
    });
  }
});

// 位置转换函数
function positionToKey(position) {
  const positionMap = {
    1: 'first',
    2: 'second',
    3: 'third',
    4: 'fourth',
    5: 'fifth'
  };
  return positionMap[position] || 'first';
}

// 获取当前游戏数据
app.get('/api/game-data', async (req, res) => {
  try {
    const username = req.query.username;
    let userMarketType = 'D'; // 默认D盘
    
    // 如果提供了用户名，验证会话
    if (username) {
      const sessionToken = req.headers['x-session-token'];
      if (sessionToken) {
        const session = await SessionManager.validateSession(sessionToken);
        if (!session) {
          return res.status(401).json({ success: false, message: '会话已过期' });
        }
      }
      try {
        // 先尝试作为会员查询
        const memberResponse = await fetch(`${AGENT_API_URL}/api/agent/member/info/${username}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (memberResponse.ok) {
          const memberData = await memberResponse.json();
          if (memberData.success && memberData.member) {
            userMarketType = memberData.member.market_type || 'D';
          }
        } else {
          // 如果作为会员查询失败，尝试作为代理查询
          const agentResponse = await fetch(`${AGENT_API_URL}/api/agent/info/${username}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (agentResponse.ok) {
            const agentData = await agentResponse.json();
            if (agentData.success && agentData.agent) {
              userMarketType = agentData.agent.market_type || 'D';
            }
          }
        }
      } catch (error) {
        console.warn('获取用户盘口类型失败:', error);
      }
    }

    // 获取基本游戏数据
    const currentPeriod = memoryGameState.current_period;
    const countdown = memoryGameState.countdown_seconds;
    const lastResult = memoryGameState.last_result || [];
    const gameStatus = memoryGameState.status;
    
    // 在开奖阶段（drawing）时，添加隐藏结算状态标记
    const hideRecentSettlements = gameStatus === 'drawing';
    
    const gameData = {
      currentPeriod: currentPeriod,
      countdownSeconds: countdown,
      lastResult: lastResult,
      status: gameStatus
    };
    
    if (hideRecentSettlements) {
      gameData.hideRecentSettlements = true;
    }

    const odds = generateOdds(userMarketType);
    
    console.log(`API返回游戏数据: 期数=${currentPeriod}, 倒计时=${countdown}, 状态=${gameStatus}, 盘口=${userMarketType}`);
    
    res.json({
      gameData: gameData,
      odds: odds,
      marketType: userMarketType
    });
  } catch (error) {
    console.error('获取游戏数据失败:', error);
    res.status(500).json({ success: false, message: '获取游戏数据失败' });
  }
});

// 备份端点 - 完全相同的逻辑作为备份
app.get('/api/game-data-original', async (req, res) => {
  try {
    // 获取请求参数中的用户名（可选）
    const username = req.query.username;
    let userMarketType = 'D'; // 默认D盘
    
    // 如果提供了用户名，获取用户盘口类型
    if (username) {
      try {
        // 先尝试作为会员查询
        const memberResponse = await fetch(`${AGENT_API_URL}/api/agent/member/info/${username}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (memberResponse.ok) {
          const memberData = await memberResponse.json();
          if (memberData.success && memberData.member) {
            userMarketType = memberData.member.market_type || 'D';
            console.log(`会员 ${username} 盘口类型: ${userMarketType}`);
          } else if (!memberData.success) {
            // 如果会员不存在(success=false)，尝试作为代理查询
            console.log(`会员 ${username} 不存在，尝试作为代理查询...`);
            
            // 代理系统暂时没有代理查询API，直接使用硬编码配置
            if (username === 'ti2025A') {
              userMarketType = 'A';
              console.log(`使用硬编码配置: ${username} 盘口类型: ${userMarketType}`);
            } else {
              console.log(`未知代理 ${username}，使用默认D盘`);
            }
          }
        }
      } catch (error) {
        console.warn('获取用户盘口类型失败，使用默认D盘:', error.message);
        
        // 如果是已知的测试代理，使用硬编码配置
        if (username === 'ti2025A') {
          userMarketType = 'A';
          console.log(`网络错误时使用硬编码配置: ${username} 盘口类型: ${userMarketType}`);
        }
      }
    }
    
    // 优先使用内存状态，确保实时性
    let currentGameState = memoryGameState;
    
    // 如果内存状态不存在，从数据库获取
    if (!currentGameState.current_period) {
      const dbGameState = await GameModel.getCurrentState();
      if (dbGameState) {
        currentGameState = {
          current_period: dbGameState.current_period,
          countdown_seconds: dbGameState.countdown_seconds,
          last_result: dbGameState.last_result,
          status: dbGameState.status
        };
        // 同步到内存
        memoryGameState = currentGameState;
      }
    }
    
    // 解析JSON格式的last_result
    let last_result = parseDrawResult(currentGameState.last_result);
    if (!last_result) {
      last_result = [1,2,3,4,5,6,7,8,9,10]; // 默认值
    }
    
    const gameData = {
      currentPeriod: currentGameState.current_period,
      countdownSeconds: currentGameState.countdown_seconds,
      lastResult: last_result,
      status: currentGameState.status
    };
    
    // 根据用户盘口类型动态生成赔率
    const config = MARKET_CONFIG[userMarketType] || MARKET_CONFIG.D;
    const dynamicOdds = {
      // 冠亚和值赔率 - 使用新的基础赔率表
      sumValue: {
        '3': parseFloat((45.0 * (1 - config.rebatePercentage)).toFixed(3)), 
        '4': parseFloat((23.0 * (1 - config.rebatePercentage)).toFixed(3)), 
        '5': parseFloat((15.0 * (1 - config.rebatePercentage)).toFixed(3)), 
        '6': parseFloat((11.5 * (1 - config.rebatePercentage)).toFixed(3)), 
        '7': parseFloat((9.0 * (1 - config.rebatePercentage)).toFixed(3)), 
        '8': parseFloat((7.5 * (1 - config.rebatePercentage)).toFixed(3)), 
        '9': parseFloat((6.5 * (1 - config.rebatePercentage)).toFixed(3)), 
        '10': parseFloat((5.7 * (1 - config.rebatePercentage)).toFixed(3)), 
        '11': parseFloat((5.7 * (1 - config.rebatePercentage)).toFixed(3)), 
        '12': parseFloat((6.5 * (1 - config.rebatePercentage)).toFixed(3)), 
        '13': parseFloat((7.5 * (1 - config.rebatePercentage)).toFixed(3)), 
        '14': parseFloat((9.0 * (1 - config.rebatePercentage)).toFixed(3)), 
        '15': parseFloat((11.5 * (1 - config.rebatePercentage)).toFixed(3)), 
        '16': parseFloat((15.0 * (1 - config.rebatePercentage)).toFixed(3)), 
        '17': parseFloat((23.0 * (1 - config.rebatePercentage)).toFixed(3)),
        '18': parseFloat((45.0 * (1 - config.rebatePercentage)).toFixed(3)), 
        '19': parseFloat((90.0 * (1 - config.rebatePercentage)).toFixed(3)),
        big: config.twoSideOdds, small: config.twoSideOdds, 
        odd: config.twoSideOdds, even: config.twoSideOdds
      },
      // 单车号码赔率
      number: {
        first: config.numberOdds, second: config.numberOdds, third: config.numberOdds,
        fourth: config.numberOdds, fifth: config.numberOdds, sixth: config.numberOdds,
        seventh: config.numberOdds, eighth: config.numberOdds, ninth: config.numberOdds,
        tenth: config.numberOdds
      },
      // 各位置大小单双赔率
      champion: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
      runnerup: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
      third: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
      fourth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
      fifth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
      sixth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
      seventh: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
      eighth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
      ninth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
      tenth: { big: config.twoSideOdds, small: config.twoSideOdds, odd: config.twoSideOdds, even: config.twoSideOdds },
      // 龙虎赔率
      dragonTiger: {
        dragon: config.dragonTigerOdds,
        tiger: config.dragonTigerOdds
      }
    };
    
    console.log(`API返回游戏数据: 期数=${gameData.currentPeriod}, 倒计时=${gameData.countdownSeconds}, 状态=${gameData.status}, 盘口=${userMarketType}`);
    
    res.json({
      gameData,
      odds: dynamicOdds,
      marketType: userMarketType // 返回盘口类型供前端确认
    });
  } catch (error) {
    console.error('获取游戏数据出错:', error);
    res.status(500).json({ success: false, message: '获取游戏数据失败' });
  }
});

// 获取当前游戏数据 (供API内部使用)
async function getGameData() {
  // 使用内存状态，避免频繁数据库查询
  let last_result = memoryGameState.last_result;
  last_result = parseDrawResult(last_result);
  
  return {
    period: memoryGameState.current_period,
    countdown: memoryGameState.countdown_seconds,
    lastResult: last_result,
    status: memoryGameState.status
  };
}

// 🎯 新增API：获取预先生成的开奖结果
app.get('/api/next-result', (req, res) => {
  try {
    console.log('前端请求预先生成的结果...');
    
    // 检查是否有预先生成的结果
    if (memoryGameState.next_result && Array.isArray(memoryGameState.next_result)) {
      console.log('✅ 返回预先生成的结果');
      res.json({
        success: true,
        hasNextResult: true,
        nextResult: memoryGameState.next_result,
        currentPeriod: memoryGameState.current_period,
        countdown: memoryGameState.countdown_seconds,
        status: memoryGameState.status
      });
    } else {
      console.log('❌ 没有预先生成的结果');
      res.json({
        success: true,
        hasNextResult: false,
        nextResult: null,
        currentPeriod: memoryGameState.current_period,
        countdown: memoryGameState.countdown_seconds,
        status: memoryGameState.status
      });
    }
  } catch (error) {
    console.error('获取预先结果API错误:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取预先结果失败',
      hasNextResult: false,
      nextResult: null
    });
  }
});

// 辅助函数：计算奖金并保留两位小数
function calculateWinningAmount(amount, odds) {
  return Math.round(amount * odds * 100) / 100;
}

// 计算下注奖金
function calculateWinAmount(bet, winResult) {
  try {
    // 比赛尚未结束
    if (!winResult || !Array.isArray(winResult) || winResult.length !== 10) {
      console.error('无效的开奖结果:', winResult);
      return 0;
    }
    
    // 检查投注金额
    const amount = parseFloat(bet.amount);
    if (isNaN(amount) || amount <= 0) {
      console.error('无效的投注金额:', bet.amount);
      return 0;
    }
    
    // 获取赔率
    const betOdds = parseFloat(bet.odds);
    if (isNaN(betOdds) || betOdds <= 0) {
      console.error('无效的赔率:', bet.odds);
      return 0;
    }
    
    // 冠军和亚军的值
    const champion = winResult[0];
    const runnerup = winResult[1];
    const sumValue = champion + runnerup;
    
    switch (bet.bet_type) {
      case 'number':
        // 号码玩法
        const position = parseInt(bet.position) || 1;
        const value = parseInt(bet.bet_value);
        
        // 检查结果
        if (position >= 1 && position <= 10 && value === winResult[position - 1]) {
          return Math.round(amount * betOdds * 100) / 100;
        }
        break;
        
      case 'sumValue':
        // 冠亚和值
        const betValue = bet.bet_value;
        
        if (betValue === 'big' && sumValue > 11) {
          return calculateWinningAmount(amount, betOdds);
        } else if (betValue === 'small' && sumValue <= 11) {
          return calculateWinningAmount(amount, betOdds);
        } else if (betValue === 'odd' && sumValue % 2 === 1) {
          return calculateWinningAmount(amount, betOdds);
        } else if (betValue === 'even' && sumValue % 2 === 0) {
          return calculateWinningAmount(amount, betOdds);
        } else if (parseInt(betValue) === sumValue) {
          return calculateWinningAmount(amount, betOdds);
        }
        break;
        
      case 'champion':
        // 冠军投注
        if (bet.bet_value === 'big' && champion > 5) {
          return calculateWinningAmount(amount, betOdds);
        } else if (bet.bet_value === 'small' && champion <= 5) {
          return calculateWinningAmount(amount, betOdds);
        } else if (bet.bet_value === 'odd' && champion % 2 === 1) {
          return calculateWinningAmount(amount, betOdds);
        } else if (bet.bet_value === 'even' && champion % 2 === 0) {
          return calculateWinningAmount(amount, betOdds);
        } else if (!isNaN(parseInt(bet.bet_value)) && parseInt(bet.bet_value) === champion) {
          // 指定号码投注
          return calculateWinningAmount(amount, betOdds);
        }
        break;
        
      case 'runnerup':
        // 亚军投注
        if (bet.bet_value === 'big' && runnerup > 5) {
          return calculateWinningAmount(amount, betOdds);
        } else if (bet.bet_value === 'small' && runnerup <= 5) {
          return calculateWinningAmount(amount, betOdds);
        } else if (bet.bet_value === 'odd' && runnerup % 2 === 1) {
          return calculateWinningAmount(amount, betOdds);
        } else if (bet.bet_value === 'even' && runnerup % 2 === 0) {
          return calculateWinningAmount(amount, betOdds);
        } else if (!isNaN(parseInt(bet.bet_value)) && parseInt(bet.bet_value) === runnerup) {
          // 指定号码投注
          return calculateWinningAmount(amount, betOdds);
        }
        break;
        
      case 'dragonTiger':
        // 龙虎投注 - 支援传统格式和位置对比格式
        let dragonTigerType, pos1, pos2;
        
        if (bet.bet_value === 'dragon' || bet.bet_value === 'tiger') {
          // 传统格式：默认冠军vs亚军
          dragonTigerType = bet.bet_value;
          pos1 = 0; // 冠军
          pos2 = 1; // 亚军
        } else if (typeof bet.bet_value === 'string' && 
                   (bet.bet_value.startsWith('dragon_') || bet.bet_value.startsWith('tiger_'))) {
          // 复杂格式：dragon_5_6 表示第5名vs第6名
          const parts = bet.bet_value.split('_');
          if (parts.length === 3) {
            dragonTigerType = parts[0];
            pos1 = parseInt(parts[1]) - 1; // 转为0-9索引
            pos2 = parseInt(parts[2]) - 1;
            
            // 验证位置有效性
            if (isNaN(pos1) || isNaN(pos2) || pos1 < 0 || pos1 > 9 || pos2 < 0 || pos2 > 9 || pos1 === pos2) {
              console.warn(`⚠️ 龙虎结算：无效的投注格式: ${bet.bet_value}`);
              break;
            }
          } else {
            console.warn(`⚠️ 龙虎结算：无法解析投注格式: ${bet.bet_value}`);
            break;
          }
        } else {
          console.warn(`⚠️ 龙虎结算：未知的投注格式: ${bet.bet_value}`);
          break;
        }
        
        // 获取对应位置的开奖号码
        const pos1Value = winResult[pos1];
        const pos2Value = winResult[pos2];
        
        console.log(`🐉🐅 龙虎结算检查: ${bet.bet_value}, 第${pos1+1}名=${pos1Value}, 第${pos2+1}名=${pos2Value}`);
        
        // 判断龙虎结果
        if (dragonTigerType === 'dragon' && pos1Value > pos2Value) {
          console.log(`✅ 龙虎中奖: 龙胜 (${pos1Value} > ${pos2Value})`);
          return calculateWinningAmount(amount, betOdds);
        } else if (dragonTigerType === 'tiger' && pos1Value < pos2Value) {
          console.log(`✅ 龙虎中奖: 虎胜 (${pos1Value} < ${pos2Value})`);
          return calculateWinningAmount(amount, betOdds);
        } else {
          console.log(`❌ 龙虎未中奖: 投注${dragonTigerType}, 实际${pos1Value > pos2Value ? '龙' : pos1Value < pos2Value ? '虎' : '和'}胜`);
        }
        break;
        
      case 'position':
        // 快速投注 - 位置投注
        const position_num = parseInt(bet.position) || 1;
        if (position_num >= 1 && position_num <= 10) {
          const ballValue = winResult[position_num - 1];
          
          if (bet.bet_value === 'big' && ballValue > 5) {
            return calculateWinningAmount(amount, betOdds);
          } else if (bet.bet_value === 'small' && ballValue <= 5) {
            return calculateWinningAmount(amount, betOdds);
          } else if (bet.bet_value === 'odd' && ballValue % 2 === 1) {
            return calculateWinningAmount(amount, betOdds);
          } else if (bet.bet_value === 'even' && ballValue % 2 === 0) {
            return calculateWinningAmount(amount, betOdds);
          }
        }
        break;
        
      default:
        // 其他位置的大小单双
        const posMap = {
          'third': 2, 'fourth': 3, 'fifth': 4, 
          'sixth': 5, 'seventh': 6, 'eighth': 7, 
          'ninth': 8, 'tenth': 9
        };
        
        if (posMap[bet.bet_type]) {
          const pos = posMap[bet.bet_type];
          const ballValue = winResult[pos];
          
          if (bet.bet_value === 'big' && ballValue > 5) {
            return calculateWinningAmount(amount, betOdds);
          } else if (bet.bet_value === 'small' && ballValue <= 5) {
            return calculateWinningAmount(amount, betOdds);
          } else if (bet.bet_value === 'odd' && ballValue % 2 === 1) {
            return calculateWinningAmount(amount, betOdds);
          } else if (bet.bet_value === 'even' && ballValue % 2 === 0) {
            return calculateWinningAmount(amount, betOdds);
          } else if (!isNaN(parseInt(bet.bet_value)) && parseInt(bet.bet_value) === ballValue) {
            // 指定号码投注
            return calculateWinningAmount(amount, betOdds);
          }
        }
        break;
    }
    
    // 未中奖
    return 0;
  } catch (error) {
    console.error('计算奖金时出错:', error);
    return 0;
  }
}

// 获取最近开奖结果（简化版本） - 已被下面的优化版本取代
/*
app.get('/api/recent-results', async (req, res) => {
  try {
    // 获取最近100期开奖记录，确保包含当天所有记录
    const query = `
      SELECT 
        period, 
        result, 
        created_at,
        created_at as time
      FROM result_history 
      WHERE result IS NOT NULL 
      ORDER BY period DESC 
      LIMIT 100
    `;
    
    const results = await db.any(query);
    
    // 格式化结果
    const formattedResults = results.map(row => ({
      period: row.period,
      result: parseDrawResult(row.result),
      time: row.time,
      created_at: row.created_at
    }));
    
    res.json({
      success: true,
      data: formattedResults,
      count: formattedResults.length
    });
    
  } catch (error) {
    console.error('获取近期开奖记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取开奖记录失败'
    });
  }
});
*/

// 获取历史开奖结果
app.get('/api/history', async (req, res) => {
  try {
    console.log('收到开奖历史查询请求:', req.query);
    
    const { page = 1, limit = 20, period = '', date = '' } = req.query;
    const pageNumber = parseInt(page);
    // 当有日期筛选时，返回所有记录（最多500笔）
    const pageSize = date ? 500 : parseInt(limit);
    
    // 构建查询条件
    let whereClause = '';
    let params = [];
    let conditions = [];
    
    // 期数筛选
    if (period) {
      conditions.push('period::text LIKE $' + (params.length + 1));
      params.push(`%${period}%`);
    }
    
    // 日期筛选 - 基于期号中的日期而非创建时间
    if (date) {
      const dateStr = date.replace(/-/g, '');
      conditions.push('period::text LIKE $' + (params.length + 1));
      params.push(`${dateStr}%`);
    }
    
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    console.log('查询条件:', { whereClause, params });
    
    try {
      // 添加基本过滤条件 - 只过滤掉测试数据（序号大于300的）
      let baseConditions = `result IS NOT NULL AND position_1 IS NOT NULL AND CAST(SUBSTRING(period::text FROM 9) AS INTEGER) < 300`;
      
      // 如果是查询今天的数据，才需要过滤未来期号
      let fullWhereClause;
      if (date === new Date().toISOString().split('T')[0]) {
        const currentGameState = await db.oneOrNone('SELECT current_period FROM game_state ORDER BY id DESC LIMIT 1');
        const currentPeriod = currentGameState?.current_period || 99999999999;
        baseConditions = `${baseConditions} AND period < ${currentPeriod}`;
      }
      
      fullWhereClause = whereClause 
        ? `WHERE ${baseConditions} AND ${whereClause.replace('WHERE ', '')}`
        : `WHERE ${baseConditions}`;
      
      // 计算总记录数
      const countQuery = `SELECT COUNT(*) as total FROM result_history ${fullWhereClause}`;
      console.log('执行计数查询:', countQuery);
      const countResult = await db.one(countQuery, params);
      const totalRecords = parseInt(countResult.total);
      const totalPages = Math.ceil(totalRecords / pageSize);
      
      // 获取分页数据
      const offset = (pageNumber - 1) * pageSize;
      const query = `
        SELECT period, result, created_at, draw_time,
               position_1, position_2, position_3, position_4, position_5,
               position_6, position_7, position_8, position_9, position_10
        FROM result_history 
        ${fullWhereClause} 
        ORDER BY created_at DESC 
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      console.log('执行查询:', query);
      const results = await db.any(query, params);
    
    // 转换格式使其与前端相容
    const formattedResults = results.map(record => {
      // 使用位置栏位来建立正确的结果阵列
      const positionArray = [];
      for (let i = 1; i <= 10; i++) {
        positionArray.push(record[`position_${i}`]);
      }
      
      return {
        period: record.period,
        result: positionArray, // 使用正确的位置顺序
        time: record.draw_time || record.created_at  // 优先使用 draw_time，如果不存在则使用 created_at
      };
    });
    
      res.json({
        success: true,
        records: formattedResults,
        totalPages,
        currentPage: pageNumber,
        totalRecords
      });
    } catch (dbError) {
      console.error('资料库查询错误:', dbError);
      throw new Error(`资料库查询错误: ${dbError.message}`);
    }
  } catch (error) {
    console.error('获取历史开奖结果出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取历史开奖结果失败',
      error: error.message
    });
  }
});

// 获取最近10期开奖结果 (使用优化的 recent_draws 表)
app.get('/api/recent-results', async (req, res) => {
  try {
    console.log('获取最近10期开奖结果');
    
    // 从优化的视图中获取数据
    const results = await db.manyOrNone(`
      SELECT 
        period,
        result,
        position_1, position_2, position_3, position_4, position_5,
        position_6, position_7, position_8, position_9, position_10,
        draw_time,
        formatted_time
      FROM v_api_recent_draws
      ORDER BY period DESC
    `);
    
    // 转换格式与前端相容
    const formattedResults = results.map(record => ({
      period: record.period,
      result: record.result,
      positions: [
        record.position_1,
        record.position_2,
        record.position_3,
        record.position_4,
        record.position_5,
        record.position_6,
        record.position_7,
        record.position_8,
        record.position_9,
        record.position_10
      ],
      time: record.draw_time,
      formattedTime: record.formatted_time
    }));
    
    res.json({
      success: true,
      data: formattedResults,
      count: formattedResults.length
    });
    
  } catch (error) {
    console.error('获取最近开奖结果失败:', error);
    res.status(500).json({
      success: false,
      message: '获取最近开奖结果失败',
      error: error.message
    });
  }
});

// 获取指定期号的下注记录API (用于限红检查)
app.get('/api/period-bets', async (req, res) => {
  try {
    const { username, period } = req.query;
    
    if (!username || !period) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：username 和 period'
      });
    }
    
    const bets = await db.manyOrNone(`
      SELECT bet_type, bet_value, amount, position
      FROM bet_history 
      WHERE username = $1 AND period = $2 AND settled = false
    `, [username, period]);
    
    res.json({
      success: true,
      bets: bets || []
    });
    
  } catch (error) {
    console.error('获取期号下注记录失败:', error);
    res.status(500).json({
      success: false,
      message: '获取期号下注记录失败',
      error: error.message
    });
  }
});

// 获取下注记录API
app.get('/api/bet-history', async (req, res) => {
  try {
    console.log('收到下注记录查询请求:', req.query);
    
    const { username, page = 1, limit = 9999, period = '', date = '' } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '未提供用户名'
      });
    }
    
    // 构建查询条件
    let whereClause = 'WHERE username = $1';
    let params = [username];
    
    // 期数筛选
    if (period) {
      whereClause += ' AND period::text LIKE $' + (params.length + 1);
      params.push(`%${period}%`);
    }
    
    // 日期筛选
    if (date) {
      whereClause += ' AND DATE(created_at) = $' + (params.length + 1);
      params.push(date);
    }
    
    console.log('查询条件:', { whereClause, params });
    
    try {
      // 计算总记录数
      const countQuery = `SELECT COUNT(*) as total FROM bet_history bh ${whereClause.replace('WHERE', 'WHERE bh.').replace('DATE(created_at)', 'DATE(bh.created_at)')}`;
      console.log('执行计数查询:', countQuery);
      const countResult = await db.one(countQuery, params);
      const totalRecords = parseInt(countResult.total);
      const totalPages = Math.ceil(totalRecords / pageSize);
      
      // 获取分页数据
      const offset = (pageNumber - 1) * pageSize;
      const query = `
        SELECT 
          bh.id, 
          bh.username, 
          bh.amount, 
          bh.bet_type as "betType", 
          bh.bet_value as "value", 
          bh.position, 
          bh.period, 
          bh.odds,
          bh.created_at as "time", 
          bh.win, 
          bh.win_amount as "winAmount", 
          bh.settled,
          rh.result as draw_result
        FROM bet_history bh
        LEFT JOIN result_history rh ON bh.period = rh.period
        ${whereClause.replace('WHERE', 'WHERE bh.').replace('DATE(created_at)', 'DATE(bh.created_at)')} 
        ORDER BY bh.created_at DESC 
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      console.log('执行查询:', query);
      const results = await db.any(query, params);
      
      // 格式化结果，确保前端可以直接使用
      const formattedResults = results.map(bet => {
        // 解析开奖结果
        const drawResult = parseDrawResult(bet.draw_result);
        
        return {
          id: bet.id,
          username: bet.username,
          amount: bet.amount,
          betType: bet.betType,
          value: bet.value,
          position: bet.position,
          period: bet.period,
          odds: parseFloat(bet.odds) || 1.0,
          time: bet.time,
          win: bet.win,
          winAmount: bet.winAmount,
          settled: bet.settled,
          drawResult: drawResult
        };
      });
      
      res.json({
        success: true,
        records: formattedResults,
        totalPages,
        currentPage: pageNumber,
        totalRecords
      });
    } catch (dbError) {
      console.error('资料库查询错误:', dbError);
      throw new Error(`资料库查询错误: ${dbError.message}`);
    }
  } catch (error) {
    console.error('获取下注记录出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取下注记录失败',
      error: error.message,
      records: [] // 确保即使错误也返回空数组
    });
  }
});

// 旧的登入端点已移除，统一使用 /api/member/login

// 更新下注处理逻辑
app.post('/api/bet', async (req, res) => {
  try {
    // 检查是否在维修时间
    if (isMaintenanceTime()) {
      console.log('下注失败: 系统维修中');
      return res.status(503).json({ 
        success: false, 
        message: '系统维护中（每日6:00-7:00），请稍后再试' 
      });
    }
    
    // 检查游戏状态
    const gameState = memoryGameState;
    if (gameState.status === 'maintenance' || gameState.status === 'waiting') {
      console.log('下注失败: 系统不在投注状态');
      return res.status(503).json({ 
        success: false, 
        message: gameState.status === 'maintenance' ? '系统维护中' : '等待下一期开始' 
      });
    }
    
    // 验证必要参数
    const { username, amount, betType, value, position } = req.body;
    
    console.log(`收到下注请求: 用户=${username}, 金额=${amount}, 类型=${betType}, 值=${value}, 位置=${position || 'N/A'}`);
    
    if (!username || !amount || !betType || !value) {
      console.error('下注失败: 请提供完整的下注信息');
      return res.status(400).json({ success: false, message: '请提供完整的下注信息' });
    }
    
    // 检查参数有效性
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      console.error('下注失败: 无效的下注金额');
      return res.status(400).json({ success: false, message: '无效的下注金额' });
    }
    
    // 检查最低投注金额限制（防止小额套利）
    const MIN_BET_AMOUNT = 1;
    if (amountNum < MIN_BET_AMOUNT) {
              console.error(`下注失败: 投注金额不能少于 ${MIN_BET_AMOUNT} 元`);
        return res.status(400).json({ success: false, message: `投注金额不能少于 ${MIN_BET_AMOUNT} 元` });
    }
    
    // 检查下注类型和选项的有效性
    if (!isValidBet(betType, value, position)) {
      console.error(`下注失败: 无效的下注选项 ${betType}=${value}`);
      return res.status(400).json({ success: false, message: '无效的下注选项' });
    }
    
    // 获取当前游戏状态（使用不同的变数名避免冲突）
    const currentGameData = await getGameData();
    const { period, status } = currentGameData;
    
    // 检查游戏状态
    if (status !== 'betting') {
      console.error('下注失败: 当前不是下注阶段');
      return res.status(400).json({ success: false, message: '当前不是下注阶段' });
    }
    
    // 获取赔率（暂时使用默认D盘，会在会员信息检查后更新）
    let odds = getOdds(betType, value, 'D');
    console.log(`初始下注赔率: ${odds}`);
    
    try {
      // 获取总代理ID
      const adminAgent = await getAdminAgentId();
      if (!adminAgent) {
        console.error('下注失败: 找不到总代理帐户');
        return res.status(500).json({ success: false, message: '系统错误：找不到总代理帐户' });
      }
      
      console.log(`使用总代理 ID: ${adminAgent.id}, 用户名: ${adminAgent.username}`);
      
      // 首先检查会员状态和盘口信息
      let memberMarketType = 'D'; // 默认D盘
      try {
        console.log(`检查会员 ${username} 状态和盘口信息`);
        
        // 调用代理系统API检查会员状态
        const memberResponse = await fetch(`${AGENT_API_URL}/api/agent/member/info/${username}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (memberResponse.ok) {
          const memberData = await memberResponse.json();
          
          if (memberData.success && memberData.member) {
            // 检查会员状态：0=停用, 1=启用, 2=冻结
            if (memberData.member.status === 0) {
              console.error(`会员 ${username} 已被停用`);
              return res.status(400).json({ success: false, message: '帐号已被停用，请联系客服' });
            } else if (memberData.member.status === 2) {
              console.error(`会员 ${username} 已被冻结`);
              return res.status(400).json({ success: false, message: '帐号已被冻结，只能观看游戏无法下注' });
            }
            
            // 获取会员盘口类型
            memberMarketType = memberData.member.market_type || 'D';
            console.log(`会员 ${username} 盘口类型: ${memberMarketType}`);
          }
        }
      } catch (statusError) {
        console.warn('检查会员状态失败，继续使用原有逻辑:', statusError.message);
      }
      
      // 获取用户当前期投注记录，用于限红检查
      let userCurrentBets = [];
      try {
        const existingBets = await BetModel.findByUserAndPeriod(username, period);
        userCurrentBets = existingBets || [];
      } catch (betError) {
        console.warn('获取用户当期投注记录失败:', betError.message);
      }
      
             // 限红验证
       const limitCheck = await validateBetLimits(betType, value, amountNum, userCurrentBets, username, position);
       if (!limitCheck.valid) {
         console.error(`限红验证失败: ${limitCheck.message}`);
         return res.status(400).json({ success: false, message: limitCheck.message });
       }
       
       // 根据会员盘口类型重新计算赔率
       odds = getOdds(betType, value, memberMarketType);
       console.log(`根据盘口 ${memberMarketType} 调整后赔率: ${odds}`);

      // 使用代理系统检查和扣除会员余额
      let updatedBalance;
      try {
        console.log(`尝试从代理系统扣除会员 ${username} 余额 ${amountNum} 元`);
        
        // 调用代理系统API扣除余额
        const deductResponse = await fetch(`${AGENT_API_URL}/api/agent/deduct-member-balance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: username,
            amount: amountNum,
            reason: '游戏下注'
          })
        });
        
        const deductData = await deductResponse.json();
        
        if (!deductData.success) {
          console.error(`代理系统扣除余额失败: ${deductData.message}`);
          return res.status(400).json({ success: false, message: deductData.message || '余额不足' });
        }
        
        updatedBalance = deductData.balance;
        console.log(`用户 ${username} 下注 ${amountNum} 元后余额: ${updatedBalance}`);
        
        // 同步余额到本地users表（保持兼容性）
        try {
          await UserModel.createOrUpdate({ username: username, balance: updatedBalance });
        } catch (syncError) {
          console.warn('同步余额到本地users表失败:', syncError);
        }
        
      } catch (balanceError) {
        console.error(`下注失败: ${balanceError.message}`);
        return res.status(400).json({ success: false, message: '余额检查失败，请稍后再试' });
      }
      
      // 余额已由代理系统处理，无需重复同步
      
      // 准备下注数据
      // 处理 position 转换
      let positionValue = null;
      if (position) {
        // 如果 position 是字串（如 "champion"），转换为对应的数字
        const positionMap = {
          'champion': 1,
          'runnerup': 2,
          'third': 3,
          'fourth': 4,
          'fifth': 5,
          'sixth': 6,
          'seventh': 7,
          'eighth': 8,
          'ninth': 9,
          'tenth': 10
        };
        
        if (typeof position === 'string' && positionMap[position]) {
          positionValue = positionMap[position];
        } else if (!isNaN(parseInt(position))) {
          positionValue = parseInt(position);
        }
      }
      
      const betData = {
        username: username,
        amount: amountNum,
        bet_type: betType,  // 注意: 这里使用 bet_type 而不是 betType
        bet_value: value,   // 注意: 这里使用 bet_value 而不是 value
        position: positionValue,
        period: period,
        odds: odds
      };
      
      console.log('准备创建下注记录:', JSON.stringify(betData));
      
      // 尝试创建下注记录
      let betResult;
      try {
        // 使用BetModel创建下注记录
        betResult = await BetModel.create(betData);
        console.log(`创建了一个新的下注记录: ID=${betResult.id}`);
      } catch (dbError) {
        console.error('创建下注记录失败:', dbError);
        // 如果记录创建失败，返还用户余额
        await UserModel.addBalance(username, amountNum);
        return res.status(500).json({ success: false, message: `创建下注记录失败: ${dbError.message}` });
      }
      
      // 移除立即退水分配 - 退水将在结算阶段处理
      console.log(`用户 ${username} 下注 ${amountNum} 元成功，退水将在结算后分配`);
      
      console.log(`用户 ${username} 下注 ${amountNum} 元，类型：${betType}，值：${value}，位置：${position || 'N/A'}`);
      console.log(`用户 ${username} 下注 ${amountNum} 元后余额更新为: ${updatedBalance}`);
      
      // 直接使用代理系统返回的余额，避免重新查询导致竞态条件
      return res.json({ 
        success: true, 
        message: '下注成功', 
        betId: betResult.id, 
        balance: updatedBalance.toString() 
      });
    } catch (innerError) {
      console.error('下注处理过程中发生错误:', innerError);
      return res.status(500).json({ success: false, message: `系统错误: ${innerError.message}` });
    }
    
  } catch (error) {
    console.error('下注处理过程中发生错误:', error);
    return res.status(500).json({ success: false, message: `系统错误: ${error.message}` });
  }
});

// 批量下注处理端点（优化版）
app.post('/api/batch-bet', async (req, res) => {
  try {
    const { username, bets } = req.body;
    
    console.log(`收到批量下注请求: 用户=${username}, 注数=${bets ? bets.length : 0}`);
    
    // 验证参数
    if (!username || !Array.isArray(bets) || bets.length === 0) {
      return res.status(400).json({ success: false, message: '请提供用户名和下注列表' });
    }
    
    // 限制单次批量下注数量
    const MAX_BATCH_SIZE = 100;
    if (bets.length > MAX_BATCH_SIZE) {
      return res.status(400).json({ success: false, message: `单次最多只能下注 ${MAX_BATCH_SIZE} 笔` });
    }
    
    // 获取当前游戏状态（使用不同的变数名避免冲突）
    const currentGameData = await getGameData();
    const { period, status } = currentGameData;
    
    // 检查游戏状态
    if (status !== 'betting') {
      console.error('批量下注失败: 当前不是下注阶段');
      return res.status(400).json({ success: false, message: '当前不是下注阶段' });
    }
    
    // 使用优化的批量投注系统
    const result = await optimizedBatchBet(username, bets, period, AGENT_API_URL);
    
    if (result.success) {
      console.log(`✅ 批量投注成功: ${result.betIds.length}笔, 耗时: ${result.executionTime}ms`);
    }
    
    return res.json(result);
  } catch (error) {
    console.error('批量下注处理失败:', error);
    return res.status(500).json({ 
      success: false, 
      message: `系统错误: ${error.message}` 
    });
  }
});

// 验证下注是否有效
function isValidBet(betType, value, position) {
  // 检查下注类型
  const validBetTypes = [
    'sumValue', 'champion', 'runnerup', 'third', 'fourth', 'fifth', 
    'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'dragonTiger', 'number', 'position'
  ];
  
  if (!validBetTypes.includes(betType)) {
    return false;
  }
  
  // 检查数值
  if (betType === 'number') {
    // 对於单号投注，需要检查数字和位置
    if (!position || position < 1 || position > 10) {
      return false;
    }
    
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 1 || numValue > 10) {
      return false;
    }
    
    return true;
  } else if (betType === 'sumValue') {
    // 对于冠亚和值，检查是否为有效的和值或大小单双
    const validValues = ['big', 'small', 'odd', 'even', '3', '4', '5', '6', '7', 
                          '8', '9', '10', '11', '12', '13', '14', '15', '16', 
                          '17', '18', '19'];
    return validValues.includes(value.toString());
  } else if (betType === 'dragonTiger') {
    // 龙虎投注，支持简单格式（dragon, tiger）和复杂格式（dragon_1_10, tiger_2_9等）
    if (value === 'dragon' || value === 'tiger') {
      return true;
    }
    
    // 检查复杂格式：dragon_pos1_pos2 或 tiger_pos1_pos2
    if (typeof value === 'string' && (value.startsWith('dragon_') || value.startsWith('tiger_'))) {
      const parts = value.split('_');
      if (parts.length === 3) {
        const pos1 = parseInt(parts[1]);
        const pos2 = parseInt(parts[2]);
        // 位置必须在1-10之间且不相等
        return !isNaN(pos1) && !isNaN(pos2) && 
               pos1 >= 1 && pos1 <= 10 && 
               pos2 >= 1 && pos2 <= 10 && 
               pos1 !== pos2;
      }
    }
    
    return false;
  } else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
    // 位置投注：支援大小单双 AND 指定号码(1-10)
    const validPropertyValues = ['big', 'small', 'odd', 'even'];
    if (validPropertyValues.includes(value)) {
      return true; // 大小单双投注
    }
    
    // 检查是否为有效的号码投注(1-10)
    const numValue = parseInt(value);
    return !isNaN(numValue) && numValue >= 1 && numValue <= 10;
  } else if (betType === 'position') {
    // 快速投注：位置投注，支援大小单双属性
    const validPropertyValues = ['big', 'small', 'odd', 'even'];
    if (validPropertyValues.includes(value)) {
      // 检查位置是否有效(1-10)
      return position && !isNaN(parseInt(position)) && parseInt(position) >= 1 && parseInt(position) <= 10;
    }
    return false;
  }
  
  return false;
}

// 重复的createBet函数已移除，统一使用BetModel.create

// 新增: 获取总代理ID的函数
async function getAdminAgentId() {
  try {
    // 从代理系统获取总代理ID
    const response = await fetch(`${AGENT_API_URL}/api/agent/admin-agent`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      return { id: data.agent.id, username: data.agent.username };
    } else {
      console.error('获取总代理ID失败:', data.message);
      // 返回本地默认总代理
      console.log('使用本地默认总代理ID');
      return { id: 1, username: 'admin' };
    }
  } catch (error) {
    console.error('获取总代理ID出错:', error);
    // 出错时也返回本地默认总代理
    console.log('连接代理系统失败，使用本地默认总代理ID');
    return { id: 1, username: 'admin' };
  }
}

// 初始化数据库并启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    
    // 确保数据库约束正确设置
    await ensureDatabaseConstraints();
    
    // 初始化结算相关表
    console.log('🔧 初始化结算系统表...');
    await createSettlementTables();
    
    // 初始化会话管理系统
    await SessionManager.initialize();
    
    console.log('开始初始化热门投注数据...');
    // 更新热门投注数据
    try {
      await updateHotBets();
      console.log('热门投注数据初始化成功');
    } catch (hotBetsError) {
      console.error('初始化热门投注数据时出错:', hotBetsError);
    }
    
    // 设置定时更新热门投注（每10分钟）
    hotBetsInterval = setInterval(async () => {
      try {
        console.log('定时更新热门投注数据...');
        await updateHotBets();
      } catch (error) {
        console.error('定时更新热门投注数据时出错:', error);
      }
    }, 10 * 60 * 1000);
    
    // 错误处理中间件 - 必须放在所有路由之后
    app.use((err, req, res, next) => {
      if (err.status === 416 || err.message === 'Range Not Satisfiable') {
        console.log('处理 Range Not Satisfiable 错误:', req.url);
        // 返回200状态，让浏览器重新请求完整文件
        res.status(200).sendFile(path.join(__dirname, 'frontend', req.path));
      } else {
        console.error('伺服器错误:', err);
        res.status(err.status || 500).json({
          success: false,
          message: err.message || '伺服器内部错误'
        });
      }
    });
    
    // 创建 HTTP 服务器
    const server = createServer(app);
    
    // 初始化 WebSocket
    wsManager.initialize(server);
    
    // 启动服务器
    server.listen(port, () => {
      console.log(`FS金彩赛车游戏服务运行在端口 ${port}`);
      console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
      console.log(`API Base URL: ${AGENT_API_URL}`);
      console.log('WebSocket 服务已启动');
      
      // 确认API端点可用
      console.log('已注册 API 端点: /api/hot-bets');
      console.log('已注册 API 端点: /api/batch-bet');
      
      // 启动游戏循环
      startGameCycle();
    });
  } catch (error) {
    console.error('启动服务器时出错:', error);
  }
}

// 启动服务器
startServer();

// 限红验证函数 - 支援动态限红配置
async function validateBetLimits(betType, value, amount, userBets = [], username = null, position = null) {
  let limits;
  
  // 如果提供了用户名，尝试从代理系统获取会员的限红设定
  if (username) {
    try {
      const response = await fetch(`${AGENT_API_URL}/api/agent/member-betting-limit-by-username?username=${username}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.config) {
          const userConfig = data.config;
          
          // 根据投注类型确定限红配置
          if (betType === 'dragonTiger') {
            limits = userConfig.dragonTiger;
          } else if (betType === 'sumValue') {
            if (['big', 'small'].includes(value)) {
              limits = userConfig.sumValueSize;
            } else if (['odd', 'even'].includes(value)) {
              limits = userConfig.sumValueOddEven;
            } else {
              limits = userConfig.sumValue;
            }
          } else if (betType === 'number' || (
            ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType) && 
            !['big', 'small', 'odd', 'even'].includes(value)
          )) {
            limits = userConfig.number;
          } else if (
            ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'position'].includes(betType) && 
            ['big', 'small', 'odd', 'even'].includes(value)
          ) {
            limits = userConfig.twoSide;
          } else {
            limits = userConfig.twoSide;
          }
        }
      }
    } catch (error) {
      console.warn('获取会员限红设定失败，使用预设限红:', error);
    }
  }
  
  // 如果没有获取到用户限红设定，使用预设配置
  if (!limits) {
    // 根据投注类型确定预设限红配置
    if (betType === 'dragonTiger') {
      // 龙虎投注 - 5000/5000
      limits = BET_LIMITS.dragonTiger;
    } else if (betType === 'sumValue') {
      // 冠亚军和值投注
      if (['big', 'small'].includes(value)) {
        // 冠亚军和大小 - 5000/5000
        limits = BET_LIMITS.sumValueSize;
      } else if (['odd', 'even'].includes(value)) {
        // 冠亚军和单双 - 5000/5000
        limits = BET_LIMITS.sumValueOddEven;
      } else {
        // 冠亚军和值 - 1000/2000
        limits = BET_LIMITS.sumValue;
      }
    } else if (betType === 'number' || (
      ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType) && 
      !['big', 'small', 'odd', 'even'].includes(value)
    )) {
      // 1-10车号投注 - 2500/5000
      limits = BET_LIMITS.number;
    } else if (
      ['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'position'].includes(betType) && 
      ['big', 'small', 'odd', 'even'].includes(value)
    ) {
      // 两面投注（大小单双）- 5000/5000
      limits = BET_LIMITS.twoSide;
    } else {
      // 其他情况使用两面限额
      limits = BET_LIMITS.twoSide;
    }
  }
  
  // 检查单注限额
  if (amount < limits.minBet) {
    return {
      valid: false,
      message: `单注金额不能低于 ${limits.minBet} 元`
    };
  }
  
  if (amount > limits.maxBet) {
    return {
      valid: false,
      message: `单注金额不能超过 ${limits.maxBet} 元`
    };
  }
  
  // 检查单期限额（按每个具体下注选项计算，而非类型总和）
  console.log(`[限红检查] 开始检查: ${betType} ${value} ${amount}元, position=${position}`);
  console.log(`[限红检查] 当前用户已有 ${userBets.length} 笔投注`);
  
  const sameOptionBets = userBets.filter(bet => {
    // 确保 bet 物件存在
    if (!bet) return false;
    
    // 处理可能的栏位名称差异（betType 或 bet_type）
    const betTypeField = bet.betType || bet.bet_type;
    const betValueField = bet.value || bet.bet_value;
    const betPositionField = bet.position;
    
    // 号码投注：检查相同位置和号码
    if (betType === 'number') {
      return betTypeField === 'number' && 
             betPositionField === position && 
             betValueField === value;
    }
    
    // 位置大小单双：检查相同位置和选项
    if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType) &&
        ['big', 'small', 'odd', 'even', '大', '小', '单', '双'].includes(value)) {
      return betTypeField === betType && betValueField === value;
    }
    
    // 位置号码：检查相同位置和号码
    if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType) &&
        !['big', 'small', 'odd', 'even', '大', '小', '单', '双'].includes(value)) {
      return betTypeField === betType && betValueField === value;
    }
    
    // 龙虎：检查相同的龙虎对战选项
    if (betType === 'dragonTiger') {
      return betTypeField === 'dragonTiger' && betValueField === value;
    }
    
    // 冠亚和值：检查相同的和值选项
    if (betType === 'sumValue') {
      return betTypeField === 'sumValue' && betValueField === value;
    }
    
    // 其他情况：完全匹配
    return betTypeField === betType && betValueField === value && betPositionField === position;
  });
  
  const currentOptionAmount = sameOptionBets.reduce((sum, bet) => sum + bet.amount, 0);
  
  console.log(`[限红检查] 相同选项的投注: ${sameOptionBets.length} 笔，累计金额: ${currentOptionAmount}`);
  console.log(`[限红检查] 限额配置: 单注最高${limits.maxBet}，单期限额${limits.periodLimit}`);
  
  if (currentOptionAmount + amount > limits.periodLimit) {
    console.log(`[限红检查] ❌ 超过单期限额！ ${currentOptionAmount} + ${amount} > ${limits.periodLimit}`);
    return {
      valid: false,
      message: `该选项单期限额为 ${limits.periodLimit} 元，已投注 ${currentOptionAmount} 元，无法再投注 ${amount} 元`
    };
  }
  
  return { valid: true };
}

// 会员限红设定API
app.get('/api/member-betting-limits', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ success: false, message: '缺少会员用户名' });
    }
    
    // 从代理系统获取会员限红设定
    const response = await fetch(`${AGENT_API_URL}/api/agent/member-betting-limit-by-username?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.config) {
        return res.json({
          success: true,
          config: data.config,
          levelName: data.levelName,
          levelDisplayName: data.levelDisplayName
        });
      }
    }
    
    // 如果无法获取会员限红设定，返回预设配置
    const defaultConfig = {
      number: { maxBet: 2500, periodLimit: 5000 },
      twoSide: { maxBet: 5000, periodLimit: 5000 },
      sumValueSize: { maxBet: 5000, periodLimit: 5000 },
      sumValueOddEven: { maxBet: 5000, periodLimit: 5000 },
      sumValue: { maxBet: 1000, periodLimit: 2000 },
      dragonTiger: { maxBet: 5000, periodLimit: 5000 }
    };
    
    res.json({
      success: true,
      config: defaultConfig,
      levelName: 'level1',
      levelDisplayName: '标准限红'
    });
    
  } catch (error) {
    console.error('获取会员限红设定错误:', error);
    
    // 错误时返回预设配置
    const defaultConfig = {
      number: { maxBet: 2500, periodLimit: 5000 },
      twoSide: { maxBet: 5000, periodLimit: 5000 },
      sumValueSize: { maxBet: 5000, periodLimit: 5000 },
      sumValueOddEven: { maxBet: 5000, periodLimit: 5000 },
      sumValue: { maxBet: 1000, periodLimit: 2000 },
      dragonTiger: { maxBet: 5000, periodLimit: 5000 }
    };
    
    res.json({
      success: true,
      config: defaultConfig,
      levelName: 'level1',
      levelDisplayName: '标准限红'
    });
  }
});

// 获取下注赔率函数 - 支持盘口系统
function getOdds(betType, value, marketType = 'D') {
  try {
    // 根据盘口类型获取配置
    const config = MARKET_CONFIG[marketType] || MARKET_CONFIG.D;
    const rebatePercentage = config.rebatePercentage;
    
    // 冠亚和值赔率
    if (betType === 'sumValue') {
      if (value === 'big' || value === 'small' || value === 'odd' || value === 'even' || 
          value === '大' || value === '小' || value === '单' || value === '双') {
        return config.twoSideOdds;  // 使用盘口配置的两面赔率
      } else {
        // 和值赔率表 - 使用新的基础赔率表
        const sumOdds = {
          '3': parseFloat((45.0 * (1 - rebatePercentage)).toFixed(3)), 
          '4': parseFloat((23.0 * (1 - rebatePercentage)).toFixed(3)), 
          '5': parseFloat((15.0 * (1 - rebatePercentage)).toFixed(3)), 
          '6': parseFloat((11.5 * (1 - rebatePercentage)).toFixed(3)), 
          '7': parseFloat((9.0 * (1 - rebatePercentage)).toFixed(3)), 
          '8': parseFloat((7.5 * (1 - rebatePercentage)).toFixed(3)), 
          '9': parseFloat((6.5 * (1 - rebatePercentage)).toFixed(3)), 
          '10': parseFloat((5.7 * (1 - rebatePercentage)).toFixed(3)), 
          '11': parseFloat((5.7 * (1 - rebatePercentage)).toFixed(3)), 
          '12': parseFloat((6.5 * (1 - rebatePercentage)).toFixed(3)), 
          '13': parseFloat((7.5 * (1 - rebatePercentage)).toFixed(3)), 
          '14': parseFloat((9.0 * (1 - rebatePercentage)).toFixed(3)), 
          '15': parseFloat((11.5 * (1 - rebatePercentage)).toFixed(3)), 
          '16': parseFloat((15.0 * (1 - rebatePercentage)).toFixed(3)), 
          '17': parseFloat((23.0 * (1 - rebatePercentage)).toFixed(3)),
          '18': parseFloat((45.0 * (1 - rebatePercentage)).toFixed(3)), 
          '19': parseFloat((90.0 * (1 - rebatePercentage)).toFixed(3))
        };
        return sumOdds[value] || 1.0;
      }
    } 
    // 单号投注
    else if (betType === 'number') {
      return config.numberOdds;  // 使用盘口配置的单号赔率
    }
    // 龙虎
    else if (betType === 'dragonTiger') {
      return config.dragonTigerOdds;  // 使用盘口配置的龙虎赔率
    } 
    // 快速投注 (position类型)
    else if (betType === 'position') {
      if (['big', 'small', 'odd', 'even'].includes(value)) {
        return config.twoSideOdds;  // 使用盘口配置的两面赔率
      } else {
        console.warn(`快速投注收到无效值: ${value}，返回默认赔率 1.0`);
        return 1.0;
      }
    }
    // 冠军、亚军等位置投注
    else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
      if (['big', 'small', 'odd', 'even'].includes(value)) {
        return config.twoSideOdds;  // 使用盘口配置的两面赔率
      } else {
        // 指定号码投注：使用盘口配置的单号赔率
        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
          return config.numberOdds;
        } else {
          // 无效值，返回最低赔率并记录警告
          console.warn(`位置投注 ${betType} 收到无效值: ${value}，返回默认赔率 1.0`);
          return 1.0;
        }
      }
    }
    
    // 预设赔率
    return 1.0;
  } catch (error) {
    console.error('计算赔率时出错:', error);
    return 1.0;
  }
}

// 获取余额函数，由多个API使用
async function getBalance(username) {
  try {
    if (!username) {
      console.log('获取余额失败: 未提供用户名');
      return 0;
    }
    
    // 尝试从代理系统获取余额
    try {
      const response = await fetch(`${AGENT_API_URL}/api/agent/member-balance?username=${username}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 更新本地余额
        await UserModel.setBalance(username, data.balance);
        return parseFloat(data.balance);
      }
    } catch (error) {
      console.error('从代理系统获取余额失败:', error);
    }
    
    // 如果从代理系统获取失败，则使用本地余额
    const user = await UserModel.findByUsername(username);
    if (user) {
      return parseFloat(user.balance);
    }
    
    console.log(`用户 ${username} 不存在，余额为 0`);
    return 0;
  } catch (error) {
    console.error('获取余额出错:', error);
    return 0;
  }
}

// 更新会员余额的函数
async function updateMemberBalance(username, amount, adminAgent, reason) {
  try {
    console.log(`尝试更新会员 ${username} 的余额：${amount}，原因：${reason}`);
    console.log(`代理信息:`, JSON.stringify(adminAgent));
    
    if (!username) {
      console.error('更新会员余额失败: 未提供用户名');
      return { success: false, message: '未提供用户名' };
    }

    // 获取当前余额
    const currentBalance = await getBalance(username);
    console.log(`用户 ${username} 的当前余额: ${currentBalance}`);
    
    // 计算新余额
    const newBalance = parseFloat(currentBalance) + parseFloat(amount);
    console.log(`用户 ${username} 的新余额将为: ${newBalance}`);
    
    // 检查余额是否为负数
    if (newBalance < 0) {
              console.error(`更新会员余额失败: 余额不足 (当前: ${currentBalance}, 尝试扣除: ${Math.abs(amount)})`);
        return { success: false, message: '余额不足' };
    }
    
    // 先更新本地用户余额
    try {
      await UserModel.setBalance(username, newBalance);
      console.log(`本地余额已更新为: ${newBalance}`);
    } catch (localError) {
      console.error('更新本地余额失败:', localError);
      return { success: false, message: `更新本地余额失败: ${localError.message}` };
    }
    
    // 尝试同步到代理系统，但即使失败也不影响本地更新结果
    let agentSystemSuccess = false;
    if (adminAgent) {
      try {
        console.log(`向代理系统发送余额同步请求: ${AGENT_API_URL}/api/agent/sync-member-balance`);
        console.log(`请求体:`, JSON.stringify({
          username: username,
          balance: newBalance,
          reason: reason
        }));
        
        const response = await fetch(`${AGENT_API_URL}/api/agent/sync-member-balance`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            username: username,
            balance: newBalance,
            reason: reason
        })
      });
      
        console.log(`代理系统响应状态码: ${response.status}`);
        
        const data = await response.json();
        console.log(`代理系统响应数据:`, JSON.stringify(data));
        
        if (!data.success) {
          console.error('代理系统同步余额失败:', data.message);
          // 即使代理系统失败，我们也继续使用本地更新的余额
        } else {
          console.log(`代理系统成功同步余额`);
          agentSystemSuccess = true;
        }
      } catch (error) {
        console.error('呼叫代理系统API出错:', error);
        // 继续使用本地更新的余额
      }
    } else {
      console.log('未提供代理信息，仅更新本地余额');
    }
    
    console.log(`用户 ${username} 余额已更新: ${currentBalance} -> ${newBalance} (代理系统同步状态: ${agentSystemSuccess ? '成功' : '失败'})`);
    return { success: true, balance: newBalance };
    
  } catch (error) {
    console.error('更新会员余额时出错:', error);
    return { success: false, message: `系统错误: ${error.message}` };
  }
}

// 初始化全局热门投注数据结构
const hotBetsData = {
  // 按下注类型和值保存热门程度
  byType: {
    sumValue: {}, // 冠亚和值
    dragonTiger: {}, // 龙虎
    champion: {}, // 冠军位置
    runnerup: {}, // 亚军位置
    number: {} // 单号投注
  },
  // 热门投注排行榜（按下注次数排序）
  topBets: [],
  // 最后更新时间
  lastUpdate: null
};

// 定期更新热门投注数据
async function updateHotBets() {
  try {
    console.log('开始更新热门投注数据');
    const now = new Date();
    
    // 获取最近24小时的下注数据
    const period = 24 * 60 * 60 * 1000; // 24小时的毫秒数
    const startTime = new Date(now.getTime() - period);
    
    // 查询数据库，获取最近下注
    let recentBets = [];
    try {
      recentBets = await db.any(`
        SELECT 
          bet_type, 
          bet_value, 
          position,
          COUNT(*) as bet_count,
          SUM(amount) as total_amount
        FROM bet_history
        WHERE created_at > $1
        GROUP BY bet_type, bet_value, position
        ORDER BY bet_count DESC
      `, [startTime]);
      
      console.log(`查询到 ${recentBets.length} 条近期投注数据`);
    } catch (dbError) {
      console.error('查询数据库获取热门投注数据失败:', dbError);
      // 如果数据库查询失败，设置为空数组
      recentBets = [];
      throw new Error('查询数据库获取热门投注数据失败');
    }
    
    // 重置热门投注数据
    for (const type in hotBetsData.byType) {
      hotBetsData.byType[type] = {};
    }
    
    // 如果没有数据，则直接返回空数组
    if (recentBets.length === 0) {
      console.log('没有查询到投注数据，返回空数据');
      hotBetsData.topBets = [];
      hotBetsData.lastUpdate = now;
      return;
    }
    
    // 正常处理查询结果
    recentBets.forEach(bet => {
      const betType = bet.bet_type;
      const betValue = bet.bet_value;
      const position = bet.position;
      const count = parseInt(bet.bet_count);
      const amount = parseFloat(bet.total_amount);
      
      if (betType === 'number' && position) {
        // 单号投注需要考虑位置
        const key = `${position}_${betValue}`;
        hotBetsData.byType.number[key] = { count, amount, position, value: betValue };
      } else if (hotBetsData.byType[betType]) {
        // 其他投注类型
        hotBetsData.byType[betType][betValue] = { count, amount, value: betValue };
      }
    });
    
    // 整理热门投注排行榜
    const allBets = [];
    
    // 处理号码投注
    Object.entries(hotBetsData.byType.number).forEach(([key, data]) => {
      const [position, value] = key.split('_');
      allBets.push({
        type: 'number',
        typeLabel: '单号',
        position: parseInt(position),
        value,
        count: data.count,
        amount: data.amount,
        label: `第${position}名 ${value}号`
      });
    });
    
    // 处理冠亚和值
    Object.entries(hotBetsData.byType.sumValue).forEach(([value, data]) => {
      let label = '';
      if (['big', 'small', 'odd', 'even'].includes(value)) {
        const valueMap = {
          'big': '大',
          'small': '小',
          'odd': '单',
          'even': '双'
        };
        label = `冠亚和 ${valueMap[value]}`;
      } else {
        label = `冠亚和 ${value}`;
      }
      
      allBets.push({
        type: 'sumValue',
        typeLabel: '冠亚和',
        value,
        count: data.count,
        amount: data.amount,
        label
      });
    });
    
    // 处理龙虎
    Object.entries(hotBetsData.byType.dragonTiger).forEach(([value, data]) => {
      let label = '';
      
      // 处理龙虎投注格式：dragon_1_10 -> 龙(冠军vs第10名)
      if (value && value.includes('_')) {
        const parts = value.split('_');
        if (parts.length === 3) {
          const dragonTiger = parts[0] === 'dragon' ? '龙' : '虎';
          const pos1 = parts[1] === '1' ? '冠军' : parts[1] === '2' ? '亚军' : `第${parts[1]}名`;
          const pos2 = parts[2] === '10' ? '第十名' : `第${parts[2]}名`;
          label = `${dragonTiger}(${pos1}vs${pos2})`;
        } else {
          label = `龙虎 ${value}`;
        }
      } else {
        const valueMap = {
          'dragon': '龙',
          'tiger': '虎'
        };
        label = `龙虎 ${valueMap[value] || value}`;
      }
      
      allBets.push({
        type: 'dragonTiger',
        typeLabel: '龙虎',
        value,
        count: data.count,
        amount: data.amount,
        label
      });
    });
    
    // 处理冠军
    Object.entries(hotBetsData.byType.champion).forEach(([value, data]) => {
      let label = '';
      if (['big', 'small', 'odd', 'even'].includes(value)) {
        const valueMap = {
          'big': '大',
          'small': '小',
          'odd': '单',
          'even': '双'
        };
        label = `冠军 ${valueMap[value]}`;
      } else {
        label = `冠军 ${value}号`;
      }
      
      allBets.push({
        type: 'champion',
        typeLabel: '冠军',
        value,
        count: data.count,
        amount: data.amount,
        label
      });
    });
    
    // 处理亚军
    Object.entries(hotBetsData.byType.runnerup).forEach(([value, data]) => {
      let label = '';
      if (['big', 'small', 'odd', 'even'].includes(value)) {
        const valueMap = {
          'big': '大',
          'small': '小',
          'odd': '单',
          'even': '双'
        };
        label = `亚军 ${valueMap[value]}`;
      } else {
        label = `亚军 ${value}号`;
      }
      
      allBets.push({
        type: 'runnerup',
        typeLabel: '亚军',
        value,
        count: data.count,
        amount: data.amount,
        label
      });
    });
    
    // 排序并只保留前10个
    hotBetsData.topBets = allBets
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    hotBetsData.lastUpdate = now;
    console.log(`热门投注数据更新完成，共有 ${hotBetsData.topBets.length} 个热门选项`);
  } catch (error) {
    console.error('更新热门投注数据失败:', error);
    // 出错时不产生默认数据，将topBets保持为原来的值，不影响已有数据
  }
}

// REST API端点 - 获取最新开奖结果
app.get('/api/results/latest', async (req, res) => {
  try {
    console.log('收到获取最新开奖结果请求');
    
    const result = await db.oneOrNone(`
      SELECT period, result, created_at,
             position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10
      FROM result_history 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result) {
      console.log(`返回最新开奖结果: 期号=${result.period}`);
      
      // 构建正确的位置阵列
      const positionArray = [];
      for (let i = 1; i <= 10; i++) {
        positionArray.push(result[`position_${i}`]);
      }
      
      res.json({
        success: true,
        result: {
          period: result.period,
          result_numbers: positionArray.join(','),
          result_array: positionArray, // 直接返回阵列格式
          created_at: result.created_at
        }
      });
    } else {
      console.log('没有找到开奖结果');
      res.json({
        success: false,
        message: '没有找到开奖结果'
      });
    }
  } catch (error) {
    console.error('获取最新开奖结果失败:', error);
    res.status(500).json({
      success: false,
      message: '获取开奖结果失败'
    });
  }
});

// 跑马灯讯息API
app.get('/api/marquee-messages', async (req, res) => {
  try {
    console.log('收到跑马灯讯息查询请求');
    
    // 查询活跃的跑马灯讯息，按优先级排序
    const messages = await db.any(`
      SELECT id, message, priority 
      FROM marquee_messages 
      WHERE is_active = true 
      ORDER BY priority DESC, created_at DESC
    `);
    
    console.log(`返回 ${messages.length} 条跑马灯讯息`);
    
    res.json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error('获取跑马灯讯息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取跑马灯讯息失败'
    });
  }
});

// REST API端点 - 获取热门投注
app.get('/api/hot-bets', (req, res) => {
  console.log('收到热门投注API请求');
  try {
    // 如果hotBetsData.topBets为空或未初始化，返回空数据
    if (!hotBetsData.topBets || hotBetsData.topBets.length === 0) {
      console.log('热门投注数据为空，返回空数组');
      return res.json({
        success: true,
        message: '暂无热门投注数据',
        hotBets: [],
        lastUpdate: null
      });
    }
    
    // 正常数据处理
    const hotBets = hotBetsData.topBets.map(bet => ({
      betType: bet.type,      // 前端期望betType字段
      betValue: bet.value,    // 前端期望betValue字段
      typeLabel: bet.typeLabel,
      position: bet.position,
      count: bet.count,
      label: bet.label,
      isHot: true
    }));
    
    console.log(`热门投注API返回 ${hotBets.length} 个数据`);
    
    res.json({
      success: true,
      hotBets,
      lastUpdate: hotBetsData.lastUpdate
    });
  } catch (error) {
    console.error('获取热门投注数据失败:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取热门投注数据失败',
      error: error.message,
      hotBets: []
    });
  }
});

// 获取长龙排行数据的API端点
app.get('/api/dragon-ranking', async (req, res) => {
  try {
    // 获取最近100期的开奖记录，用于计算长龙
    const query = `
      SELECT period, result, created_at as draw_time 
      FROM result_history 
      ORDER BY created_at DESC 
      LIMIT 100
    `;
    
    const results = await db.any(query);
    
    if (!results || results.length === 0) {
      return res.json({
        success: true,
        dragonRankings: []
      });
    }
    
    // 解析结果并计算长龙
    const parsedResults = results.map(row => {
      let result;
      try {
        result = parseDrawResult(row.result);
      } catch (e) {
        console.error('解析开奖结果失败:', e);
        return null;
      }
      return {
        period: row.period,
        result,
        time: row.draw_time
      };
    }).filter(item => item !== null).reverse(); // 按时间顺序排列
    
    // 计算各种长龙统计
    const dragonStats = calculateDragonStats(parsedResults);
    
    res.json({
      success: true,
      dragonRankings: dragonStats
    });

  } catch (error) {
    console.error('获取长龙排行出错:', error);
    res.status(500).json({ 
      success: false, 
      message: '获取长龙排行失败',
      dragonRankings: []
    });
  }
});

// 计算长龙统计的辅助函数
function calculateDragonStats(results) {
  // 返回仅「当前不中断」连续纪录（即从最近一期往前推遇断点即停止）
  const stats = [];

  // 为方便，最新一期排在 results[0] ，若不是请先确保阵列按时间 DESC。
  const latestFirst = Array.isArray(results) ? [...results] : [];
  // 保证最新在索引 0
  latestFirst.sort((a,b)=> new Date(b.time||b.period) - new Date(a.time||a.period));

  // 10 名大小 & 单双
  for (let pos=1; pos<=10; pos++) {
    // 大小
    addCurrentStreak(latestFirst, (num)=> num>5?'大':'小', `第${getPositionName(pos)}名`, stats, `大小-${pos}`,(numbers)=>numbers[pos-1]);
    // 单双
    addCurrentStreak(latestFirst, (num)=> num%2===1?'单':'双', `第${getPositionName(pos)}名`, stats, `单双-${pos}`,(numbers)=>numbers[pos-1]);
  }

  // 5 组龙虎 (1v10,2v9,3v8,4v7,5v6)
  const dragonPairs=[[1,10],[2,9],[3,8],[4,7],[5,6]];
  dragonPairs.forEach(([a,b])=>{
    addCurrentStreak(latestFirst, (values)=> values[0]>values[1]?'龙':'虎', `${a}v${b}`, stats, `龙虎-${a}`, (numbers)=> [numbers[a-1], numbers[b-1]]);
  });

  // 冠亚和值 大小
  addCurrentStreak(latestFirst, (sum)=> sum>11?'大':'小', '冠亚和', stats, 'sum-bigsmall', (numbers)=> numbers[0]+numbers[1]);
  // 冠亚和值 单双
  addCurrentStreak(latestFirst, (sum)=> sum%2===1?'单':'双', '冠亚和', stats, 'sum-oddeven', (numbers)=> numbers[0]+numbers[1]);

  // 只保留连续 >=2 的项目，并依 count DESC 排序
  return stats.filter(s=>s.count>=2).sort((a,b)=>b.count-a.count).slice(0,20);
}

// helper to accumulate streak
function addCurrentStreak(results, getValue, labelPrefix, allStats, categoryType, extractFn){
  let currentVal = null; 
  let count = 0;
  
  for(const rec of results){
    if (!rec || !rec.result || !Array.isArray(rec.result)) continue;
    
    const valRaw = extractFn(rec.result);
    const val = typeof getValue === 'function' ? getValue(valRaw) : valRaw;
    
    if(currentVal === null){
      currentVal = val; 
      count = 1; 
      continue;
    }
    
    if(val === currentVal){
      count++;
    } else {
      break;
    }
  }
  
  if(count >= 1){  // 改为>=1，因为即使只有1期也要显示
    // 根据categoryType决定分类
    let category;
    if (categoryType.startsWith('大小')) {
      category = '大小';
    } else if (categoryType.startsWith('单双')) {
      category = '单双';
    } else if (categoryType.startsWith('龙虎')) {
      category = '龙虎';
    } else if (categoryType.startsWith('sum-bigsmall')) {
      category = '冠亚和大小';
    } else if (categoryType.startsWith('sum-oddeven')) {
      category = '冠亚和单双';
    } else {
      category = '其他';
    }
    
    allStats.push({
      name: `${labelPrefix} ${currentVal}`,
      count,
      value: currentVal,
      category,
      type: labelPrefix
    });
  }
}

function getPositionName(position) {
  const names = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
  return names[position - 1] || position.toString();
}

// 🎴 路珠走势数据
app.get('/api/road-bead', async (req, res) => {
    const { position = 1, type = 'number', limit = 60 } = req.query;
    
    try {
        // 计算今日期号范围 (使用与游戏逻辑相同的期号格式)
        const today = new Date();
        const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
        const todayPeriodStart = parseInt(`${todayStr}001`); // 今日第一期，格式：YYYYMMDD001
        
        console.log(`🔍 路珠API: 获取今日期号格式 ${todayStr}xxx 的最近 ${limit} 期开奖记录`);
        
        // 获取今日的最近开奖记录，按期号降序排列
        // 使用字符串匹配来确保只获取今日格式的期号
        const drawHistory = await db.any(`
            SELECT period, result, created_at
            FROM result_history 
            WHERE result IS NOT NULL 
            AND period::text LIKE $1
            ORDER BY period DESC 
            LIMIT $2
        `, [`${todayStr}%`, parseInt(limit)]);
        
        if (!drawHistory || drawHistory.length === 0) {
            return res.json({
                success: true,
                data: {
                    position: parseInt(position),
                    type,
                    tableData: [],
                    todayStats: [],
                    summary: {}
                }
            });
        }
        
        // 反转顺序，从旧到新
        const orderedHistory = drawHistory.reverse();
        
        console.log(`✅ 路珠API: 成功获取 ${drawHistory.length} 期开奖记录，最新期号: ${drawHistory.length > 0 ? drawHistory[drawHistory.length - 1].period : '无'}`);
        
        // 使用今日期号起始值作为今日判断基准
        const todayPeriod = parseInt(`${todayStr}001`);
        
        // 处理路珠数据
        const roadBeadData = processRoadBeadData(orderedHistory, parseInt(position), type);
        
        // 计算今日统计（只统计号码出现次数）
        const todayStats = calculateTodayStats(orderedHistory, parseInt(position), todayPeriod);
        
        res.json({
            success: true,
            data: {
                position: parseInt(position),
                type,
                tableData: roadBeadData.tableData,
                todayStats,
                summary: roadBeadData.summary
            }
        });
        
    } catch (error) {
        console.error('获取路珠走势失败:', error);
        res.status(500).json({
            success: false,
            message: '获取路珠走势失败'
        });
    }
});

// 处理路珠数据
function processRoadBeadData(history, position, type) {
    const tableData = [];
    const currentRow = [];
    
    // 统计数据
    const stats = {
        totalPeriods: history.length,
        sizeStats: { big: { count: 0, percentage: 0 }, small: { count: 0, percentage: 0 } },
        parityStats: { odd: { count: 0, percentage: 0 }, even: { count: 0, percentage: 0 } },
        numberFrequency: {},
        dragonTigerStats: { dragon: { count: 0, percentage: 0 }, tiger: { count: 0, percentage: 0 } },
        sumStats: { min: 999, max: 0, frequency: {} }
    };
    
    // 路珠表格配置
    const COLS = 6; // 每行6列
    const ROWS = Math.ceil(history.length / COLS);
    
    // 初始化表格
    for (let i = 0; i < ROWS; i++) {
        tableData.push(new Array(COLS).fill(null));
    }
    
    // 填充数据
    history.forEach((draw, index) => {
        const row = Math.floor(index / COLS);
        const col = index % COLS;
        const result = parseDrawResult(draw.result);
        
        // 获取指定位置的数字
        const number = result[position - 1];
        
        // 创建单元格数据
        const cellData = {
            period: draw.period,
            number,
            position,
            isBig: number > 5,
            isOdd: number % 2 === 1,
            dragonTiger: null
        };
        
        // 计算冠亚和（如果是第1或第2名）
        if (position <= 2) {
            const sum = result[0] + result[1];
            cellData.sum = sum;
            cellData.sumBig = sum >= 12;
            cellData.sumOdd = sum % 2 === 1;
            
            // 更新和值统计
            stats.sumStats.min = Math.min(stats.sumStats.min, sum);
            stats.sumStats.max = Math.max(stats.sumStats.max, sum);
            stats.sumStats.frequency[sum] = (stats.sumStats.frequency[sum] || 0) + 1;
        }
        
        // 计算龙虎（第1-5名对应第10-6名）
        if (position <= 5) {
            const oppositePosition = 11 - position;
            const oppositeNumber = result[oppositePosition - 1];
            cellData.dragonTiger = number > oppositeNumber ? 'dragon' : 'tiger';
            
            // 更新龙虎统计
            if (cellData.dragonTiger === 'dragon') {
                stats.dragonTigerStats.dragon.count++;
            } else {
                stats.dragonTigerStats.tiger.count++;
            }
        }
        
        // 更新统计
        stats.numberFrequency[number] = (stats.numberFrequency[number] || 0) + 1;
        if (cellData.isBig) {
            stats.sizeStats.big.count++;
        } else {
            stats.sizeStats.small.count++;
        }
        if (cellData.isOdd) {
            stats.parityStats.odd.count++;
        } else {
            stats.parityStats.even.count++;
        }
        
        // 添加到表格
        tableData[row][col] = cellData;
    });
    
    // 计算百分比
    if (stats.totalPeriods > 0) {
        stats.sizeStats.big.percentage = ((stats.sizeStats.big.count / stats.totalPeriods) * 100).toFixed(1);
        stats.sizeStats.small.percentage = ((stats.sizeStats.small.count / stats.totalPeriods) * 100).toFixed(1);
        stats.parityStats.odd.percentage = ((stats.parityStats.odd.count / stats.totalPeriods) * 100).toFixed(1);
        stats.parityStats.even.percentage = ((stats.parityStats.even.count / stats.totalPeriods) * 100).toFixed(1);
        
        if (position <= 5) {
            const dragonTigerTotal = stats.dragonTigerStats.dragon.count + stats.dragonTigerStats.tiger.count;
            if (dragonTigerTotal > 0) {
                stats.dragonTigerStats.dragon.percentage = ((stats.dragonTigerStats.dragon.count / dragonTigerTotal) * 100).toFixed(1);
                stats.dragonTigerStats.tiger.percentage = ((stats.dragonTigerStats.tiger.count / dragonTigerTotal) * 100).toFixed(1);
            }
        }
    }
    
    return {
        tableData,
        summary: stats
    };
}

// 计算今日统计（号码出现次数）
function calculateTodayStats(history, position, todayPeriod) {
    const todayNumbers = {};
    let todayTotal = 0;
    
    // 统计今日每个号码出现的次数
    history.forEach(draw => {
        // 只统计今日的开奖
        if (parseInt(draw.period) >= todayPeriod) {
            const result = parseDrawResult(draw.result);
            const number = result[position - 1];
            todayNumbers[number] = (todayNumbers[number] || 0) + 1;
            todayTotal++;
        }
    });
    
    // 生成1-10号的统计数组
    const stats = [];
    for (let i = 1; i <= 10; i++) {
        const count = todayNumbers[i] || 0;
        stats.push({
            number: i,
            count,
            percentage: todayTotal > 0 ? ((count / todayTotal) * 100).toFixed(1) : '0.0'
        });
    }
    
    return stats;
}

// 自动侦测分析：计算全体玩家与平台的输赢比例
async function performAutoDetectAnalysis(period, betStats) {
  try {
    console.log(`🤖 [自动侦测] 开始分析期数 ${period} 的全体玩家输赢比例...`);
    
    // 1. 获取该期所有下注资料
    const allBets = await db.any(`
      SELECT 
        b.username, b.bet_type, b.bet_value, b.position, b.amount,
        m.agent_id, a.username as agent_username
      FROM bet_history b
      LEFT JOIN members m ON b.username = m.username
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE b.period = $1 AND b.settled = false
    `, [period]);
    
    if (allBets.length === 0) {
      return {
        shouldApplyControl: false,
        reason: '该期无任何下注，维持正常机率',
        playerWinProbability: 0,
        platformAdvantage: 0
      };
    }
    
    const totalBetAmount = allBets.reduce((sum, bet) => sum + parseFloat(bet.amount), 0);
    console.log(`🤖 [自动侦测] 该期总下注金额: ${totalBetAmount}`);
    
    // 2. 计算近期平台盈亏状况（最近5期）
    const recentProfitLoss = await calculateRecentPlatformProfitLoss(5);
    console.log(`🤖 [自动侦测] 近期平台盈亏: ${recentProfitLoss}`);
    
    // 3. 模拟所有可能的开奖结果，计算玩家与平台的输赢比例
    const simulationResults = simulateAllPossibleOutcomes(allBets);
    console.log(`🤖 [自动侦测] 模拟分析完成:`, {
      averagePlayerWinRate: simulationResults.averagePlayerWinRate,
      averagePlatformProfit: simulationResults.averagePlatformProfit,
      highRiskOutcomes: simulationResults.highRiskOutcomes.length
    });
    
    // 4. 分析关键指标
    const playerWinProbability = simulationResults.averagePlayerWinRate;
    const platformAdvantage = simulationResults.averagePlatformProfit;
    
    // 5. 决策逻辑：让平台小赢，玩家小输
    let shouldApplyControl = false;
    let reason = '';
    
    // 平台亏损风险过高时触发控制
    if (platformAdvantage < -totalBetAmount * 0.1) {
      shouldApplyControl = true;
      reason = `平台面临亏损风险 (预期亏损: ${platformAdvantage.toFixed(2)})，触发保护机制`;
    }
    // 玩家胜率过高时触发控制  
    else if (playerWinProbability > 0.6) {
      shouldApplyControl = true;
      reason = `玩家胜率过高 (${(playerWinProbability * 100).toFixed(1)}%)，平衡输赢比例`;
    }
    // 近期平台亏损过多时加强控制
    else if (recentProfitLoss < -totalBetAmount * 2) {
      shouldApplyControl = true;
      reason = `近期平台亏损过多 (${recentProfitLoss.toFixed(2)})，适度调整`;
    }
    // 检测异常大额下注模式
    else if (simulationResults.highRiskOutcomes.length > 10) {
      shouldApplyControl = true;
      reason = `检测到 ${simulationResults.highRiskOutcomes.length} 个高风险下注组合，启动风控`;
    }
    // 正常情况下维持少量平台优势（移除金额门槛，一律检查）
    else if (platformAdvantage < totalBetAmount * 0.05) {
      shouldApplyControl = true;
      reason = `维持健康的平台收益率，确保长期运营稳定 (预期收益: ${platformAdvantage.toFixed(2)}, 目标: ${(totalBetAmount * 0.05).toFixed(2)})`;
    } else {
      reason = `各项指标正常，维持正常机率开奖`;
    }
    
    console.log(`🤖 [自动侦测] 决策结果: ${shouldApplyControl ? '触发控制' : '维持正常'} - ${reason}`);
    
    return {
      shouldApplyControl,
      reason,
      playerWinProbability,
      platformAdvantage,
      totalBetAmount,
      recentProfitLoss,
      allBets,
      simulationResults
    };
    
  } catch (error) {
    console.error('🤖 [自动侦测] 分析过程出错:', error);
    return {
      shouldApplyControl: false,
      reason: '分析过程出错，使用正常机率',
      playerWinProbability: 0,
      platformAdvantage: 0
    };
  }
}

// 模拟所有可能的开奖结果
function simulateAllPossibleOutcomes(allBets) {
  const outcomes = [];
  
  // 抽样模拟（完整模拟开销太大）
  const sampleSize = 1000;
  
  for (let i = 0; i < sampleSize; i++) {
    // 生成随机开奖结果
    const result = generateRaceResult();
    
    // 计算该结果下的总输赢
    let totalPlayerWin = 0;
    let totalPlayerBet = 0;
    
    allBets.forEach(bet => {
      const betAmount = parseFloat(bet.amount);
      totalPlayerBet += betAmount;
      
      const winAmount = calculateWinAmountForBet(bet, result);
      if (winAmount > 0) {
        totalPlayerWin += winAmount;
      }
    });
    
    const platformProfit = totalPlayerBet - totalPlayerWin;
    const playerWinRate = totalPlayerBet > 0 ? totalPlayerWin / totalPlayerBet : 0;
    
    outcomes.push({
      result,
      playerWinRate,
      platformProfit,
      totalPlayerWin,
      totalPlayerBet
    });
  }
  
  // 统计分析
  const averagePlayerWinRate = outcomes.reduce((sum, o) => sum + o.playerWinRate, 0) / outcomes.length;
  const averagePlatformProfit = outcomes.reduce((sum, o) => sum + o.platformProfit, 0) / outcomes.length;
  
  // 找出高风险结果（平台亏损超过一定阈值）
  const highRiskOutcomes = outcomes.filter(o => o.platformProfit < -o.totalPlayerBet * 0.2);
  
  return {
    averagePlayerWinRate,
    averagePlatformProfit,
    highRiskOutcomes,
    allOutcomes: outcomes
  };
}

// 计算近期平台盈亏（专用于自动侦测）
async function calculateRecentPlatformProfitLoss(periods = 5) {
  try {
    // 获取最近N期的已结算注单
    const recentBets = await db.any(`
      SELECT amount, win, win_amount
      FROM bet_history 
      WHERE settled = true 
      ORDER BY period DESC, id DESC
      LIMIT $1
    `, [periods * 100]); // 假设每期最多100笔下注
    
    let platformProfit = 0;
    
    recentBets.forEach(bet => {
      const betAmount = parseFloat(bet.amount);
      if (bet.win) {
        // 玩家赢钱，平台亏损
        platformProfit -= parseFloat(bet.win_amount) - betAmount;
      } else {
        // 玩家输钱，平台获利
        platformProfit += betAmount;
      }
    });
    
    return platformProfit;
  } catch (error) {
    console.error('计算近期平台盈亏错误:', error);
    return 0;
  }
}

// 计算自动侦测控制权重
function calculateAutoDetectWeights(autoDetectResult, betStats) {
  const weights = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
    sumValue: Array(17).fill(1)
  };
  
  console.log(`🤖 [自动侦测] 开始计算控制权重...`);
  
  // 根据分析结果调整权重策略
  const { allBets, platformAdvantage, playerWinProbability, totalBetAmount } = autoDetectResult;
  
  // 控制强度：根据风险程度决定
  let controlIntensity = 0.3; // 基础控制强度
  
  if (platformAdvantage < -totalBetAmount * 0.2) {
    controlIntensity = 0.8; // 高风险时强控制
  } else if (platformAdvantage < -totalBetAmount * 0.1) {
    controlIntensity = 0.6; // 中风险时中等控制
  } else if (playerWinProbability > 0.7) {
    controlIntensity = 0.5; // 玩家胜率过高时适度控制
  }
  
  console.log(`🤖 [自动侦测] 控制强度: ${controlIntensity}`);
  
  // 分析玩家下注分布，对热门选项进行反向调整
  const betDistribution = analyzeBetDistribution(allBets);
  
  // 调整号码权重
  betDistribution.numberBets.forEach(bet => {
    const position = parseInt(bet.position) - 1;
    const value = parseInt(bet.bet_value) - 1;
    
    if (position >= 0 && position < 10 && value >= 0 && value < 10) {
      // 对下注金额大的选项降低权重（让平台小赢）
      const betRatio = bet.totalAmount / totalBetAmount;
      if (betRatio > 0.1) { // 超过10%的下注集中度
        weights.positions[position][value] *= (1 - controlIntensity * betRatio);
        console.log(`🤖 [自动侦测] 降低位置${position+1}号码${value+1}权重，下注比例: ${(betRatio*100).toFixed(1)}%`);
      }
    }
  });
  
  // 调整和值权重
  betDistribution.sumValueBets.forEach(bet => {
    const sumIndex = parseInt(bet.bet_value) - 3;
    if (sumIndex >= 0 && sumIndex < 17) {
      const betRatio = bet.totalAmount / totalBetAmount;
      if (betRatio > 0.15) { // 超过15%的下注集中度
        weights.sumValue[sumIndex] *= (1 - controlIntensity * betRatio);
        console.log(`🤖 [自动侦测] 降低和值${bet.bet_value}权重，下注比例: ${(betRatio*100).toFixed(1)}%`);
      }
    }
  });
  
  console.log(`🤖 [自动侦测] 权重计算完成`);
  return weights;
}

// 分析下注分布
function analyzeBetDistribution(allBets) {
  const numberBets = {};
  const sumValueBets = {};
  
  allBets.forEach(bet => {
    const amount = parseFloat(bet.amount);
    
    if (bet.bet_type === 'number') {
      const key = `${bet.position}-${bet.bet_value}`;
      if (!numberBets[key]) {
        numberBets[key] = { position: bet.position, bet_value: bet.bet_value, totalAmount: 0, count: 0 };
      }
      numberBets[key].totalAmount += amount;
      numberBets[key].count += 1;
    } else if (bet.bet_type === 'sumValue') {
      const key = bet.bet_value;
      if (!sumValueBets[key]) {
        sumValueBets[key] = { bet_value: bet.bet_value, totalAmount: 0, count: 0 };
      }
      sumValueBets[key].totalAmount += amount;
      sumValueBets[key].count += 1;
    }
  });
  
  return {
    numberBets: Object.values(numberBets),
    sumValueBets: Object.values(sumValueBets)
  };
}

// 计算单笔下注的赢钱金额（用于模拟）
function calculateWinAmountForBet(bet, winResult) {
  const amount = parseFloat(bet.amount);
  
  if (bet.bet_type === 'number') {
    const position = parseInt(bet.position);
    const betValue = parseInt(bet.bet_value);
    
    if (position >= 1 && position <= 10 && winResult[position - 1] === betValue) {
      return amount * 9; // 固定赔率9倍
    }
  } else if (bet.bet_type === 'sumValue') {
    const betSumValue = parseInt(bet.bet_value);
    const actualSumValue = winResult[0] + winResult[1];
    
    if (betSumValue === actualSumValue) {
      // 根据和值计算赔率
      const odds = getSumValueOdds(betSumValue);
      return amount * odds;
    }
  } else if (bet.bet_type === 'dragonTiger') {
    const actualResult = winResult[0] > winResult[1] ? 'dragon' : 
                        winResult[0] < winResult[1] ? 'tiger' : 'tie';
    
    if (bet.bet_value === actualResult) {
      if (actualResult === 'tie') {
        return amount * 8; // 和局赔率
      } else {
        return amount * 1.88; // 龙虎赔率
      }
    }
  }
  
  return 0; // 未中奖
}

// 获取和值赔率
function getSumValueOdds(sumValue) {
  const oddsTable = {
    3: 180, 4: 60, 5: 30, 6: 18, 7: 12, 8: 8, 9: 6, 10: 6,
    11: 6, 12: 8, 13: 12, 14: 18, 15: 30, 16: 60, 17: 180, 18: 180, 19: 180
  };
  return oddsTable[sumValue] || 6;
}
