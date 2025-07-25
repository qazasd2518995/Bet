// agentBackend.js - 代理管理会员系统后端
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { createServer } from 'http';
import wsManager from './websocket/ws-manager.js';
// 使用优化过的数据库配置
import db from './db/config.js';
// 导入基本数据库初始化函数
import initDatabaseBase from './db/init.js';
import SessionManager from './security/session-manager.js';
import { generateBlockchainData } from './utils/blockchain.js';
import bcrypt from 'bcrypt';

// 初始化环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3003; // 使用不同于主游戏系统的端口

// 跨域设置 - 加强本地开发支持
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://bet-game.onrender.com', 'https://bet-game-vcje.onrender.com', 'https://bet-agent.onrender.com'] 
    : ['http://localhost:3002', 'http://localhost:3000', 'http://localhost:3003', 'http://127.0.0.1:3003', 'http://localhost:8081', 'http://127.0.0.1:8081'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Session-Token'],
  credentials: true
}));

app.use(express.json());

// 提供静态文件
app.use(express.static(path.join(__dirname, 'agent/frontend')));

// 主页面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'agent/frontend', 'index.html'));
});

// Favicon 路由处理
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'agent/frontend', 'favicon.svg'));
});

// 健康检查端点 - 用于 Render 监控
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 创建必要的资料库表格
async function initializeWinLossControlTables() {
  try {
    console.log('初始化输赢控制表格...');
    
    // 创建输赢控制表
    await db.none(`
      CREATE TABLE IF NOT EXISTS win_loss_control (
        id SERIAL PRIMARY KEY,
        control_mode VARCHAR(20) NOT NULL DEFAULT 'normal',
        target_type VARCHAR(20),
        target_id INTEGER,
        target_username VARCHAR(100),
        control_percentage INTEGER DEFAULT 50,
        win_control BOOLEAN DEFAULT false,
        loss_control BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT false,
        start_period VARCHAR(20),
        operator_id INTEGER,
        operator_username VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 如果表已存在，检查并修改start_period栏位类型
    try {
      await db.none(`
        ALTER TABLE win_loss_control 
        ALTER COLUMN start_period TYPE VARCHAR(20)
      `);
      console.log('✅ start_period栏位类型已更新为VARCHAR(20)');
    } catch (alterError) {
      // 如果修改失败（可能因为已经是正确类型），继续执行
      if (!alterError.message.includes('already exists') && !alterError.message.includes('cannot be cast')) {
        console.log('start_period栏位类型修改:', alterError.message);
      }
    }
    
    // 创建输赢控制日志表
    await db.none(`
      CREATE TABLE IF NOT EXISTS win_loss_control_logs (
        id SERIAL PRIMARY KEY,
        control_id INTEGER,
        action VARCHAR(20) NOT NULL,
        old_values JSONB,
        new_values JSONB,
        operator_id INTEGER,
        operator_username VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('输赢控制表格初始化完成');
  } catch (error) {
    console.error('输赢控制表格初始化错误:', error);
  }
}

// 在应用启动时初始化资料库
initializeWinLossControlTables();

// 新增数据库初始化端点 - 用于手动触发数据库初始化
app.get('/api/init-db', async (req, res) => {
  try {
    console.log('手动触发数据库初始化...');
    await initDatabase();
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

// 新增数据库检查端点 - 用于检查agents表是否存在
app.get('/api/check-profile-table', async (req, res) => {
  try {
    console.log('检查 agents 表...');
    
    // 检查表是否存在
    const tableExists = await db.oneOrNone(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'agents'
    `);
    
    if (!tableExists) {
      return res.json({
        success: false,
        message: 'agents 表不存在',
        tableExists: false
      });
    }
    
    // 检查表结构
    const columns = await db.any(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'agents' 
      ORDER BY ordinal_position
    `);
    
    // 检查记录数量
    const recordCount = await db.one('SELECT COUNT(*) as count FROM agents');
    
    res.json({
      success: true,
      message: 'agents 表检查完成',
      tableExists: true,
      columns: columns,
      recordCount: parseInt(recordCount.count)
    });
    
  } catch (error) {
    console.error('检查 agents 表失败:', error);
    res.status(500).json({
      success: false,
      message: '检查失败',
      error: error.message
    });
  }
});



// 代理API路由前缀
const API_PREFIX = '/api/agent';

// 会员登入验证API
app.post(`${API_PREFIX}/member/verify-login`, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`会员登入验证请求: ${username}`);
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请提供帐号和密码'
      });
    }
    
    // 查询会员资讯
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      console.log(`会员不存在: ${username}`);
      return res.status(400).json({
        success: false,
        message: '帐号或密码错误'
      });
    }
    
    // 验证密码（这里简化处理，实际应该使用加密）
    if (member.password !== password) {
      console.log(`密码错误: ${username}`);
      return res.status(400).json({
        success: false,
        message: '帐号或密码错误'
      });
    }
    
    console.log(`会员登入验证成功: ${username}, ID: ${member.id}`);
    console.log(`会员完整数据:`, JSON.stringify(member, null, 2));
    console.log(`会员market_type值:`, member.market_type);
    console.log(`会员market_type类型:`, typeof member.market_type);
    
    const responseData = {
      id: member.id,
      username: member.username,
      balance: member.balance,
      agent_id: member.agent_id,
      status: member.status,
      market_type: member.market_type || 'D'
    };
    
    console.log(`回应数据:`, JSON.stringify(responseData, null, 2));
    
    res.json({
      success: true,
      message: '验证成功',
      member: responseData
    });
    
  } catch (error) {
    console.error('会员登入验证错误:', error);
    res.status(500).json({
      success: false,
      message: '验证服务暂时不可用'
    });
  }
});

// 获取会员信息API（包含盘口类型）
app.get(`${API_PREFIX}/member/info/:username`, async (req, res) => {
  try {
    const { username } = req.params;
    
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.status(400).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.json({
      success: true,
      member: {
        id: member.id,
        username: member.username,
        balance: member.balance,
        agent_id: member.agent_id,
        status: member.status,
        market_type: member.market_type || 'D',
        created_at: member.created_at
      }
    });
    
  } catch (error) {
    console.error('获取会员信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务暂时不可用'
    });
  }
});

// 获取会员余额API
app.get(`${API_PREFIX}/member/balance/:username`, async (req, res) => {
  try {
    const { username } = req.params;
    
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.status(400).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    res.json({
      success: true,
      balance: member.balance,
      username: member.username
    });
    
  } catch (error) {
    console.error('获取会员余额错误:', error);
    res.status(500).json({
      success: false,
      message: '获取余额失败'
    });
  }
});

// 会员投注记录API
app.get(`${API_PREFIX}/member/bet-records/:username`, async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.status(400).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 从游戏资料库查询真实投注记录
    try {
      const offset = (page - 1) * limit;
      
      // 查询投注记录
      const records = await db.many(`
        SELECT id, username, period, bet_type, bet_value, position, amount, odds, win, settled, created_at, win_amount
        FROM bet_history 
        WHERE username = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `, [username, limit, offset]);
      
      // 查询总数
      const totalResult = await db.one(`
        SELECT COUNT(*) as total 
        FROM bet_history 
        WHERE username = $1
      `, [username]);
      
      // 格式化记录
      const formattedRecords = records.map(record => ({
        id: record.id,
        username: record.username,
        period_number: record.period,
        bet_type: record.bet_type,
        bet_value: record.bet_value,
        position: record.position,
        amount: parseFloat(record.amount),
        odds: parseFloat(record.odds),
        win: record.win,
        settled: record.settled,
        win_amount: record.win_amount ? parseFloat(record.win_amount) : 0,
        created_at: record.created_at
      }));

      res.json({
        success: true,
        records: formattedRecords,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(totalResult.total)
        }
      });
      
    } catch (dbError) {
      console.error('查询投注记录资料库错误:', dbError);
      res.json({
        success: true,
        records: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0
        }
      });
    }
    
  } catch (error) {
    console.error('获取会员投注记录错误:', error);
    res.status(500).json({
      success: false,
      message: '获取投注记录失败'
    });
  }
});

// 会员盈亏统计API
app.get(`${API_PREFIX}/member/profit-loss/:username`, async (req, res) => {
  try {
    const { username } = req.params;
    const { period = 'today' } = req.query;
    
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.status(400).json({
        success: false,
        message: '用户不存在'
      });
    }
    
    // 根据period设定时间范围（台湾时间 UTC+8）
    let timeCondition = '';
    if (period === 'today') {
      timeCondition = `AND DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei') = DATE(NOW() AT TIME ZONE 'Asia/Taipei')`;
    } else if (period === '7days') {
      timeCondition = `AND created_at >= (NOW() AT TIME ZONE 'Asia/Taipei' - INTERVAL '7 days') AT TIME ZONE 'Asia/Taipei' AT TIME ZONE 'UTC'`;
    } else if (period === '30days') {
      timeCondition = `AND created_at >= (NOW() AT TIME ZONE 'Asia/Taipei' - INTERVAL '30 days') AT TIME ZONE 'Asia/Taipei' AT TIME ZONE 'UTC'`;
    }
    
    // 查询投注记录并计算盈亏
    const profitQuery = `
      SELECT 
        COUNT(*) as total_bets,
        COUNT(CASE WHEN win = true THEN 1 END) as wins,
        COALESCE(SUM(amount), 0) as total_bet_amount,
        COALESCE(SUM(CASE WHEN win = true THEN win_amount ELSE 0 END), 0) as total_win_amount,
        COALESCE(SUM(CASE WHEN win = true THEN win_amount - amount ELSE -amount END), 0) as net_profit
      FROM bet_history 
      WHERE username = $1 
      AND settled = true
      ${timeCondition}
    `;
    
    console.log(`查询用户 ${username} 的盈亏统计，期间: ${period}`);
    console.log('执行SQL:', profitQuery);
    
    const result = await db.one(profitQuery, [username]);
    
    console.log('查询结果:', result);
    
    const totalBetAmount = parseFloat(result.total_bet_amount) || 0;
    const totalWinAmount = parseFloat(result.total_win_amount) || 0;
    const netProfit = parseFloat(result.net_profit) || 0;
    const totalBets = parseInt(result.total_bets) || 0;
    const wins = parseInt(result.wins) || 0;
    
    res.json({
      success: true,
      data: {
        profit: totalWinAmount > totalBetAmount ? totalWinAmount - totalBetAmount : 0,
        loss: totalWinAmount < totalBetAmount ? totalBetAmount - totalWinAmount : 0,
        net: netProfit,
        bets: totalBets,
        wins: wins,
        period: period,
        totalBetAmount: totalBetAmount,
        totalWinAmount: totalWinAmount
      }
    });
    
  } catch (error) {
    console.error('获取会员盈亏统计错误:', error);
    res.status(500).json({
      success: false,
      message: '获取盈亏统计失败'
    });
  }
});

// 接收游戏端的即时开奖同步
app.post(`${API_PREFIX}/sync-draw-record`, async (req, res) => {
  try {
    const { period, result, draw_time } = req.body;
    
    if (!period || !result) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: period 或 result'
      });
    }
    
    console.log(`📨 收到即时开奖同步请求: 期数=${period}`);
    
    // 生成区块链资料
    const blockchainData = generateBlockchainData(period, result);
    
    // 直接插入/更新到draw_records表，包含区块链资料
    await db.none(`
      INSERT INTO draw_records (period, result, draw_time, created_at, block_height, block_hash)
      VALUES ($1, $2::jsonb, $3, $4, $5, $6)
      ON CONFLICT (period) DO UPDATE 
      SET result = $2::jsonb, draw_time = $3, created_at = $4, 
          block_height = $5, block_hash = $6
    `, [period, JSON.stringify(result), draw_time || new Date(), new Date(), 
        blockchainData.blockHeight, blockchainData.blockHash]);
    
    console.log(`✅ 即时开奖同步成功: 期数=${period}`);
    
    res.json({
      success: true,
      message: '开奖记录同步成功',
      period: period,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('即时开奖同步失败:', error);
    res.status(500).json({
      success: false,
      message: '开奖记录同步失败',
      error: error.message
    });
  }
});

// 切换代理状态API
app.post(`${API_PREFIX}/toggle-agent-status`, async (req, res) => {
  try {
    const { agentId, status } = req.body;
    
    if (!agentId || status === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数: agentId 或 status'
      });
    }
    
    await AgentModel.updateStatus(agentId, status);
    
    const statusText = status === 1 ? '启用' : status === 0 ? '停用' : '冻结';
    res.json({
      success: true,
      message: `代理状态已更新为: ${statusText}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('更新代理状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新代理状态失败',
      error: error.message
    });
  }
});

// 删除代理API - 物理删除
app.delete(`${API_PREFIX}/delete-agent/:agentId`, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: '缺少代理ID'
      });
    }
    
    // 检查代理是否存在
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 检查代理余额是否为0
    const balance = parseFloat(agent.balance) || 0;
    if (balance !== 0) {
      return res.status(400).json({
        success: false,
        message: `无法删除：代理余额为 $${balance.toFixed(2)}，必须先将余额清空至0才能删除`
      });
    }
    
    // 检查是否有下级代理（只查询启用状态的）
    const subAgents = await db.any(`
      SELECT * FROM agents WHERE parent_id = $1 AND status = 1
    `, [agentId]);
    
    // 检查是否有会员（只查询启用状态的）
    const members = await db.any(`
      SELECT * FROM members WHERE agent_id = $1 AND status = 1
    `, [agentId]);
    
    if (subAgents.length > 0 || members.length > 0) {
      const details = [];
      if (subAgents.length > 0) details.push(`${subAgents.length}个下级代理`);
      if (members.length > 0) details.push(`${members.length}个会员`);
      
      return res.status(400).json({
        success: false,
        message: `无法删除：该代理下还有${details.join('和')}，请先处理这些下级关系`
      });
    }
    
    // 执行物理删除（完全从数据库移除）
    const deleted = await AgentModel.delete(agentId);
    
    if (deleted) {
      res.json({
        success: true,
        message: '代理已永久删除',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: '删除代理失败'
      });
    }
    
  } catch (error) {
    console.error('删除代理失败:', error);
    res.status(500).json({
      success: false,
      message: '删除代理失败',
      error: error.message
    });
  }
});

// 删除会员API - 物理删除
app.delete(`${API_PREFIX}/delete-member/:memberId`, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: '缺少会员ID'
      });
    }
    
    // 检查会员是否存在
    const member = await MemberModel.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: '会员不存在'
      });
    }
    
    // 检查会员余额是否为0
    const balance = parseFloat(member.balance) || 0;
    if (balance !== 0) {
      return res.status(400).json({
        success: false,
        message: `无法删除：会员余额为 $${balance.toFixed(2)}，必须先将余额清空至0才能删除`
      });
    }
    
    // 执行物理删除（完全从数据库移除）
    const deleted = await MemberModel.delete(memberId);
    
    if (deleted) {
      res.json({
        success: true,
        message: '会员已永久删除',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: '删除会员失败'
      });
    }
    
  } catch (error) {
    console.error('删除会员失败:', error);
    res.status(500).json({
      success: false,
      message: '删除会员失败',
      error: error.message
    });
  }
});

// 清理测试数据API
app.delete(`${API_PREFIX}/cleanup-test-data`, async (req, res) => {
  try {
    // 删除测试期数
    await db.none(`DELETE FROM draw_records WHERE period = 'test123'`);
    
    res.json({
      success: true,
      message: '测试数据已清理',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('清理测试数据失败:', error);
    res.status(500).json({
      success: false,
      message: '清理测试数据失败',
      error: error.message
    });
  }
});

// 初始化代理系统数据库
async function initDatabase() {
  try {
    console.log('初始化代理系统数据库...');
    
    // 首先调用基本数据库初始化函数，确保共用表已创建
    await initDatabaseBase();
    
    // 代理系统特有的表
    // 创建代理表
    await db.none(`
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        parent_id INTEGER REFERENCES agents(id),
        level INTEGER NOT NULL DEFAULT 1,
        balance DECIMAL(15, 2) DEFAULT 0,
        commission_rate DECIMAL(5, 4) DEFAULT 0.2,
        commission_balance DECIMAL(15, 2) DEFAULT 0,
        rebate_percentage DECIMAL(5, 4) DEFAULT 0.041,
        rebate_mode VARCHAR(20) DEFAULT 'percentage',
        max_rebate_percentage DECIMAL(5, 4) DEFAULT 0.041,
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建会员表
    await db.none(`
      CREATE TABLE IF NOT EXISTS members (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        agent_id INTEGER REFERENCES agents(id),
        balance DECIMAL(15, 2) DEFAULT 0,
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建交易记录表
    await db.none(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_type VARCHAR(10) NOT NULL,
        user_id INTEGER NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        type VARCHAR(20) NOT NULL,
        before_balance DECIMAL(15, 2) NOT NULL,
        after_balance DECIMAL(15, 2) NOT NULL,
        reference_id INTEGER,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建点数转移记录表
    await db.none(`
      CREATE TABLE IF NOT EXISTS point_transfers (
        id SERIAL PRIMARY KEY,
        from_type VARCHAR(10) NOT NULL,
        from_id INTEGER NOT NULL,
        to_type VARCHAR(10) NOT NULL,
        to_id INTEGER NOT NULL,
        amount DECIMAL(15, 2) NOT NULL,
        from_before_balance DECIMAL(15, 2) NOT NULL,
        from_after_balance DECIMAL(15, 2) NOT NULL,
        to_before_balance DECIMAL(15, 2) NOT NULL,
        to_after_balance DECIMAL(15, 2) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 创建公告表
    await db.none(`
      CREATE TABLE IF NOT EXISTS notices (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(20) DEFAULT '最新公告',
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 检查并添加category字段（为现有表添加新字段）
    try {
      await db.none(`
        ALTER TABLE notices ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT '最新公告'
      `);
    } catch (error) {
      // 如果字段已存在，忽略错误
      console.log('公告分类字段已存在或添加失败:', error.message);
    }

    // 检查并添加代理退水相关字段
    try {
      await db.none(`
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS rebate_percentage DECIMAL(5, 4) DEFAULT 0.041
      `);
      await db.none(`
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS rebate_mode VARCHAR(20) DEFAULT 'percentage'
      `);
      await db.none(`
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS max_rebate_percentage DECIMAL(5, 4) DEFAULT 0.041
      `);
      // 新增盘口类型字段 - A盘(1.1%退水)或D盘(4.1%退水)
      await db.none(`
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS market_type VARCHAR(1) DEFAULT 'D'
      `);
      console.log('代理退水字段添加成功');
    } catch (error) {
      console.log('代理退水字段已存在或添加失败:', error.message);
    }
    
    // 检查并添加退水记录相关字段
    try {
      await db.none(`
        ALTER TABLE transaction_records ADD COLUMN IF NOT EXISTS member_username VARCHAR(50)
      `);
      await db.none(`
        ALTER TABLE transaction_records ADD COLUMN IF NOT EXISTS bet_amount DECIMAL(10, 2)
      `);
      await db.none(`
        ALTER TABLE transaction_records ADD COLUMN IF NOT EXISTS rebate_percentage DECIMAL(8, 6)
      `);
      await db.none(`
        ALTER TABLE transaction_records ADD COLUMN IF NOT EXISTS period VARCHAR(20)
      `);
      console.log('退水记录字段添加成功');
    } catch (error) {
      console.log('退水记录字段已存在或添加失败:', error.message);
    }
    
    // 检查并添加备注字段
    try {
      await db.none(`
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''
      `);
      await db.none(`
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      await db.none(`
        ALTER TABLE members ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''
      `);
      await db.none(`
        ALTER TABLE members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      // 新增会员盘口类型字段，从代理继承
      await db.none(`
        ALTER TABLE members ADD COLUMN IF NOT EXISTS market_type VARCHAR(1) DEFAULT 'D'
      `);
      console.log('备注字段添加成功');
    } catch (error) {
      console.log('备注字段已存在或添加失败:', error.message);
    }
    
    // 创建开奖记录表
    await db.none(`
      CREATE TABLE IF NOT EXISTS draw_records (
        id SERIAL PRIMARY KEY,
        period VARCHAR(50) UNIQUE NOT NULL,
        result JSONB,
        draw_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 为开奖记录表创建索引
    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_draw_records_period ON draw_records(period);
      CREATE INDEX IF NOT EXISTS idx_draw_records_draw_time ON draw_records(draw_time);
    `);
    
    // 创建登录日志表
    await db.none(`
      CREATE TABLE IF NOT EXISTS user_login_logs (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        user_type VARCHAR(20) DEFAULT 'agent',
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET NOT NULL,
        ip_location TEXT,
        user_agent TEXT,
        session_token VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 为登录日志表创建索引
    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_user_login_logs_username ON user_login_logs(username);
      CREATE INDEX IF NOT EXISTS idx_user_login_logs_login_time ON user_login_logs(login_time DESC);
      CREATE INDEX IF NOT EXISTS idx_user_login_logs_ip ON user_login_logs(ip_address);
    `);
    
    // 创建会话管理表
    await db.none(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        session_token VARCHAR(64) UNIQUE NOT NULL,
        user_type VARCHAR(20) NOT NULL,
        user_id INTEGER NOT NULL,
        ip_address INET NOT NULL,
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 为会话表创建索引
    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_type, user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);
    `);
    
    console.log('初始化代理系统数据库表结构完成');
    
    // 检查是否已有总代理
    const adminAgents = await db.any('SELECT * FROM agents WHERE level = 0');
    
    if (adminAgents.length === 0) {
      // 创建两个独立的总代理：A盘和D盘
      console.log('未找到总代理，开始创建A盘和D盘总代理...');
      
      // 创建A盘总代理
      console.log('创建A盘总代理 ti2025A...');
      await db.none(`
        INSERT INTO agents (username, password, level, balance, commission_rate, market_type, max_rebate_percentage, rebate_percentage) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, ['ti2025A', 'ti2025A', 0, 200000, 0.3, 'A', 0.011, 0.011]);
      console.log('A盘总代理 ti2025A 创建成功，初始余额 200,000，退水1.1%');
      
      // 创建D盘总代理
      console.log('创建D盘总代理 ti2025D...');
      await db.none(`
        INSERT INTO agents (username, password, level, balance, commission_rate, market_type, max_rebate_percentage, rebate_percentage) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, ['ti2025D', 'ti2025D', 0, 200000, 0.3, 'D', 0.041, 0.041]);
      console.log('D盘总代理 ti2025D 创建成功，初始余额 200,000，退水4.1%');
    } else {
      console.log(`已存在 ${adminAgents.length} 个总代理，检查是否需要创建A盘和D盘总代理`);
      
      // 检查是否已有A盘和D盘总代理
      const ti2025AAgent = adminAgents.find(agent => agent.username === 'ti2025A');
      const ti2025DAgent = adminAgents.find(agent => agent.username === 'ti2025D');
      
      // 如果没有A盘总代理，创建一个
      if (!ti2025AAgent) {
        console.log('创建A盘总代理 ti2025A...');
        await db.none(`
          INSERT INTO agents (username, password, level, balance, commission_rate, market_type, max_rebate_percentage, rebate_percentage) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, ['ti2025A', 'ti2025A', 0, 200000, 0.3, 'A', 0.011, 0.011]);
        console.log('A盘总代理 ti2025A 创建成功');
      } else {
        console.log(`A盘总代理ti2025A已存在，ID=${ti2025AAgent.id}`);
      }
      
      // 如果没有D盘总代理，创建一个
      if (!ti2025DAgent) {
        console.log('创建D盘总代理 ti2025D...');
        await db.none(`
          INSERT INTO agents (username, password, level, balance, commission_rate, market_type, max_rebate_percentage, rebate_percentage) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, ['ti2025D', 'ti2025D', 0, 200000, 0.3, 'D', 0.041, 0.041]);
        console.log('D盘总代理 ti2025D 创建成功');
      } else {
        console.log(`D盘总代理ti2025D已存在，ID=${ti2025DAgent.id}`);
      }
      
      // 处理旧的ti2025总代理（如果存在）
      const oldTi2025Agent = adminAgents.find(agent => agent.username === 'ti2025');
      if (oldTi2025Agent) {
        console.log(`发现旧的ti2025总代理，将其转换为D盘总代理`);
        try {
          await db.none(`
            UPDATE agents 
            SET username = $1, market_type = $2, max_rebate_percentage = $3, rebate_percentage = $4 
            WHERE id = $5
          `, ['ti2025D_backup', 'D', 0.041, 0.041, oldTi2025Agent.id]);
          console.log(`旧ti2025总代理已重命名为ti2025D_backup`);
        } catch (renameError) {
          console.log('重命名旧总代理失败:', renameError.message);
        }
      }
    }
    
    console.log('初始化代理系统数据库完成');
    
    // 检查并添加范例公告
    const existingNotices = await db.any('SELECT COUNT(*) as count FROM notices');
    if (existingNotices[0].count === 0) {
      console.log('添加范例公告...');
      
      // 添加范例公告
      const sampleNotices = [
        {
          title: '系统维护通知',
          content: '本系统将于今晚00:00-02:00进行例行维护，期间可能会暂停服务，请提前做好准备。维护期间如有紧急情况，请联系客服人员。',
          category: '维修'
        },
        {
          title: '欢迎使用代理管理系统',
          content: '欢迎使用全新的代理管理系统！系统提供会员管理、点数转移、投注记录查询等完整功能。如有任何问题，请随时联系技术支援。',
          category: '最新公告'
        },
        {
          title: '新春优惠活动开始',
          content: '🎉 新春特别优惠活动正式开始！活动期间新会员注册即享首存100%优惠，最高可获得5000元奖金。活动详情请洽客服人员。',
          category: '活动'
        },
        {
          title: '系统功能更新',
          content: '系统已完成最新功能更新：1. 新增点数转移记录查询 2. 优化投注统计报表 3. 增强系统安全性 4. 修复已知问题。请各位代理及时体验新功能。',
          category: '最新公告'
        },
        {
          title: '每日维护时间调整',
          content: '为提供更好的服务品质，每日系统维护时间调整为凌晨01:30-02:30，维护期间系统将暂停服务约1小时。造成不便敬请见谅。',
          category: '维修'
        },
        {
          title: '周年庆回馈活动',
          content: '🎈 平台周年庆特别回馈！全体会员可享受特别优惠，代理商可获得额外佣金加成。活动时间：本月1日-31日，详细规则请查看活动专页。',
          category: '活动'
        }
      ];
      
      for (const notice of sampleNotices) {
        await db.none(`
          INSERT INTO notices (title, content, category) 
          VALUES ($1, $2, $3)
        `, [notice.title, notice.content, notice.category]);
      }
      
      console.log(`成功添加 ${sampleNotices.length} 条范例公告`);
    }

    // 创建代理个人资料表
    await db.none(`
      CREATE TABLE IF NOT EXISTS agents (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
        real_name VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(100),
        line_id VARCHAR(50),
        telegram VARCHAR(50),
        address TEXT,
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('代理个人资料表已创建');
    
    // 创建输赢控制相关表
    try {
      // 创建输赢控制设定表
      await db.none(`
        CREATE TABLE IF NOT EXISTS win_loss_control (
          id SERIAL PRIMARY KEY,
          control_mode VARCHAR(20) DEFAULT 'normal' CHECK (control_mode IN ('normal', 'agent_line', 'single_member', 'auto_detect')),
          target_type VARCHAR(10) CHECK (target_type IS NULL OR target_type IN ('agent', 'member')),
          target_id INTEGER,
          target_username VARCHAR(50),
          control_percentage DECIMAL(5,2) DEFAULT 50.00 CHECK (control_percentage >= 0 AND control_percentage <= 100),
          win_control BOOLEAN DEFAULT false,
          loss_control BOOLEAN DEFAULT false,
          is_active BOOLEAN DEFAULT false,
          operator_id INTEGER REFERENCES agents(id),
          operator_username VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建输赢控制日志表
      await db.none(`
        CREATE TABLE IF NOT EXISTS win_loss_control_logs (
          id SERIAL PRIMARY KEY,
          control_id INTEGER REFERENCES win_loss_control(id),
          action VARCHAR(20) CHECK (action IN ('create', 'update', 'delete', 'activate', 'deactivate')),
          old_values JSONB,
          new_values JSONB,
          operator_id INTEGER REFERENCES agents(id),
          operator_username VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('✅ 输赢控制表创建成功');
    } catch (error) {
      console.log('输赢控制表创建失败:', error.message);
    }
    
    // 检查是否需要迁移旧字段
    try {
      const hasOldFields = await db.oneOrNone(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'agents' AND column_name IN ('qq', 'wechat')
      `);
      
      if (hasOldFields) {
        console.log('检测到旧字段，执行数据库迁移...');
        
        // 添加新字段
        await db.none(`
          ALTER TABLE agents 
          ADD COLUMN IF NOT EXISTS line_id VARCHAR(50)
        `);
        
        // 如果需要，可以将微信号迁移到Line ID
        await db.none(`
          UPDATE agents 
          SET line_id = wechat 
          WHERE line_id IS NULL AND wechat IS NOT NULL AND wechat != ''
        `);
        
        // 删除旧字段
        await db.none(`ALTER TABLE agents DROP COLUMN IF EXISTS qq`);
        await db.none(`ALTER TABLE agents DROP COLUMN IF EXISTS wechat`);
        
        console.log('数据库迁移完成');
      }
    } catch (migrationError) {
      console.log('数据库迁移检查失败:', migrationError.message);
    }
    
    console.log('代理个人资料表已创建');
  } catch (error) {
    console.error('初始化数据库时出错:', error);
    // 出错时不结束进程，让系统仍能启动，方便调试
  }
}


// 安全查询函数 - 避免 Multiple rows 错误
const SafeDB = {
  // 安全的单记录查询
  async safeOne(query, params = []) {
    try {
      const results = await db.any(query + ' LIMIT 1', params);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('SafeDB.safeOne 错误:', error);
      throw error;
    }
  },
  
  // 安全的计数查询
  async safeCount(query, params = []) {
    try {
      const result = await db.one(query, params);
      return parseInt(result.count || result.total || 0);
    } catch (error) {
      console.error('SafeDB.safeCount 错误:', error);
      return 0;
    }
  },
  
  // 安全的存在性检查
  async exists(query, params = []) {
    try {
      const results = await db.any(query + ' LIMIT 1', params);
      return results.length > 0;
    } catch (error) {
      console.error('SafeDB.exists 错误:', error);
      return false;
    }
  }
};

// 模型: 代理
const AgentModel = {
  // 获取代理by用户名
  async findByUsername(username) {
    try {
      return await db.oneOrNone('SELECT * FROM agents WHERE username = $1', [username]);
    } catch (error) {
      console.error('查询代理出错:', error);
      return null; // 返回空值而非抛出异常
    }
  },
  
  // 获取代理by ID
  async findById(id) {
    try {
      // 参数验证：确认ID是整数
      const parsedId = parseInt(id);
      if (isNaN(parsedId)) {
        console.log(`查询代理: ID "${id}" 不是有效的整数ID`);
        return null;
      }
      
      return await db.oneOrNone('SELECT * FROM agents WHERE id = $1', [parsedId]);
    } catch (error) {
      console.error('查询代理出错:', error);
      return null; // 返回空值而非抛出异常
    }
  },
  
  // 获取代理下级
  async findByParentId(parentId, level = null, status = null, page = 1, limit = 20) {
    try {
      console.log(`查询代理下级: parentId=${parentId}, level=${level}, status=${status}, page=${page}, limit=${limit}`);
      
      // 验证参数
      if (parentId && parentId !== '') {
        const parsedParentId = parseInt(parentId);
        if (isNaN(parsedParentId)) {
          console.log(`查询代理下级: 父级代理ID "${parentId}" 不是有效的整数ID`);
          return [];
        }
        
        const parentExists = await db.oneOrNone('SELECT id FROM agents WHERE id = $1', [parsedParentId]);
        if (!parentExists) {
          console.log(`查询代理下级: 父级代理ID ${parsedParentId} 不存在`);
          return [];
        }
      }
      
      let query = `
        SELECT a.*, p.username as parent_username 
        FROM agents a 
        LEFT JOIN agents p ON a.parent_id = p.id 
        WHERE 1=1
      `;
      const params = [];
      
      if (parentId && parentId !== '') {
        query += ' AND a.parent_id = $' + (params.length + 1);
        params.push(parseInt(parentId));
      }
      
      if (level && level !== '-1') {
        query += ' AND a.level = $' + (params.length + 1);
        params.push(level);
      }
      
      if (status && status !== '-1') {
        query += ' AND a.status = $' + (params.length + 1);
        params.push(status);
      }
      
      query += ' ORDER BY a.created_at DESC';
      
      // 添加分页
      const offset = (page - 1) * limit;
      query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      
      console.log(`查询代理下级: 执行SQL查询: ${query.replace(/\$\d+/g, '?')}`);
      
      const agents = await db.any(query, params);
      console.log(`查询代理下级: 找到 ${agents.length} 位代理`);
      
      return agents;
    } catch (error) {
      console.error('查询代理下级出错:', error);
      return []; // 出错时返回空数组而不是抛出异常
    }
  },
  
  // 创建代理
  async create(agentData) {
    const { username, password, parent_id, level, commission_rate, rebate_percentage, rebate_mode, max_rebate_percentage, notes, market_type, betting_limit_level } = agentData;
    
    try {
      return await db.one(`
        INSERT INTO agents (username, password, parent_id, level, commission_rate, rebate_percentage, rebate_mode, max_rebate_percentage, notes, market_type, betting_limit_level) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING *
      `, [username, password, parent_id, level, commission_rate, rebate_percentage || 0.041, rebate_mode || 'percentage', max_rebate_percentage || 0.041, notes || '', market_type || 'D', betting_limit_level || 'level3']);
    } catch (error) {
      console.error('创建代理出错:', error);
      throw error;
    }
  },
  
  // 更新代理状态
  async updateStatus(id, status) {
    try {
      return await db.one(`
        UPDATE agents 
        SET status = $1 
        WHERE id = $2 
        RETURNING *
      `, [status, id]);
    } catch (error) {
      console.error('更新代理状态出错:', error);
      throw error;
    }
  },
  
  // 获取代理统计
  async getStats(agentId) {
    try {
      // 获取该代理下的会员数
      const memberCount = await db.one(`
        SELECT COUNT(*) as count FROM members WHERE agent_id = $1
      `, [agentId]);
      
      // 获取该代理的佣金余额
      const agent = await this.findById(agentId);
      
      return {
        memberCount: parseInt(memberCount.count),
        commissionBalance: agent.commission_balance
      };
    } catch (error) {
      console.error('获取代理统计出错:', error);
      throw error;
    }
  },
  
  // 更新代理佣金
  async updateCommission(id, amount) {
    try {
      return await db.one(`
        UPDATE agents 
        SET commission_balance = commission_balance + $1 
        WHERE id = $2 
        RETURNING *
      `, [amount, id]);
    } catch (error) {
      console.error('更新代理佣金出错:', error);
      throw error;
    }
  },
  
  // 更新代理余额
  async updateBalance(id, amount) {
    try {
      const agent = await this.findById(id);
      if (!agent) throw new Error('代理不存在');
      
      const beforeBalance = parseFloat(agent.balance);
      const afterBalance = beforeBalance + parseFloat(amount);
      
      // 确保余额不会小于0
      if (afterBalance < 0) throw new Error('代理余额不足');
      
      const updatedAgent = await db.one(`
        UPDATE agents 
        SET balance = $1 
        WHERE id = $2 
        RETURNING *
      `, [afterBalance, id]);
      
      // 记录交易
      await db.none(`
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['agent', id, amount, amount > 0 ? 'rebate' : 'withdraw', beforeBalance, afterBalance, amount > 0 ? '退水收入' : '代理点数调整']);
      
      return updatedAgent;
    } catch (error) {
      console.error('更新代理余额出错:', error);
      throw error;
    }
  },

  // 客服专用: 直接设置代理余额
  async setBalanceByCustomerService(agentId, newBalance, description = '客服调整余额') {
    try {
      const agent = await this.findById(agentId);
      if (!agent) throw new Error('代理不存在');
      
      const beforeBalance = parseFloat(agent.balance);
      const afterBalance = parseFloat(newBalance);
      const difference = afterBalance - beforeBalance;
      
      // 确保新余额不会小于0
      if (afterBalance < 0) throw new Error('代理余额不能小于0');
      
      const updatedAgent = await db.one(`
        UPDATE agents 
        SET balance = $1 
        WHERE id = $2 
        RETURNING *
      `, [afterBalance, agentId]);
      
      // 记录客服操作交易
      await db.none(`
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['agent', agentId, difference, difference > 0 ? 'cs_deposit' : 'cs_withdraw', beforeBalance, afterBalance, description]);
      
      return {
        success: true,
        agent: updatedAgent,
        difference: difference
      };
    } catch (error) {
      console.error('客服设置代理余额出错:', error);
      throw error;
    }
  },

  // 检查是否为客服权限（总代理）
  async isCustomerService(agentId) {
    try {
      const agents = await db.any('SELECT * FROM agents WHERE id = $1 AND level = 0 LIMIT 1', [agentId]);
      return agents.length > 0; // 总代理level为0
    } catch (error) {
      console.error('检查客服权限出错:', error);
      return false;
    }
  },

  // 更新代理密码
  async updatePassword(id, newPassword) {
    try {
      const agent = await this.findById(id);
      if (!agent) throw new Error('代理不存在');
      
      // 更新密码（后端会自动加密）
      const result = await db.one(`
        UPDATE agents 
        SET password = $1 
        WHERE id = $2 
        RETURNING *
      `, [newPassword, id]);
      
      return result;
    } catch (error) {
      console.error('更新代理密码出错:', error);
      throw error;
    }
  },

  // 更新代理退水设定
  async updateRebateSettings(id, rebateSettings) {
    try {
      const agent = await this.findById(id);
      if (!agent) throw new Error('代理不存在');
      
      const { rebate_percentage, rebate_mode, max_rebate_percentage } = rebateSettings;
      
      // 验证退水设定
      if (parseFloat(rebate_percentage) > parseFloat(max_rebate_percentage)) {
        throw new Error('退水比例不能超过最大允许比例');
      }
      
      const result = await db.one(`
        UPDATE agents 
        SET rebate_percentage = $1, rebate_mode = $2, max_rebate_percentage = $3 
        WHERE id = $4 
        RETURNING *
      `, [rebate_percentage, rebate_mode, max_rebate_percentage, id]);
      
      return result;
    } catch (error) {
      console.error('更新代理退水设定出错:', error);
      throw error;
    }
  },

  // 物理删除代理（不可恢复）
  async delete(id) {
    try {
      const result = await db.result(`
        DELETE FROM agents WHERE id = $1
      `, [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('物理删除代理出错:', error);
      throw error;
    }
  }
};

// 模型: 会员
const MemberModel = {
  // 获取会员
  async findByAgentId(agentId, status = null, page = 1, limit = 20) {
    try {
      console.log(`查询会员: agentId=${agentId}, status=${status}, page=${page}, limit=${limit}`);
      
      // 验证代理ID
      if (!agentId || agentId === '') {
        console.log(`查询会员: 未提供有效的代理ID`);
        return [];
      }
      
      // 检查代理是否存在
      const parsedAgentId = parseInt(agentId);
      if (isNaN(parsedAgentId)) {
        console.log(`查询会员: 代理ID "${agentId}" 不是有效的整数ID`);
        return [];
      }
      
      const agentExists = await db.oneOrNone('SELECT id FROM agents WHERE id = $1', [parsedAgentId]);
      if (!agentExists) {
        console.log(`查询会员: 代理ID ${parsedAgentId} 不存在`);
        return [];
      }
      
      let query = 'SELECT * FROM members WHERE agent_id = $1';
      const params = [parsedAgentId];
      
      if (status && status !== '-1') {
        query += ' AND status = $' + (params.length + 1);
        params.push(status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      // 添加分页
      const offset = (page - 1) * limit;
      query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      
      console.log(`查询会员: 执行SQL查询: ${query.replace(/\$\d+/g, '?')}`);
      
      const members = await db.any(query, params);
      console.log(`查询会员: 找到 ${members.length} 位会员`);
      
      return members;
    } catch (error) {
      console.error('查询会员出错:', error);
      return []; // 出错时返回空数组
    }
  },
  
  // 获取会员总数
  async countByAgentId(agentId, status = null) {
    try {
      console.log(`计算会员数量: agentId=${agentId}, status=${status}`);
      
      // 验证代理ID
      if (!agentId || agentId === '') {
        console.log(`计算会员数量: 未提供有效的代理ID`);
        return 0;
      }
      
      // 解析并验证代理ID
      const parsedAgentId = parseInt(agentId);
      if (isNaN(parsedAgentId)) {
        console.log(`计算会员数量: 代理ID "${agentId}" 不是有效的整数ID`);
        return 0;
      }
      
      let query = 'SELECT COUNT(*) FROM members WHERE agent_id = $1';
      const params = [parsedAgentId];
      
      if (status && status !== '-1') {
        query += ' AND status = $' + (params.length + 1);
        params.push(status);
      }
      
      console.log(`计算会员数量: 执行SQL查询: ${query.replace(/\$\d+/g, '?')}`);
      
      const result = await db.one(query, params);
      console.log(`计算会员数量: 共计 ${result.count} 位会员`);
      
      return parseInt(result.count);
    } catch (error) {
      console.error('计算会员数量出错:', error);
      return 0; // 出错时返回0
    }
  },
  
  // 获取会员by用户名
  async findByUsername(username) {
    try {
      return await db.oneOrNone('SELECT * FROM members WHERE username = $1', [username]);
    } catch (error) {
      console.error('查询会员出错:', error);
      throw error;
    }
  },
  
  // 获取会员by ID
  async findById(id) {
    try {
      return await db.oneOrNone('SELECT * FROM members WHERE id = $1', [id]);
    } catch (error) {
      console.error('查询会员出错:', error);
      throw error;
    }
  },
  
  // 创建会员
  async create(memberData) {
    const { username, password, agent_id, balance = 0, notes, market_type, betting_limit_level } = memberData;
    
    try {
      // 如果没有指定盘口类型或限红等级，从代理继承
      let finalMarketType = market_type;
      let finalBettingLimitLevel = betting_limit_level || 'level1';
      
      if ((!finalMarketType || !betting_limit_level) && agent_id) {
        const agent = await AgentModel.findById(agent_id);
        if (agent) {
          finalMarketType = finalMarketType || agent.market_type || 'D';
          
          // 如果有指定限红等级，需要检查是否不超过代理的限红等级
          if (betting_limit_level) {
            const levelOrder = {
              'level1': 1,  // 新手
              'level2': 2,  // 一般
              'level3': 3,  // 标准
              'level4': 4,  // 高级
              'level5': 5,  // VIP
              'level6': 6   // VVIP
            };
            
            const agentLevel = levelOrder[agent.betting_limit_level || 'level3'] || 3;
            const requestedLevel = levelOrder[betting_limit_level] || 1;
            
            // 如果请求的等级超过代理的等级，使用代理的等级
            if (requestedLevel > agentLevel) {
              finalBettingLimitLevel = agent.betting_limit_level || 'level3';
            } else {
              finalBettingLimitLevel = betting_limit_level;
            }
          } else {
            // 如果没有指定限红等级，使用代理的限红等级或预设值
            finalBettingLimitLevel = agent.betting_limit_level || 'level1';
          }
        }
      }
      finalMarketType = finalMarketType || 'D';
      
      return await db.one(`
        INSERT INTO members (username, password, agent_id, balance, notes, market_type, betting_limit_level) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *
      `, [username, password, agent_id, balance, notes || '', finalMarketType, finalBettingLimitLevel]);
    } catch (error) {
      console.error('创建会员出错:', error);
      throw error;
    }
  },
  
  // 更新会员状态
  async updateStatus(id, status) {
    try {
      return await db.one(`
        UPDATE members 
        SET status = $1 
        WHERE id = $2 
        RETURNING *
      `, [status, id]);
    } catch (error) {
      console.error('更新会员状态出错:', error);
      throw error;
    }
  },
  
  // 更新会员余额
  async updateBalance(username, amount) {
    try {
      // 使用新的原子性更新函数
      const result = await db.one(`
        SELECT * FROM atomic_update_member_balance($1, $2)
      `, [username, amount]);
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // 记录交易 - 修复交易类型分类
      const member = await this.findByUsername(username);
      if (member) {
        await db.none(`
          INSERT INTO transaction_records 
          (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['member', member.id, amount, amount > 0 ? 'game_win' : 'game_bet', 
            result.before_balance, result.balance, '会员点数调整']);
      }
      
      return {
        ...member,
        balance: result.balance
      };
    } catch (error) {
      console.error('更新会员余额出错:', error);
      throw error;
    }
  },
  
  // 设置会员余额(绝对值)
  async setBalance(username, balance) {
    try {
      // 获取当前余额
      const member = await this.findByUsername(username);
      if (!member) throw new Error('会员不存在');
      
      const beforeBalance = parseFloat(member.balance);
      const afterBalance = parseFloat(balance);
      
      // 确保余额不会小于0
      if (afterBalance < 0) throw new Error('会员余额不能小于0');
      
      // 更新余额
      const updatedMember = await db.one(`
        UPDATE members 
        SET balance = $1 
        WHERE username = $2 
        RETURNING *
      `, [afterBalance, username]);
      
      // 记录交易
      await db.none(`
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['member', member.id, afterBalance - beforeBalance, 'adjustment', beforeBalance, afterBalance, '会员点数设置']);
      
      return updatedMember;
    } catch (error) {
      console.error('设置会员余额出错:', error);
      throw error;
    }
  },
  
  // 查询特定代理下的特定会员
  async findByAgentAndUsername(agentId, username) {
    try {
      return await db.oneOrNone(`
        SELECT * FROM members 
        WHERE agent_id = $1 AND username = $2
      `, [agentId, username]);
    } catch (error) {
      console.error('查询特定代理下的特定会员出错:', error);
      throw error;
    }
  },

  // 客服专用: 直接设置会员余额
  async setBalanceByCustomerService(memberUsername, newBalance, description = '客服调整余额') {
    try {
      // 获取当前余额
      const member = await this.findByUsername(memberUsername);
      if (!member) throw new Error('会员不存在');
      
      const beforeBalance = parseFloat(member.balance);
      const afterBalance = parseFloat(newBalance);
      const difference = afterBalance - beforeBalance;
      
      // 确保余额不会小于0
      if (afterBalance < 0) throw new Error('会员余额不能小于0');
      
      // 更新余额
      const updatedMember = await db.one(`
        UPDATE members 
        SET balance = $1 
        WHERE username = $2 
        RETURNING *
      `, [afterBalance, memberUsername]);
      
      // 记录客服操作交易
      await db.none(`
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['member', member.id, difference, difference > 0 ? 'cs_deposit' : 'cs_withdraw', beforeBalance, afterBalance, description]);
      
      return {
        success: true,
        member: updatedMember,
        difference: difference
      };
    } catch (error) {
      console.error('客服设置会员余额出错:', error);
      throw error;
    }
  },

  // 更新会员密码
  async updatePassword(id, newPassword) {
    try {
      const member = await this.findById(id);
      if (!member) throw new Error('会员不存在');
      
      // 更新密码（后端会自动加密）
      const result = await db.one(`
        UPDATE members 
        SET password = $1 
        WHERE id = $2 
        RETURNING *
      `, [newPassword, id]);
      
      return result;
    } catch (error) {
      console.error('更新会员密码出错:', error);
      throw error;
    }
  },

  // 物理删除会员（不可恢复）
  async delete(id) {
    try {
      const result = await db.result(`
        DELETE FROM members WHERE id = $1
      `, [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('物理删除会员出错:', error);
      throw error;
    }
  }
};

// 模型: 点数转移
const PointTransferModel = {
  // 从代理转移点数到会员
  async transferFromAgentToMember(agentId, memberId, amount, description = '', isCustomerServiceOperation = false) {
    try {
      // 参数验证
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('转移的点数必须大于0');
      }
      
      // 获取代理和会员信息
      const agent = await AgentModel.findById(agentId);
      if (!agent) throw new Error('代理不存在');
      
      const member = await MemberModel.findById(memberId);
      if (!member) throw new Error('会员不存在');
      
      // 检查代理余额是否足够
      if (parseFloat(agent.balance) < parsedAmount) {
        throw new Error('代理点数不足');
      }
      
      // 开始数据库事务
      return await db.tx(async t => {
        // 更新代理余额
        const agentBeforeBalance = parseFloat(agent.balance);
        const agentAfterBalance = agentBeforeBalance - parsedAmount;
        
        await t.one(`
          UPDATE agents 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [agentAfterBalance, agentId]);
        
        // 更新会员余额
        const memberBeforeBalance = parseFloat(member.balance);
        const memberAfterBalance = memberBeforeBalance + parsedAmount;
        
        const updatedMember = await t.one(`
          UPDATE members 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [memberAfterBalance, memberId]);
        
        // 只有客服操作才记录到transaction_records表
        console.log(`🔍 transferFromAgentToMember: isCustomerServiceOperation=${isCustomerServiceOperation}`);
        if (isCustomerServiceOperation) {
          console.log(`✅ 客服操作：记录代理交易记录`);
          // 记录代理的交易（客服操作使用cs_withdraw表示代理向会员转出点数）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['agent', agentId, -parsedAmount, 'cs_withdraw', agentBeforeBalance, agentAfterBalance, description || '客服会员存款操作']);
          
          console.log(`✅ 客服操作：记录会员交易记录`);
          // 记录会员的交易（客服操作使用cs_deposit表示会员收到点数）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['member', memberId, parsedAmount, 'cs_deposit', memberBeforeBalance, memberAfterBalance, description || '客服会员存款操作']);
        } else {
          console.log(`❌ 非客服操作：不记录transaction_records`);
        }
        
        // 记录点数转移
        await t.one(`
          INSERT INTO point_transfers 
          (from_type, from_id, to_type, to_id, amount, 
           from_before_balance, from_after_balance, 
           to_before_balance, to_after_balance, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
          RETURNING *
        `, ['agent', agentId, 'member', memberId, parsedAmount, 
            agentBeforeBalance, agentAfterBalance, 
            memberBeforeBalance, memberAfterBalance, description]);
        
        return updatedMember;
      });
    } catch (error) {
      console.error('转移点数出错:', error);
      throw error;
    }
  },
  
  // 从会员转移点数到代理
  async transferFromMemberToAgent(memberId, agentId, amount, description = '', isCustomerServiceOperation = false) {
    try {
      // 参数验证
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('转移的点数必须大于0');
      }
      
      // 获取代理和会员信息
      const member = await MemberModel.findById(memberId);
      if (!member) throw new Error('会员不存在');
      
      const agent = await AgentModel.findById(agentId);
      if (!agent) throw new Error('代理不存在');
      
      // 检查会员余额是否足够
      if (parseFloat(member.balance) < parsedAmount) {
        throw new Error('会员点数不足');
      }
      
      // 开始数据库事务
      return await db.tx(async t => {
        // 更新会员余额
        const memberBeforeBalance = parseFloat(member.balance);
        const memberAfterBalance = memberBeforeBalance - parsedAmount;
        
        await t.one(`
          UPDATE members 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [memberAfterBalance, memberId]);
        
        // 更新代理余额
        const agentBeforeBalance = parseFloat(agent.balance);
        const agentAfterBalance = agentBeforeBalance + parsedAmount;
        
        const updatedAgent = await t.one(`
          UPDATE agents 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [agentAfterBalance, agentId]);
        
        // 只有客服操作才记录到transaction_records表
        if (isCustomerServiceOperation) {
          // 记录会员的交易（客服操作使用cs_withdraw表示会员转出点数）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['member', memberId, -parsedAmount, 'cs_withdraw', memberBeforeBalance, memberAfterBalance, description || '客服会员提款操作']);
          
          // 记录代理的交易（客服操作使用cs_deposit表示代理收到点数）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['agent', agentId, parsedAmount, 'cs_deposit', agentBeforeBalance, agentAfterBalance, description || '客服会员提款操作']);
        }
        
        // 记录点数转移
        await t.one(`
          INSERT INTO point_transfers 
          (from_type, from_id, to_type, to_id, amount, 
           from_before_balance, from_after_balance, 
           to_before_balance, to_after_balance, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
          RETURNING *
        `, ['member', memberId, 'agent', agentId, parsedAmount, 
            memberBeforeBalance, memberAfterBalance, 
            agentBeforeBalance, agentAfterBalance, description]);
        
        return updatedAgent;
      });
    } catch (error) {
      console.error('转移点数出错:', error);
      throw error;
    }
  },
  
  // 从代理转移点数到代理
  async transferFromAgentToAgent(fromAgentId, toAgentId, amount, description = '', isCustomerServiceOperation = false) {
    try {
      // 参数验证
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('转移的点数必须大于0');
      }
      
      // 获取两个代理的信息
      const fromAgent = await AgentModel.findById(fromAgentId);
      if (!fromAgent) throw new Error('转出代理不存在');
      
      const toAgent = await AgentModel.findById(toAgentId);
      if (!toAgent) throw new Error('转入代理不存在');
      
      // 检查转出代理余额是否足够
      if (parseFloat(fromAgent.balance) < parsedAmount) {
        throw new Error('转出代理点数不足');
      }
      
      // 开始数据库事务
      return await db.tx(async t => {
        // 更新转出代理余额
        const fromAgentBeforeBalance = parseFloat(fromAgent.balance);
        const fromAgentAfterBalance = fromAgentBeforeBalance - parsedAmount;
        
        await t.one(`
          UPDATE agents 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [fromAgentAfterBalance, fromAgentId]);
        
        // 更新转入代理余额
        const toAgentBeforeBalance = parseFloat(toAgent.balance);
        const toAgentAfterBalance = toAgentBeforeBalance + parsedAmount;
        
        const updatedToAgent = await t.one(`
          UPDATE agents 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [toAgentAfterBalance, toAgentId]);
        
        // 只有客服操作才记录到transaction_records表
        if (isCustomerServiceOperation) {
          // 记录转出代理的交易（客服操作使用cs_withdraw表示从该代理提款）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['agent', fromAgentId, -parsedAmount, 'cs_withdraw', fromAgentBeforeBalance, fromAgentAfterBalance, description || '客服转移操作']);
          
          // 记录转入代理的交易（客服操作使用cs_deposit表示为该代理存款）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['agent', toAgentId, parsedAmount, 'cs_deposit', toAgentBeforeBalance, toAgentAfterBalance, description || '客服转移操作']);
        }
        
        // 记录点数转移
        await t.one(`
          INSERT INTO point_transfers 
          (from_type, from_id, to_type, to_id, amount, 
           from_before_balance, from_after_balance, 
           to_before_balance, to_after_balance, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
          RETURNING *
        `, ['agent', fromAgentId, 'agent', toAgentId, parsedAmount, 
            fromAgentBeforeBalance, fromAgentAfterBalance, 
            toAgentBeforeBalance, toAgentAfterBalance, description]);
        
        return {
          fromAgent: { ...fromAgent, balance: fromAgentAfterBalance },
          toAgent: updatedToAgent
        };
      });
    } catch (error) {
      console.error('代理间转移点数出错:', error);
      throw error;
    }
  },
  
  // 获取点数转移记录
  async getTransferRecords(userType, userId, limit = 50) {
    try {
      // 更新SQL查询以JOIN agents 和 members 表来获取用户名
      return await db.any(`
        SELECT 
          pt.*,
          CASE 
            WHEN pt.from_type = 'agent' THEN from_agent.username
            WHEN pt.from_type = 'member' THEN from_member.username
            ELSE NULL 
          END as from_username,
          CASE 
            WHEN pt.to_type = 'agent' THEN to_agent.username
            WHEN pt.to_type = 'member' THEN to_member.username
            ELSE NULL 
          END as to_username,
          CASE 
            WHEN pt.from_type = 'agent' THEN from_agent.level
            ELSE NULL 
          END as from_level,
          CASE 
            WHEN pt.to_type = 'agent' THEN to_agent.level
            ELSE NULL 
          END as to_level
        FROM point_transfers pt
        LEFT JOIN agents from_agent ON pt.from_type = 'agent' AND pt.from_id = from_agent.id
        LEFT JOIN members from_member ON pt.from_type = 'member' AND pt.from_id = from_member.id
        LEFT JOIN agents to_agent ON pt.to_type = 'agent' AND pt.to_id = to_agent.id
        LEFT JOIN members to_member ON pt.to_type = 'member' AND pt.to_id = to_member.id
        WHERE (pt.from_type = $1 AND pt.from_id = $2) OR (pt.to_type = $1 AND pt.to_id = $2) 
        ORDER BY pt.created_at DESC 
        LIMIT $3
      `, [userType, userId, limit]);
    } catch (error) {
      console.error('获取点数转移记录出错:', error);
      throw error;
    }
  }
};

// 模型: 公告
const NoticeModel = {
  // 获取所有公告
  async findAll(limit = 50, category = null) {
    try {
      let query = `
        SELECT * FROM notices 
        WHERE status = 1
      `;
      const params = [];
      
      if (category && category !== 'all') {
        query += ' AND category = $' + (params.length + 1);
        params.push(category);
      }
      
      query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
      params.push(limit);
      
      return await db.any(query, params);
    } catch (error) {
      console.error('获取公告出错:', error);
      throw error;
    }
  },
  
  // 获取公告分类列表
  async getCategories() {
    try {
      const result = await db.any(`
        SELECT DISTINCT category 
        FROM notices 
        WHERE status = 1 
        ORDER BY category
      `);
      return result.map(r => r.category);
    } catch (error) {
      console.error('获取公告分类出错:', error);
      return ['最新公告', '维修', '活动']; // 返回默认分类
    }
  },
  
  // 创建公告
  async create(title, content, category = '最新公告') {
    try {
      return await db.one(`
        INSERT INTO notices (title, content, category) 
        VALUES ($1, $2, $3) 
        RETURNING *
      `, [title, content, category]);
    } catch (error) {
      console.error('创建公告出错:', error);
      throw error;
    }
  },
  
  // 根据ID获取公告
  async findById(id) {
    try {
      return await db.oneOrNone(`
        SELECT * FROM notices WHERE id = $1 AND status = 1
      `, [id]);
    } catch (error) {
      console.error('获取公告出错:', error);
      throw error;
    }
  },
  
  // 更新公告
  async update(id, title, content, category) {
    try {
      return await db.one(`
        UPDATE notices 
        SET title = $2, content = $3, category = $4
        WHERE id = $1 AND status = 1
        RETURNING *
      `, [id, title, content, category]);
    } catch (error) {
      console.error('更新公告出错:', error);
      throw error;
    }
  },
  
  // 删除公告（软删除）
  async delete(id) {
    try {
      return await db.one(`
        UPDATE notices 
        SET status = 0
        WHERE id = $1 AND status = 1
        RETURNING *
      `, [id]);
    } catch (error) {
      console.error('删除公告出错:', error);
      throw error;
    }
  }
};

// 模型: 交易
const TransactionModel = {
  // 创建交易记录
  async create(transactionData) {
    const { 
      user_type, user_id, amount, type, 
      balance_before, balance_after, description 
    } = transactionData;
    
    try {
      return await db.one(`
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING *
      `, [user_type, user_id, amount, type, balance_before, balance_after, description]);
    } catch (error) {
      console.error('创建交易记录出错:', error);
      throw error;
    }
  },
  
  // 获取用户的交易记录
  async getByUserId(userType, userId, limit = 50) {
    try {
      return await db.any(`
        SELECT * FROM transaction_records 
        WHERE user_type = $1 AND user_id = $2 
        ORDER BY created_at DESC 
        LIMIT $3
      `, [userType, userId, limit]);
    } catch (error) {
      console.error('获取交易记录出错:', error);
      throw error;
    }
  },
  
  // 获取代理今日统计数据
  async getAgentTodayStats(agentId) {
    try {
      console.log(`获取代理统计: agentId=${agentId}`);
      
      // 验证代理ID
      if (!agentId || agentId === '') {
        console.log(`获取代理统计: 未提供有效的代理ID`);
        return {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          memberCount: 0,
          activeMembers: 0
        };
      }
      
      // 解析并验证代理ID
      const parsedAgentId = parseInt(agentId);
      if (isNaN(parsedAgentId)) {
        console.log(`获取代理统计: 代理ID "${agentId}" 不是有效的整数ID`);
        return {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          memberCount: 0,
          activeMembers: 0
        };
      }
      
      // 检查代理是否存在
      const agentExists = await db.oneOrNone('SELECT id FROM agents WHERE id = $1', [parsedAgentId]);
      if (!agentExists) {
        console.log(`获取代理统计: 代理ID ${parsedAgentId} 不存在`);
        return {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          memberCount: 0,
          activeMembers: 0
        };
      }
      
      // 获取代理下的所有会员ID
      const members = await db.any('SELECT id FROM members WHERE agent_id = $1', [parsedAgentId]);
      if (!members || members.length === 0) {
        console.log(`获取代理统计: 代理ID ${parsedAgentId} 下无会员`);
        return {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          memberCount: 0,
          activeMembers: 0
        };
      }
      
      const memberIds = members.map(m => m.id);
      console.log(`获取代理统计: 代理 ${parsedAgentId} 下有 ${memberIds.length} 位会员`);
      
      // 获取今日日期
      const today = new Date().toISOString().split('T')[0];
      console.log(`获取代理统计: 查询日期=${today}`);
      
      // 计算今日所有交易总额（包括代理和会员的所有转帐）
      try {
        // 查询真实的下注统计数据（包含所有下线代理的会员）
        const betStatsResult = await db.oneOrNone(`
          WITH RECURSIVE agent_hierarchy AS (
            -- 起始：目标代理本身
            SELECT id FROM agents WHERE id = $1
            UNION ALL
            -- 递归：所有下级代理
            SELECT a.id FROM agents a
            INNER JOIN agent_hierarchy ah ON a.parent_id = ah.id
          )
          SELECT 
            COUNT(bh.*) as total_bets,
            COALESCE(SUM(bh.amount), 0) as total_bet_amount,
            COALESCE(SUM(bh.win_amount), 0) as total_win_amount,
            COALESCE(SUM(bh.amount) - SUM(bh.win_amount), 0) as agent_profit
          FROM bet_history bh
          JOIN members m ON bh.username = m.username
          JOIN agent_hierarchy ah ON m.agent_id = ah.id
          WHERE DATE(bh.created_at) = $2
        `, [parsedAgentId, today]);
        
        const totalBets = parseInt(betStatsResult ? betStatsResult.total_bets : 0);
        const totalBetAmount = parseFloat(betStatsResult ? betStatsResult.total_bet_amount : 0);
        const totalWinAmount = parseFloat(betStatsResult ? betStatsResult.total_win_amount : 0);
        const agentProfit = parseFloat(betStatsResult ? betStatsResult.agent_profit : 0);
        
        // 计算代理盈亏分解
        const agentEarnings = agentProfit > 0 ? agentProfit : 0;  // 代理盈利（会员亏损）
        const agentLosses = agentProfit < 0 ? Math.abs(agentProfit) : 0;  // 代理亏损（会员盈利）
        const netRevenue = agentProfit;  // 净收益
        
        // 获取今日活跃会员数（包含所有下线代理的会员）
        const activeMembersResult = await db.oneOrNone(`
          WITH RECURSIVE agent_hierarchy AS (
            SELECT id FROM agents WHERE id = $1
            UNION ALL
            SELECT a.id FROM agents a
            INNER JOIN agent_hierarchy ah ON a.parent_id = ah.id
          )
          SELECT COUNT(DISTINCT bh.username) as count 
          FROM bet_history bh
          JOIN members m ON bh.username = m.username
          JOIN agent_hierarchy ah ON m.agent_id = ah.id
          WHERE DATE(bh.created_at) = $2
        `, [parsedAgentId, today]);
        
        const activeMembers = parseInt(activeMembersResult ? activeMembersResult.count : 0);
        
        // 获取下级代理数量
        const subAgentsResult = await db.oneOrNone(`
          SELECT COUNT(*) as count 
          FROM agents 
          WHERE parent_id = $1 AND status = 1
        `, [parsedAgentId]);
        
        const subAgentsCount = parseInt(subAgentsResult ? subAgentsResult.count : 0);
        
        console.log(`获取代理统计: 成功获取 ID=${parsedAgentId} 的统计数据`);
        
        return {
          totalDeposit: agentEarnings,        // 代理盈利（会员亏损）
          totalWithdraw: agentLosses,         // 代理亏损（会员盈利）
          totalRevenue: netRevenue,           // 净收益
          totalTransactions: totalBetAmount,  // 总投注金额
          totalBets: totalBets,               // 总投注笔数
          memberCount: memberIds.length,      // 总会员数
          activeMembers,                      // 活跃会员数
          subAgentsCount                      // 下级代理数
        };
      } catch (queryError) {
        console.error('获取代理统计 - 查询错误:', queryError);
        return {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          totalTransactions: 0,
          memberCount: memberIds.length,
          activeMembers: 0,
          subAgentsCount: 0
        };
      }
    } catch (error) {
      console.error('获取代理统计出错:', error);
      // 出错时返回默认值
      return {
        totalDeposit: 0,
        totalWithdraw: 0,
        totalRevenue: 0,
        totalTransactions: 0,
        memberCount: 0,
        activeMembers: 0,
        subAgentsCount: 0
      };
    }
  }
};

// 代理登入
app.post(`${API_PREFIX}/login`, async (req, res) => {
  const { username, password } = req.body;
  
  try {
    let user = null;
    let isSubAccount = false;
    
    // 先尝试查询代理
    const agent = await AgentModel.findByUsername(username);
    
    if (agent) {
      // 检查密码
      let isValidPassword = false;
      
      // 检查密码是否已经是 bcrypt hash
      if (agent.password.startsWith('$2b$') || agent.password.startsWith('$2a$')) {
        // 使用 bcrypt 验证
        isValidPassword = await bcrypt.compare(password, agent.password);
      } else {
        // 明文密码直接比较（向后兼容）
        isValidPassword = (agent.password === password);
      }
      
      if (!isValidPassword) {
        return res.json({
          success: false,
          message: '密码错误'
        });
      }
      
      // 检查状态
      if (agent.status !== 1) {
        return res.json({
          success: false,
          message: '代理帐号已被禁用'
        });
      }
      
      user = agent;
    } else {
      // 如果不是代理，尝试查询子帐号
      const subAccount = await db.oneOrNone(`
        SELECT sa.*, a.username as parent_agent_username, a.id as parent_agent_id, a.level as parent_agent_level
        FROM sub_accounts sa
        JOIN agents a ON sa.parent_agent_id = a.id
        WHERE sa.username = $1
      `, [username]);
      
      if (!subAccount) {
        return res.json({
          success: false,
          message: '帐号不存在'
        });
      }
      
      // 验证密码
      const isValidPassword = await bcrypt.compare(password, subAccount.password);
      if (!isValidPassword) {
        return res.json({
          success: false,
          message: '密码错误'
        });
      }
      
      // 检查状态
      if (subAccount.status !== 1) {
        return res.json({
          success: false,
          message: '子帐号已被停用'
        });
      }
      
      // 更新最后登入时间
      await db.none(`
        UPDATE sub_accounts 
        SET last_login = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [subAccount.id]);
      
      // 设置 user 为子帐号，但使用父代理的基本信息
      console.log('子帐号登入 - 查询结果:', {
        subAccountUsername: subAccount.username,
        parentAgentId: subAccount.parent_agent_id,
        parentAgentLevel: subAccount.parent_agent_level,
        parentAgentUsername: subAccount.parent_agent_username
      });
      
      // 获取父代理的完整信息
      const parentAgent = await AgentModel.findById(subAccount.parent_agent_id);
      if (!parentAgent) {
        return res.json({
          success: false,
          message: '父代理不存在'
        });
      }
      
      user = {
        id: parentAgent.id,
        username: subAccount.username,
        level: parentAgent.level, // 使用父代理的等级
        balance: parentAgent.balance,
        commission_balance: parentAgent.commission_balance,
        status: subAccount.status,
        rebate_percentage: parentAgent.rebate_percentage,
        max_rebate_percentage: parentAgent.max_rebate_percentage,
        rebate_mode: parentAgent.rebate_mode,
        market_type: parentAgent.market_type,
        betting_limit_level: parentAgent.betting_limit_level,
        is_sub_account: true,
        sub_account_id: subAccount.id,
        parent_agent_username: parentAgent.username
      };
      
      isSubAccount = true;
    }
    
    // 获取请求信息
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'] || '';
    
    // 检查可疑活动
    const isSuspicious = await SessionManager.checkSuspiciousActivity(ipAddress);
    if (isSuspicious) {
      console.warn(`🚨 检测到可疑登入活动 - IP: ${ipAddress}, 代理: ${username}`);
      // 可以选择阻止登入或记录警告
    }
    
    // 创建会话（这会自动登出其他装置的会话）
    const sessionToken = await SessionManager.createSession('agent', user.id, ipAddress, userAgent);
    
    // 生成向后兼容的token
    const legacyToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    
    // 记录登录日志
    try {
      // 简单的IP归属地判断
      let ipLocation = '未知地区';
      if (ipAddress) {
        if (ipAddress.includes('127.0.0.1') || ipAddress.includes('::1')) {
          ipLocation = '本地开发环境';
        } else if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.')) {
          ipLocation = '内网地址';
        } else {
          // 这里可以接入真实的IP归属地查询服务
          ipLocation = '台湾省'; // 预设值
        }
      }
      
      await db.none(`
        INSERT INTO user_login_logs (username, user_type, login_time, ip_address, ip_location, user_agent, session_token)
        VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6)
      `, [username, isSubAccount ? 'subaccount' : 'agent', ipAddress, ipLocation, userAgent, sessionToken]);
      
      console.log(`📝 登录日志已记录: ${username}, IP: ${ipAddress}`);
    } catch (logError) {
      console.error('记录登录日志失败:', logError);
      // 登录日志失败不影响登录流程
    }
    
    console.log(`✅ ${isSubAccount ? '子帐号' : '代理'}登入成功: ${username} (ID: ${user.id}), IP: ${ipAddress}`);
    
    // 在返回之前记录将要发送的数据
    const responseAgent = {
      id: user.id,
      username: user.username,
      level: user.level,
      balance: user.balance,
      commission_balance: user.commission_balance,
      rebate_percentage: user.rebate_percentage,
      max_rebate_percentage: user.max_rebate_percentage,
      rebate_mode: user.rebate_mode,
      market_type: user.market_type || 'D', // 添加盘口类型
      betting_limit_level: user.betting_limit_level || 'level3', // 添加限红等级
      is_sub_account: user.is_sub_account || false // 添加子帐号标记
    };
    
    console.log('登入响应 - 即将发送的代理数据:', {
      id: responseAgent.id,
      username: responseAgent.username,
      level: responseAgent.level,
      is_sub_account: responseAgent.is_sub_account
    });
    
    res.json({
      success: true,
      message: '登入成功',
      agent: responseAgent,
      token: legacyToken,
      sessionToken: sessionToken // 新的会话token
    });
  } catch (error) {
    console.error('代理登入出错:', error);
    console.error('错误堆叠:', error.stack);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 代理会话检查API
app.get(`${API_PREFIX}/check-session`, async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'] || req.query.sessionToken;
    const legacyToken = req.headers['authorization']?.replace('Bearer ', '');
    
    if (sessionToken) {
      // 使用新的会话管理系统验证
      const session = await SessionManager.validateSession(sessionToken);
      
      if (session && session.userType === 'agent') {
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
      console.log('使用旧版token检查代理会话');
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
    console.error('代理会话检查错误:', error);
    return res.json({ 
      success: false, 
      message: 'Session check failed',
      needLogin: true,
      isAuthenticated: false,
      reason: 'system_error'
    });
  }
});

// 代理登出API
app.post(`${API_PREFIX}/logout`, async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'] || req.body.sessionToken;
    
    if (sessionToken) {
      await SessionManager.logout(sessionToken);
      console.log('✅ 代理登出成功');
    }
    
    res.json({
      success: true,
      message: '登出成功'
    });
    
  } catch (error) {
    console.error('代理登出错误:', error);
    res.json({
      success: true, // 即使出错也返回成功，因为登出应该总是成功
      message: '登出成功'
    });
  }
});

// 创建代理 - 修改路由名称
app.post(`${API_PREFIX}/create-agent`, async (req, res) => {
  const { username, password, level, parent, commission_rate, rebate_mode, rebate_percentage, notes, market_type } = req.body;
  
  try {
    // 验证用户名格式（只允许英文、数字）
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!username || !usernameRegex.test(username)) {
      return res.json({
        success: false,
        message: '用户名只能包含英文字母和数字'
      });
    }
    
    // 验证密码长度（至少6码）
    if (!password || password.length < 6) {
      return res.json({
        success: false,
        message: '密码至少需要6个字符'
      });
    }
    
    // 检查用户名是否已存在（检查代理表、会员表和子帐号表）
    const existingAgent = await AgentModel.findByUsername(username);
    if (existingAgent) {
      return res.json({
        success: false,
        message: '该用户名已被使用（代理）'
      });
    }
    
    const existingMember = await MemberModel.findByUsername(username);
    if (existingMember) {
      return res.json({
        success: false,
        message: '该用户名已被使用（会员）'
      });
    }
    
    // 检查子帐号表
    const existingSubAccount = await db.oneOrNone(`
      SELECT id FROM sub_accounts WHERE username = $1
    `, [username]);
    
    if (existingSubAccount) {
      return res.json({
        success: false,
        message: '该用户名已被使用（子帐号）'
      });
    }
    
    // 验证代理级别范围 (0-15)
    const parsedLevel = parseInt(level);
    if (isNaN(parsedLevel) || parsedLevel < 0 || parsedLevel > 15) {
      return res.json({
        success: false,
        message: '代理级别必须在0到15之间'
      });
    }
    
    // 获取上级代理ID 和 上级代理信息
    let parentId = null;
    let parentAgent = null; 
    let maxRebatePercentage = 0.041; // 预设最大退水比例 4.1%
    
    if (parent) {
      parentAgent = await AgentModel.findById(parent);
      if (!parentAgent) {
        return res.json({
          success: false,
          message: '上级代理不存在'
        });
      }
      parentId = parentAgent.id;
      
      // 修改验证逻辑：代理级别必须恰好比上级代理高1级
      if (parsedLevel !== parentAgent.level + 1) {
        return res.json({
          success: false,
          message: `必须严格按照代理层级结构创建，${parentAgent.level}级代理只能创建${parentAgent.level + 1}级代理`
        });
      }
      
      // 验证佣金比例是否合理
      if (parseFloat(commission_rate) > parentAgent.commission_rate) {
          return res.json({
              success: false,
              message: '下级代理的佣金比例不能高于上级代理'
          });
      }

      // 设定最大退水比例
      // 如果上级是总代理（level 0），根据新代理的盘口类型决定最大退水
      if (parentAgent.level === 0) {
        // 总代理创建下级时，根据新代理的盘口类型决定最大退水
        maxRebatePercentage = market_type === 'A' ? 0.011 : 0.041;
      } else {
        // 一般代理创建下级时，不能超过自己的退水比例
        maxRebatePercentage = parentAgent.rebate_percentage || 0.041;
      }
      
      // 验证限红等级
      if (req.body.betting_limit_level) {
        const parentBettingLevel = parentAgent.betting_limit_level || 'level6';
        const levelOrder = {
          'level1': 1,
          'level2': 2,
          'level3': 3,
          'level4': 4,
          'level5': 5,
          'level6': 6
        };
        
        const parentLevel = levelOrder[parentBettingLevel] || 6;
        const newLevel = levelOrder[req.body.betting_limit_level] || 0;
        
        if (newLevel > parentLevel) {
          return res.json({
            success: false,
            message: `不能设定高于上级代理限红等级(${parentBettingLevel})的限红等级`
          });
        }
      }
    } else {
         // 如果没有指定上级，检查是否正在创建总代理
         if (parsedLevel !== 0) {
              return res.json({
                success: false,
                message: '只有总代理可以没有上级'
              })
         }
    }
    
    // 处理退水设定
    let finalRebatePercentage = 0.041;
    let finalRebateMode = rebate_mode || 'percentage';
    
    if (rebate_mode === 'all') {
      // 全拿退水：上级代理（本代理）拿走所有退水，下级代理拿0%
      finalRebatePercentage = 0;
    } else if (rebate_mode === 'none') {
      // 全退下级：上级代理（本代理）不拿退水，下级代理拿最大值
      finalRebatePercentage = maxRebatePercentage;
    } else if (rebate_mode === 'percentage' && rebate_percentage !== undefined) {
      // 按比例分配：下级代理拿设定的比例，其余归上级代理
      const parsedRebatePercentage = parseFloat(rebate_percentage);
      
      // 不使用四舍五入，直接比较精确值
      if (isNaN(parsedRebatePercentage) || parsedRebatePercentage < 0 || parsedRebatePercentage > maxRebatePercentage) {
        return res.json({
          success: false,
          message: `退水比例必须在 0% - ${parseFloat((maxRebatePercentage * 100).toFixed(2))}% 之间`
        });
      }
      finalRebatePercentage = parsedRebatePercentage;
    }
    
    // 处理盘口类型继承逻辑 - 必须继承上级代理的盘口类型
    let finalMarketType = 'D'; // 预设D盘
    
    // 如果有上级代理，必须继承其盘口类型
    if (parentAgent) {
      finalMarketType = parentAgent.market_type || 'D';
      
      // 验证传入的盘口类型必须与上级代理一致
      if (market_type && market_type !== finalMarketType) {
        return res.json({
          success: false,
          message: `必须使用与上级代理相同的盘口类型（${finalMarketType}盘）`
        });
      }
    } else {
      // 创建总代理时，使用传入的盘口类型
      finalMarketType = market_type || 'D';
    }
    
    // 创建代理 - 限红等级需要参考父代理的限红等级
    let finalBettingLimitLevel = req.body.betting_limit_level || 'level3';
    
    // 如果有父代理，限红等级不能超过父代理
    if (parentAgent) {
      const levelOrder = {
        'level1': 1,  // 新手
        'level2': 2,  // 一般
        'level3': 3,  // 标准
        'level4': 4,  // 高级
        'level5': 5,  // VIP
        'level6': 6   // VVIP
      };
      
      const parentLevel = levelOrder[parentAgent.betting_limit_level || 'level3'] || 3;
      const requestedLevel = levelOrder[req.body.betting_limit_level] || 3;
      
      // 如果请求的等级超过父代理的等级，使用父代理的等级
      if (requestedLevel > parentLevel) {
        finalBettingLimitLevel = parentAgent.betting_limit_level || 'level3';
        console.log(`⚠️ 代理 ${username} 请求的限红等级 ${req.body.betting_limit_level} 超过父代理 ${parentAgent.username} 的限红等级 ${parentAgent.betting_limit_level}，已调整为 ${finalBettingLimitLevel}`);
      }
    }
    
    const newAgent = await AgentModel.create({
      username,
      password,
      parent_id: parentId,
      level: parsedLevel,
      commission_rate: parseFloat(commission_rate),
      rebate_percentage: finalRebatePercentage,
      rebate_mode: finalRebateMode,
      max_rebate_percentage: maxRebatePercentage,
      notes: notes || '',
      market_type: finalMarketType,
      betting_limit_level: finalBettingLimitLevel
    });
    
    res.json({
      success: true,
      agent: {
        id: newAgent.id,
        username: newAgent.username,
        level: newAgent.level,
        rebate_percentage: newAgent.rebate_percentage,
        rebate_mode: newAgent.rebate_mode
      }
    });
  } catch (error) {
    console.error('创建代理出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 更新代理退水设定
app.put(`${API_PREFIX}/update-rebate-settings/:agentId`, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { rebate_mode, rebate_percentage } = req.body;
    
    console.log('🔧 更新退水设定请求:', {
      agentId,
      rebate_mode,
      rebate_percentage,
      requestBody: req.body
    });
    
    if (!agentId) {
      return res.json({
        success: false,
        message: '缺少代理ID'
      });
    }
    
    // 获取代理资讯
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    console.log('📋 原始代理资料:', {
      id: agent.id,
      username: agent.username,
      rebate_mode: agent.rebate_mode,
      rebate_percentage: agent.rebate_percentage,
      max_rebate_percentage: agent.max_rebate_percentage
    });
    
    // 处理退水设定
    let finalRebatePercentage = agent.rebate_percentage;
    let finalRebateMode = rebate_mode || agent.rebate_mode;
    const maxRebatePercentage = agent.max_rebate_percentage || 0.041;
    
    if (rebate_mode === 'all') {
      // 全拿退水：上级代理（本代理）拿走所有退水，下级代理拿0%
      finalRebatePercentage = 0;
    } else if (rebate_mode === 'none') {
      // 全退下级：上级代理（本代理）不拿退水，下级代理拿最大值
      finalRebatePercentage = maxRebatePercentage;
    } else if (rebate_mode === 'percentage' && rebate_percentage !== undefined) {
      // 按比例分配：下级代理拿设定的比例，其余归上级代理
      const parsedRebatePercentage = parseFloat(rebate_percentage);
      
      // 不使用四舍五入，直接比较精确值
      if (isNaN(parsedRebatePercentage) || parsedRebatePercentage < 0 || parsedRebatePercentage > maxRebatePercentage) {
        return res.json({
          success: false,
          message: `退水比例必须在 0% - ${parseFloat((maxRebatePercentage * 100).toFixed(2))}% 之间`
        });
      }
      finalRebatePercentage = parsedRebatePercentage;
    }
    
    console.log('🎯 最终设定:', {
      finalRebateMode,
      finalRebatePercentage,
      maxRebatePercentage
    });
    
    // 更新退水设定
    const updatedAgent = await AgentModel.updateRebateSettings(agentId, {
      rebate_percentage: finalRebatePercentage,
      rebate_mode: finalRebateMode,
      max_rebate_percentage: maxRebatePercentage
    });
    
    console.log('✅ 更新后的代理资料:', {
      id: updatedAgent.id,
      username: updatedAgent.username,
      rebate_mode: updatedAgent.rebate_mode,
      rebate_percentage: updatedAgent.rebate_percentage,
      max_rebate_percentage: updatedAgent.max_rebate_percentage
    });
    
    // 执行级联更新 - 调整所有下级代理的退水设定
    console.log('🔗 开始级联更新下级代理退水设定...');
    
    // 递回函数：调整下级代理的退水设定
    async function adjustDownlineRebateSettings(parentAgentId, maxRebatePercentage) {
      // 获取该代理的所有直接下级代理
      const childAgents = await db.any(`
        SELECT id, username, rebate_percentage, max_rebate_percentage 
        FROM agents 
        WHERE parent_id = $1 AND status = 1
      `, [parentAgentId]);
      
      for (const childAgent of childAgents) {
        const currentRebate = parseFloat(childAgent.rebate_percentage);
        const currentMaxRebate = parseFloat(childAgent.max_rebate_percentage);
        
        // 处理两种情况：
        // 1. 如果下级的退水超过上级的新限制，需要调降
        // 2. 如果下级的最大退水不等于上级的新限制，需要更新（允许调高或调低）
        let needUpdate = false;
        let newRebate = currentRebate;
        let updateDescription = '';
        
        // 情况1：退水超过新限制，需要调降
        if (currentRebate > maxRebatePercentage) {
          newRebate = maxRebatePercentage;
          needUpdate = true;
          updateDescription = `退水调降: ${currentRebate * 100}% -> ${newRebate * 100}%`;
        }
        
        // 情况2：最大退水需要更新（不论上调或下调）
        if (currentMaxRebate !== maxRebatePercentage) {
          needUpdate = true;
          if (updateDescription) {
            updateDescription += `，最大退水更新: ${currentMaxRebate * 100}% -> ${maxRebatePercentage * 100}%`;
          } else {
            updateDescription = `最大退水更新: ${currentMaxRebate * 100}% -> ${maxRebatePercentage * 100}%`;
          }
        }
        
        if (needUpdate) {
          await db.none(`
            UPDATE agents 
            SET rebate_percentage = $1, max_rebate_percentage = $2, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $3
          `, [newRebate, maxRebatePercentage, childAgent.id]);
          
          console.log(`  - 调整下级代理 ${childAgent.username}: ${updateDescription}`);
          
          // 记录调整日志
          await db.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, transaction_type, amount, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            'agent', 
            childAgent.id, 
            'other', 
            0, 
            0, 
            0, 
            `退水设定连锁调整: ${updateDescription} (因上级代理 ${agent.username} 退水调整)`
          ]);
        }
        
        // 递回处理此代理的下级
        await adjustDownlineRebateSettings(childAgent.id, maxRebatePercentage);
      }
    }
    
    // 开始连锁调整
    await adjustDownlineRebateSettings(agentId, finalRebatePercentage);
    
    console.log(`连锁调整完成`);
    
    res.json({
      success: true,
      message: '退水设定更新成功',
      agent: {
        id: updatedAgent.id,
        username: updatedAgent.username,
        rebate_percentage: updatedAgent.rebate_percentage,
        rebate_mode: updatedAgent.rebate_mode,
        max_rebate_percentage: updatedAgent.max_rebate_percentage
      }
    });
    
  } catch (error) {
    console.error('更新代理退水设定失败:', error);
    res.status(500).json({
      success: false,
      message: '更新退水设定失败',
      error: error.message
    });
  }
});

// 获取会员的代理链
app.get(`${API_PREFIX}/member-agent-chain`, async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.json({
        success: false,
        message: '缺少会员用户名'
      });
    }
    
    // 获取会员资讯
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    // 获取代理链
    const agentChain = await getAgentChainForMember(member.agent_id);
    
    res.json({
      success: true,
      agentChain: agentChain
    });
  } catch (error) {
    console.error('获取会员代理链错误:', error);
    res.status(500).json({
      success: false,
      message: '系统错误'
    });
  }
});

// 分配退水给代理
app.post(`${API_PREFIX}/allocate-rebate`, async (req, res) => {
  try {
    const { agentId, agentUsername, rebateAmount, memberUsername, betAmount, reason, period } = req.body;
    
    console.log(`收到退水分配请求: 代理=${agentUsername}(${agentId}), 退水金额=${rebateAmount}, 会员=${memberUsername}, 下注=${betAmount}`);
    
    if (!agentId || !rebateAmount || rebateAmount <= 0) {
      console.warn('无效的退水分配请求:', { agentId, rebateAmount });
      return res.json({
        success: false,
        message: '无效的退水分配请求'
      });
    }
    
    // 验证退水金额是否合理（防止异常大额）
    const maxReasonableRebate = parseFloat(betAmount) * 0.1; // 最多10%下注金额作为安全阈值
    if (parseFloat(rebateAmount) > maxReasonableRebate) {
      console.error(`退水金额异常: ${rebateAmount} 超过安全阈值 ${maxReasonableRebate}`);
      return res.json({
        success: false,
        message: '退水金额异常，请检查计算逻辑'
      });
    }
    
    // 获取代理资讯
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 保证金额精度，四舍五入到小数点后2位
    const roundedRebateAmount = Math.round(parseFloat(rebateAmount) * 100) / 100;
    
    // 计算退水比例
    const rebatePercentage = parseFloat(betAmount) > 0 ? roundedRebateAmount / parseFloat(betAmount) : 0;
    
    const beforeBalance = parseFloat(agent.balance);
    const afterBalance = beforeBalance + roundedRebateAmount;
    
    // 增加代理余额
    await db.none(`UPDATE agents SET balance = $1 WHERE id = $2`, [afterBalance, agentId]);
    
    // 记录详细的退水交易记录（包含会员信息）
    await db.none(`
      INSERT INTO transaction_records 
      (user_type, user_id, amount, transaction_type, balance_before, balance_after, description, 
       member_username, bet_amount, rebate_percentage, period) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      'agent', 
      agentId, 
      roundedRebateAmount, 
      'rebate', 
      beforeBalance, 
      afterBalance, 
      `退水收入 - ${memberUsername || '未知会员'}`, 
      memberUsername || null,
      parseFloat(betAmount) || 0,
      rebatePercentage,
      period ? String(period) : null
    ]);
    
    // 获取更新后的代理资讯
    const updatedAgent = await AgentModel.findById(agentId);
    
    console.log(`成功分配退水 ${roundedRebateAmount} 给代理 ${agentUsername}，新余额: ${updatedAgent.balance}`);
    
    res.json({
      success: true,
      message: '退水分配成功'
    });
  } catch (error) {
    console.error('分配退水错误:', error);
    res.status(500).json({
      success: false,
      message: '系统错误'
    });
  }
});

// 获取投注记录的占成明细（代理链）
async function getCommissionDetailsForBet(memberUsername, betAmount) {
  try {
    console.log(`🔍 查询会员 ${memberUsername} 的占成明细...`);
    
    // 首先查找会员所属的代理
    const member = await db.oneOrNone(`
      SELECT m.id, m.username, m.agent_id, a.username as agent_username, a.level, a.rebate_percentage, a.parent_id
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.username = $1
    `, [memberUsername]);

    console.log(`👤 会员查询结果:`, member);

    if (!member || !member.agent_id) {
      console.log(`⚠️ 会员 ${memberUsername} 不存在或没有绑定代理`);
      return []; // 如果会员不存在或没有绑定代理，返回空阵列
    }

    const commissionDetails = [];
    let currentAgentId = member.agent_id;
    let level = 1;

    console.log(`🔗 开始遍历代理链，起始代理ID: ${currentAgentId}`);

    // 从会员的直属代理开始，向上遍历代理链
    while (currentAgentId && level <= 15) { // 限制最多15级，避免无限循环
      console.log(`🔄 查询代理 ID: ${currentAgentId}, 层级: ${level}`);
      
      const agent = await db.oneOrNone(`
        SELECT id, username, level, rebate_percentage, commission_rate, parent_id
        FROM agents 
        WHERE id = $1 AND status = 1
      `, [currentAgentId]);

      console.log(`👥 代理查询结果:`, agent);

      if (!agent) {
        console.log(`⚠️ 代理ID ${currentAgentId} 不存在或已停用`);
        break;
      }

      // 计算这个代理的退水率（这里使用简单的逻辑，实际可能更复杂）
      const rebateRate = parseFloat(agent.rebate_percentage) || 0.038; // 预设3.8%
      const commissionRate = 0.0; // 占成固定为 0%

      // 格式化代理级别名称
      const levelNames = ['总代理', '一级代理', '二级代理', '三级代理', '四级代理', '五级代理', 
                         '六级代理', '七级代理', '八级代理', '九级代理', '十级代理', 
                         '十一级代理', '十二级代理', '十三级代理', '十四级代理', '十五级代理'];
      
      const agentType = levelNames[agent.level] || `${agent.level}级代理`;

      const detail = {
        id: agent.id,
        agent_type: agentType,
        username: agent.username,
        commission_rate: commissionRate, // 固定为 0
        rebate_rate: rebateRate,
        level: agent.level
      };
      
      console.log(`✅ 添加代理明细:`, detail);
      commissionDetails.push(detail);

      // 移动到上级代理
      currentAgentId = agent.parent_id;
      level++;
      console.log(`⬆️ 下个查询代理 ID: ${currentAgentId}`);
    }

    console.log(`📊 最终占成明细 (共 ${commissionDetails.length} 级):`, commissionDetails);
    return commissionDetails;
  } catch (error) {
    console.error(`❌ 获取会员 ${memberUsername} 占成明细时发生错误:`, error);
    return [];
  }
}

// 获取代理链的辅助函数
async function getAgentChainForMember(agentId) {
  const agentChain = [];
  
  try {
    let currentAgentId = agentId;
    
    while (currentAgentId) {
      const agent = await db.oneOrNone(`
        SELECT id, username, level, rebate_mode, rebate_percentage, max_rebate_percentage, parent_id, market_type
        FROM agents 
        WHERE id = $1 AND status = 1
      `, [currentAgentId]);
      
      if (!agent) break;
      
      agentChain.push({
        id: agent.id,
        username: agent.username,
        level: agent.level,
        rebate_mode: agent.rebate_mode || 'percentage',
        rebate_percentage: agent.rebate_percentage || 0.041,
        max_rebate_percentage: agent.max_rebate_percentage || 0.041,
        market_type: agent.market_type || 'D'  // 添加 market_type，预设为 D 盘
      });
      
      // 移动到上级代理
      currentAgentId = agent.parent_id;
    }
    
    return agentChain;
  } catch (error) {
    console.error('获取代理链时发生错误:', error);
    return [];
  }
}

// 检查代理是否有权限对会员进行操作（检查是否为上级代理）
async function canAgentManageMember(agentId, memberId) {
  try {
    // 获取会员信息
    const member = await MemberModel.findById(memberId);
    if (!member) return false;
    
    // 如果代理直接创建了这个会员，当然有权限
    if (member.agent_id === agentId) return true;
    
    // 获取会员的代理链（从会员的直接代理开始，往上级查找）
    const agentChain = await getAgentChainForMember(member.agent_id);
    
    // 检查当前代理是否在会员的代理链中（即是否为上级代理）
    return agentChain.some(chainAgent => chainAgent.id === agentId);
  } catch (error) {
    console.error('检查代理权限时发生错误:', error);
    return false;
  }
}

// 检查代理是否有权限对另一个代理进行操作（检查是否为上级代理）
async function canAgentManageAgent(parentAgentId, subAgentId) {
  try {
    // 获取下级代理信息
    const subAgent = await AgentModel.findById(subAgentId);
    if (!subAgent) return false;
    
    // 如果是直接下级，当然有权限
    if (subAgent.parent_id === parentAgentId) return true;
    
    // 获取下级代理的代理链（从下级代理开始，往上级查找）
    const agentChain = await getAgentChainForAgent(subAgentId);
    
    // 检查当前代理是否在下级代理的代理链中（即是否为上级代理）
    return agentChain.some(chainAgent => chainAgent.id === parentAgentId);
  } catch (error) {
    console.error('检查代理层级权限时发生错误:', error);
    return false;
  }
}

// 获取代理的代理链（从指定代理开始往上级查找）
async function getAgentChainForAgent(agentId) {
  const agentChain = [];
  
  try {
    let currentAgentId = agentId;
    
    while (currentAgentId) {
      const agent = await db.oneOrNone(`
        SELECT id, username, level, parent_id
        FROM agents 
        WHERE id = $1 AND status = 1
      `, [currentAgentId]);
      
      if (!agent) break;
      
      agentChain.push({
        id: agent.id,
        username: agent.username,
        level: agent.level,
        parent_id: agent.parent_id
      });
      
      // 移动到上级代理
      currentAgentId = agent.parent_id;
    }
    
    return agentChain;
  } catch (error) {
    console.error('获取代理链时发生错误:', error);
    return [];
  }
}

// 获取会员的代理链
app.get(`${API_PREFIX}/member-agent-chain`, async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.json({
        success: false,
        message: '请提供会员用户名'
      });
    }
    
    // 查找会员
    const member = await db.oneOrNone(`
      SELECT id, username, agent_id
      FROM members 
      WHERE username = $1
    `, [username]);
    
    if (!member) {
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    // 获取代理链
    const agentChain = await getAgentChainForMember(member.agent_id);
    
    res.json({
      success: true,
      agentChain: agentChain
    });
  } catch (error) {
    console.error('获取会员代理链错误:', error);
    res.status(500).json({
      success: false,
      message: '系统错误'
    });
  }
});

// 设置仪表板路由
app.get(`${API_PREFIX}/stats`, async (req, res) => {
  try {
    console.log('获取仪表板统计API: 接收请求', req.query);
    
    // 直接从查询参数获取agentId
    const { agentId } = req.query;
    
    if (!agentId) {
      console.log('获取仪表板统计API: 未提供agentId');
      return res.json({
        success: false,
        message: '请提供代理ID'
      });
    }
    
    try {
      // 获取代理统计数据
      const stats = await TransactionModel.getAgentTodayStats(agentId);
      console.log('获取仪表板统计API: 成功获取数据', stats);
      
      return res.json({
        success: true,
        data: stats
      });
    } catch (statsError) {
      console.error('获取仪表板统计API: 统计数据查询错误', statsError);
      // 返回空数据而非500错误
      return res.json({
        success: true,
        data: {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          memberCount: 0,
          activeMembers: 0
        }
      });
    }
  } catch (error) {
    console.error('获取仪表板统计API: 处理错误', error);
    return res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 输赢控制相关API
  
// 检查操作权限 - 只有特定的总代理帐号可以使用
const checkWinLossControlPermission = (agent) => {
  // 旧帐号名称（为了相容性）
  const legacyUsernames = ['ti2025A', 'ti2025D'];
  // 新帐号名称
  const newUsernames = ['MA@x9Kp#2025$zL7', 'MD@y7Rw#2025$qX4'];
  
  return legacyUsernames.includes(agent.username) || newUsernames.includes(agent.username);
};

// 安全记录输赢控制日志的函数
async function safeLogWinLossControl(controlId, action, oldValues = null, newValues = null, operatorId, operatorUsername) {
  try {
    console.log(`[日志] 尝试记录 ${action} 操作:`, { controlId, operatorId, operatorUsername });
    
    // 确保 JSON 序列化不会失败
    let oldValuesStr = null;
    let newValuesStr = null;
    
    if (oldValues) {
      try {
        oldValuesStr = JSON.stringify(oldValues);
      } catch (jsonError) {
        console.warn('旧数据 JSON 序列化失败:', jsonError.message);
        oldValuesStr = JSON.stringify({ error: 'JSON序列化失败' });
      }
    }
    
    if (newValues) {
      try {
        newValuesStr = JSON.stringify(newValues);
      } catch (jsonError) {
        console.warn('新数据 JSON 序列化失败:', jsonError.message);
        newValuesStr = JSON.stringify({ error: 'JSON序列化失败' });
      }
    }
    
    // 删除操作时使用 NULL 避免外键约束
    const logControlId = action === 'delete' ? null : controlId;
    
    await db.none(`
      INSERT INTO win_loss_control_logs (control_id, action, old_values, new_values, operator_id, operator_username)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      logControlId,
      action,
      oldValuesStr,
      newValuesStr,
      operatorId,
      operatorUsername
    ]);
    
    console.log(`[日志] ${action} 操作记录成功`);
  } catch (logError) {
    console.warn(`记录输赢控制日志失败 (${action}):`, logError.message);
    console.warn('详细错误:', logError);
    // 日志失败不影响主要操作
  }
}

// 获取输赢控制列表
app.get(`${API_PREFIX}/win-loss-control`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    if (!agent) {
      return res.status(401).json({ success: false, message: '代理不存在' });
    }
    
    // 检查权限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '权限不足，只有总代理可以使用此功能' 
      });
    }

    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const controls = await db.any(`
      SELECT wlc.*, 
        CASE 
          WHEN wlc.target_type = 'agent' THEN a.username
          WHEN wlc.target_type = 'member' THEN m.username
          ELSE wlc.target_username
        END as target_display_name
      FROM win_loss_control wlc
      LEFT JOIN agents a ON wlc.target_type = 'agent' AND wlc.target_id IS NOT NULL AND wlc.target_id = a.id
      LEFT JOIN members m ON wlc.target_type = 'member' AND wlc.target_id IS NOT NULL AND wlc.target_id = m.id
      ORDER BY wlc.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const totalCount = await db.one('SELECT COUNT(*) FROM win_loss_control', [], r => +r.count);

    res.json({
      success: true,
      data: controls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('获取输赢控制列表错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 创建输赢控制
app.post(`${API_PREFIX}/win-loss-control`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 检查权限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '权限不足，只有总代理可以使用此功能' 
      });
    }

    let { 
      control_mode, 
      target_type, 
      target_username, 
      control_percentage = 50,
      win_control,
      loss_control,
      start_period = null
    } = req.body;

    // 🔧 修复CHECK约束错误：将空字串转换为NULL
    const dbTargetType = (target_type === '' || target_type === undefined) ? null : target_type;
    const dbTargetUsername = (target_username === '' || target_username === undefined) ? null : target_username;

    console.log('创建输赢控制:', { control_mode, target_type: dbTargetType, target_username: dbTargetUsername, control_percentage, win_control, loss_control });

    // 验证必要参数
    if (!control_mode || !['normal', 'agent_line', 'single_member', 'auto_detect'].includes(control_mode)) {
      return res.status(400).json({ success: false, message: '无效的控制模式' });
    }

    // 验证控制类型 - 必须选择赢控制或输控制其中一种（除了正常机率和自动侦测模式）
    if (control_mode !== 'normal' && control_mode !== 'auto_detect') {
      if (win_control === undefined || loss_control === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: '请选择控制类型（赢控制或输控制）' 
        });
      }
      
      if (win_control === loss_control) {
        return res.status(400).json({ 
          success: false, 
          message: win_control ? '不能同时选择赢控制和输控制' : '必须选择赢控制或输控制其中一种' 
        });
      }
    }
    
    // 自动侦测模式不需要设定赢控制或输控制
    if (control_mode === 'auto_detect') {
      win_control = false;
      loss_control = false;
    }

    let target_id = null;
    let validated_username = dbTargetUsername;

    // 如果不是正常模式或自动侦测，需要验证目标
    if (control_mode === 'agent_line' || control_mode === 'single_member') {
      if (!dbTargetType || !dbTargetUsername) {
        return res.status(400).json({ success: false, message: '必须指定目标类型和用户名' });
      }

      // 验证目标是否存在
      if (dbTargetType === 'agent') {
        const targetAgent = await db.oneOrNone('SELECT id, username FROM agents WHERE username = $1', [dbTargetUsername]);
        if (!targetAgent) {
          return res.status(400).json({ success: false, message: '找不到指定的代理' });
        }
        target_id = targetAgent.id;
        validated_username = targetAgent.username;
      } else if (dbTargetType === 'member') {
        const targetMember = await db.oneOrNone('SELECT id, username FROM members WHERE username = $1', [dbTargetUsername]);
        if (!targetMember) {
          return res.status(400).json({ success: false, message: '找不到指定的会员' });
        }
        target_id = targetMember.id;
        validated_username = targetMember.username;
      }
    }

    // 如果是正常机率模式或自动侦测模式，需要停用所有其他控制设定
    if (control_mode === 'normal' || control_mode === 'auto_detect') {
      await db.none('UPDATE win_loss_control SET is_active = false, updated_at = CURRENT_TIMESTAMP');
      console.log(`✅ ${control_mode === 'normal' ? '正常机率模式' : '自动侦测模式'}：已停用所有其他控制设定`);
    }
    
    // 如果是代理线控制或单会员控制，需要停用正常机率和自动侦测控制
    if (control_mode === 'agent_line' || control_mode === 'single_member') {
      await db.none(`
        UPDATE win_loss_control 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP 
        WHERE control_mode IN ('normal', 'auto_detect') AND is_active = true
      `);
      console.log(`✅ ${control_mode === 'agent_line' ? '代理线控制' : '单会员控制'}：已停用正常机率和自动侦测控制`);
    }

    // 创建新的控制设定
    const newControl = await db.one(`
      INSERT INTO win_loss_control 
      (control_mode, target_type, target_id, target_username, control_percentage, win_control, loss_control, is_active, start_period, operator_id, operator_username)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10)
      RETURNING *
    `, [
      control_mode, 
      dbTargetType,  // 🔧 使用转换后的值，避免空字串
      target_id, 
      validated_username, 
      control_percentage,
      win_control,
      loss_control,
      start_period,
      agent.id, 
      agent.username
    ]);

    // 记录操作日志
    await safeLogWinLossControl(newControl.id, 'create', null, newControl, agent.id, agent.username);

    console.log('✅ 输赢控制创建成功:', newControl);

    res.json({
      success: true,
      message: '输赢控制设定成功',
      data: newControl
    });
  } catch (error) {
    console.error('创建输赢控制错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 更新输赢控制
app.put(`${API_PREFIX}/win-loss-control/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 检查权限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '权限不足，只有总代理可以使用此功能' 
      });
    }

    const { 
      control_percentage = 50,
      win_control,
      loss_control,
      is_active = true
    } = req.body;

    // 获取旧资料
    const oldControl = await db.oneOrNone('SELECT * FROM win_loss_control WHERE id = $1', [id]);
    if (!oldControl) {
      return res.status(404).json({ success: false, message: '找不到指定的控制设定' });
    }

    // 验证控制类型 - 必须选择赢控制或输控制其中一种（除了正常机率和自动侦测模式）
    if (oldControl.control_mode !== 'normal' && oldControl.control_mode !== 'auto_detect') {
      const finalWinControl = win_control !== undefined ? win_control : oldControl.win_control;
      const finalLossControl = loss_control !== undefined ? loss_control : oldControl.loss_control;
      
      if (finalWinControl === finalLossControl) {
        return res.status(400).json({ 
          success: false, 
          message: finalWinControl ? '不能同时选择赢控制和输控制' : '必须选择赢控制或输控制其中一种' 
        });
      }
    }

    // 如果要启用此控制，先停用其他所有控制
    if (is_active) {
      await db.none('UPDATE win_loss_control SET is_active = false WHERE id != $1', [id]);
    }

    // 使用实际值或保留原值
    const finalWinControl = win_control !== undefined ? win_control : oldControl.win_control;
    const finalLossControl = loss_control !== undefined ? loss_control : oldControl.loss_control;
    
    // 更新控制设定
    const updatedControl = await db.one(`
      UPDATE win_loss_control 
      SET control_percentage = $1, win_control = $2, loss_control = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [control_percentage, finalWinControl, finalLossControl, is_active, id]);

    // 记录操作日志
    await safeLogWinLossControl(id, 'update', oldControl, updatedControl, agent.id, agent.username);

    res.json({
      success: true,
      message: '输赢控制更新成功',
      data: updatedControl
    });
  } catch (error) {
    console.error('更新输赢控制错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 删除输赢控制
app.delete(`${API_PREFIX}/win-loss-control/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 检查权限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '权限不足，只有总代理可以使用此功能' 
      });
    }

    console.log(`[删除] 开始删除控制设定 ID: ${id}`);

    // 获取要删除的资料
    const controlToDelete = await db.oneOrNone('SELECT * FROM win_loss_control WHERE id = $1', [id]);
    if (!controlToDelete) {
      console.log(`[删除] 控制设定 ID ${id} 不存在`);
      return res.status(404).json({ success: false, message: '找不到指定的控制设定' });
    }

    console.log(`[删除] 找到控制设定:`, controlToDelete);

    // 使用事务确保数据一致性
    try {
      await db.tx(async t => {
        // 先删除相关的日志记录
        const deleteLogCount = await t.result('DELETE FROM win_loss_control_logs WHERE control_id = $1', [id]);
        console.log(`[删除] 删除了 ${deleteLogCount.rowCount} 条相关日志记录`);
        
        // 再删除主记录
        await t.none('DELETE FROM win_loss_control WHERE id = $1', [id]);
        console.log(`[删除] 主记录删除成功 ID: ${id}`);
        
        // 记录删除操作（control_id 设为 NULL 避免外键约束）
        await t.none(`
          INSERT INTO win_loss_control_logs 
          (control_id, action, old_values, new_values, operator_id, operator_username, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [null, 'delete', JSON.stringify(controlToDelete), null, agent.id, agent.username]);
        console.log(`[删除] 操作日志记录成功`);
      });
    } catch (deleteError) {
      console.error(`[删除] 删除过程失败:`, deleteError);
      throw deleteError;
    }

    res.json({
      success: true,
      message: '输赢控制删除成功'
    });
  } catch (error) {
    console.error('删除输赢控制错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 内部API - 获取当前活跃的输赢控制设定 (游戏后端专用，无需认证)
app.get(`${API_PREFIX}/internal/win-loss-control/active`, async (req, res) => {
  try {
    // 获取所有活跃的控制设定
    const activeControls = await db.manyOrNone(`
      SELECT wlc.*,
        CASE 
          WHEN wlc.target_type = 'agent' THEN a.username
          WHEN wlc.target_type = 'member' THEN m.username
          ELSE wlc.target_username
        END as target_display_name
      FROM win_loss_control wlc
      LEFT JOIN agents a ON wlc.target_type = 'agent' AND wlc.target_id IS NOT NULL AND wlc.target_id = a.id
      LEFT JOIN members m ON wlc.target_type = 'member' AND wlc.target_id IS NOT NULL AND wlc.target_id = m.id
      WHERE wlc.is_active = true
      ORDER BY wlc.control_mode, wlc.updated_at DESC
    `);

    // 如果有多个控制设定，返回数组；为了向后兼容，如果只有一个或没有，返回单个对象
    if (activeControls && activeControls.length > 1) {
      res.json({
        success: true,
        data: activeControls,
        multiple: true
      });
    } else if (activeControls && activeControls.length === 1) {
      res.json({
        success: true,
        data: activeControls[0],
        multiple: false
      });
    } else {
      res.json({
        success: true,
        data: { control_mode: 'normal', is_active: false },
        multiple: false
      });
    }
  } catch (error) {
    console.error('获取活跃输赢控制错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 获取当前活跃的输赢控制设定
app.get(`${API_PREFIX}/win-loss-control/active`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 检查权限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '权限不足，只有总代理可以使用此功能' 
      });
    }

    const activeControl = await db.oneOrNone(`
      SELECT wlc.*,
        CASE 
          WHEN wlc.target_type = 'agent' THEN a.username
          WHEN wlc.target_type = 'member' THEN m.username
          ELSE wlc.target_username
        END as target_display_name
      FROM win_loss_control wlc
      LEFT JOIN agents a ON wlc.target_type = 'agent' AND wlc.target_id IS NOT NULL AND wlc.target_id = a.id
      LEFT JOIN members m ON wlc.target_type = 'member' AND wlc.target_id IS NOT NULL AND wlc.target_id = m.id
      WHERE wlc.is_active = true
      ORDER BY wlc.updated_at DESC
      LIMIT 1
    `);

    res.json({
      success: true,
      data: activeControl || { control_mode: 'normal', is_active: false }
    });
  } catch (error) {
    console.error('获取活跃输赢控制错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 获取代理列表 - 用于输赢控制目标选择
app.get(`${API_PREFIX}/win-loss-control/agents`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 检查权限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '权限不足，只有总代理可以使用此功能' 
      });
    }

    // 获取所有代理，包含层级信息
    const agents = await db.any(`
      SELECT id, username, level, status, created_at,
        CASE 
          WHEN level = 0 THEN '总代理'
          WHEN level = 1 THEN '一级代理'
          WHEN level = 2 THEN '二级代理'
          WHEN level = 3 THEN '三级代理'
          ELSE level::text || '级代理'
        END as level_name
      FROM agents
      WHERE status IN (0, 1, 2)
      ORDER BY level ASC, username ASC
    `);

    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    console.error('获取代理列表错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 获取会员列表 - 用于输赢控制目标选择
app.get(`${API_PREFIX}/win-loss-control/members`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 检查权限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '权限不足，只有总代理可以使用此功能' 
      });
    }

    // 获取所有会员，包含创建代理信息
    const members = await db.any(`
      SELECT m.id, m.username, m.status, m.created_at, m.agent_id,
        a.username as agent_username,
        CASE 
          WHEN a.level = 0 THEN '总代理'
          WHEN a.level = 1 THEN '一级代理'
          WHEN a.level = 2 THEN '二级代理'
          WHEN a.level = 3 THEN '三级代理'
          ELSE a.level::text || '级代理'
        END as agent_level_name
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.status IN (0, 1)
      ORDER BY a.level ASC, a.username ASC, m.username ASC
    `);

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('获取会员列表错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 获取当前期数 - 用于设定控制开始期数
app.get(`${API_PREFIX}/win-loss-control/current-period`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 检查权限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '权限不足，只有总代理可以使用此功能' 
      });
    }

    // 从资料库获取当前期数（优先使用资料库，因为游戏系统可能未运行）
    let currentPeriod;
    try {
      // 从result_history表中查询最新期数（这是实际开奖记录表）
      const latestDraw = await db.oneOrNone(`
        SELECT period 
        FROM result_history 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      
      if (latestDraw && latestDraw.period) {
        currentPeriod = parseInt(latestDraw.period);
        console.log('从资料库获取当前期数:', currentPeriod);
      } else {
        // 如果没有记录，使用当天的第一期
        const today = new Date();
        const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
        currentPeriod = parseInt(todayStr + '001');
      }
    } catch (error) {
      console.error('查询期数错误:', error);
      // 使用当天的第一期作为预设值
      const today = new Date();
      const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
      currentPeriod = parseInt(todayStr + '001');
    }
    
    // 使用正确的期数递增逻辑
    function getNextPeriod(currentPeriod) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
      
      const currentPeriodStr = currentPeriod.toString();
      
      // 检查当前期号是否为今天
      if (currentPeriodStr.startsWith(todayStr)) {
        // 提取期号后缀并递增
        const suffix = parseInt(currentPeriodStr.substring(8)) + 1;
        
        // 如果超过999场，使用4位数字，但保持日期部分不变
        if (suffix > 999) {
          return `${todayStr}${suffix.toString().padStart(4, '0')}`;
        } else {
          return parseInt(`${todayStr}${suffix.toString().padStart(3, '0')}`);
        }
      } else {
        // 新的一天，重置期号为001
        return parseInt(`${todayStr}001`);
      }
    }
    
    const nextPeriod = getNextPeriod(currentPeriod);

    res.json({
      success: true,
      data: {
        current_period: currentPeriod,
        next_period: nextPeriod,
        suggested_start: nextPeriod
      }
    });
  } catch (error) {
    console.error('获取当前期数错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 激活输赢控制设定
app.put(`${API_PREFIX}/win-loss-control/:id/activate`, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 身份验证 - 优先使用会话token
    const sessionToken = req.headers['x-session-token'];
    const authHeader = req.headers.authorization;
    
    if (!sessionToken && !authHeader) {
      return res.status(401).json({ success: false, message: '需要身份验证' });
    }

    let sessionData;
    if (sessionToken) {
      sessionData = await SessionManager.validateSession(sessionToken);
    } else {
      const token = authHeader.split(' ')[1];
      sessionData = await SessionManager.validateSession(token);
    }
    
    if (!sessionData || sessionData.userType !== 'agent') {
      return res.status(401).json({ success: false, message: '无效的会话' });
    }

    const agent = await AgentModel.findById(sessionData.userId);
    if (!agent || !checkWinLossControlPermission(agent)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    // 检查控制设定是否存在
    const control = await db.oneOrNone('SELECT * FROM win_loss_control WHERE id = $1', [id]);
    if (!control) {
      return res.status(404).json({ success: false, message: '控制设定不存在' });
    }

    // 如果启用的是正常机率模式或自动侦测模式，需要先停用所有其他控制
    if (control.control_mode === 'normal' || control.control_mode === 'auto_detect') {
      await db.none('UPDATE win_loss_control SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id != $1', [id]);
      console.log(`✅ 启用${control.control_mode === 'normal' ? '正常机率模式' : '自动侦测模式'}：已停用所有其他控制设定`);
    }
    
    // 如果启用的是代理线控制或单会员控制，需要停用正常机率和自动侦测控制
    if (control.control_mode === 'agent_line' || control.control_mode === 'single_member') {
      await db.none(`
        UPDATE win_loss_control 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP 
        WHERE control_mode IN ('normal', 'auto_detect') AND is_active = true AND id != $1
      `, [id]);
      console.log(`✅ 启用${control.control_mode === 'agent_line' ? '代理线控制' : '单会员控制'}：已停用正常机率和自动侦测控制`);
    }

    // 激活指定控制
    await db.none('UPDATE win_loss_control SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    
    // 如果不是正常机率模式，检查是否有相同目标的其他活跃控制
    if (control.control_mode !== 'normal' && control.target_type && control.target_id) {
      const otherControls = await db.manyOrNone(`
        SELECT id, control_mode, win_control, loss_control 
        FROM win_loss_control 
        WHERE target_type = $1 
        AND target_id = $2 
        AND id != $3 
        AND is_active = true
      `, [control.target_type, control.target_id, id]);

      if (otherControls && otherControls.length > 0) {
        console.log(`⚠️ 目标 ${control.target_username} 现在有 ${otherControls.length + 1} 个活跃的控制设定`);
      }
    }

    // 记录操作日志
    await safeLogWinLossControl(id, 'activate', null, null, agent.id, agent.username);

    res.json({ success: true, message: '控制设定已激活' });
  } catch (error) {
    console.error('激活控制设定错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 停用输赢控制设定
app.put(`${API_PREFIX}/win-loss-control/:id/deactivate`, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 身份验证 - 优先使用会话token
    const sessionToken = req.headers['x-session-token'];
    const authHeader = req.headers.authorization;
    
    if (!sessionToken && !authHeader) {
      return res.status(401).json({ success: false, message: '需要身份验证' });
    }

    let sessionData;
    if (sessionToken) {
      sessionData = await SessionManager.validateSession(sessionToken);
    } else {
      const token = authHeader.split(' ')[1];
      sessionData = await SessionManager.validateSession(token);
    }
    
    if (!sessionData || sessionData.userType !== 'agent') {
      return res.status(401).json({ success: false, message: '无效的会话' });
    }

    const agent = await AgentModel.findById(sessionData.userId);
    if (!agent || !checkWinLossControlPermission(agent)) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }

    // 检查控制设定是否存在
    const control = await db.oneOrNone('SELECT * FROM win_loss_control WHERE id = $1', [id]);
    if (!control) {
      return res.status(404).json({ success: false, message: '控制设定不存在' });
    }

    // 停用控制
    await db.none('UPDATE win_loss_control SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    // 记录操作日志
    await safeLogWinLossControl(id, 'deactivate', null, null, agent.id, agent.username);

    res.json({ success: true, message: '控制设定已停用' });
  } catch (error) {
    console.error('停用控制设定错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 跑马灯API
// 获取跑马灯讯息
app.get(`${API_PREFIX}/marquee-messages`, async (req, res) => {
  try {
    console.log('获取跑马灯讯息');
    
    const messages = await db.any(`
      SELECT id, message, priority, is_active, created_at 
      FROM marquee_messages 
      ORDER BY priority DESC, created_at DESC
    `);
    
    res.json({
      success: true,
      messages: messages
    });
  } catch (error) {
    console.error('获取跑马灯讯息错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 新增跑马灯讯息
app.post(`${API_PREFIX}/marquee-messages`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 检查是否是总代理
    if (agent.level !== 0) {
      return res.status(403).json({ success: false, message: '只有总代理可以设定跑马灯' });
    }

    const { message, priority = 0 } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: '请提供讯息内容' });
    }

    const result = await db.one(`
      INSERT INTO marquee_messages (message, priority, created_by) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `, [message.trim(), priority, agent.id]);

    res.json({
      success: true,
      message: '跑马灯讯息已新增',
      data: result
    });
  } catch (error) {
    console.error('新增跑马灯讯息错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 更新跑马灯讯息状态
app.put(`${API_PREFIX}/marquee-messages/:id`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 检查是否是总代理
    if (agent.level !== 0) {
      return res.status(403).json({ success: false, message: '只有总代理可以设定跑马灯' });
    }

    const { id } = req.params;
    const { is_active } = req.body;
    
    await db.none(`
      UPDATE marquee_messages 
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [is_active, id]);

    res.json({
      success: true,
      message: `跑马灯讯息已${is_active ? '启用' : '停用'}`
    });
  } catch (error) {
    console.error('更新跑马灯讯息错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 删除跑马灯讯息
app.delete(`${API_PREFIX}/marquee-messages/:id`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 检查是否是总代理
    if (agent.level !== 0) {
      return res.status(403).json({ success: false, message: '只有总代理可以设定跑马灯' });
    }

    const { id } = req.params;
    
    await db.none('DELETE FROM marquee_messages WHERE id = $1', [id]);

    res.json({
      success: true,
      message: '跑马灯讯息已删除'
    });
  } catch (error) {
    console.error('删除跑马灯讯息错误:', error);
    res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 获取代理的会员列表
app.get(`${API_PREFIX}/members`, async (req, res) => {
  try {
    console.log('获取会员列表API: 接收请求', req.query);
    
    // 直接从查询参数获取agentId
    const { agentId, status = '-1', page = 1, limit = 20 } = req.query;
    
    if (!agentId) {
      console.log('获取会员列表API: 未提供agentId');
      return res.json({
        success: false,
        message: '请提供代理ID'
      });
    }
    
    try {
      // 获取会员列表
      const members = await MemberModel.findByAgentId(agentId, status, page, limit);
      
      // 获取会员总数
      const total = await MemberModel.countByAgentId(agentId, status);
      
      console.log(`获取会员列表API: 成功找到 ${members.length} 位会员，总计 ${total} 位`);
      
      return res.json({
        success: true,
        data: {
          list: members,
          total: total,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (queryError) {
      console.error('获取会员列表API: 查询错误', queryError);
      // 返回空列表而非500错误
      return res.json({
        success: true,
        data: {
          list: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    }
  } catch (error) {
    console.error('获取会员列表API: 处理错误', error);
    return res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 获取代理的下级代理列表
app.get(`${API_PREFIX}/sub-agents`, async (req, res) => {
  try {
    console.log('获取下级代理API: 接收请求', req.query);
    
    // 直接从查询参数获取
    const { parentId = '', level = '-1', status = '-1', page = 1, limit = 20 } = req.query;
    
    console.log(`获取下级代理API: 接收请求 parentId=${parentId}, level=${level}, status=${status}, page=${page}, limit=${limit}`);
    
    try {
      // 获取下级代理列表
      const agents = await AgentModel.findByParentId(parentId, level, status, page, limit);
      console.log(`获取下级代理API: 成功找到 ${agents.length} 位代理`);
      
      // 获取下级代理总数
      let total = 0;
      
      if (parentId && parentId !== '') {
        const parsedParentId = parseInt(parentId);
        if (!isNaN(parsedParentId)) {
          const result = await db.one('SELECT COUNT(*) FROM agents WHERE parent_id = $1', [parsedParentId]);
          total = parseInt(result.count);
        }
      } else {
        const result = await db.one('SELECT COUNT(*) FROM agents');
        total = parseInt(result.count);
      }
      
      console.log(`获取下级代理API: 总共 ${total} 位代理`);
      
      return res.json({
        success: true,
        data: {
          list: agents,
          total: total,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    } catch (queryError) {
      console.error('获取下级代理API: 查询错误', queryError);
      // 返回空列表而非500错误
      return res.json({
        success: true,
        data: {
          list: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });
    }
  } catch (error) {
    console.error('获取下级代理API: 处理错误', error);
    return res.status(500).json({ success: false, message: '伺服器错误' });
  }
});

// 获取单个代理详细资料
app.get(`${API_PREFIX}/agents/:id`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { id } = req.params;
    
    const agent = await db.oneOrNone(`
      SELECT 
        a.*,
        p.username as parent_username
      FROM agents a
      LEFT JOIN agents p ON a.parent_id = p.id
      WHERE a.id = $1
    `, [id]);
    
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('获取代理详细资料失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 更新代理状态
app.put(`${API_PREFIX}/update-status`, async (req, res) => {
  const { id, status } = req.body;
  
  try {
    // 更新代理状态
    const agent = await AgentModel.updateStatus(id, status);
    
    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('更新代理状态出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 更新代理备注
app.post(`${API_PREFIX}/update-agent-notes`, async (req, res) => {
  try {
    const { agentId, notes } = req.body;
    
    if (!agentId) {
      return res.json({
        success: false,
        message: '缺少代理ID'
      });
    }
    
    // 检查代理是否存在
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 更新备注
    await db.none('UPDATE agents SET notes = $1, updated_at = NOW() WHERE id = $2', [notes || '', agentId]);
    
    res.json({
      success: true,
      message: '代理备注更新成功'
    });
    
  } catch (error) {
    console.error('更新代理备注失败:', error);
    res.status(500).json({
      success: false,
      message: '更新代理备注失败'
    });
  }
});

// 更新会员备注
app.post(`${API_PREFIX}/update-member-notes`, async (req, res) => {
  try {
    const { memberId, notes } = req.body;
    
    if (!memberId) {
      return res.json({
        success: false,
        message: '缺少会员ID'
      });
    }
    
    // 检查会员是否存在
    const member = await MemberModel.findById(memberId);
    if (!member) {
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    // 更新备注
    await db.none('UPDATE members SET notes = $1, updated_at = NOW() WHERE id = $2', [notes || '', memberId]);
    
    res.json({
      success: true,
      message: '会员备注更新成功'
    });
    
  } catch (error) {
    console.error('更新会员备注失败:', error);
    res.status(500).json({
      success: false,
      message: '更新会员备注失败'
    });
  }
});

// 创建会员
app.post(`${API_PREFIX}/create-member`, async (req, res) => {
  const { username, password, agentId, notes } = req.body;
  
  try {
    // 验证用户名格式（只允许英文、数字）
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!username || !usernameRegex.test(username)) {
      return res.json({
        success: false,
        message: '用户名只能包含英文字母和数字'
      });
    }
    
    // 验证密码长度（至少6码）
    if (!password || password.length < 6) {
      return res.json({
        success: false,
        message: '密码至少需要6个字符'
      });
    }
    
    // 检查用户名是否已存在（检查会员表、代理表和子帐号表）
    const existingMember = await MemberModel.findByUsername(username);
    if (existingMember) {
      return res.json({
        success: false,
        message: '该用户名已被使用（会员）'
      });
    }
    
    const existingAgent = await AgentModel.findByUsername(username);
    if (existingAgent) {
      return res.json({
        success: false,
        message: '该用户名已被使用（代理）'
      });
    }
    
    // 检查子帐号表
    const existingSubAccount = await db.oneOrNone(`
      SELECT id FROM sub_accounts WHERE username = $1
    `, [username]);
    
    if (existingSubAccount) {
      return res.json({
        success: false,
        message: '该用户名已被使用（子帐号）'
      });
    }
    
    // 检查代理是否存在
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 创建会员 - 继承代理的盘口类型
    const newMember = await MemberModel.create({
      username,
      password,
      agent_id: agentId,
      balance: 0, // 初始余额
      notes: notes || '',
      market_type: agent.market_type || 'D' // 继承代理的盘口类型
    });
    
    res.json({
      success: true,
      member: {
        id: newMember.id,
        username: newMember.username
      }
    });
  } catch (error) {
    console.error('创建会员出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 代为创建会员
app.post(`${API_PREFIX}/create-member-for-agent`, async (req, res) => {
  const { username, password, agentId, initialBalance, createdBy } = req.body;
  
  try {
    console.log(`代为创建会员请求: 用户名=${username}, 代理ID=${agentId}, 初始余额=${initialBalance}, 创建者=${createdBy}`);
    
    // 检查用户名是否已存在（检查会员表、代理表和子帐号表）
    const existingMember = await MemberModel.findByUsername(username);
    if (existingMember) {
      return res.json({
        success: false,
        message: '该用户名已被使用（会员）'
      });
    }
    
    const existingAgent = await AgentModel.findByUsername(username);
    if (existingAgent) {
      return res.json({
        success: false,
        message: '该用户名已被使用（代理）'
      });
    }
    
    // 检查子帐号表
    const existingSubAccount = await db.oneOrNone(`
      SELECT id FROM sub_accounts WHERE username = $1
    `, [username]);
    
    if (existingSubAccount) {
      return res.json({
        success: false,
        message: '该用户名已被使用（子帐号）'
      });
    }
    
    // 检查目标代理是否存在
    const targetAgent = await AgentModel.findById(agentId);
    if (!targetAgent) {
      return res.json({
        success: false,
        message: '目标代理不存在'
      });
    }
    
    // 检查创建者是否存在
    const creator = await AgentModel.findById(createdBy);
    if (!creator) {
      return res.json({
        success: false,
        message: '创建者代理不存在'
      });
    }
    
    // 检查代理层级是否达到最大值 (15层)
    if (targetAgent.level >= 15) {
      return res.json({
        success: false,
        message: '该代理已达到最大层级（15层），无法再创建下级会员'
      });
    }
    
    const initialBal = parseFloat(initialBalance) || 0;
    
    // 如果设定了初始余额，检查创建者余额是否足够
    if (initialBal > 0) {
      if (parseFloat(creator.balance) < initialBal) {
        return res.json({
          success: false,
          message: '您的余额不足以设定该初始余额'
        });
      }
    }
    
    // 开始数据库事务
    await db.tx(async t => {
      // 创建会员 - 继承代理的盘口类型
      const newMember = await t.one(`
        INSERT INTO members (username, password, agent_id, balance, status, market_type, created_at)
        VALUES ($1, $2, $3, $4, 1, $5, NOW())
        RETURNING id, username, balance
      `, [username, password, agentId, initialBal, targetAgent.market_type || 'D']);
      
      // 如果设定了初始余额，从创建者余额中扣除
      if (initialBal > 0) {
        // 扣除创建者余额
        await t.none(`
          UPDATE agents 
          SET balance = balance - $1, updated_at = NOW()
          WHERE id = $2
        `, [initialBal, createdBy]);
        
        // 记录点数转移
        await t.none(`
          INSERT INTO point_transfers (from_user_type, from_user_id, to_user_type, to_user_id, amount, transfer_type, description, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, ['agent', createdBy, 'member', newMember.id, initialBal, 'agent_to_member', `代为创建会员 ${username} 的初始余额`]);
      }
      
      return newMember;
    });
    
    // 获取更新后的创建者余额
    const updatedCreator = await AgentModel.findById(createdBy);
    
    console.log(`成功代为创建会员: ${username}, 代理: ${targetAgent.username}, 初始余额: ${initialBal}`);
    
    res.json({
      success: true,
      message: `成功为代理 ${targetAgent.username} 创建会员 ${username}`,
      member: {
        id: newMember.id,
        username: newMember.username,
        balance: initialBal,
        agent_id: agentId
      },
      newBalance: updatedCreator.balance
    });
    
  } catch (error) {
    console.error('代为创建会员出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 更新会员状态
app.put(`${API_PREFIX}/update-member-status`, async (req, res) => {
  const { id, status } = req.body;
  
  try {
    // 更新会员状态
    const member = await MemberModel.updateStatus(id, status);
    
    res.json({
      success: true,
      member
    });
  } catch (error) {
    console.error('更新会员状态出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 修复会员验证端点
app.post(`${API_PREFIX}/verify-member`, async (req, res) => {
  const { username, password } = req.body;
  
  console.log('收到会员验证请求:', { username, password: '***' });
  
  try {
    // 查询会员
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      console.log(`会员 ${username} 不存在`);
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    // 检查密码
    if (member.password !== password) {
      console.log(`会员 ${username} 密码错误`);
      return res.json({
        success: false,
        message: '密码错误'
      });
    }
    
    // 检查状态
    if (member.status !== 1) {
      console.log(`会员 ${username} 帐号已被禁用`);
      return res.json({
        success: false,
        message: '帐号已被禁用'
      });
    }
    
    // 获取会员的代理
    const agent = await AgentModel.findById(member.agent_id);
    
    console.log(`会员 ${username} 验证成功`);
    
    res.json({
      success: true,
      member: {
        id: member.id,
        username: member.username,
        balance: member.balance,
        status: member.status,
        agent: agent ? {
          id: agent.id,
          username: agent.username
        } : null
      }
    });
  } catch (error) {
    console.error('会员验证出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 新增: 会员余额查询API
app.get(`${API_PREFIX}/member-balance`, async (req, res) => {
  const { username } = req.query;
  
  try {
    if (!username) {
      return res.json({
        success: false,
        message: '请提供会员用户名'
      });
    }
    
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    res.json({
      success: true,
      balance: member.balance
    });
  } catch (error) {
    console.error('获取会员余额出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 更新会员余额 API 端点 - 修改为点数转移逻辑
app.post(`${API_PREFIX}/update-member-balance`, async (req, res) => {
  const { agentId, username, amount, type, description } = req.body;
  
  console.log(`收到更新会员余额请求: 代理ID=${agentId}, 会员=${username}, 金额=${amount}, 类型=${type}, 说明=${description}`);
  console.log(`请求体:`, JSON.stringify(req.body));
  
  try {
    if (!username || amount === undefined || !agentId) {
      console.error('更新会员余额失败: 缺少必要参数');
      return res.json({
        success: false,
        message: '请提供代理ID、会员用户名和变更金额'
      });
    }
    
    // 查询会员
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      console.error(`更新会员余额失败: 会员 ${username} 不存在`);
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    console.log(`找到会员: ID=${member.id}, 用户名=${member.username}`);
    
    // 查询代理
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      console.error(`更新会员余额失败: 代理 ID=${agentId} 不存在`);
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    console.log(`找到代理: ID=${agent.id}, 用户名=${agent.username}`);
    
    const parsedAmount = parseFloat(amount);
    console.log(`处理点数转移: 金额=${parsedAmount}`);
    
    // 根据操作类型执行不同的点数转移
    let result;
    
    try {
      if (parsedAmount > 0) {
        // 从代理转移点数到会员
        console.log(`执行代理到会员的点数转移: 金额=${parsedAmount}`);
        result = await PointTransferModel.transferFromAgentToMember(
          agent.id, 
          member.id, 
          parsedAmount, 
          description || ''
        );
      } else if (parsedAmount < 0) {
        // 从会员转移点数到代理
        console.log(`执行会员到代理的点数转移: 金额=${Math.abs(parsedAmount)}`);
        result = await PointTransferModel.transferFromMemberToAgent(
          member.id, 
          agent.id, 
          Math.abs(parsedAmount), 
          description || ''
        );
      } else {
        console.error('更新会员余额失败: 转移点数必须不等于0');
        return res.json({
          success: false,
          message: '转移点数必须不等于0'
        });
      }
      
      // 查询更新后的代理余额
      const updatedAgent = await AgentModel.findById(agent.id);
      
      console.log(`点数转移成功: 会员余额=${result.balance}, 代理余额=${updatedAgent.balance}`);
      
      res.json({
        success: true,
        newBalance: result.balance,
        agentBalance: updatedAgent.balance
      });
    } catch (error) {
      console.error('点数转移处理出错:', error);
      res.status(500).json({
        success: false,
        message: error.message || '点数转移处理出错，请稍后再试'
      });
    }
  } catch (error) {
    console.error('更新会员余额出错:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系统错误，请稍后再试'
    });
  }
});

// 新增: 会员余额同步API（用于下注/中奖，不扣代理点数）
app.post(`${API_PREFIX}/sync-member-balance`, async (req, res) => {
  const { username, balance, reason } = req.body;
  
  try {
    if (!username || balance === undefined) {
      return res.json({
        success: false,
        message: '请提供会员用户名和余额'
      });
    }
    
    // 查询会员
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      console.log(`同步余额失败: 会员 ${username} 不存在`);
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    // 更新会员余额（不影响代理余额）
    await MemberModel.setBalance(username, balance);
    
    console.log(`会员 ${username} 余额已同步为: ${balance}，原因: ${reason || '系统同步'}`);
    
    res.json({
      success: true,
      message: '余额同步成功',
      balance: balance
    });
  } catch (error) {
    console.error('同步会员余额出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 新增: 清空点数转移记录API（仅用于测试）
app.delete(`${API_PREFIX}/clear-transfers`, async (req, res) => {
  try {
    // 删除所有点数转移记录
    await db.none('DELETE FROM point_transfers');
    
    // 也清空相关的transactions记录（可选）
    await db.none('DELETE FROM transactions');
    
    console.log('所有点数转移记录已清空');
    
    res.json({
      success: true,
      message: '所有点数转移记录已清空'
    });
  } catch (error) {
    console.error('清空点数转移记录出错:', error);
    res.status(500).json({
      success: false,
      message: '清空记录失败，请稍后再试'
    });
  }
});

// 新增: 点数转移记录API
app.get(`${API_PREFIX}/point-transfers`, async (req, res) => {
  const { userType, userId, agentId, limit = 50 } = req.query;
  
  try {
    // 如果提供了 agentId，优先使用它
    const actualUserType = agentId ? 'agent' : userType;
    const actualUserId = agentId || userId;
    
    if (!actualUserType || !actualUserId) {
      return res.json({
        success: false,
        message: '请提供用户类型和ID或代理ID'
      });
    }
    
    const transfers = await PointTransferModel.getTransferRecords(actualUserType, actualUserId, limit);
    
    res.json({
      success: true,
      transfers
    });
  } catch (error) {
    console.error('获取点数转移记录出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 获取代理余额
app.get(`${API_PREFIX}/agent-balance`, async (req, res) => {
  const { agentId } = req.query;
  
  try {
    if (!agentId) {
      return res.json({
        success: false,
        message: '请提供代理ID'
      });
    }
    
    // 查询代理信息
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    res.json({
      success: true,
      balance: agent.balance
    });
  } catch (error) {
    console.error('获取代理余额出错:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系统错误，请稍后再试'
    });
  }
});

// 代理间点数转移 API 端点
app.post(`${API_PREFIX}/transfer-agent-balance`, async (req, res) => {
  const { agentId, subAgentId, amount, type, description } = req.body;
  
  console.log(`收到代理点数转移请求: 上级代理ID=${agentId}, 下级代理ID=${subAgentId}, 金额=${amount}, 类型=${type}, 说明=${description}`);
  console.log(`请求体:`, JSON.stringify(req.body));
  
  try {
    if (!agentId || !subAgentId || amount === undefined || !type) {
      console.error('代理点数转移失败: 缺少必要参数');
      return res.json({
        success: false,
        message: '请提供完整的转移参数'
      });
    }
    
    // 查询上级代理
    const parentAgent = await AgentModel.findById(agentId);
    if (!parentAgent) {
      console.error(`代理点数转移失败: 上级代理 ID=${agentId} 不存在`);
      return res.json({
        success: false,
        message: '上级代理不存在'
      });
    }
    console.log(`找到上级代理: ID=${parentAgent.id}, 用户名=${parentAgent.username}, 余额=${parentAgent.balance}`);
    
    // 查询下级代理
    const subAgent = await AgentModel.findById(subAgentId);
    if (!subAgent) {
      console.error(`代理点数转移失败: 下级代理 ID=${subAgentId} 不存在`);
      return res.json({
        success: false,
        message: '下级代理不存在'
      });
    }
    console.log(`找到下级代理: ID=${subAgent.id}, 用户名=${subAgent.username}, 余额=${subAgent.balance}`);
    
    // 验证代理层级关系（检查是否为上级代理）
    const canManageAgent = await canAgentManageAgent(parentAgent.id, subAgent.id);
    if (!canManageAgent) {
      console.error(`代理点数转移失败: 代理 ${parentAgent.username} 无权限操作代理 ${subAgent.username}`);
      return res.json({
        success: false,
        message: '只能对下线代理进行点数转移'
      });
    }
    console.log(`权限检查通过: 代理 ${parentAgent.username} 可以操作代理 ${subAgent.username}`);
    
    const transferAmount = Math.abs(parseFloat(amount));
    console.log(`处理代理点数转移: 金额=${transferAmount}, 类型=${type}`);
    
    // 根据操作类型执行不同的点数转移
    let result;
    try {
      if (type === 'deposit') {
        // 上级代理存入点数给下级代理
        console.log(`执行上级代理到下级代理的点数转移: 金额=${transferAmount}`);
        result = await PointTransferModel.transferFromAgentToAgent(
          parentAgent.id, 
          subAgent.id, 
          transferAmount, 
          description || '',
          false // 一般点数转移，不是客服操作
        );
        
      } else if (type === 'withdraw') {
        // 上级代理从下级代理提领点数
        console.log(`执行下级代理到上级代理的点数转移: 金额=${transferAmount}`);
        result = await PointTransferModel.transferFromAgentToAgent(
          subAgent.id, 
          parentAgent.id, 
          transferAmount, 
          description || '',
          false // 一般点数转移，不是客服操作
        );
        
      } else {
        console.error('代理点数转移失败: 无效的转移类型');
        return res.json({
          success: false,
          message: '无效的转移类型'
        });
      }
      
      // 重新查询最新的上级代理和下级代理余额
      const updatedParentAgent = await AgentModel.findById(parentAgent.id);
      const updatedSubAgent = await AgentModel.findById(subAgent.id);
      
      const finalParentBalance = parseFloat(updatedParentAgent.balance);
      const finalSubAgentBalance = parseFloat(updatedSubAgent.balance);
      
      console.log(`代理点数转移成功: 上级代理余额=${finalParentBalance}, 下级代理余额=${finalSubAgentBalance}`);
      
      res.json({
        success: true,
        message: '代理点数转移成功',
        parentBalance: finalParentBalance,
        subAgentBalance: finalSubAgentBalance
      });
      
    } catch (error) {
      console.error('代理点数转移处理出错:', error);
      res.status(500).json({
        success: false,
        message: error.message || '代理点数转移处理出错，请稍后再试'
      });
    }
  } catch (error) {
    console.error('代理点数转移出错:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系统错误，请稍后再试'
    });
  }
});

// 会员点数转移 API 端点
app.post(`${API_PREFIX}/transfer-member-balance`, async (req, res) => {
  const { agentId, memberId, amount, type, description } = req.body;
  
  console.log(`收到会员点数转移请求: 代理ID=${agentId}, 会员ID=${memberId}, 金额=${amount}, 类型=${type}, 说明=${description}`);
  console.log(`请求体:`, JSON.stringify(req.body));
  
  try {
    if (!agentId || !memberId || amount === undefined || !type) {
      console.error('会员点数转移失败: 缺少必要参数');
      return res.json({
        success: false,
        message: '请提供完整的转移参数'
      });
    }
    
    // 查询代理
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      console.error(`会员点数转移失败: 代理 ID=${agentId} 不存在`);
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    console.log(`找到代理: ID=${agent.id}, 用户名=${agent.username}, 余额=${agent.balance}`);
    
    // 查询会员
    const member = await MemberModel.findById(memberId);
    if (!member) {
      console.error(`会员点数转移失败: 会员 ID=${memberId} 不存在`);
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    console.log(`找到会员: ID=${member.id}, 用户名=${member.username}, 余额=${member.balance}`);
    
    // 验证会员归属关系（检查是否为上级代理）
    const canManage = await canAgentManageMember(agent.id, member.id);
    if (!canManage) {
      console.error(`会员点数转移失败: 代理 ${agent.username} 无权限操作会员 ${member.username}`);
      return res.json({
        success: false,
        message: '只能对下线代理创建的会员进行点数转移'
      });
    }
    console.log(`权限检查通过: 代理 ${agent.username} 可以操作会员 ${member.username}`);
    
    const transferAmount = Math.abs(parseFloat(amount));
    console.log(`处理会员点数转移: 金额=${transferAmount}, 类型=${type}`);
    
          // 根据操作类型执行不同的点数转移
      let result;
      try {
        if (type === 'deposit') {
          // 代理存入点数给会员
          console.log(`执行代理到会员的点数转移: 金额=${transferAmount}`);
          console.log(`🔍 调用transferFromAgentToMember: agentId=${agent.id}, memberId=${member.id}, amount=${transferAmount}, isCustomerServiceOperation=false`);
          result = await PointTransferModel.transferFromAgentToMember(
            agent.id, 
            member.id, 
            transferAmount, 
            description || '',
            false // 一般点数转移，不是客服操作
          );
          
        } else if (type === 'withdraw') {
          // 代理从会员提领点数
          console.log(`执行会员到代理的点数转移: 金额=${transferAmount}`);
          console.log(`🔍 调用transferFromMemberToAgent: memberId=${member.id}, agentId=${agent.id}, amount=${transferAmount}, isCustomerServiceOperation=false`);
          result = await PointTransferModel.transferFromMemberToAgent(
            member.id, 
            agent.id, 
            transferAmount, 
            description || '',
            false // 一般点数转移，不是客服操作
          );
          
        } else {
          console.error('会员点数转移失败: 无效的转移类型');
          return res.json({
            success: false,
            message: '无效的转移类型'
          });
        }
        
        // 重新查询最新的代理和会员余额
        const updatedAgent = await AgentModel.findById(agent.id);
        const updatedMember = await MemberModel.findById(member.id);
        
        const finalAgentBalance = parseFloat(updatedAgent.balance);
        const finalMemberBalance = parseFloat(updatedMember.balance);
        
        console.log(`会员点数转移成功: 代理余额=${finalAgentBalance}, 会员余额=${finalMemberBalance}`);
        
        res.json({
          success: true,
          message: '会员点数转移成功',
          parentBalance: finalAgentBalance,
          memberBalance: finalMemberBalance
        });
      
    } catch (error) {
      console.error('会员点数转移处理出错:', error);
      res.status(500).json({
        success: false,
        message: error.message || '会员点数转移处理出错，请稍后再试'
      });
    }
  } catch (error) {
    console.error('会员点数转移出错:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系统错误，请稍后再试'
    });
  }
});

// 获取公告
app.get(`${API_PREFIX}/notices`, async (req, res) => {
  try {
    const { category = null, limit = 50 } = req.query;
    
    // 获取公告
    const notices = await NoticeModel.findAll(parseInt(limit), category);
    
    // 获取所有分类
    const categories = await NoticeModel.getCategories();
    
    res.json({
      success: true,
      notices,
      categories
    });
  } catch (error) {
    console.error('获取公告出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 新增系统公告 (仅总代理可用)
app.post(`${API_PREFIX}/create-notice`, async (req, res) => {
  try {
    const { operatorId, title, content, category } = req.body;
    
    // 参数验证
    if (!operatorId || !title || !content) {
      return res.json({
        success: false,
        message: '请提供操作员ID、标题和内容'
      });
    }
    
    // 检查操作员是否为总代理（客服）
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '权限不足，只有总代理可以创建系统公告'
      });
    }
    
    // 验证分类
    const validCategories = ['最新公告', '维修', '活动'];
    const finalCategory = validCategories.includes(category) ? category : '最新公告';
    
    // 创建公告
    const newNotice = await NoticeModel.create(
      title.substring(0, 100), // 限制标题长度
      content,
      finalCategory
    );
    
    console.log(`总代理 ${operatorId} 创建新公告: "${title}"`);
    
    res.json({
      success: true,
      message: '系统公告创建成功',
      notice: newNotice
    });
    
  } catch (error) {
    console.error('创建系统公告出错:', error);
    res.status(500).json({
      success: false,
      message: '创建公告失败，请稍后再试'
    });
  }
});

// 编辑系统公告 (仅总代理可用)
app.put(`${API_PREFIX}/notice/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    const { operatorId, title, content, category } = req.body;
    
    // 参数验证
    if (!operatorId || !title || !content) {
      return res.json({
        success: false,
        message: '请提供操作员ID、标题和内容'
      });
    }
    
    // 检查操作员是否为总代理（客服）
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '权限不足，只有总代理可以编辑系统公告'
      });
    }
    
    // 检查公告是否存在
    const existingNotice = await NoticeModel.findById(id);
    if (!existingNotice) {
      return res.json({
        success: false,
        message: '公告不存在或已被删除'
      });
    }
    
    // 验证分类
    const validCategories = ['最新公告', '维修', '活动'];
    const finalCategory = validCategories.includes(category) ? category : '最新公告';
    
    // 更新公告
    const updatedNotice = await NoticeModel.update(
      id,
      title.substring(0, 100), // 限制标题长度
      content,
      finalCategory
    );
    
    console.log(`总代理 ${operatorId} 编辑公告 ${id}: "${title}"`);
    
    res.json({
      success: true,
      message: '系统公告更新成功',
      notice: updatedNotice
    });
    
  } catch (error) {
    console.error('编辑系统公告出错:', error);
    res.status(500).json({
      success: false,
      message: '编辑公告失败，请稍后再试'
    });
  }
});

// 删除系统公告 (仅总代理可用)
app.delete(`${API_PREFIX}/notice/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    const { operatorId } = req.body;
    
    // 参数验证
    if (!operatorId) {
      return res.json({
        success: false,
        message: '请提供操作员ID'
      });
    }
    
    // 检查操作员是否为总代理（客服）
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '权限不足，只有总代理可以删除系统公告'
      });
    }
    
    // 检查公告是否存在
    const existingNotice = await NoticeModel.findById(id);
    if (!existingNotice) {
      return res.json({
        success: false,
        message: '公告不存在或已被删除'
      });
    }
    
    // 删除公告（软删除）
    await NoticeModel.delete(id);
    
    console.log(`总代理 ${operatorId} 删除公告 ${id}: "${existingNotice.title}"`);
    
    res.json({
      success: true,
      message: '系统公告删除成功'
    });
    
  } catch (error) {
    console.error('删除系统公告出错:', error);
    res.status(500).json({
      success: false,
      message: '删除公告失败，请稍后再试'
    });
  }
});

// 新增: 获取总代理API端点
app.get(`${API_PREFIX}/admin-agent`, async (req, res) => {
  try {
    // 获取总代理 (level = 0)，如果有多个则取第一个
    const adminAgents = await db.any('SELECT * FROM agents WHERE level = 0 ORDER BY id ASC LIMIT 1');
    
    if (adminAgents.length === 0) {
      return res.json({
        success: false,
        message: '系统还未设置总代理'
      });
    }
    
    const adminAgent = adminAgents[0];
    
    res.json({
      success: true,
      agent: {
        id: adminAgent.id,
        username: adminAgent.username,
        balance: adminAgent.balance
      }
    });
  } catch (error) {
    console.error('获取总代理信息出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 添加系统级别的仪表板API - 使用适当的API前缀
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // 获取所有代理
    const agents = await db.one('SELECT COUNT(*) as count FROM agents');
    
    // 获取所有会员
    const members = await db.one('SELECT COUNT(*) as count FROM members');
    
    // 获取今日交易总额
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const transactions = await db.one(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total_amount, COUNT(*) as count 
      FROM transaction_records 
      WHERE created_at >= $1
    `, [today]);
    
    // 获取总佣金
    const commission = await db.one(`
      SELECT COALESCE(SUM(total_commission), 0) as total 
      FROM agents
    `);
    
    res.json({
      success: true,
      stats: {
        totalAgents: parseInt(agents.count),
        totalMembers: parseInt(members.count),
        totalAmount: parseFloat(transactions.total_amount),
        totalTransactions: parseInt(transactions.count),
        totalCommission: parseFloat(commission.total)
      }
    });
  } catch (error) {
    console.error('获取仪表板统计数据出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 添加系统级别的会员列表API - 使用适当的API前缀
app.get('/api/dashboard/members', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  try {
    // 获取所有会员
    const query = `
      SELECT m.*, a.username as agent_username 
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      ORDER BY m.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const members = await db.any(query, [limit, offset]);
    
    // 获取总数
    const countQuery = `
      SELECT COUNT(*) as count
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
    `;
    const totalResult = await db.one(countQuery);
    const total = parseInt(totalResult.count);
    
    res.json({
      success: true,
      members,
      total: parseInt(total)
    });
  } catch (error) {
    console.error('获取会员列表出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 切换会员状态 - 支持三种状态：0=停用, 1=启用, 2=冻结
app.post(`${API_PREFIX}/toggle-member-status`, async (req, res) => {
  const { memberId, status } = req.body;
  
  try {
    if (!memberId) {
      return res.json({
        success: false,
        message: '请提供会员ID'
      });
    }
    
    // 验证状态值：0=停用, 1=启用, 2=冻结
    const newStatus = parseInt(status);
    if (![0, 1, 2].includes(newStatus)) {
      return res.json({
        success: false,
        message: '无效的状态值，必须是0(停用)、1(启用)或2(冻结)'
      });
    }
    
    // 更新会员状态
    await db.none('UPDATE members SET status = $1 WHERE id = $2', [newStatus, memberId]);
    
    const statusText = newStatus === 1 ? '启用' : newStatus === 0 ? '停用' : '冻结';
    res.json({
      success: true,
      message: `会员状态已更新为: ${statusText}`
    });
  } catch (error) {
    console.error('更新会员状态出错:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系统错误，请稍后再试'
    });
  }
});

// 获取开奖结果历史记录 - 使用 result_history 表与游戏端保持一致
app.get(`${API_PREFIX}/draw-history`, async (req, res) => {
  try {
    const { page = 1, limit = 20, period = '', date = '' } = req.query;
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const offset = (parsedPage - 1) * parsedLimit;

    let whereConditions = [];
    const params = [];

    // 基本过滤条件 - 只过滤掉测试数据（序号大于300的）
    whereConditions.push(`result IS NOT NULL`);
    whereConditions.push(`position_1 IS NOT NULL`);
    whereConditions.push(`CAST(SUBSTRING(period::text FROM 9) AS INTEGER) < 300`);

    if (period) {
      whereConditions.push(`period::text LIKE $${params.length + 1}`);
      params.push(`%${period}%`);
    }

    if (date) {
      // 基于期号中的日期而非创建时间
      const dateStr = date.replace(/-/g, '');
      whereConditions.push(`period::text LIKE $${params.length + 1}`);
      params.push(`${dateStr}%`);
    }

    // 如果是查询今天的数据，过滤未来期号
    if (date === new Date().toISOString().split('T')[0]) {
      const currentGameState = await db.oneOrNone('SELECT current_period FROM game_state ORDER BY id DESC LIMIT 1');
      const currentPeriod = currentGameState?.current_period || 99999999999;
      whereConditions.push(`period < ${currentPeriod}`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 计算总记录数
    const countQuery = `SELECT COUNT(*) FROM result_history ${whereClause}`;
    console.log(`Executing count query: ${countQuery} with params: ${JSON.stringify(params)}`);
    const totalResult = await db.one(countQuery, params);
    const totalRecords = parseInt(totalResult.count);

    // 获取分页数据
    const dataQuery = `
      SELECT period, result, created_at, draw_time,
             position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10
      FROM result_history 
      ${whereClause}
      ORDER BY period DESC 
      LIMIT ${parsedLimit} OFFSET ${offset}
    `;
    
    console.log(`Executing data query: ${dataQuery} with params: ${JSON.stringify(params)}`);
    const records = await db.any(dataQuery, params);

    // 转换格式使其与前端相容
    const formattedRecords = records.map(record => {
      // 使用位置栏位来建立正确的结果阵列
      const positions = [];
      for (let i = 1; i <= 10; i++) {
        positions.push(record[`position_${i}`]);
      }
      
      return {
        period: record.period,
        result: positions,
        draw_time: record.draw_time || record.created_at,  // 优先使用 draw_time
        positions: positions,
        // 计算额外的游戏结果
        sum: positions[0] + positions[1],  // 冠亚和
        dragon_tiger: positions[0] > positions[9] ? '龙' : '虎'  // 龙虎
      };
    });

    res.json({
      success: true,
      records: formattedRecords,
      totalPages: Math.ceil(totalRecords / parsedLimit),
      currentPage: parsedPage,
      totalRecords: totalRecords,
      page: parsedPage,
      total: totalRecords
    });

  } catch (error) {
    console.error('获取开奖历史出错:', error);
    res.status(500).json({
      success: false,
      message: error.message || '获取开奖历史失败'
    });
  }
});

// API 路由
// 获取下注记录 - 修复400错误，支持更多查询参数
app.get(`${API_PREFIX}/bets`, async (req, res) => {
  try {
    // 使用通用认证中间件
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { agent } = authResult;
    const { agentId, rootAgentId, includeDownline, username, date, startDate, endDate, period, page = 1, limit = 20 } = req.query;
    
    // 基本参数验证 - 支持agentId或rootAgentId
    const currentAgentId = agentId || rootAgentId;
    if (!currentAgentId) {
      return res.status(400).json({
        success: false,
        message: '代理ID为必填项 (agentId或rootAgentId)'
      });
    }
    
    console.log(`📡 查询下注记录: agentId=${currentAgentId}, includeDownline=${includeDownline}, username=${username}`);
    
    // 查询该代理下的所有会员
    let members = [];
    
    // 如果指定了会员用户名
    if (username) {
      // 检查这个会员是否属于该代理
      const member = await MemberModel.findByAgentAndUsername(currentAgentId, username);
      if (member) {
        members = [member];
      } else {
        return res.status(403).json({
          success: false,
          message: '该会员不存在或不属于你的下线'
        });
      }
    } else {
      // 根据includeDownline参数决定是否包含下级代理的会员
      if (includeDownline === 'true') {
        // 获取所有下级代理的会员
        const downlineAgents = await getAllDownlineAgents(currentAgentId);
        const allAgentIds = [parseInt(currentAgentId), ...downlineAgents]; // 修复：downlineAgents已经是整数数组
        
        for (const agentId of allAgentIds) {
          const agentMembers = await MemberModel.findByAgentId(agentId);
          members = members.concat(agentMembers || []);
        }
      } else {
        // 只获取直系下线会员
        const memberList = await MemberModel.findByAgentId(currentAgentId);
        members = memberList || [];
      }
    }
    
    if (members.length === 0) {
      return res.json({
        success: true,
        bets: [],
        total: 0,
        stats: {
          totalBets: 0,
          totalAmount: 0,
          totalProfit: 0
        }
      });
    }
    
    // 创建会员到代理的映射
    const memberToAgentMap = {};
    const agentInfoMap = {};
    
    // 获取代理信息
    for (const member of members) {
      memberToAgentMap[member.username] = member.agent_id;
      if (!agentInfoMap[member.agent_id]) {
        const agent = await AgentModel.findById(member.agent_id);
        if (agent) {
          agentInfoMap[member.agent_id] = {
            username: agent.username,
            level: agent.level
          };
        }
      }
    }
    
    // 获取这些会员的用户名
    const memberUsernames = members.map(m => m.username);
    
    // 构建查询条件
    let whereClause = `WHERE username IN (${memberUsernames.map((_, i) => `$${i + 1}`).join(',')})`;
    let params = [...memberUsernames];
    let paramIndex = memberUsernames.length + 1;
    
    // 添加日期过滤
    if (date) {
      whereClause += ` AND DATE(created_at) = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    } else if (startDate && endDate) {
      // 期间查询
      whereClause += ` AND DATE(created_at) BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    } else if (startDate) {
      // 只有开始日期
      whereClause += ` AND DATE(created_at) >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    } else if (endDate) {
      // 只有结束日期
      whereClause += ` AND DATE(created_at) <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    // 添加期数过滤  
    if (period) {
      whereClause += ` AND period::text LIKE $${paramIndex}`;
      params.push(`%${period}%`);
      paramIndex++;
    }
    
    // 计算总记录数
    const countQuery = `SELECT COUNT(*) AS total FROM bet_history ${whereClause}`;
    const totalResult = await db.one(countQuery, params);
    const total = parseInt(totalResult.total);
    
    // 计算分页
    const offset = (page - 1) * limit;
    
    // 获取投注记录
    const betQuery = `
      SELECT * FROM bet_history 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const bets = await db.any(betQuery, params);
    
    // 为每笔下注添加代理信息
    const betsWithAgentInfo = bets.map(bet => {
      const agentId = memberToAgentMap[bet.username];
      const agentInfo = agentInfoMap[agentId];
      return {
        ...bet,
        agent_id: agentId,
        agent_username: agentInfo ? agentInfo.username : '未知',
        agent_level: agentInfo ? agentInfo.level : 1
      };
    });
    
    // 计算统计数据
    const statsQuery = `
      SELECT 
        COUNT(*) AS total_bets,
        SUM(amount) AS total_amount,
        SUM(CASE WHEN win = true THEN win_amount - amount ELSE -amount END) AS total_profit
      FROM bet_history 
      ${whereClause}
    `;
    
    const stats = await db.one(statsQuery, params.slice(0, paramIndex - 1));
    
    res.json({
      success: true,
      bets: betsWithAgentInfo,
      total,
      stats: {
        totalBets: parseInt(stats.total_bets),
        totalAmount: parseFloat(stats.total_amount) || 0,
        totalProfit: parseFloat(stats.total_profit) || 0
      }
    });
    
  } catch (error) {
    console.error('获取下注记录出错:', error);
    res.status(500).json({
      success: false,
      message: '获取下注记录失败',
      error: error.message
    });
  }
});

// 获取下级代理列表API - 修复404错误
app.get(`${API_PREFIX}/downline-agents`, async (req, res) => {
  try {
    const { rootAgentId } = req.query;
    
    console.log(`📡 获取下级代理API: rootAgentId=${rootAgentId}`);
    
    if (!rootAgentId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：rootAgentId'
      });
    }
    
    // 辅助函数：获取级别名称
    function getLevelName(level) {
      const levels = {
        0: '总代理',
        1: '一级代理', 
        2: '二级代理',
        3: '三级代理',
        4: '四级代理',
        5: '五级代理',
        6: '六级代理',
        7: '七级代理',
        8: '八级代理',
        9: '九级代理',
        10: '十级代理',
        11: '十一级代理',
        12: '十二级代理',
        13: '十三级代理',
        14: '十四级代理',
        15: '十五级代理'
      };
      return levels[level] || `${level}级代理`;
    }
    
    // 获取所有下级代理ID
    const downlineAgentIds = await getAllDownlineAgents(rootAgentId);
    
    if (downlineAgentIds.length === 0) {
      return res.json({
        success: true,
        agents: [],
        total: 0
      });
    }
    
    // 查询代理详细信息
    let agentQuery = 'SELECT id, username, level, balance, status FROM agents WHERE id IN (';
    agentQuery += downlineAgentIds.map((_, i) => `$${i + 1}`).join(',');
    agentQuery += ') ORDER BY level, username';
    
    const agents = await db.any(agentQuery, downlineAgentIds);
    
    // 添加级别名称
    const agentsWithLevelName = agents.map(agent => ({
      ...agent,
      level_name: getLevelName(agent.level)
    }));
    
    res.json({
      success: true,
      agents: agentsWithLevelName,
      total: agentsWithLevelName.length
    });
    
  } catch (error) {
    console.error('❌ 获取下级代理错误:', error);
    res.status(500).json({
      success: false,
      message: '获取下级代理失败',
      error: error.message
    });
  }
});

// 获取整条代理线会员API - 修复404错误  
app.get(`${API_PREFIX}/downline-members`, async (req, res) => {
  try {
    const { rootAgentId } = req.query;
    
    console.log(`📡 获取整条代理线会员API: rootAgentId=${rootAgentId}`);
    
    if (!rootAgentId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：rootAgentId'
      });
    }
    
    // 首先获取所有下级代理ID
    const downlineAgents = await getAllDownlineAgents(rootAgentId);
    const allAgentIds = [parseInt(rootAgentId), ...downlineAgents];
    
    // 获取所有这些代理的会员
    let allMembers = [];
    
    // 创建代理ID到代理资讯的映射，包含完整的代理信息
    const agentMap = {};
    
    // 获取根代理信息
    const rootAgent = await AgentModel.findById(rootAgentId);
    agentMap[rootAgentId] = { 
      username: rootAgent ? rootAgent.username : '未知代理',
      level: rootAgent ? rootAgent.level : 0,
      level_name: rootAgent ? getLevelName(rootAgent.level) : '未知级别'
    };
    
    // 获取所有下级代理的完整信息并添加到映射中
    if (downlineAgents.length > 0) {
      let agentQuery = 'SELECT id, username, level FROM agents WHERE id IN (';
      agentQuery += downlineAgents.map((_, i) => `$${i + 1}`).join(',');
      agentQuery += ')';
      
      const downlineAgentObjects = await db.any(agentQuery, downlineAgents);
      
      downlineAgentObjects.forEach(agent => {
        agentMap[agent.id] = { 
          username: agent.username,
          level: agent.level,
          level_name: getLevelName(agent.level)
        };
      });
    }
    
    // 辅助函数：获取级别名称
    function getLevelName(level) {
      const levels = {
        0: '总代理',
        1: '一级代理', 
        2: '二级代理',
        3: '三级代理',
        4: '四级代理',
        5: '五级代理',
        6: '六级代理',
        7: '七级代理',
        8: '八级代理',
        9: '九级代理',
        10: '十级代理',
        11: '十一级代理',
        12: '十二级代理',
        13: '十三级代理',
        14: '十四级代理',
        15: '十五级代理'
      };
      return levels[level] || `${level}级代理`;
    }
    
    for (const agentId of allAgentIds) {
      const { status, keyword } = req.query;
      const members = await MemberModel.findByAgentId(agentId, status !== '-1' ? status : null, 1, 1000);
      
      // 如果有关键字筛选，进行过滤
      let filteredMembers = members;
      if (keyword) {
        filteredMembers = members.filter(member => 
          member.username.toLowerCase().includes(keyword.toLowerCase()) ||
          member.id.toString().includes(keyword)
        );
      }
      
      allMembers = allMembers.concat(filteredMembers.map(member => ({
        ...member,
        agentId: agentId,
        agentUsername: agentMap[agentId]?.username || '未知代理',
        agentLevel: agentMap[agentId]?.level || 0,
        agentLevelName: agentMap[agentId]?.level_name || '未知级别'
      })));
    }
    
    res.json({
      success: true,
      members: allMembers,
      total: allMembers.length
    });
    
  } catch (error) {
    console.error('❌ 获取整条代理线会员错误:', error);
    res.status(500).json({
      success: false,
      message: '获取会员列表失败',
      error: error.message
    });
  }
});

// 获取指定代理的会员API
app.get(`${API_PREFIX}/agent-members`, async (req, res) => {
  try {
    const { agentId } = req.query;
    
    console.log(`📡 获取指定代理会员API: agentId=${agentId}`);
    
    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数：agentId'
      });
    }
    
    const members = await MemberModel.findByAgentId(agentId, null, 1, 1000);
    
    res.json({
      success: true,
      members: members,
      total: members.length
    });
    
  } catch (error) {
    console.error('❌ 获取指定代理会员错误:', error);
    res.status(500).json({
      success: false,
      message: '获取会员列表失败',
      error: error.message
    });
  }
});

// 递归获取所有下级代理的辅助函数
async function getAllDownlineAgents(rootAgentId) {
  const allAgents = [];
  
  // 获取直接下级代理
  const directSubAgents = await AgentModel.findByParentId(rootAgentId, null, null, 1, 1000);
  
  for (const agent of directSubAgents) {
    allAgents.push(parseInt(agent.id)); // 只返回ID，确保是整数
    
    // 递归获取该代理的下级代理
    const subAgents = await getAllDownlineAgents(agent.id);
    allAgents.push(...subAgents);
  }
  
  return allAgents;
}

// 定期同步开奖记录的函数
async function syncDrawRecords() {
  try {
    console.log('开始同步开奖记录...');
    
    // 获取draw_records表中最新的一笔记录，用来确定从哪里开始同步
    const latestRecord = await db.oneOrNone(`
      SELECT period FROM draw_records ORDER BY period DESC LIMIT 1
    `);
    
    let whereClause = '';
    const params = [];
    
    if (latestRecord && latestRecord.period) {
      whereClause = 'WHERE period > $1';
      params.push(latestRecord.period);
      console.log(`从期数 ${latestRecord.period} 以后开始同步`);
    } else {
      console.log('没有现有记录，将同步全部开奖历史');
    }
    
    // 从result_history表获取需要同步的记录
    const recordsToSync = await db.any(`
      SELECT period, result, created_at 
      FROM result_history 
      ${whereClause}
      ORDER BY period ASC
    `, params);
    
    if (recordsToSync.length === 0) {
      // console.log('没有新的开奖记录需要同步'); // 减少日志输出
      return;
    }
    
    console.log(`找到 ${recordsToSync.length} 笔开奖记录需要同步`);
    
    // 逐一同步记录
    for (const record of recordsToSync) {
      try {
        // 正确处理result为JSONB格式
        let result = record.result;
        if (typeof result === 'string') {
          result = JSON.parse(result);
        }
        
        // 使用to_jsonb转换确保PostgreSQL正确处理JSONB类型
        await db.none(`
          INSERT INTO draw_records (period, result, draw_time, created_at)
          VALUES ($1, $2::jsonb, $3, $4)
          ON CONFLICT (period) DO UPDATE 
          SET result = $2::jsonb, draw_time = $3
        `, [record.period, JSON.stringify(result), record.created_at, new Date()]);
        
        // console.log(`同步开奖记录: 期数=${record.period} 成功`); // 减少日志输出
      } catch (insertError) {
        console.error(`同步开奖记录: 期数=${record.period} 失败:`, insertError);
      }
    }
    
    console.log('开奖记录同步完成');
  } catch (error) {
    console.error('同步开奖记录时出错:', error);
  }
}

// 在服务器启动时调用一次同步函数
async function startServer() {
  try {
    // 检测是否在Render环境运行
    const isRenderPlatform = process.env.RENDER === 'true' || 
                             process.env.RENDER_EXTERNAL_URL || 
                             process.env.RENDER_SERVICE_ID;
    
    // 检查是否已经存在标记文件，用于判断是否为首次运行
    let isFirstRun = false;
    try {
      // 尝试读取标记文件
      await fs.access(path.join(__dirname, '.render_initialized'));
      console.log('检测到Render初始化标记，非首次运行');
    } catch (err) {
      // 文件不存在，说明是首次运行
      isFirstRun = true;
      console.log('未检测到Render初始化标记，视为首次运行');
    }
    
    if (isRenderPlatform) {
      console.log('检测到Render部署环境');
      process.env.RENDER = 'true';
      
      if (isFirstRun) {
        console.log('设置为Render首次运行，将在需要时修改总代理为ti2025');
        process.env.RENDER_FIRST_RUN = 'true';
      }
    }
    
    await initDatabase();
    
    // 初始化会话管理系统
    await SessionManager.initialize();
    
    // 如果是Render环境且首次运行，创建标记文件避免下次重置
    if (isRenderPlatform && isFirstRun) {
      try {
        // 创建标记文件
        await fs.writeFile(
          path.join(__dirname, '.render_initialized'), 
          `Initialized at ${new Date().toISOString()}`
        );
        console.log('已创建Render初始化标记文件');
      } catch (err) {
        console.error('创建初始化标记文件失败:', err);
      }
    }
    
    // 子帐号相关 API
    
    // 获取子帐号列表
    app.get(`${API_PREFIX}/subaccounts`, async (req, res) => {
      try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        
        // 查询该代理的所有子帐号
        const subAccounts = await db.any(`
          SELECT id, username, status, last_login, created_at
          FROM sub_accounts
          WHERE parent_agent_id = $1
          ORDER BY created_at DESC
        `, [agentId]);
        
        res.json({
          success: true,
          subAccounts
        });
      } catch (error) {
        console.error('获取子帐号列表失败:', error);
        res.status(500).json({
          success: false,
          message: '系统错误，请稍后再试'
        });
      }
    });
    
    // 创建子帐号
    app.post(`${API_PREFIX}/subaccounts`, async (req, res) => {
      try {
        console.log('📝 创建子帐号请求:', req.body);
        
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          console.log('❌ 认证失败');
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        const { username, password } = req.body;
        
        console.log('📋 代理ID:', agentId, '子帐号名称:', username);
        
        // 输入验证
        if (!username || !password) {
          return res.status(400).json({
            success: false,
            message: '请提供子帐号名称和密码'
          });
        }
        
        // 检查是否已有 2 个子帐号
        const count = await db.one(`
          SELECT COUNT(*) as count
          FROM sub_accounts
          WHERE parent_agent_id = $1
        `, [agentId]);
        
        console.log('📊 现有子帐号数量:', count.count);
        
        if (parseInt(count.count) >= 2) {
          return res.json({
            success: false,
            message: '每个代理最多只能创建 2 个子帐号'
          });
        }
        
        // 检查用户名是否在三个表中都唯一
        console.log('🔍 检查用户名唯一性:', username);
        
        // 检查代理表
        const existingAgent = await db.oneOrNone(`
          SELECT id FROM agents WHERE username = $1
        `, [username]);
        
        if (existingAgent) {
          console.log('❌ 用户名已被代理使用');
          return res.json({
            success: false,
            message: '此用户名已被代理使用，请选择其他名称'
          });
        }
        
        // 检查会员表
        const existingMember = await db.oneOrNone(`
          SELECT id FROM members WHERE username = $1
        `, [username]);
        
        if (existingMember) {
          console.log('❌ 用户名已被会员使用');
          return res.json({
            success: false,
            message: '此用户名已被会员使用，请选择其他名称'
          });
        }
        
        // 检查子帐号表
        const existingSubAccount = await db.oneOrNone(`
          SELECT id FROM sub_accounts WHERE username = $1
        `, [username]);
        
        if (existingSubAccount) {
          console.log('❌ 用户名已被其他子帐号使用');
          return res.json({
            success: false,
            message: '此用户名已被其他子帐号使用，请选择其他名称'
          });
        }
        
        console.log('✅ 用户名可以使用');
        
        // 加密密码
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 创建子帐号
        const newSubAccount = await db.one(`
          INSERT INTO sub_accounts (parent_agent_id, username, password)
          VALUES ($1, $2, $3)
          RETURNING id, username, status, created_at
        `, [agentId, username, hashedPassword]);
        
        console.log('✅ 子帐号创建成功:', newSubAccount);
        
        res.json({
          success: true,
          message: '子帐号创建成功',
          subAccount: newSubAccount
        });
      } catch (error) {
        console.error('❌ 创建子帐号失败:', error);
        console.error('错误详情:', {
          name: error.name,
          message: error.message,
          code: error.code,
          detail: error.detail,
          table: error.table,
          constraint: error.constraint
        });
        
        // 检查是否是资料库错误
        if (error.code === '42P01') {
          res.status(500).json({
            success: false,
            message: '资料表不存在，请联系系统管理员'
          });
        } else if (error.code === '23505') {
          res.status(400).json({
            success: false,
            message: '子帐号名称已存在'
          });
        } else {
          res.status(500).json({
            success: false,
            message: '系统错误，请稍后再试'
          });
        }
      }
    });
    
    // 更新子帐号状态
    app.put(`${API_PREFIX}/subaccounts/:id/status`, async (req, res) => {
      try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        const subAccountId = req.params.id;
        const { status } = req.body;
        
        // 确认子帐号属于该代理
        const subAccount = await db.oneOrNone(`
          SELECT id FROM sub_accounts
          WHERE id = $1 AND parent_agent_id = $2
        `, [subAccountId, agentId]);
        
        if (!subAccount) {
          return res.json({
            success: false,
            message: '找不到该子帐号'
          });
        }
        
        // 更新状态
        await db.none(`
          UPDATE sub_accounts
          SET status = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [status, subAccountId]);
        
        res.json({
          success: true,
          message: status === 1 ? '子帐号已启用' : '子帐号已停用'
        });
      } catch (error) {
        console.error('更新子帐号状态失败:', error);
        res.status(500).json({
          success: false,
          message: '系统错误，请稍后再试'
        });
      }
    });
    
    // 代理更改自己的密码
    app.put(`${API_PREFIX}/change-password`, async (req, res) => {
      try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        const { currentPassword, newPassword } = req.body;
        
        console.log('📝 代理更改密码请求，代理ID:', agentId);
        
        // 验证输入
        if (!currentPassword || !newPassword) {
          return res.status(400).json({
            success: false,
            message: '请提供当前密码和新密码'
          });
        }
        
        if (newPassword.length < 6) {
          return res.status(400).json({
            success: false,
            message: '新密码长度至少需要 6 个字符'
          });
        }
        
        // 获取代理当前密码
        const agent = await db.oneOrNone(`
          SELECT id, username, password 
          FROM agents 
          WHERE id = $1
        `, [agentId]);
        
        if (!agent) {
          return res.status(404).json({
            success: false,
            message: '找不到代理资料'
          });
        }
        
        // 验证当前密码
        let isValidPassword = false;
        
        // 检查密码是否已经是 bcrypt hash
        if (agent.password.startsWith('$2b$') || agent.password.startsWith('$2a$')) {
          // 使用 bcrypt 验证
          isValidPassword = await bcrypt.compare(currentPassword, agent.password);
        } else {
          // 明文密码直接比较
          isValidPassword = (agent.password === currentPassword);
        }
        
        if (!isValidPassword) {
          console.log('❌ 当前密码验证失败');
          return res.status(401).json({
            success: false,
            message: '当前密码错误'
          });
        }
        
        // 加密新密码
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // 更新密码
        await db.none(`
          UPDATE agents 
          SET password = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [hashedPassword, agentId]);
        
        console.log('✅ 代理密码更改成功:', agent.username);
        
        res.json({
          success: true,
          message: '密码已成功更改'
        });
      } catch (error) {
        console.error('❌ 更改密码失败:', error);
        res.status(500).json({
          success: false,
          message: '系统错误，请稍后再试'
        });
      }
    });
    
    // 重设子帐号密码
    app.put(`${API_PREFIX}/subaccounts/:id/password`, async (req, res) => {
      try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        const subAccountId = req.params.id;
        const { newPassword } = req.body;
        
        console.log('📝 重设子帐号密码请求:', { subAccountId, agentId });
        
        // 验证新密码
        if (!newPassword || newPassword.length < 6) {
          return res.status(400).json({
            success: false,
            message: '密码长度至少需要 6 个字符'
          });
        }
        
        // 确认子帐号属于该代理
        const subAccount = await db.oneOrNone(`
          SELECT id, username FROM sub_accounts
          WHERE id = $1 AND parent_agent_id = $2
        `, [subAccountId, agentId]);
        
        if (!subAccount) {
          return res.json({
            success: false,
            message: '找不到该子帐号'
          });
        }
        
        // 加密新密码
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // 更新密码
        await db.none(`
          UPDATE sub_accounts 
          SET password = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [hashedPassword, subAccountId]);
        
        console.log('✅ 子帐号密码重设成功:', subAccount.username);
        
        res.json({
          success: true,
          message: '密码已成功重设'
        });
      } catch (error) {
        console.error('❌ 重设子帐号密码失败:', error);
        res.status(500).json({
          success: false,
          message: '系统错误，请稍后再试'
        });
      }
    });
    
    // 删除子帐号
    app.delete(`${API_PREFIX}/subaccounts/:id`, async (req, res) => {
      try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        const subAccountId = req.params.id;
        
        // 确认子帐号属于该代理
        const subAccount = await db.oneOrNone(`
          SELECT id FROM sub_accounts
          WHERE id = $1 AND parent_agent_id = $2
        `, [subAccountId, agentId]);
        
        if (!subAccount) {
          return res.json({
            success: false,
            message: '找不到该子帐号'
          });
        }
        
        // 删除子帐号
        await db.none(`
          DELETE FROM sub_accounts WHERE id = $1
        `, [subAccountId]);
        
        res.json({
          success: true,
          message: '子帐号已删除'
        });
      } catch (error) {
        console.error('删除子帐号失败:', error);
        res.status(500).json({
          success: false,
          message: '系统错误，请稍后再试'
        });
      }
    });
    
    // 创建 HTTP 服务器
    const server = createServer(app);
    
    // 初始化 WebSocket
    wsManager.initialize(server);
    
    // 先启动Express服务器，确保 Render 能检测到端口
    const PORT = process.env.PORT || 3003;
    server.listen(PORT, () => {
      console.log(`代理管理系统后端运行在端口 ${PORT}`);
      console.log('WebSocket 服务已启动');
      
      // 端口启动后，异步执行开奖记录同步，避免阻塞部署
      setImmediate(async () => {
        try {
          console.log('开始异步同步开奖记录...');
          await syncDrawRecords();
          console.log('开奖记录同步完成');
          
          // 每60秒同步一次开奖记录作为备援（主要依靠即时同步）
          setInterval(syncDrawRecords, 60 * 1000);
        } catch (error) {
          console.error('同步开奖记录失败:', error);
          // 即使同步失败，服务器仍然可以运行
        }
      });
    });
  } catch (error) {
    console.error('启动服务器时出错:', error);
  }
}

// ... existing code ...

// 会员下注记录查询 API
app.get(`${API_PREFIX}/member-bet-records`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { agent: currentAgent } = authResult;
    const { memberUsername, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    console.log('📊 查询会员下注记录:', { 
      memberUsername, startDate, endDate, page, limit, currentAgentId: currentAgent.id
    });
    
    if (!memberUsername) {
      return res.json({
        success: false,
        message: '请提供会员用户名'
      });
    }

    try {
      // 验证会员是否属于当前代理的下线（简化版，直接查询会员）
      const member = await db.oneOrNone(`
        SELECT m.id, m.username, m.agent_id, m.balance, m.market_type
        FROM members m
        WHERE m.username = $1
      `, [memberUsername]);

      if (!member) {
        return res.json({
          success: false,
          message: '会员不存在'
        });
      }

      // 检查会员是否在当前代理的管理范围内（暂时跳过，用于测试）
      console.log('找到会员:', member);

      // 构建查询条件，支援结算状态筛选
      let whereClause = 'WHERE bh.username = $1';
      let params = [memberUsername];
      let paramIndex = 2;
      
      if (startDate && startDate.trim()) {
        whereClause += ` AND DATE(bh.created_at) >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }
      
      if (endDate && endDate.trim()) {
        whereClause += ` AND DATE(bh.created_at) <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      // 如果有结算状态筛选
      const { settlementStatus } = req.query;
      if (settlementStatus === 'settled') {
        whereClause += ` AND bh.settled = true`;
      } else if (settlementStatus === 'unsettled') {
        whereClause += ` AND bh.settled = false`;
      }
      // 如果不指定或指定为空，则显示全部（已结算和未结算）

      // 查询总数
      const totalQuery = `SELECT COUNT(*) as total FROM bet_history bh ${whereClause}`;
      const totalResult = await db.one(totalQuery, params);
      const total = parseInt(totalResult.total);
      const totalPages = Math.ceil(total / limit);

      // 查询下注记录（使用正确的栏位名称）
      const offset = (page - 1) * limit;
      const recordsQuery = `
        SELECT 
          bh.id,
          bh.username,
          bh.bet_type as game_type,
          bh.period,
          bh.bet_value as bet_content,
          bh.position,
          bh.amount as bet_amount,
          bh.odds,
          bh.win,
          bh.win_amount,
          bh.settled,
          bh.created_at
        FROM bet_history bh 
        ${whereClause}
        ORDER BY bh.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const records = await db.any(recordsQuery, params);

      // 格式化记录，加上必要的栏位和占成明细
      const formattedRecords = await Promise.all(records.map(async (record) => {
        // 获取这笔下注的代理链占成明细
        const commissionDetails = await getCommissionDetailsForBet(record.username, parseFloat(record.bet_amount));
        
        // 判断结算状态和结果
        let result, profitLoss;
        if (!record.settled) {
          // 未结算注单
          result = '未结算';
          profitLoss = 0; // 未结算时盈亏为0
        } else {
          // 已结算注单
          result = record.win ? '赢' : '输';
          profitLoss = record.win ? parseFloat(record.win_amount) - parseFloat(record.bet_amount) : -parseFloat(record.bet_amount);
        }
        
        return {
          id: record.id,
          bet_id: record.id, // 使用 id 作为 bet_id
          username: record.username,
          game_type: record.game_type,
          bet_type: record.game_type, // 为前端兼容性添加 bet_type
          period_number: record.period,
          bet_content: record.bet_content,
          bet_value: record.bet_content, // 为前端兼容性添加 bet_value
          position: record.position, // 添加位置信息
          bet_amount: parseFloat(record.bet_amount),
          odds: parseFloat(record.odds),
          result: result,
          profit_loss: profitLoss,
          settled: record.settled, // 添加结算状态栏位
          rebate_percentage: commissionDetails.length > 0 ? commissionDetails[0].rebate_rate * 100 : 2.0, // 转换为百分比
          market_type: member.market_type || 'A', // 从会员资料取得
          created_at: record.created_at,
          commission_rate: 0.0,
          commission_details: commissionDetails
        };
      }));

      // 计算统计资讯
      const statsQuery = `
        SELECT 
          COUNT(*) as total_bets,
          COALESCE(SUM(amount), 0) as total_amount,
          COALESCE(SUM(CASE WHEN win THEN win_amount - amount ELSE -amount END), 0) as total_win_loss
        FROM bet_history bh 
        ${whereClause}
      `;
      
      const stats = await db.one(statsQuery, params);

      res.json({
        success: true,
        data: formattedRecords, // 直接返回记录阵列
        memberInfo: {
          id: member.id,
          username: member.username,
          balance: member.balance,
          marketType: member.market_type
        },
        statistics: {
          totalBets: parseInt(stats.total_bets),
          totalAmount: parseFloat(stats.total_amount),
          totalWinLoss: parseFloat(stats.total_win_loss)
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          totalPages: totalPages
        }
      });
      
    } catch (dbError) {
      console.error('查询会员下注记录数据库错误:', dbError);
      res.json({
        success: false,
        message: '查询失败，请稍后再试'
      });
    }
    
  } catch (error) {
    console.error('查询会员下注记录失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 占成明细查询 API  
app.get(`${API_PREFIX}/bet-commission-details/:betId`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { betId } = req.params;
    
    console.log('🔍 查询占成明细:', betId);
    
    try {
      // 查询投注记录（使用正确的栏位名称）
      const bet = await db.oneOrNone(`
        SELECT id, username, amount as bet_amount, bet_type as game_type, period
        FROM bet_history 
        WHERE id = $1
      `, [betId]);

      if (!bet) {
        return res.json({
          success: false,
          message: '投注记录不存在'
        });
      }

      // 模拟占成明细数据（实际应从佣金分配表查询）
      const commissionDetails = [
        {
          id: 1,
          agent_type: '八级代理',
          username: 'upup168j',
          commission_rate: 0.0,
          rebate_rate: 0.038
        },
        {
          id: 2,
          agent_type: '九级代理', 
          username: 'rdd8899',
          commission_rate: 0.0,
          rebate_rate: 0.0
        }
      ];

      res.json({
        success: true,
        data: {
          bet: bet,
          commissionDetails: commissionDetails
        }
      });
      
    } catch (dbError) {
      console.error('查询占成明细数据库错误:', dbError);
      res.json({
        success: false,
        message: '查询失败，请稍后再试'
      });
    }
    
  } catch (error) {
    console.error('查询占成明细失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 开奖结果查询 API
app.get(`${API_PREFIX}/draw-result/:gameType/:periodNumber`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { gameType, periodNumber } = req.params;
    
    console.log('🎲 查询开奖结果:', gameType, periodNumber);
    
    try {
      // 查询开奖结果
      const drawResult = await db.oneOrNone(`
        SELECT period, result, draw_time, created_at
        FROM draw_records 
        WHERE period = $1
        ORDER BY created_at DESC
        LIMIT 1
      `, [periodNumber]);

      if (!drawResult) {
        return res.json({
          success: false,
          message: '该期开奖结果暂未公布'
        });
      }

      // 解析开奖号码
      let resultNumbers = [];
      try {
        if (typeof drawResult.result === 'string') {
          resultNumbers = JSON.parse(drawResult.result);
        } else if (Array.isArray(drawResult.result)) {
          resultNumbers = drawResult.result;
        }
      } catch (parseError) {
        console.warn('解析开奖号码失败:', parseError);
        resultNumbers = [];
      }

      res.json({
        success: true,
        drawResult: {
          period: drawResult.period,
          numbers: resultNumbers,
          drawTime: drawResult.draw_time || drawResult.created_at
        }
      });
      
    } catch (dbError) {
      console.error('查询开奖结果数据库错误:', dbError);
      res.json({
        success: false,
        message: '查询失败，请稍后再试'
      });
    }
    
  } catch (error) {
    console.error('查询开奖结果失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// ... 保持 startServer() 函数的调用 ...
startServer();

// 客服专用: 代理点数转移操作
app.post(`${API_PREFIX}/cs-agent-transfer`, async (req, res) => {
  const { operatorId, targetAgentId, amount, transferType, description } = req.body;
  
  try {
    console.log(`客服代理点数转移: 操作员=${operatorId}, 目标代理=${targetAgentId}, 金额=${amount}, 类型=${transferType}`);
    
    // 检查操作员是否为客服
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '权限不足，只有客服可以执行此操作'
      });
    }
    
    // 获取客服代理（操作员）
    const csAgent = await AgentModel.findById(operatorId);
    if (!csAgent) {
      return res.json({
        success: false,
        message: '客服用户不存在'
      });
    }
    
    // 获取目标代理
    const targetAgent = await AgentModel.findById(targetAgentId);
    if (!targetAgent) {
      return res.json({
        success: false,
        message: '目标代理不存在'
      });
    }
    
    const transferAmount = parseFloat(amount);
    let result;
    
    if (transferType === 'deposit') {
      // 存款：客服 -> 目标代理
      console.log(`执行存款操作: 客服(${csAgent.username}) -> 目标代理(${targetAgent.username}), 金额=${transferAmount}`);
      
      // 检查客服余额是否足够
      if (parseFloat(csAgent.balance) < transferAmount) {
        return res.json({
          success: false,
          message: '客服余额不足'
        });
      }
      
      result = await PointTransferModel.transferFromAgentToAgent(
        operatorId, 
        targetAgentId, 
        transferAmount, 
        description || '客服存款操作',
        true // 客服操作
      );
    } else if (transferType === 'withdraw') {
      // 提款：目标代理 -> 客服
      console.log(`执行提款操作: 目标代理(${targetAgent.username}) -> 客服(${csAgent.username}), 金额=${transferAmount}`);
      
      // 检查目标代理余额是否足够
      if (parseFloat(targetAgent.balance) < transferAmount) {
        return res.json({
          success: false,
          message: '目标代理余额不足'
        });
      }
      
      result = await PointTransferModel.transferFromAgentToAgent(
        targetAgentId, 
        operatorId, 
        transferAmount, 
        description || '客服提款操作',
        true // 客服操作
      );
    } else {
      return res.json({
        success: false,
        message: '无效的转移类型'
      });
    }
    
    console.log(`客服代理点数转移成功`);
    
    // 获取更新后的客服余额
    const updatedCSAgent = await AgentModel.findById(operatorId);
    
    res.json({
      success: true,
      message: '代理点数转移成功',
      agent: {
        id: result.toAgent.id,
        username: result.toAgent.username,
        balance: result.toAgent.balance
      },
      csBalance: updatedCSAgent.balance // 返回客服最新余额
    });
    
  } catch (error) {
    console.error('客服代理点数转移失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系统错误，请稍后再试'
    });
  }
});

// 客服专用: 会员点数转移操作
app.post(`${API_PREFIX}/cs-member-transfer`, async (req, res) => {
  const { operatorId, agentId, targetMemberUsername, amount, transferType, description } = req.body;
  
  try {
    console.log(`客服会员点数转移: 操作员=${operatorId}, 代理=${agentId}, 目标会员=${targetMemberUsername}, 金额=${amount}, 类型=${transferType}`);
    
    // 检查操作员是否为客服
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '权限不足，只有客服可以执行此操作'
      });
    }
    
    // 获取客服代理（操作员）
    const csAgent = await AgentModel.findById(operatorId);
    if (!csAgent) {
      return res.json({
        success: false,
        message: '客服用户不存在'
      });
    }
    
    // 获取代理
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 获取会员
    const member = await MemberModel.findByUsername(targetMemberUsername);
    if (!member) {
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    // 验证会员属于该代理
    if (member.agent_id !== parseInt(agentId)) {
      return res.json({
        success: false,
        message: '会员不属于指定的代理'
      });
    }
    
    const transferAmount = parseFloat(amount);
    let result;
    
    if (transferType === 'deposit') {
      // 存款：客服 -> 会员（先从客服转给代理，再从代理转给会员）
      console.log(`执行存款操作: 客服(${csAgent.username}) -> 会员(${member.username}), 金额=${transferAmount}`);
      
      // 检查客服余额是否足够
      if (parseFloat(csAgent.balance) < transferAmount) {
        return res.json({
          success: false,
          message: '客服余额不足'
        });
      }
      
      // 开始数据库事务
      result = await db.tx(async t => {
        // 1. 客服转给代理
        await PointTransferModel.transferFromAgentToAgent(
          operatorId, 
          agentId, 
          transferAmount, 
          `客服给${member.username}存款-转给代理`,
          true // 客服操作
        );
        
        // 2. 代理转给会员
        const memberResult = await PointTransferModel.transferFromAgentToMember(
          agentId, 
          member.id, 
          transferAmount, 
          description || '客服存款操作',
          true // 客服操作
        );
        
        return memberResult;
      });
    } else if (transferType === 'withdraw') {
      // 提款：会员 -> 客服（先从会员转给代理，再从代理转给客服）
      console.log(`执行提款操作: 会员(${member.username}) -> 客服(${csAgent.username}), 金额=${transferAmount}`);
      
      // 检查会员余额是否足够
      if (parseFloat(member.balance) < transferAmount) {
        return res.json({
          success: false,
          message: '会员余额不足'
        });
      }
      
      // 开始数据库事务
      result = await db.tx(async t => {
        // 1. 会员转给代理
        await PointTransferModel.transferFromMemberToAgent(
          member.id, 
          agentId, 
          transferAmount, 
          `客服从${member.username}提款-先给代理`,
          true // 客服操作
        );
        
        // 2. 代理转给客服
        await PointTransferModel.transferFromAgentToAgent(
          agentId, 
          operatorId, 
          transferAmount, 
          description || '客服提款操作',
          true // 客服操作
        );
        
        // 返回更新后的会员资料
        return await MemberModel.findById(member.id);
      });
    } else {
      return res.json({
        success: false,
        message: '无效的转移类型'
      });
    }
    
    console.log(`客服会员点数转移成功`);
    
    // 重新获取最新的会员和客服资料
    const updatedMember = await MemberModel.findById(member.id);
    const updatedCSAgent = await AgentModel.findById(operatorId);
    
    res.json({
      success: true,
      message: '会员点数转移成功',
      member: {
        id: updatedMember.id,
        username: updatedMember.username,
        balance: updatedMember.balance
      },
      csBalance: updatedCSAgent.balance // 返回客服最新余额
    });
    
  } catch (error) {
    console.error('客服会员点数转移失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系统错误，请稍后再试'
    });
  }
});

// 获取客服交易记录（包含所有cs_deposit和cs_withdraw类型的交易）
app.get(`${API_PREFIX}/cs-transactions`, async (req, res) => {
  const { operatorId, page = 1, limit = 20, userType = 'all', transactionType = 'all' } = req.query;
  
  try {
    console.log(`获取客服交易记录: 操作员=${operatorId}, 页码=${page}, 数量=${limit}`);
    
    // 检查操作员是否为客服（总代理）
    const operator = await AgentModel.findById(operatorId);
    if (!operator || operator.level !== 0) {
      return res.json({
        success: false,
        message: '权限不足，只有总代理可以查看此记录'
      });
    }
    
    // 获取该总代理下的所有下级代理ID（包括自己）
    const allDownlineAgents = await getAllDownlineAgents(operatorId);
    const allAgentIds = [...allDownlineAgents, parseInt(operatorId)]; // 包含自己
    
    // 获取这些代理下的所有会员ID - 使用IN语法替代ANY
    let memberQuery = 'SELECT id FROM members WHERE agent_id IN (';
    memberQuery += allAgentIds.map((_, i) => `$${i + 1}`).join(',');
    memberQuery += ')';
    const members = await db.any(memberQuery, allAgentIds);
    const memberIds = members.map(m => parseInt(m.id));
    
    let query = `
      SELECT t.*, 
             CASE 
               WHEN t.user_type = 'agent' THEN a.username 
               WHEN t.user_type = 'member' THEN m.username 
             END as username,
             CASE 
               WHEN t.user_type = 'agent' THEN a.level 
               ELSE NULL 
             END as user_level
      FROM transaction_records t
      LEFT JOIN agents a ON t.user_type = 'agent' AND t.user_id = a.id
      LEFT JOIN members m ON t.user_type = 'member' AND t.user_id = m.id
      WHERE (t.transaction_type = 'cs_deposit' OR t.transaction_type = 'cs_withdraw')
    `;
    
    // 使用IN语法替代ANY语法
    const params = [];
    if (allAgentIds.length > 0 && memberIds.length > 0) {
      const agentPlaceholders = allAgentIds.map((_, i) => `$${i + 1}`).join(',');
      const memberPlaceholders = memberIds.map((_, i) => `$${i + 1 + allAgentIds.length}`).join(',');
      query += ` AND ((t.user_type = 'agent' AND t.user_id IN (${agentPlaceholders})) OR (t.user_type = 'member' AND t.user_id IN (${memberPlaceholders})))`;
      params.push(...allAgentIds, ...memberIds);
    } else if (allAgentIds.length > 0) {
      const agentPlaceholders = allAgentIds.map((_, i) => `$${i + 1}`).join(',');
      query += ` AND t.user_type = 'agent' AND t.user_id IN (${agentPlaceholders})`;
      params.push(...allAgentIds);
    } else {
      // 没有代理ID，返回空结果
      query += ` AND 1=0`;
    }
    
    // 筛选用户类型
    if (userType !== 'all') {
      query += ` AND t.user_type = $${params.length + 1}`;
      params.push(userType);
    }
    
    // 筛选交易类型
    if (transactionType !== 'all') {
      query += ` AND t.transaction_type = $${params.length + 1}`;
      params.push(transactionType);
    }
    
    // 获取总数
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/i, 'SELECT COUNT(*) FROM');
    const totalResult = await db.one(countQuery, params);
    const total = parseInt(totalResult.count);
    
    // 添加排序和分页
    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const transactions = await db.any(query, params);
    
    console.log(`获取客服交易记录成功: 找到 ${transactions.length} 笔记录，总计 ${total} 笔`);
    
    res.json({
      success: true,
      data: {
        list: transactions,
        total: total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('获取客服交易记录失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 获取代理交易记录（按类型筛选）
app.get(`${API_PREFIX}/transactions`, async (req, res) => {
  const { agentId, type, page = 1, limit = 20 } = req.query;
  
  try {
    console.log(`获取交易记录: 代理ID=${agentId}, 类型=${type}, 页码=${page}, 数量=${limit}`);
    
    if (!agentId) {
      return res.json({
        success: false,
        message: '请提供代理ID'
      });
    }

    // 检查代理是否存在
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }

    let query = `
      SELECT t.*, 
             CASE 
               WHEN t.user_type = 'agent' THEN a.username 
               WHEN t.user_type = 'member' THEN m.username 
             END as username,
             CASE 
               WHEN t.user_type = 'agent' THEN a.level 
               ELSE NULL 
             END as user_level
      FROM transaction_records t
      LEFT JOIN agents a ON t.user_type = 'agent' AND t.user_id = a.id
      LEFT JOIN members m ON t.user_type = 'member' AND t.user_id = m.id
      WHERE 1=1
    `;
    
    const params = [];
    
    // 数据隔离：每个代理只能查看自己线下的交易记录
    if (agent.level === 0) {
      // 总代理只能查看自己盘口线下的交易记录，不能查看其他盘口
      // 获取该总代理下的所有下级代理ID（包括自己）
      const allDownlineAgents = await getAllDownlineAgents(agentId);
      const allAgentIds = [...allDownlineAgents, agentId]; // 包含自己
      
      // 获取这些代理下的所有会员ID - 使用IN语法替代ANY
      let memberQuery = 'SELECT id FROM members WHERE agent_id IN (';
      memberQuery += allAgentIds.map((_, i) => `$${i + 1}`).join(',');
      memberQuery += ')';
      const members = await db.any(memberQuery, allAgentIds);
      const memberIds = members.map(m => parseInt(m.id));
      
      // 使用IN语法替代ANY语法
      if (allAgentIds.length > 0 && memberIds.length > 0) {
        const agentPlaceholders = allAgentIds.map((_, i) => `$${params.length + i + 1}`).join(',');
        const memberPlaceholders = memberIds.map((_, i) => `$${params.length + allAgentIds.length + i + 1}`).join(',');
        query += ` AND ((t.user_type = 'agent' AND t.user_id IN (${agentPlaceholders})) OR (t.user_type = 'member' AND t.user_id IN (${memberPlaceholders})))`;
        params.push(...allAgentIds, ...memberIds);
      } else if (allAgentIds.length > 0) {
        const agentPlaceholders = allAgentIds.map((_, i) => `$${params.length + i + 1}`).join(',');
        query += ` AND t.user_type = 'agent' AND t.user_id IN (${agentPlaceholders})`;
        params.push(...allAgentIds);
      } else {
        // 没有代理ID，返回空结果
        query += ` AND 1=0`;
      }
    } else {
      // 非总代理只能查看自己和直接下级的交易
      const members = await db.any('SELECT id FROM members WHERE agent_id = $1', [agentId]);
      const memberIds = members.map(m => parseInt(m.id)); // 确保是整数
      
      console.log(`非总代理${agentId}的会员IDs:`, memberIds);
      
      if (memberIds.length > 0) {
        const memberPlaceholders = memberIds.map((_, i) => `$${params.length + 2 + i}`).join(',');
        query += ` AND ((t.user_type = 'agent' AND t.user_id = $${params.length + 1}) OR (t.user_type = 'member' AND t.user_id IN (${memberPlaceholders})))`;
        params.push(parseInt(agentId), ...memberIds);
      } else {
        query += ` AND t.user_type = 'agent' AND t.user_id = $${params.length + 1}`;
        params.push(parseInt(agentId));
      }
    }
    
    // 按类型筛选 - 修复交易类型分类
    if (type === 'deposit') {
      // 存款记录：只有客服存款操作
      query += ` AND t.transaction_type = 'cs_deposit'`;
    } else if (type === 'withdraw') {
      // 提款记录：只有客服提款操作
      query += ` AND t.transaction_type = 'cs_withdraw'`;
    } else if (type === 'rebate') {
      // 退水记录
      query += ` AND t.transaction_type = 'rebate'`;
    } else if (type === 'bet') {
      // 下注记录：包含游戏下注和中奖
      query += ` AND (t.transaction_type = 'game_bet' OR t.transaction_type = 'game_win')`;
    }
    
    // 获取总数
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/i, 'SELECT COUNT(*) FROM');
    const totalResult = await db.one(countQuery, params);
    const total = parseInt(totalResult.count);
    
    // 添加排序和分页
    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const transactions = await db.any(query, params);
    
    console.log(`获取交易记录成功: 找到 ${transactions.length} 笔记录，总计 ${total} 笔`);
    
    res.json({
      success: true,
      data: {
        list: transactions,
        total: total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('获取交易记录失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// ... existing code ...

// 重设代理密码
app.post(`${API_PREFIX}/reset-agent-password`, async (req, res) => {
  const { userId, newPassword, operatorId } = req.body;
  
  try {
    console.log(`重设代理密码: 代理ID=${userId}, 操作员=${operatorId}`);
    
    // 验证参数
    if (!userId || !newPassword || !operatorId) {
      return res.json({
        success: false,
        message: '参数不完整'
      });
    }
    
    // 验证密码长度
    if (newPassword.length < 6) {
      return res.json({
        success: false,
        message: '密码长度至少6个字符'
      });
    }
    
    // 检查操作员权限（只有上级代理可以重设下级密码）
    const operator = await AgentModel.findById(operatorId);
    if (!operator) {
      return res.json({
        success: false,
        message: '操作员不存在'
      });
    }
    
    // 检查目标代理是否存在
    const targetAgent = await AgentModel.findById(userId);
    if (!targetAgent) {
      return res.json({
        success: false,
        message: '目标代理不存在'
      });
    }
    
    // 权限检查：只有总代理或直接上级可以重设密码
    if (operator.level !== 0 && targetAgent.parent_id !== operator.id) {
      return res.json({
        success: false,
        message: '权限不足，只能重设直接下级代理的密码'
      });
    }
    
    // 更新密码（后端会自动加密）
    const result = await AgentModel.updatePassword(userId, newPassword);
    
    if (result) {
      // 记录操作日志
      await db.none(`
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        'agent', 
        userId, 
        0, 
        'password_reset', 
        targetAgent.balance, 
        targetAgent.balance, 
        `密码重设 by ${operator.username}`
      ]);
      
      console.log(`代理密码重设成功: ${targetAgent.username}`);
      res.json({
        success: true,
        message: '密码重设成功'
      });
    } else {
      res.json({
        success: false,
        message: '密码重设失败'
      });
    }
  } catch (error) {
    console.error('重设代理密码错误:', error);
    res.json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 重设会员密码
app.post(`${API_PREFIX}/reset-member-password`, async (req, res) => {
  const { userId, newPassword, operatorId } = req.body;
  
  try {
    console.log(`重设会员密码: 会员ID=${userId}, 操作员=${operatorId}`);
    
    // 验证参数
    if (!userId || !newPassword || !operatorId) {
      return res.json({
        success: false,
        message: '参数不完整'
      });
    }
    
    // 验证密码长度
    if (newPassword.length < 6) {
      return res.json({
        success: false,
        message: '密码长度至少6个字符'
      });
    }
    
    // 检查操作员权限
    const operator = await AgentModel.findById(operatorId);
    if (!operator) {
      return res.json({
        success: false,
        message: '操作员不存在'
      });
    }
    
    // 检查目标会员是否存在
    const targetMember = await MemberModel.findById(userId);
    if (!targetMember) {
      return res.json({
        success: false,
        message: '目标会员不存在'
      });
    }
    
    // 权限检查：只有该会员的代理或总代理可以重设密码
    if (operator.level !== 0 && targetMember.agent_id !== operator.id) {
      return res.json({
        success: false,
        message: '权限不足，只能重设自己旗下会员的密码'
      });
    }
    
    // 更新密码
    const result = await MemberModel.updatePassword(userId, newPassword);
    
    if (result) {
      // 记录操作日志
      await db.none(`
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        'member', 
        userId, 
        0, 
        'password_reset', 
        targetMember.balance, 
        targetMember.balance, 
        `密码重设 by ${operator.username}`
      ]);
      
      console.log(`会员密码重设成功: ${targetMember.username}`);
      res.json({
        success: true,
        message: '密码重设成功'
      });
    } else {
      res.json({
        success: false,
        message: '密码重设失败'
      });
    }
  } catch (error) {
    console.error('重设会员密码错误:', error);
    res.json({
      success: false,
      message: '服务器错误'
    });
  }
});

// ... existing code ...

//获取代理个人资料
app.get(`${API_PREFIX}/agent-profile/:agentId`, async (req, res) => {
  const { agentId } = req.params;
  
  try {
    console.log(`获取代理个人资料: 代理ID=${agentId}`);
    
    // 参数验证
    const parsedAgentId = parseInt(agentId);
    if (isNaN(parsedAgentId)) {
      console.error(`获取个人资料失败: 代理ID "${agentId}" 不是有效的数字`);
      return res.json({
        success: false,
        message: '代理ID格式错误'
      });
    }
    
    // 检查代理是否存在
    const agent = await AgentModel.findById(parsedAgentId);
    if (!agent) {
      console.error(`获取个人资料失败: 代理ID ${parsedAgentId} 不存在`);
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 查询个人资料
    const profile = await db.oneOrNone(`
      SELECT * FROM agents WHERE agent_id = $1
    `, [parsedAgentId]);
    
    console.log('查询到的个人资料:', profile);
    
    res.json({
      success: true,
      data: profile || {
        agent_id: parsedAgentId,
        real_name: '',
        phone: '',
        email: '',
        line_id: '',
        telegram: '',
        address: '',
        remark: ''
      }
    });
    
  } catch (error) {
    console.error('获取代理个人资料错误:', error);
    console.error('错误堆叠:', error.stack);
    res.json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 更新代理个人资料
app.post(`${API_PREFIX}/update-agent-profile`, async (req, res) => {
  const { agentId, realName, phone, email, lineId, telegram, address, remark } = req.body;
  
  try {
    console.log(`更新代理个人资料: 代理ID=${agentId}`);
    console.log('请求参数:', req.body);
    
    // 参数验证
    if (!agentId) {
      console.error('更新个人资料失败: 缺少代理ID');
      return res.json({
        success: false,
        message: '缺少代理ID'
      });
    }
    
    // 确保agentId是数字
    const parsedAgentId = parseInt(agentId);
    if (isNaN(parsedAgentId)) {
      console.error(`更新个人资料失败: 代理ID "${agentId}" 不是有效的数字`);
      return res.json({
        success: false,
        message: '代理ID格式错误'
      });
    }
    
    // 检查代理是否存在
    const agent = await AgentModel.findById(parsedAgentId);
    if (!agent) {
      console.error(`更新个人资料失败: 代理ID ${parsedAgentId} 不存在`);
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 处理可能为空的字段值
    const safeRealName = realName || null;
    const safePhone = phone || null;
    const safeEmail = email || null;
    const safeLineId = lineId || null;
    const safeTelegram = telegram || null;
    const safeAddress = address || null;
    const safeRemark = remark || null;
    
    console.log('安全处理后的参数:', {
      agentId: parsedAgentId,
      realName: safeRealName,
      phone: safePhone,
      email: safeEmail,
      lineId: safeLineId,
      telegram: safeTelegram,
      address: safeAddress,
      remark: safeRemark
    });
    
    // 检查是否已有个人资料记录
    const existingProfile = await db.oneOrNone(`
      SELECT * FROM agents WHERE agent_id = $1
    `, [parsedAgentId]);
    
    if (existingProfile) {
      console.log(`找到现有个人资料记录，ID=${existingProfile.id}，执行更新`);
      // 更新现有记录
      await db.none(`
        UPDATE agents 
        SET real_name = $1, phone = $2, email = $3, line_id = $4, 
            telegram = $5, address = $6, remark = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_id = $8
      `, [safeRealName, safePhone, safeEmail, safeLineId, safeTelegram, safeAddress, safeRemark, parsedAgentId]);
      console.log('个人资料更新完成');
    } else {
      console.log('未找到现有记录，创建新的个人资料记录');
      // 创建新记录
      await db.none(`
        INSERT INTO agents 
        (agent_id, real_name, phone, email, line_id, telegram, address, remark)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [parsedAgentId, safeRealName, safePhone, safeEmail, safeLineId, safeTelegram, safeAddress, safeRemark]);
      console.log('个人资料创建完成');
    }
    
    console.log(`代理个人资料更新成功: ${agent.username}`);
    res.json({
      success: true,
      message: '个人资料更新成功'
    });
    
  } catch (error) {
    console.error('更新代理个人资料错误:', error);
    console.error('错误堆叠:', error.stack);
    
    // 更详细的错误信息
    let errorMessage = '服务器错误';
    if (error.code === '23505') {
      errorMessage = '代理个人资料记录已存在';
    } else if (error.code === '23503') {
      errorMessage = '代理不存在或已被删除';
    } else if (error.code === '22001') {
      errorMessage = '输入的资料过长，请检查各栏位长度';
    } else if (error.message) {
      errorMessage = `数据库错误: ${error.message}`;
    }
    
    res.json({
      success: false,
      message: errorMessage
    });
  }
});

// ... existing code ...

// 全局错误处理中间件
app.use((err, req, res, next) => {
  console.error('未捕获的错误:', err);
  
  // 处理 pg-promise 的 "Multiple rows were not expected" 错误
  if (err.message && err.message.includes('Multiple rows were not expected')) {
    console.error('数据库查询返回了多笔记录，但期望只有一笔');
    return res.status(500).json({
      success: false,
      message: '数据库查询异常，请联系系统管理员'
    });
  }
  
  // 处理其他数据库错误
  if (err.code) {
    console.error('数据库错误代码:', err.code);
    return res.status(500).json({
      success: false,
      message: '数据库操作失败'
    });
  }
  
  // 通用错误处理
  return res.status(500).json({
    success: false,
    message: '系统内部错误'
  });
});

// 特殊处理：期数格式的直接访问 (例如 /20250705510)
app.get(/^\/\d{11}$/, (req, res) => {
  const period = req.url.substring(1);
  console.log(`🎯 检测到期数格式的直接访问: ${period}`);
  console.log(`📍 请求来源: ${req.headers.referer || '直接访问'}`);
  
  res.status(404).json({
    success: false,
    message: `期数 ${period} 不能直接访问，请使用 API`,
    error: 'PERIOD_DIRECT_ACCESS_NOT_ALLOWED',
    suggestion: `请使用 /api/agent/draw-history?period=${period} 查询开奖记录`
  });
});

// 为所有客服相关 API 添加 try-catch 包装器
function wrapAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 新增: 下注/中奖交易同步API（建立交易记录用于统计）
app.post(`${API_PREFIX}/sync-bet-transaction`, async (req, res) => {
  const { agentId, username, amount, newBalance, type, description } = req.body;
  
  console.log(`收到下注/中奖同步请求: 代理ID=${agentId}, 会员=${username}, 金额=${amount}, 新余额=${newBalance}, 类型=${type}, 说明=${description}`);
  
  try {
    if (!username || amount === undefined || !agentId || newBalance === undefined) {
      console.error('同步下注/中奖失败: 缺少必要参数');
      return res.json({
        success: false,
        message: '请提供完整的同步参数'
      });
    }
    
    // 查询会员
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      console.error(`同步下注/中奖失败: 会员 ${username} 不存在`);
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    // 查询代理
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      console.error(`同步下注/中奖失败: 代理 ID=${agentId} 不存在`);
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 验证会员是否属于该代理
    if (member.agent_id !== agent.id) {
      console.error(`同步下注/中奖失败: 会员 ${username} 不属于代理 ${agent.username}`);
      return res.json({
        success: false,
        message: '会员与代理不匹配'
      });
    }
    
    // 更新会员余额
    await MemberModel.setBalance(username, newBalance);
    console.log(`会员 ${username} 余额已更新为: ${newBalance}`);
    
    // 建立交易记录用于统计
    const transactionType = type === 'win' ? 'game_win' : 'game_bet';
    await TransactionModel.create({
      user_type: 'member',
      user_id: member.id,
      amount: parseFloat(amount),
      type: transactionType,
      description: description || `游戏${type === 'win' ? '中奖' : '下注'}`,
      balance_after: parseFloat(newBalance)
    });
    
    console.log(`交易记录已建立: 会员ID=${member.id}, 金额=${amount}, 类型=${transactionType}`);
    
    res.json({
      success: true,
      message: '下注/中奖同步成功',
      balance: newBalance
    });
  } catch (error) {
    console.error('同步下注/中奖出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 获取会员信息API
app.get(`${API_PREFIX}/member/info/:username`, async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '缺少用户名参数'
      });
    }
    
    // 查找会员
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: '会员不存在'
      });
    }
    
    res.json({
      success: true,
      member: {
        id: member.id,
        username: member.username,
        balance: member.balance,
        status: member.status,
        agent_id: member.agent_id,
        created_at: member.created_at
      }
    });
    
  } catch (error) {
    console.error('获取会员信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取会员信息失败',
      error: error.message
    });
  }
});

// 新增: 扣除会员余额API（用于游戏下注）- 使用安全锁定机制
app.post(`${API_PREFIX}/deduct-member-balance`, async (req, res) => {
  const { username, amount, reason } = req.body;
  
  console.log(`收到扣除会员余额请求: 会员=${username}, 金额=${amount}, 原因=${reason}`);
  
  try {
    if (!username || amount === undefined) {
      return res.json({
        success: false,
        message: '请提供会员用户名和扣除金额'
      });
    }
    
    const deductAmount = parseFloat(amount);
    if (isNaN(deductAmount) || deductAmount <= 0) {
      return res.json({
        success: false,
        message: '扣除金额必须大于0'
      });
    }
    
    // 生成唯一的下注ID用于锁定
    const betId = `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 使用安全的扣款函数（带锁定机制）
      const result = await db.one(`
        SELECT * FROM safe_bet_deduction($1, $2, $3)
      `, [username, deductAmount, betId]);
      
      if (result.success) {
        console.log(`成功扣除会员 ${username} 余额 ${deductAmount} 元，新余额: ${result.balance}`);
        
        // 记录交易历史
        try {
          const member = await MemberModel.findByUsername(username);
          if (member) {
            await db.none(`
              INSERT INTO transaction_records 
              (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, ['member', member.id, -deductAmount, 'game_bet', 
                parseFloat(result.balance) + deductAmount, parseFloat(result.balance), 
                reason || '游戏下注']);
          }
        } catch (logError) {
          console.error('记录交易历史失败:', logError);
          // 不影响主要操作
        }
        
        res.json({
          success: true,
          message: '余额扣除成功',
          balance: parseFloat(result.balance),
          deductedAmount: deductAmount
        });
      } else {
        console.log(`扣除余额失败: ${result.message}`);
        res.json({
          success: false,
          message: result.message,
          balance: parseFloat(result.balance)
        });
      }
    } catch (dbError) {
      console.error('执行安全扣款函数失败:', dbError);
      
      // 如果函数不存在，使用传统方式（向后兼容）
      if (dbError.code === '42883') { // function does not exist
        console.log('安全扣款函数不存在，使用传统方式');
        
        // 查询会员
        const member = await MemberModel.findByUsername(username);
        if (!member) {
          console.log(`扣除余额失败: 会员 ${username} 不存在`);
          return res.json({
            success: false,
            message: '会员不存在'
          });
        }
        
        const currentBalance = parseFloat(member.balance);
        const afterBalance = currentBalance - deductAmount;
        
        // 检查余额是否足够
        if (afterBalance < 0) {
          console.log(`扣除余额失败: 会员 ${username} 余额不足 (当前: ${currentBalance}, 尝试扣除: ${deductAmount})`);
          return res.json({
            success: false,
            message: '余额不足'
          });
        }
        
        // 执行扣除操作（使用负金额表示扣除）
        const updatedMember = await MemberModel.updateBalance(username, -deductAmount);
        
        console.log(`成功扣除会员 ${username} 余额 ${deductAmount} 元，新余额: ${updatedMember.balance}`);
        
        res.json({
          success: true,
          message: '余额扣除成功',
          balance: parseFloat(updatedMember.balance),
          deductedAmount: deductAmount
        });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('扣除会员余额出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 新增: 批量扣除会员余额API（用于多笔同时下注）
app.post(`${API_PREFIX}/batch-deduct-member-balance`, async (req, res) => {
  const { username, bets } = req.body;
  
  console.log(`收到批量扣除会员余额请求: 会员=${username}, 下注笔数=${bets?.length || 0}`);
  
  try {
    if (!username || !bets || !Array.isArray(bets) || bets.length === 0) {
      return res.json({
        success: false,
        message: '请提供会员用户名和下注列表'
      });
    }
    
    // 验证所有下注金额
    for (let i = 0; i < bets.length; i++) {
      const bet = bets[i];
      if (!bet.amount || parseFloat(bet.amount) <= 0) {
        return res.json({
          success: false,
          message: `第 ${i + 1} 笔下注金额无效`
        });
      }
    }
    
    // 生成每笔下注的唯一ID
    const betsWithIds = bets.map((bet, index) => ({
      amount: parseFloat(bet.amount),
      bet_id: bet.bet_id || `bet_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
    }));
    
    try {
      // 使用批量扣款函数
      const result = await db.one(`
        SELECT * FROM batch_bet_deduction($1, $2::jsonb)
      `, [username, JSON.stringify(betsWithIds)]);
      
      if (result.success) {
        console.log(`成功批量扣除会员 ${username} 余额，总金额: ${result.total_deducted} 元，新余额: ${result.balance}`);
        
        // 记录交易历史
        try {
          const member = await MemberModel.findByUsername(username);
          if (member) {
            await db.none(`
              INSERT INTO transaction_records 
              (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, ['member', member.id, -result.total_deducted, 'game_bet', 
                parseFloat(result.balance) + parseFloat(result.total_deducted), 
                parseFloat(result.balance), 
                `批量下注 ${bets.length} 笔`]);
          }
        } catch (logError) {
          console.error('记录交易历史失败:', logError);
          // 不影响主要操作
        }
        
        res.json({
          success: true,
          message: '批量余额扣除成功',
          balance: parseFloat(result.balance),
          totalDeducted: parseFloat(result.total_deducted),
          processedBets: betsWithIds,
          failedBets: result.failed_bets || []
        });
      } else {
        console.log(`批量扣除余额失败: ${result.message}`);
        res.json({
          success: false,
          message: result.message,
          balance: parseFloat(result.balance),
          failedBets: result.failed_bets || bets
        });
      }
    } catch (dbError) {
      console.error('执行批量扣款函数失败:', dbError);
      
      // 如果函数不存在，降级到逐笔处理
      if (dbError.code === '42883') { // function does not exist
        console.log('批量扣款函数不存在，降级到逐笔处理');
        
        // 使用事务逐笔处理
        let totalDeducted = 0;
        let finalBalance = 0;
        const processedBets = [];
        const failedBets = [];
        
        try {
          await db.tx(async t => {
            // 先检查总余额是否足够
            const member = await t.oneOrNone('SELECT * FROM members WHERE username = $1 FOR UPDATE', [username]);
            if (!member) {
              throw new Error('会员不存在');
            }
            
            const totalAmount = betsWithIds.reduce((sum, bet) => sum + bet.amount, 0);
            if (parseFloat(member.balance) < totalAmount) {
              throw new Error('余额不足');
            }
            
            // 执行批量扣款
            finalBalance = await t.one(`
              UPDATE members 
              SET balance = balance - $1 
              WHERE username = $2 
              RETURNING balance
            `, [totalAmount, username]).then(r => parseFloat(r.balance));
            
            totalDeducted = totalAmount;
            processedBets.push(...betsWithIds);
          });
          
          console.log(`降级处理成功: 总扣款 ${totalDeducted} 元，新余额 ${finalBalance}`);
          
          res.json({
            success: true,
            message: '批量余额扣除成功（降级处理）',
            balance: finalBalance,
            totalDeducted: totalDeducted,
            processedBets: processedBets,
            failedBets: failedBets
          });
        } catch (txError) {
          console.error('降级处理失败:', txError);
          res.json({
            success: false,
            message: txError.message || '批量扣款失败',
            failedBets: betsWithIds
          });
        }
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('批量扣除会员余额出错:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 登录日志API - 获取当前用户的登录记录
app.get(`${API_PREFIX}/login-logs`, async (req, res) => {
  try {
    // 使用通用认证中间件
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { agent } = authResult;

    const { startDate, endDate } = req.query;
    
    // 构建查询条件
    let whereClause = 'WHERE username = $1';
    let queryParams = [agent.username];
    
    // 检查日期参数是否有效（不是空字符串、undefined或null）
    const validStartDate = startDate && startDate.trim() !== '';
    const validEndDate = endDate && endDate.trim() !== '';
    
    if (validStartDate && validEndDate) {
      whereClause += ' AND login_time >= $2 AND login_time <= $3';
      queryParams.push(startDate + ' 00:00:00', endDate + ' 23:59:59');
    } else if (validStartDate) {
      whereClause += ' AND login_time >= $2';
      queryParams.push(startDate + ' 00:00:00');
    } else if (validEndDate) {
      whereClause += ' AND login_time <= $2';
      queryParams.push(endDate + ' 23:59:59');
    }
    
    // 查询登录日志（假设有 user_login_logs 表）
    const logs = await db.any(`
      SELECT id, username, login_time, ip_address, ip_location
      FROM user_login_logs 
      ${whereClause}
      ORDER BY login_time DESC
      LIMIT 100
    `, queryParams);

    res.json({
      success: true,
      logs: logs
    });

  } catch (error) {
    console.error('获取登录日志失败:', error);
    
    // 如果表不存在，返回空数据而不是错误
    if (error.message.includes('does not exist') || error.message.includes('relation')) {
      return res.json({
        success: true,
        logs: [],
        message: '登录日志表尚未创建'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '获取登录日志失败',
      error: error.message
    });
  }
});

// 报表查询API - 获取投注报表数据
app.get(`${API_PREFIX}/reports`, async (req, res) => {
  try {
    // 使用通用认证中间件
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { agent } = authResult;

    const { startDate, endDate, gameTypes, settlementStatus, betType, username, minAmount, maxAmount } = req.query;
    
    // 构建查询条件
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramIndex = 1;
    
    // 暂时移除代理权限过滤，因为bet_history表没有agent_id栏位
    // TODO: 未来需要加入代理关联查询
    
    // 检查日期参数是否有效
    const validStartDate = startDate && startDate.trim() !== '';
    const validEndDate = endDate && endDate.trim() !== '';
    
    if (validStartDate && validEndDate) {
      whereClause += ` AND bh.created_at >= $${paramIndex} AND bh.created_at <= $${paramIndex + 1}`;
      queryParams.push(startDate + ' 00:00:00', endDate + ' 23:59:59');
      paramIndex += 2;
    } else if (validStartDate) {
      whereClause += ` AND bh.created_at >= $${paramIndex}`;
      queryParams.push(startDate + ' 00:00:00');
      paramIndex++;
    } else if (validEndDate) {
      whereClause += ` AND bh.created_at <= $${paramIndex}`;
      queryParams.push(endDate + ' 23:59:59');
      paramIndex++;
    }
    
    if (username) {
      whereClause += ` AND bh.username ILIKE $${paramIndex}`;
      queryParams.push(`%${username}%`);
      paramIndex++;
    }
    
    if (minAmount) {
      whereClause += ` AND bh.amount >= $${paramIndex}`;
      queryParams.push(parseFloat(minAmount));
      paramIndex++;
    }
    
    if (maxAmount) {
      whereClause += ` AND bh.amount <= $${paramIndex}`;
      queryParams.push(parseFloat(maxAmount));
      paramIndex++;
    }
    
    // 查询投注记录（使用真实的 bet_history 表）
    let baseQuery = `
      SELECT 
        bh.period,
        bh.username,
        'AR PK10' as game_type,
        bh.bet_type || ' ' || COALESCE(bh.bet_value, '') as bet_content,
        bh.amount as bet_amount,
        bh.amount as valid_amount,
        CASE 
          WHEN bh.win = true THEN bh.win_amount - bh.amount
          ELSE -bh.amount
        END as profit_loss,
        (bh.amount * 0.02) as rebate,
        'ti2025' as agent_name,
        10 as commission,
        CASE 
          WHEN bh.win = true THEN (bh.win_amount - bh.amount) * -0.1
          ELSE bh.amount * 0.1
        END as agent_result,
        (bh.amount * 0.85) as turnover,
        bh.created_at
      FROM bet_history bh
    `;
    
    const records = await db.any(`
      ${baseQuery}
      ${whereClause}
      ORDER BY bh.created_at DESC
      LIMIT 500
    `, queryParams);

    // 计算统计数据
    const totalBets = records.length;
    const totalAmount = records.reduce((sum, r) => sum + parseFloat(r.bet_amount || 0), 0);
    const validAmount = totalAmount; // 假设所有投注都是有效投注
    const profitLoss = records.reduce((sum, r) => sum + parseFloat(r.profit_loss || 0), 0);

    res.json({
      success: true,
      totalBets,
      totalAmount,
      validAmount,
      profitLoss,
      records
    });

  } catch (error) {
    console.error('获取报表数据失败:', error);
    
    // 如果表不存在，返回空数据而不是错误
    if (error.message.includes('does not exist') || error.message.includes('relation')) {
      return res.json({
        success: true,
        totalBets: 0,
        totalAmount: 0,
        validAmount: 0,
        profitLoss: 0,
        records: [],
        message: '投注记录表尚未创建'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '获取报表数据失败',
      error: error.message
    });
  }
});

// 层级会员管理 API
app.get(`${API_PREFIX}/hierarchical-members`, async (req, res) => {
    try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
            return res.status(401).json(authResult);
        }

        const { agent: currentAgent } = authResult;
        const queryAgentId = parseInt(req.query.agentId) || currentAgent.id;
        const { status, keyword } = req.query;
        
        console.log('📊 层级会员管理API调用:', { queryAgentId, status, keyword });
        
        // 辅助函数：获取级别名称
        function getLevelName(level) {
            const levels = {
                0: '总代理',
                1: '一级代理', 
                2: '二级代理',
                3: '三级代理',
                4: '四级代理',
                5: '五级代理',
                6: '六级代理',
                7: '七级代理',
                8: '八级代理',
                9: '九级代理',
                10: '十级代理',
                11: '十一级代理',
                12: '十二级代理',
                13: '十三级代理',
                14: '十四级代理',
                15: '十五级代理'
            };
            return levels[level] || `${level}级代理`;
        }
        
        // 获取直接创建的代理
        const directAgents = await db.any(`
            SELECT id, username, level, balance, status, created_at, notes,
                   rebate_mode, rebate_percentage, max_rebate_percentage, market_type, betting_limit_level
            FROM agents WHERE parent_id = $1 ORDER BY level, username
        `, [queryAgentId]);
        
        // 获取直接创建的会员
        let memberQuery = `
            SELECT id, username, balance, status, created_at, notes, market_type
            FROM members WHERE agent_id = $1
        `;
        const memberParams = [queryAgentId];
        
        if (status && status !== '-1') {
            memberQuery += ` AND status = $${memberParams.length + 1}`;
            memberParams.push(parseInt(status));
        }
        
        if (keyword) {
            memberQuery += ` AND (username ILIKE $${memberParams.length + 1} OR id::text ILIKE $${memberParams.length + 1})`;
            memberParams.push(`%${keyword}%`);
        }
        
        memberQuery += ` ORDER BY username`;
        
        const directMembers = await db.any(memberQuery, memberParams);
        
        // 检查每个代理是否有下级
        const agentsWithDownline = await Promise.all(
            directAgents.map(async (agent) => {
                const subAgentCount = await db.one(`
                    SELECT COUNT(*) as count FROM agents WHERE parent_id = $1
                `, [agent.id]);
                
                const subMemberCount = await db.one(`
                    SELECT COUNT(*) as count FROM members WHERE agent_id = $1
                `, [agent.id]);
                
                return {
                    ...agent,
                    userType: 'agent',
                    hasDownline: parseInt(subAgentCount.count) + parseInt(subMemberCount.count) > 0,
                    // 保持 level 为原始数字，让前端处理显示
                    level: agent.level
                };
            })
        );
        
        // 处理会员数据
        const membersWithType = directMembers.map(member => ({
            ...member,
            userType: 'member',
            hasDownline: false,
            level: '会员'
        }));
        
        // 合并代理和会员数据
        const combinedData = [...agentsWithDownline, ...membersWithType];
        
        // 过滤关键字（如果有的话）
        let filteredData = combinedData;
        if (keyword) {
            filteredData = combinedData.filter(item => 
                item.username.toLowerCase().includes(keyword.toLowerCase()) ||
                item.id.toString().includes(keyword)
            );
        }
        
        // 过滤状态（如果有的话）
        if (status && status !== '-1') {
            filteredData = filteredData.filter(item => item.status === parseInt(status));
        }
        
        const stats = {
            agentCount: agentsWithDownline.length,
            memberCount: membersWithType.length
        };
        
        res.json({
            success: true,
            data: filteredData,
            stats: stats,
            message: '层级会员管理数据获取成功'
        });
        
    } catch (error) {
        console.error('❌ 层级会员管理API错误:', error);
        res.status(500).json({
            success: false,
            message: '获取层级会员管理数据失败',
            error: error.message
        });
    }
});

// 代理层级分析报表API - 简化版：统一显示本级创建的代理和会员
// 代理层级分析报表API - 高性能优化版本，消除递归查询
app.get(`${API_PREFIX}/reports/agent-analysis`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent: currentAgent } = authResult;
    const { startDate, endDate, username, targetAgent } = req.query;
    let queryAgentId = currentAgent.id;
    let queryAgent = currentAgent;
    
    console.log(`🔍 当前登入代理: ${currentAgent.username} (退水: ${(currentAgent.rebate_percentage * 100).toFixed(1)}%)`);
    console.log(`🎯 目标代理参数: ${targetAgent || '无'}`);
    
    if (targetAgent) {
      const targetAgentData = await AgentModel.findByUsername(targetAgent);
      if (targetAgentData) {
        queryAgentId = targetAgentData.id;
        queryAgent = targetAgentData;
        console.log(`✅ 找到目标代理: ${targetAgentData.username} (退水: ${(targetAgentData.rebate_percentage * 100).toFixed(1)}%)`);
      } else {
        return res.json({ success: true, reportData: [], hasData: false, currentAgent: queryAgent, totalSummary: {}, message: `目标代理 ${targetAgent} 不存在` });
      }
    }
    
    console.log('📊 代理层级分析查询:', { queryAgentId, startDate, endDate, username, targetAgent });
    
    // 查询本级下所有直属代理（包含退水百分比）
    const agents = await db.any(`SELECT * FROM agents WHERE parent_id = $1 AND status = 1`, [queryAgentId]);
    // 查询本级下所有直属会员
    const members = await db.any(`SELECT * FROM members WHERE agent_id = $1 AND status = 1`, [queryAgentId]);
    
    // 获取查询代理的退水百分比
    const queryAgentRebate = parseFloat(queryAgent.rebate_percentage || 0);
    
    console.log(`📈 查询结果: ${agents.length}个代理, ${members.length}个会员`);
    console.log(`💰 查询代理 ${queryAgent.username} 的退水设定: ${(queryAgentRebate * 100).toFixed(1)}%`);
    
    // 构建日期筛选条件
    let dateFilter = '';
    let dateParams = [];
    if (startDate && startDate.trim()) {
      dateFilter += ` AND bh.created_at >= $1`;
      dateParams.push(startDate + ' 00:00:00');
    }
    if (endDate && endDate.trim()) {
      dateFilter += ` AND bh.created_at <= $${dateParams.length + 1}`;
      dateParams.push(endDate + ' 23:59:59');
    }
    
    // 统计每个代理的下注数据
    const agentStats = await Promise.all(agents.map(async agent => {
      let stats = { betcount: 0, betamount: 0, memberwinloss: 0 };
      
      if (dateParams.length > 0) {
        // 有日期筛选条件时，查询该期间的下注数据
        stats = await db.oneOrNone(
          `SELECT COUNT(*) as betCount, COALESCE(SUM(amount),0) as betAmount, COALESCE(SUM(CASE WHEN settled THEN win_amount-amount ELSE 0 END),0) as memberWinLoss
           FROM bet_history bh WHERE username IN (SELECT username FROM members WHERE agent_id = $1) ${dateFilter}`, 
          [agent.id, ...dateParams]
        ) || { betcount: 0, betamount: 0, memberwinloss: 0 };
      } else {
        // 无日期筛选条件时，查询所有下注数据
        stats = await db.oneOrNone(
          `SELECT COUNT(*) as betCount, COALESCE(SUM(amount),0) as betAmount, COALESCE(SUM(CASE WHEN settled THEN win_amount-amount ELSE 0 END),0) as memberWinLoss
           FROM bet_history WHERE username IN (SELECT username FROM members WHERE agent_id = $1)`, 
          [agent.id]
        ) || { betcount: 0, betamount: 0, memberwinloss: 0 };
      }
      
      // 新退水逻辑：查看下级代理时，显示退水差额（自己的退水% - 下级代理的退水%）
      const agentRebatePercentage = parseFloat(agent.rebate_percentage || 0);
      const queryAgentRebatePercentage = parseFloat(queryAgent.rebate_percentage || 0);
      const earnedRebatePercentage = queryAgentRebatePercentage - agentRebatePercentage; // 退水差额
      const earnedRebateAmount = parseFloat(stats.betamount || 0) * earnedRebatePercentage;
      
      console.log(`💰 下级代理 ${agent.username}: 查询代理退水 ${(queryAgentRebatePercentage * 100).toFixed(1)}% - 下级代理退水 ${(agentRebatePercentage * 100).toFixed(1)}% = 赚水 ${(earnedRebatePercentage * 100).toFixed(1)}%`);
      
      return {
        id: agent.id,
        username: agent.username,
        userType: 'agent',
        level: agent.level,
        balance: parseFloat(agent.balance || 0),
        betCount: parseInt(stats.betcount) || 0,
        betAmount: parseFloat(stats.betamount) || 0,
        validAmount: parseFloat(stats.betamount) || 0,
        memberWinLoss: parseFloat(stats.memberwinloss) || 0,
        rebatePercentage: agentRebatePercentage,
        earnedRebatePercentage: earnedRebatePercentage,
        earnedRebateAmount: earnedRebateAmount,
        hasDownline: true
      };
    }));
    
    // 统计每个会员的下注数据
    const memberStats = await Promise.all(members.map(async member => {
      let stats = { betcount: 0, betamount: 0, memberwinloss: 0 };
      
      if (dateParams.length > 0) {
        // 有日期筛选条件时，查询该期间的下注数据
        stats = await db.oneOrNone(
          `SELECT COUNT(*) as betCount, COALESCE(SUM(amount),0) as betAmount, COALESCE(SUM(CASE WHEN settled THEN win_amount-amount ELSE 0 END),0) as memberWinLoss
           FROM bet_history bh WHERE username = $1 ${dateFilter}`, 
          [member.username, ...dateParams]
        ) || { betcount: 0, betamount: 0, memberwinloss: 0 };
      } else {
        // 无日期筛选条件时，查询所有下注数据
        stats = await db.oneOrNone(
          `SELECT COUNT(*) as betCount, COALESCE(SUM(amount),0) as betAmount, COALESCE(SUM(CASE WHEN settled THEN win_amount-amount ELSE 0 END),0) as memberWinLoss
           FROM bet_history WHERE username = $1`, 
          [member.username]
        ) || { betcount: 0, betamount: 0, memberwinloss: 0 };
      }
      
      // 新退水逻辑：查看会员时，显示自己的完整退水百分比
      const earnedRebatePercentage = queryAgentRebate; // 使用查询代理的完整退水设定
      const earnedRebateAmount = parseFloat(stats.betamount || 0) * earnedRebatePercentage;
      
      return {
        id: member.id,
        username: member.username,
        userType: 'member',
        level: '会员',
        balance: parseFloat(member.balance || 0),
        betCount: parseInt(stats.betcount) || 0,
        betAmount: parseFloat(stats.betamount) || 0,
        validAmount: parseFloat(stats.betamount) || 0,
        memberWinLoss: parseFloat(stats.memberwinloss) || 0,
        rebatePercentage: 0, // 会员没有退水
        earnedRebatePercentage: earnedRebatePercentage,
        earnedRebateAmount: earnedRebateAmount,
        hasDownline: false
      };
    }));
    
    const reportData = [...agentStats, ...memberStats];
    
    // 计算总计时，赚水金额为所有个别项目的赚水金额之和
    const totalBetAmount = reportData.reduce((a, b) => a + (b.betAmount || 0), 0);
    const totalEarnedRebateAmount = reportData.reduce((a, b) => a + (b.earnedRebateAmount || 0), 0);
    
    console.log(`💵 总计计算: 总下注 ${totalBetAmount}, 总赚水 ${totalEarnedRebateAmount.toFixed(2)}`);
    
    const totalSummary = {
      betCount: reportData.reduce((a, b) => a + (b.betCount || 0), 0),
      betAmount: totalBetAmount,
      validAmount: reportData.reduce((a, b) => a + (b.validAmount || 0), 0),
      memberWinLoss: reportData.reduce((a, b) => a + (b.memberWinLoss || 0), 0),
      earnedRebateAmount: totalEarnedRebateAmount // 使用查询代理的退水百分比计算
    };
    
    // 添加agentInfo字段
    const agentInfo = {
      id: queryAgent.id,
      username: queryAgent.username,
      agentCount: agents.length,
      memberCount: members.length
    };
    
    console.log(`📊 返回数据: ${reportData.length}个项目 (${agents.length}代理 + ${members.length}会员)`);
    
    res.json({ 
      success: true, 
      reportData, 
      totalSummary, 
      hasData: reportData.length > 0, 
      currentAgent: queryAgent,
      agentInfo: agentInfo
    });
  } catch (error) {
    console.error('代理层级分析API错误:', error);
    res.json({ success: false, reportData: [], totalSummary: {}, hasData: false, message: error.message });
  }
});



// 创建通用认证中间件
async function authenticateAgent(req) {
  const legacyToken = req.headers.authorization?.replace('Bearer ', '');
  const sessionToken = req.headers['x-session-token'] || req.headers['X-Session-Token'];
  
  console.log('🔐 认证中间件调用:', { 
    hasLegacyToken: !!legacyToken, 
    hasSessionToken: !!sessionToken,
    headers: Object.keys(req.headers)
  });
  
  // 优先使用新的session token
  if (sessionToken) {
    try {
      const session = await SessionManager.validateSession(sessionToken);
      if (session && session.userType === 'agent') {
        const agent = await AgentModel.findById(session.userId);
        if (agent) {
          console.log('✅ Session token认证成功:', agent.username);
          return { success: true, agent, session };
        }
      }
    } catch (error) {
      console.error('Session token验证失败:', error);
    }
  }
  
  // 向后兼容旧的legacy token
  if (legacyToken) {
    try {
      // 解析legacy token格式: agentId:timestamp
      const decoded = Buffer.from(legacyToken, 'base64').toString();
      const [agentId, timestamp] = decoded.split(':');
      
      if (agentId && timestamp) {
        const agent = await AgentModel.findById(parseInt(agentId));
        if (agent) {
          console.log('✅ Legacy token认证成功:', agent.username);
          return { success: true, agent, session: { userId: agent.id, userType: 'agent' } };
        }
      }
    } catch (error) {
      console.error('Legacy token解析错误:', error);
    }
  }
  
  console.log('❌ 认证失败: 无有效token');
  return { success: false, message: '无效的授权令牌' };
}

// 新增：代理层级分析API别名路由 - 优化版本，减少查询次数并返回实际报表数据
app.get(`${API_PREFIX}/agent-hierarchical-analysis`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { agent: currentAgent } = authResult;
    const { startDate, endDate, username, agentId } = req.query;
    
    console.log('📊 代理层级分析API (优化版):', { 
      startDate, endDate, username, agentId, currentAgentId: currentAgent.id
    });
    
    const targetAgentId = parseInt(agentId) || currentAgent.id;
    
    try {
      // 使用单一SQL查询获取所有下级代理和会员的下注数据
      let whereClause = 'WHERE 1=1';
      let params = [];
      let paramIndex = 1;
      
      if (startDate && startDate.trim()) {
        whereClause += ` AND bh.created_at >= $${paramIndex}`;
        params.push(startDate + ' 00:00:00');
        paramIndex++;
      }
      
      if (endDate && endDate.trim()) {
        whereClause += ` AND bh.created_at <= $${paramIndex}`;
        params.push(endDate + ' 23:59:59');
        paramIndex++;
      }
      
      if (username && username.trim()) {
        whereClause += ` AND bh.username ILIKE $${paramIndex}`;
        params.push(`%${username}%`);
        paramIndex++;
      }
      
      let reportData = [];
      let hasData = false;
      let totalSummary = {
        betCount: 0,
        betAmount: 0.0,
        validAmount: 0.0,
        memberWinLoss: 0.0,
        rebate: 0.0,
        profitLoss: 0.0,
        actualRebate: 0.0,
        rebateProfit: 0.0,
        finalProfitLoss: 0.0
      };
      
      // 获取目标代理的直接下级代理和会员，以及他们的下注统计
      try {
        // 1. 获取直接下级代理的统计  
        const agentQuery = `
          WITH RECURSIVE agent_tree AS (
            SELECT id, username, level, parent_id, 0 as depth
            FROM agents 
            WHERE parent_id = $1 AND status = 1
            
            UNION ALL
            
            SELECT a.id, a.username, a.level, a.parent_id, at.depth + 1
            FROM agents a
            INNER JOIN agent_tree at ON a.parent_id = at.id
            WHERE a.status = 1 AND at.depth < 3
          ),
          agent_members AS (
            SELECT at.id as agent_id, at.username as agent_username, at.level,
                   m.username as member_username
            FROM agent_tree at
            LEFT JOIN members m ON m.agent_id = at.id AND m.status = 1
          ),
          bet_stats AS (
            SELECT am.agent_id, am.agent_username, am.level,
                   COUNT(bh.id) as bet_count,
                   COALESCE(SUM(bh.amount), 0) as total_bet_amount,
                   COALESCE(SUM(bh.win_amount), 0) as total_win_amount
            FROM agent_members am
            LEFT JOIN bet_history bh ON bh.username = am.member_username
            ${whereClause.replace(/\$(\d+)/g, (match, p1) => `$${parseInt(p1) + 1}`)}
            GROUP BY am.agent_id, am.agent_username, am.level
          )
          SELECT bs.agent_id, bs.agent_username, bs.level, bs.bet_count, bs.total_bet_amount, bs.total_win_amount,
                 a.balance, a.rebate_percentage
          FROM bet_stats bs
          INNER JOIN agents a ON a.id = bs.agent_id
          WHERE bs.bet_count > 0
          ORDER BY bs.agent_username
        `;
        const agentStats = await db.any(agentQuery, [targetAgentId].concat(params));
        
        // 获取当前查询代理的退水百分比
        const targetAgent = await db.oneOrNone('SELECT rebate_percentage FROM agents WHERE id = $1', [targetAgentId]);
        const targetAgentRebate = parseFloat(targetAgent?.rebate_percentage || 0.041);
        
        // 2. 获取直接会员的统计
        const memberQuery = `
          SELECT m.id, m.username, m.balance,
                 COUNT(bh.id) as bet_count,
                 COALESCE(SUM(bh.amount), 0) as total_bet_amount,
                 COALESCE(SUM(bh.win_amount), 0) as total_win_amount
          FROM members m
          LEFT JOIN bet_history bh ON bh.username = m.username
          ${whereClause.replace(/\$(\d+)/g, (match, p1) => `$${parseInt(p1) + 1}`)} AND m.agent_id = $1 AND m.status = 1
          GROUP BY m.id, m.username, m.balance
          HAVING COUNT(bh.id) > 0
          ORDER BY m.username
        `;
        const memberStats = await db.any(memberQuery, [targetAgentId].concat(params));
        
        // 处理代理数据
        for (const agent of agentStats) {
          if (parseInt(agent.bet_count) > 0) {
            const agentRebatePercentage = parseFloat(agent.rebate_percentage || 0);
            // 新退水逻辑：查看下级代理时，显示退水差额（自己的退水% - 下级代理的退水%）
            const earnedRebatePercentage = targetAgentRebate - agentRebatePercentage; // 退水差额
            const earnedRebateAmount = parseFloat(agent.total_bet_amount) * earnedRebatePercentage;
            
            console.log(`📊 代理 ${agent.agent_username} 退水计算:`, {
              查询代理退水: `${(targetAgentRebate * 100).toFixed(1)}%`,
              下级代理退水: `${(agentRebatePercentage * 100).toFixed(1)}%`,
              退水差额: `${(earnedRebatePercentage * 100).toFixed(1)}%`,
              下注金额: agent.total_bet_amount,
              赚水金额: earnedRebateAmount.toFixed(2)
            });
            
            reportData.push({
              type: 'agent',
              id: agent.agent_id,
              username: agent.agent_username,
              level: agent.level,
              balance: parseFloat(agent.balance || 0),
              betCount: parseInt(agent.bet_count),
              betAmount: parseFloat(agent.total_bet_amount),
              winAmount: parseFloat(agent.total_win_amount),
              memberWinLoss: parseFloat(agent.total_win_amount) - parseFloat(agent.total_bet_amount),
              rebatePercentage: agentRebatePercentage,
              earnedRebatePercentage: earnedRebatePercentage,
              earnedRebateAmount: earnedRebateAmount,
              hasActivity: true
            });
            
            totalSummary.betCount += parseInt(agent.bet_count);
            totalSummary.betAmount += parseFloat(agent.total_bet_amount);
            totalSummary.memberWinLoss += parseFloat(agent.total_win_amount) - parseFloat(agent.total_bet_amount);
            totalSummary.rebateProfit += earnedRebateAmount;
          }
        }
        
        // 处理会员数据
        for (const member of memberStats) {
          if (parseInt(member.bet_count) > 0) {
            // 新退水逻辑：查看会员时，显示自己的完整退水百分比
            const earnedRebatePercentage = targetAgentRebate; // 使用查询代理的完整退水设定
            const earnedRebateAmount = parseFloat(member.total_bet_amount) * earnedRebatePercentage;
            
            console.log(`👤 会员 ${member.username} 退水计算:`, {
              代理退水设定: `${(targetAgentRebate * 100).toFixed(1)}%`,
              下注金额: member.total_bet_amount,
              赚水金额: earnedRebateAmount.toFixed(2)
            });
            
            reportData.push({
              type: 'member',
              id: member.id,
              username: member.username,
              balance: parseFloat(member.balance),
              betCount: parseInt(member.bet_count),
              betAmount: parseFloat(member.total_bet_amount),
              winAmount: parseFloat(member.total_win_amount),
              memberWinLoss: parseFloat(member.total_win_amount) - parseFloat(member.total_bet_amount),
              rebatePercentage: 0, // 会员没有退水
              earnedRebatePercentage: earnedRebatePercentage,
              earnedRebateAmount: earnedRebateAmount,
              hasActivity: true
            });
            
            totalSummary.betCount += parseInt(member.bet_count);
            totalSummary.betAmount += parseFloat(member.total_bet_amount);
            totalSummary.memberWinLoss += parseFloat(member.total_win_amount) - parseFloat(member.total_bet_amount);
            totalSummary.rebateProfit += earnedRebateAmount;
          }
        }
        
        hasData = reportData.length > 0;
        
        // 计算其他统计值
        totalSummary.validAmount = totalSummary.betAmount;
        totalSummary.profitLoss = -totalSummary.memberWinLoss; // 平台盈亏与会员输赢相反
        
        // 新退水逻辑：总计赚水为所有个别项目的赚水金额之和
        totalSummary.earnedRebateAmount = totalSummary.rebateProfit; // 已经在处理个别项目时累加了
        totalSummary.finalProfitLoss = totalSummary.profitLoss + totalSummary.earnedRebateAmount; // 最终盈亏（含退水）
        
        console.log('📊 总计统计:', {
          总下注金额: totalSummary.betAmount.toFixed(2),
          总赚水金额: totalSummary.earnedRebateAmount.toFixed(2),
          会员输赢: totalSummary.memberWinLoss.toFixed(2),
          最终盈亏: totalSummary.finalProfitLoss.toFixed(2)
        });
        
      } catch (dbError) {
        console.log('统计查询出错，尝试简化查询:', dbError.message);
        
        // 简化查询：只检查是否有下注记录
        try {
          const simpleQuery = `
            SELECT COUNT(*) as total_bets
            FROM bet_history bh
            INNER JOIN members m ON bh.username = m.username
            ${whereClause.replace(/\$(\d+)/g, (match, p1) => `$${parseInt(p1) + 1}`)} AND m.agent_id = $1
          `;
          const simpleCheck = await db.oneOrNone(simpleQuery, [targetAgentId].concat(params));
          
          hasData = simpleCheck && parseInt(simpleCheck.total_bets) > 0;
        } catch (err) {
          hasData = false;
        }
      }
      
      // 获取会员总数
      let memberCount = 0;
      try {
        const memberCountResult = await db.oneOrNone(`
          WITH RECURSIVE agent_tree AS (
            SELECT id FROM agents WHERE id = $1
            UNION ALL
            SELECT a.id FROM agents a
            INNER JOIN agent_tree at ON a.parent_id = at.id
            WHERE a.status = 1
          )
          SELECT COUNT(*) as member_count
          FROM members m
          INNER JOIN agent_tree at ON m.agent_id = at.id
          WHERE m.status = 1
        `, [targetAgentId]);
        
        memberCount = memberCountResult ? parseInt(memberCountResult.member_count) : 0;
      } catch (err) {
        memberCount = 0;
      }
      
      res.json({
        success: true,
        reportData: reportData,
        totalSummary: totalSummary,
        hasData: hasData,
        agentInfo: {
          id: currentAgent.id,
          username: currentAgent.username,
          memberCount: memberCount
        },
        message: hasData ? '查询成功' : null
      });
      
    } catch (dbError) {
      console.log('数据库查询出错，返回空结果:', dbError.message);
      res.json({
        success: true,
        reportData: [],
        totalSummary: {
          betCount: 0,
          betAmount: 0.0,
          validAmount: 0.0,
          memberWinLoss: 0.0,
          rebate: 0.0,
          profitLoss: 0.0,
          actualRebate: 0.0,
          rebateProfit: 0.0,
          finalProfitLoss: 0.0
        },
        hasData: false,
        agentInfo: {
          id: currentAgent.id,
          username: currentAgent.username,
          memberCount: 0
        },
        message: null
      });
    }
    
  } catch (error) {
    console.error('代理层级分析API错误:', error);
    res.status(500).json({
      success: false,
      reportData: [],
      totalSummary: {
        betCount: 0,
        betAmount: 0.0,
        validAmount: 0.0,
        memberWinLoss: 0.0,
        rebate: 0.0,
        profitLoss: 0.0,
        actualRebate: 0.0,
        rebateProfit: 0.0,
        finalProfitLoss: 0.0
      },
      hasData: false,
      agentInfo: {},
      message: error.message || '查询失败'
    });
  }
});

// 获取所有限红配置
app.get(`${API_PREFIX}/betting-limit-configs`, async (req, res) => {
  try {
    console.log('获取限红配置列表');
    
    const configs = await db.any(`
      SELECT level_name, level_display_name, config, description 
      FROM betting_limit_configs 
      ORDER BY 
        CASE level_name 
          WHEN 'level1' THEN 1
          WHEN 'level2' THEN 2
          WHEN 'level3' THEN 3
          WHEN 'level4' THEN 4
          WHEN 'level5' THEN 5
          WHEN 'level6' THEN 6
          ELSE 999
        END
    `);
    
    console.log(`找到 ${configs.length} 个限红配置`);
    
    res.json({
      success: true,
      configs: configs
    });
    
  } catch (error) {
    console.error('获取限红配置失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 获取会员的限红设定
app.get(`${API_PREFIX}/member-betting-limit/:memberId`, async (req, res) => {
  const { memberId } = req.params;
  
  try {
    console.log(`获取会员 ${memberId} 的限红设定`);
    
    // 获取会员资料、限红配置和所属代理的限红等级
    const memberData = await db.oneOrNone(`
      SELECT m.id, m.username, m.betting_limit_level, m.agent_id,
             blc.level_display_name, blc.config, blc.description,
             a.username as agent_username, a.betting_limit_level as agent_betting_limit_level
      FROM members m
      LEFT JOIN betting_limit_configs blc ON m.betting_limit_level = blc.level_name
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.id = $1
    `, [memberId]);
    
    if (!memberData) {
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    console.log(`会员 ${memberData.username} 当前限红等级: ${memberData.betting_limit_level}`);
    console.log(`所属代理 ${memberData.agent_username} 限红等级: ${memberData.agent_betting_limit_level}`);
    
    res.json({
      success: true,
      member: {
        id: memberData.id,
        username: memberData.username,
        bettingLimitLevel: memberData.betting_limit_level,
        levelDisplayName: memberData.level_display_name,
        config: memberData.config,
        description: memberData.description,
        agentId: memberData.agent_id,
        agentUsername: memberData.agent_username,
        agentBettingLimitLevel: memberData.agent_betting_limit_level
      }
    });
    
  } catch (error) {
    console.error('获取会员限红设定失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 根据用户名获取会员限红设定
app.get(`${API_PREFIX}/member-betting-limit-by-username`, async (req, res) => {
  const { username } = req.query;
  
  try {
    console.log(`根据用户名 ${username} 获取限红设定`);
    
    if (!username) {
      return res.json({
        success: false,
        message: '请提供用户名'
      });
    }
    
    // 获取会员资料和限红配置
    const memberData = await db.oneOrNone(`
      SELECT m.id, m.username, m.betting_limit_level,
             blc.level_display_name, blc.config, blc.description
      FROM members m
      LEFT JOIN betting_limit_configs blc ON m.betting_limit_level = blc.level_name
      WHERE m.username = $1
    `, [username]);
    
    if (!memberData) {
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    console.log(`会员 ${memberData.username} 当前限红等级: ${memberData.betting_limit_level}`);
    
    res.json({
      success: true,
      member: {
        id: memberData.id,
        username: memberData.username,
        bettingLimitLevel: memberData.betting_limit_level,
        levelDisplayName: memberData.level_display_name,
        description: memberData.description
      },
      config: memberData.config
    });
    
  } catch (error) {
    console.error('根据用户名获取会员限红设定失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 更新会员的限红设定
app.post(`${API_PREFIX}/update-member-betting-limit`, async (req, res) => {
  const { operatorId, memberId, newLimitLevel, reason } = req.body;
  
  try {
    console.log(`更新会员 ${memberId} 的限红设定: ${newLimitLevel}`);
    
    // 检查操作权限 - 只有总代理可以修改限红
    const operator = await AgentModel.findById(operatorId);
    if (!operator || operator.level !== 0) {
      return res.json({
        success: false,
        message: '权限不足，只有总代理可以调整会员限红'
      });
    }
    
    // 验证限红等级是否存在
    const limitConfig = await db.oneOrNone(`
      SELECT level_name, level_display_name 
      FROM betting_limit_configs 
      WHERE level_name = $1
    `, [newLimitLevel]);
    
    if (!limitConfig) {
      return res.json({
        success: false,
        message: '无效的限红等级'
      });
    }
    
    // 获取会员资料
    const member = await MemberModel.findById(memberId);
    if (!member) {
      return res.json({
        success: false,
        message: '会员不存在'
      });
    }
    
    // 获取会员所属代理的限红等级
    const memberAgent = await AgentModel.findById(member.agent_id);
    if (!memberAgent) {
      return res.json({
        success: false,
        message: '找不到会员所属代理'
      });
    }
    
    // 检查新限红等级是否超过代理的限红等级
    const levelOrder = {
      'level1': 1,  // 新手
      'level2': 2,  // 一般
      'level3': 3,  // 标准
      'level4': 4,  // 高级
      'level5': 5,  // VIP
      'level6': 6   // VVIP
    };
    
    const agentLevel = levelOrder[memberAgent.betting_limit_level || 'level3'] || 3;
    const newLevel = levelOrder[newLimitLevel] || 1;
    
    if (newLevel > agentLevel) {
      return res.json({
        success: false,
        message: `不能设定高于代理限红等级的限红 (代理限红: ${memberAgent.betting_limit_level || 'level3'})`
      });
    }
    
    const oldLimitLevel = member.betting_limit_level;
    
    // 更新会员限红等级
    await db.none(`
      UPDATE members 
      SET betting_limit_level = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [newLimitLevel, memberId]);
    
    // 记录操作日志到交易记录
    await db.none(`
      INSERT INTO transaction_records 
      (user_type, user_id, transaction_type, amount, balance_before, balance_after, description) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      'member', 
      memberId, 
      'limit_change', 
      0, 
      0, 
      0, 
      `限红等级调整: ${oldLimitLevel || 'level1'} → ${newLimitLevel} (${reason || '管理员调整'})`
    ]);
    
    console.log(`✅ 会员 ${member.username} 限红等级已更新: ${oldLimitLevel} → ${newLimitLevel}`);
    
    res.json({
      success: true,
      message: '限红设定更新成功',
      member: {
        id: member.id,
        username: member.username,
        oldLimitLevel: oldLimitLevel,
        newLimitLevel: newLimitLevel,
        levelDisplayName: limitConfig.level_display_name
      }
    });
    
  } catch (error) {
    console.error('更新会员限红设定失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 代理限红设定相关 API

// 获取代理的限红设定
app.get(`${API_PREFIX}/agent-betting-limit/:agentId`, async (req, res) => {
  const { agentId } = req.params;
  
  try {
    console.log(`获取代理 ${agentId} 的限红设定`);
    
    // 获取代理资料和限红配置
    const agentData = await db.oneOrNone(`
      SELECT a.id, a.username, a.betting_limit_level,
             blc.level_display_name, blc.config, blc.description
      FROM agents a
      LEFT JOIN betting_limit_configs blc ON a.betting_limit_level = blc.level_name
      WHERE a.id = $1
    `, [agentId]);
    
    if (!agentData) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    console.log(`代理 ${agentData.username} 当前限红等级: ${agentData.betting_limit_level}`);
    
    res.json({
      success: true,
      agent: {
        id: agentData.id,
        username: agentData.username,
        bettingLimitLevel: agentData.betting_limit_level,
        levelDisplayName: agentData.level_display_name,
        config: agentData.config,
        description: agentData.description
      }
    });
    
  } catch (error) {
    console.error('获取代理限红设定失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

// 更新代理的限红设定
app.post(`${API_PREFIX}/update-agent-betting-limit`, async (req, res) => {
  const { operatorId, agentId, newLimitLevel, reason } = req.body;
  
  try {
    console.log(`更新代理 ${agentId} 的限红设定: ${newLimitLevel}`);
    
    // 检查操作者权限
    const operator = await AgentModel.findById(operatorId);
    if (!operator) {
      return res.json({
        success: false,
        message: '操作者不存在'
      });
    }
    
    // 获取目标代理资讯
    const targetAgent = await AgentModel.findById(agentId);
    if (!targetAgent) {
      return res.json({
        success: false,
        message: '目标代理不存在'
      });
    }
    
    // 检查是否有权限修改（只能修改自己的下级代理）
    if (targetAgent.parent_id !== operatorId && operator.level !== 0) {
      return res.json({
        success: false,
        message: '无权限修改此代理的限红设定'
      });
    }
    
    // 检查限红等级是否存在
    const limitConfig = await db.oneOrNone(`
      SELECT * FROM betting_limit_configs 
      WHERE level_name = $1
    `, [newLimitLevel]);
    
    if (!limitConfig) {
      return res.json({
        success: false,
        message: '无效的限红等级'
      });
    }
    
    // 获取操作者的限红等级，确保不能设定高于自己的等级
    const operatorLimit = await db.oneOrNone(`
      SELECT betting_limit_level FROM agents WHERE id = $1
    `, [operatorId]);
    
    // 比较限红等级（level1 < level2 < level3 < level4 < level5 < level6）
    const levelOrder = {
      'level1': 1,
      'level2': 2,
      'level3': 3,
      'level4': 4,
      'level5': 5,
      'level6': 6
    };
    
    if (levelOrder[newLimitLevel] > levelOrder[operatorLimit.betting_limit_level]) {
      return res.json({
        success: false,
        message: '不能设定高于自己限红等级的代理'
      });
    }
    
    const oldLimitLevel = targetAgent.betting_limit_level || 'level3';
    
    // 更新代理限红等级
    await db.none(`
      UPDATE agents 
      SET betting_limit_level = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [newLimitLevel, agentId]);
    
    // 记录操作日志
    await db.none(`
      INSERT INTO transaction_records 
      (user_type, user_id, transaction_type, amount, balance_before, balance_after, description) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      'agent', 
      agentId, 
      'other', 
      0, 
      0, 
      0, 
      `限红等级变更: ${oldLimitLevel} -> ${newLimitLevel}, 操作者: ${operator.username}, 原因: ${reason || '未说明'}`
    ]);
    
    console.log(`代理 ${targetAgent.username} 限红等级已更新: ${oldLimitLevel} -> ${newLimitLevel}`);
    
    // 如果是调降限红等级，需要连锁调整所有下级
    if (levelOrder[newLimitLevel] < levelOrder[oldLimitLevel]) {
      console.log(`开始连锁调整代理 ${targetAgent.username} 的所有下级限红等级...`);
      
      // 递回函数：调整所有下级代理和会员的限红等级
      async function adjustDownlineBettingLimits(parentAgentId, maxLevel) {
        // 获取所有直接下级代理
        const childAgents = await db.any(`
          SELECT id, username, betting_limit_level 
          FROM agents 
          WHERE parent_id = $1
        `, [parentAgentId]);
        
        for (const childAgent of childAgents) {
          const childLevel = childAgent.betting_limit_level || 'level3';
          
          // 如果下级代理的限红等级超过上级的新限制，则调整为上级的限制
          if (levelOrder[childLevel] > levelOrder[maxLevel]) {
            await db.none(`
              UPDATE agents 
              SET betting_limit_level = $1, updated_at = CURRENT_TIMESTAMP 
              WHERE id = $2
            `, [maxLevel, childAgent.id]);
            
            console.log(`  - 调整下级代理 ${childAgent.username} 的限红等级: ${childLevel} -> ${maxLevel}`);
            
            // 记录调整日志
            await db.none(`
              INSERT INTO transaction_records 
              (user_type, user_id, transaction_type, amount, balance_before, balance_after, description) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              'agent', 
              childAgent.id, 
              'other', 
              0, 
              0, 
              0, 
              `限红等级连锁调整: ${childLevel} -> ${maxLevel} (因上级代理 ${targetAgent.username} 限红调降)`
            ]);
          }
          
          // 递回处理此代理的下级
          await adjustDownlineBettingLimits(childAgent.id, maxLevel);
        }
        
        // 获取该代理的所有会员
        const members = await db.any(`
          SELECT id, username, betting_limit_level 
          FROM members 
          WHERE agent_id = $1
        `, [parentAgentId]);
        
        for (const member of members) {
          const memberLevel = member.betting_limit_level || 'level1';
          
          // 如果会员的限红等级超过代理的新限制，则调整为代理的限制
          if (levelOrder[memberLevel] > levelOrder[maxLevel]) {
            await db.none(`
              UPDATE members 
              SET betting_limit_level = $1, updated_at = CURRENT_TIMESTAMP 
              WHERE id = $2
            `, [maxLevel, member.id]);
            
            console.log(`  - 调整会员 ${member.username} 的限红等级: ${memberLevel} -> ${maxLevel}`);
            
            // 记录调整日志
            await db.none(`
              INSERT INTO transaction_records 
              (user_type, user_id, transaction_type, amount, balance_before, balance_after, description) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              'member', 
              member.id, 
              'other', 
              0, 
              0, 
              0, 
              `限红等级连锁调整: ${memberLevel} -> ${maxLevel} (因所属代理限红调降)`
            ]);
          }
        }
      }
      
      // 开始连锁调整
      await adjustDownlineBettingLimits(agentId, newLimitLevel);
      
      console.log(`连锁调整完成`);
    }
    
    // 重新获取更新后的代理资料
    const updatedAgent = await db.oneOrNone(`
      SELECT id, username, betting_limit_level, level, status, balance
      FROM agents
      WHERE id = $1
    `, [agentId]);
    
    res.json({
      success: true,
      message: '限红设定更新成功',
      data: {
        agentId: agentId,
        username: targetAgent.username,
        oldLevel: oldLimitLevel,
        newLevel: newLimitLevel,
        levelDisplayName: limitConfig.level_display_name
      },
      updatedAgent: updatedAgent
    });
    
  } catch (error) {
    console.error('更新代理限红设定失败:', error);
    res.status(500).json({
      success: false,
      message: '系统错误，请稍后再试'
    });
  }
});

