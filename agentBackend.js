// agentBackend.js - 代理管理會員系統後端
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
// 使用優化過的數據庫配置
import db from './db/config.js';
// 導入基本數據庫初始化函數
import initDatabaseBase from './db/init.js';

// 初始化環境變量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3003; // 使用不同於主遊戲系統的端口

// 跨域設置
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://bet-game.onrender.com', 'https://bet-agent.onrender.com'] 
    : ['http://localhost:3002', 'http://localhost:3000', 'http://localhost:3003'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 提供靜態文件
app.use(express.static(path.join(__dirname, 'agent/frontend')));

// 主頁面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'agent/frontend', 'index.html'));
});

// 健康檢查端點 - 用於 Render 監控
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 新增數據庫初始化端點 - 用於手動觸發數據庫初始化
app.get('/api/init-db', async (req, res) => {
  try {
    console.log('手動觸發數據庫初始化...');
    await initDatabase();
    res.json({ 
      success: true, 
      message: '數據庫初始化成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('數據庫手動初始化失敗:', error);
    res.status(500).json({ 
      success: false, 
      message: '數據庫初始化失敗', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 代理API路由前綴
const API_PREFIX = '/api/agent';

// 初始化代理系統數據庫
async function initDatabase() {
  try {
    console.log('初始化代理系統數據庫...');
    
    // 首先調用基本數據庫初始化函數，確保共用表已創建
    await initDatabaseBase();
    
    // 代理系統特有的表
    // 創建代理表
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
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 創建會員表
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
    
    // 創建交易記錄表
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
    
    // 創建公告表
    await db.none(`
      CREATE TABLE IF NOT EXISTS notices (
        id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('初始化代理系統數據庫表結構完成');
    
    // 檢查是否已有總代理
    const adminAgent = await db.oneOrNone('SELECT * FROM agents WHERE level = 0');
    if (!adminAgent) {
      // 創建總代理
      await db.none(`
        INSERT INTO agents (username, password, level, balance, commission_rate) 
        VALUES ($1, $2, $3, $4, $5)
      `, ['admin', 'adminpwd', 0, 100000, 0.3]);
      
      console.log('創建總代理成功');
    }
    
    // 檢查是否有預設的測試會員
    const testMember = await db.oneOrNone('SELECT * FROM members WHERE username = $1', ['aaa']);
    if (!testMember) {
      // 獲取總代理
      const adminAgent = await db.one('SELECT id FROM agents WHERE level = 0');
      
      // 創建預設測試會員
      await db.none(`
        INSERT INTO members (username, password, agent_id, balance) 
        VALUES ($1, $2, $3, $4)
      `, ['aaa', 'aaapwd', adminAgent.id, 10000]);
      
      console.log('創建預設測試會員成功');
    }
    
    console.log('初始化代理系統數據庫完成');
  } catch (error) {
    console.error('初始化數據庫時出錯:', error);
    // 出錯時不結束進程，讓系統仍能啟動，方便調試
  }
}

// 模型: 代理
const AgentModel = {
  // 獲取代理by用戶名
  async findByUsername(username) {
    try {
      return await db.oneOrNone('SELECT * FROM agents WHERE username = $1', [username]);
    } catch (error) {
      console.error('查詢代理出錯:', error);
      throw error;
    }
  },
  
  // 獲取代理by ID
  async findById(id) {
    try {
      return await db.oneOrNone('SELECT * FROM agents WHERE id = $1', [id]);
    } catch (error) {
      console.error('查詢代理出錯:', error);
      throw error;
    }
  },
  
  // 獲取代理下級
  async findByParentId(parentId, level = null, status = null, page = 1, limit = 20) {
    try {
      let query = 'SELECT * FROM agents WHERE 1=1';
      const params = [];
      
      if (parentId) {
        query += ' AND parent_id = $' + (params.length + 1);
        params.push(parentId);
      }
      
      if (level && level !== '-1') {
        query += ' AND level = $' + (params.length + 1);
        params.push(level);
      }
      
      if (status && status !== '-1') {
        query += ' AND status = $' + (params.length + 1);
        params.push(status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      // 添加分頁
      const offset = (page - 1) * limit;
      query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      
      return await db.any(query, params);
    } catch (error) {
      console.error('查詢代理下級出錯:', error);
      throw error;
    }
  },
  
  // 創建代理
  async create(agentData) {
    const { username, password, parent_id, level, commission_rate } = agentData;
    
    try {
      return await db.one(`
        INSERT INTO agents (username, password, parent_id, level, commission_rate) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING *
      `, [username, password, parent_id, level, commission_rate]);
    } catch (error) {
      console.error('創建代理出錯:', error);
      throw error;
    }
  },
  
  // 更新代理狀態
  async updateStatus(id, status) {
    try {
      return await db.one(`
        UPDATE agents 
        SET status = $1 
        WHERE id = $2 
        RETURNING *
      `, [status, id]);
    } catch (error) {
      console.error('更新代理狀態出錯:', error);
      throw error;
    }
  },
  
  // 獲取代理統計
  async getStats(agentId) {
    try {
      // 獲取該代理下的會員數
      const memberCount = await db.one(`
        SELECT COUNT(*) as count FROM members WHERE agent_id = $1
      `, [agentId]);
      
      // 獲取該代理的佣金餘額
      const agent = await this.findById(agentId);
      
      return {
        memberCount: parseInt(memberCount.count),
        commissionBalance: agent.commission_balance
      };
    } catch (error) {
      console.error('獲取代理統計出錯:', error);
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
      console.error('更新代理佣金出錯:', error);
      throw error;
    }
  }
};

// 模型: 會員
const MemberModel = {
  // 獲取會員by用戶名
  async findByUsername(username) {
    try {
      return await db.oneOrNone('SELECT * FROM members WHERE username = $1', [username]);
    } catch (error) {
      console.error('查詢會員出錯:', error);
      throw error;
    }
  },
  
  // 獲取會員by ID
  async findById(id) {
    try {
      return await db.oneOrNone('SELECT * FROM members WHERE id = $1', [id]);
    } catch (error) {
      console.error('查詢會員出錯:', error);
      throw error;
    }
  },
  
  // 獲取代理的會員
  async findByAgentId(agentId, status = null, page = 1, limit = 20) {
    try {
      let query = 'SELECT * FROM members WHERE agent_id = $1';
      const params = [agentId];
      
      if (status && status !== '-1') {
        query += ' AND status = $' + (params.length + 1);
        params.push(status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      // 添加分頁
      const offset = (page - 1) * limit;
      query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      
      return await db.any(query, params);
    } catch (error) {
      console.error('查詢代理會員出錯:', error);
      throw error;
    }
  },
  
  // 創建會員
  async create(memberData) {
    const { username, password, agent_id, balance = 0 } = memberData;
    
    try {
      return await db.one(`
        INSERT INTO members (username, password, agent_id, balance) 
        VALUES ($1, $2, $3, $4) 
        RETURNING *
      `, [username, password, agent_id, balance]);
    } catch (error) {
      console.error('創建會員出錯:', error);
      throw error;
    }
  },
  
  // 更新會員狀態
  async updateStatus(id, status) {
    try {
      return await db.one(`
        UPDATE members 
        SET status = $1 
        WHERE id = $2 
        RETURNING *
      `, [status, id]);
    } catch (error) {
      console.error('更新會員狀態出錯:', error);
      throw error;
    }
  },
  
  // 更新會員餘額
  async updateBalance(username, amount) {
    try {
      // 獲取當前餘額
      const member = await this.findByUsername(username);
      if (!member) throw new Error('會員不存在');
      
      const beforeBalance = member.balance;
      const afterBalance = parseFloat(beforeBalance) + parseFloat(amount);
      
      // 更新餘額
      const updatedMember = await db.one(`
        UPDATE members 
        SET balance = $1 
        WHERE username = $2 
        RETURNING *
      `, [afterBalance, username]);
      
      // 記錄交易
      await db.none(`
        INSERT INTO transactions 
        (user_type, user_id, amount, type, before_balance, after_balance, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['member', member.id, amount, amount > 0 ? 'deposit' : 'withdraw', beforeBalance, afterBalance, '餘額調整']);
      
      return updatedMember;
    } catch (error) {
      console.error('更新會員餘額出錯:', error);
      throw error;
    }
  },
  
  // 設置會員餘額(絕對值)
  async setBalance(username, balance) {
    try {
      // 獲取當前餘額
      const member = await this.findByUsername(username);
      if (!member) throw new Error('會員不存在');
      
      const beforeBalance = member.balance;
      const afterBalance = parseFloat(balance);
      
      // 更新餘額
      const updatedMember = await db.one(`
        UPDATE members 
        SET balance = $1 
        WHERE username = $2 
        RETURNING *
      `, [afterBalance, username]);
      
      // 記錄交易
      await db.none(`
        INSERT INTO transactions 
        (user_type, user_id, amount, type, before_balance, after_balance, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['member', member.id, afterBalance - beforeBalance, 'adjustment', beforeBalance, afterBalance, '餘額設置']);
      
      return updatedMember;
    } catch (error) {
      console.error('設置會員餘額出錯:', error);
      throw error;
    }
  }
};

// 模型: 公告
const NoticeModel = {
  // 獲取所有公告
  async findAll(limit = 10) {
    try {
      return await db.any(`
        SELECT * FROM notices 
        WHERE status = 1 
        ORDER BY created_at DESC 
        LIMIT $1
      `, [limit]);
    } catch (error) {
      console.error('獲取公告出錯:', error);
      throw error;
    }
  },
  
  // 創建公告
  async create(title, content) {
    try {
      return await db.one(`
        INSERT INTO notices (title, content) 
        VALUES ($1, $2) 
        RETURNING *
      `, [title, content]);
    } catch (error) {
      console.error('創建公告出錯:', error);
      throw error;
    }
  }
};

// 交易模型
const TransactionModel = {
  // 創建交易記錄
  async create(transactionData) {
    const { 
      user_type, user_id, amount, type, 
      before_balance, after_balance, reference_id, description 
    } = transactionData;
    
    try {
      return await db.one(`
        INSERT INTO transactions 
        (user_type, user_id, amount, type, before_balance, after_balance, reference_id, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *
      `, [user_type, user_id, amount, type, before_balance, after_balance, reference_id, description]);
    } catch (error) {
      console.error('創建交易記錄出錯:', error);
      throw error;
    }
  },
  
  // 獲取用戶的交易記錄
  async getByUserId(userType, userId, limit = 50) {
    try {
      return await db.any(`
        SELECT * FROM transactions 
        WHERE user_type = $1 AND user_id = $2 
        ORDER BY created_at DESC 
        LIMIT $3
      `, [userType, userId, limit]);
    } catch (error) {
      console.error('獲取交易記錄出錯:', error);
      throw error;
    }
  },
  
  // 獲取代理的今日交易統計
  async getAgentTodayStats(agentId) {
    try {
      // 獲取該代理下所有會員
      const members = await MemberModel.findByAgentId(agentId);
      const memberIds = members.map(m => m.id);
      
      if (memberIds.length === 0) {
        return { totalAmount: 0, totalCount: 0 };
      }
      
      // 獲取今日交易總額
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const stats = await db.one(`
        SELECT 
          COALESCE(SUM(ABS(amount)), 0) as total_amount, 
          COUNT(*) as total_count 
        FROM transactions 
        WHERE user_type = 'member' 
          AND user_id IN ($1:csv) 
          AND created_at >= $2
      `, [memberIds, today]);
      
      return {
        totalAmount: parseFloat(stats.total_amount),
        totalCount: parseInt(stats.total_count)
      };
    } catch (error) {
      console.error('獲取代理今日交易統計出錯:', error);
      throw error;
    }
  }
};

// 代理登入
app.post(`${API_PREFIX}/login`, async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // 查詢代理
    const agent = await AgentModel.findByUsername(username);
    
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 檢查密碼
    if (agent.password !== password) {
      return res.json({
        success: false,
        message: '密碼錯誤'
      });
    }
    
    // 檢查狀態
    if (agent.status !== 1) {
      return res.json({
        success: false,
        message: '代理帳號已被禁用'
      });
    }
    
    // 假設這是一個簡單的令牌生成
    const token = Buffer.from(`${agent.id}:${Date.now()}`).toString('base64');
    
    res.json({
      success: true,
      agent: {
        id: agent.id,
        username: agent.username,
        level: agent.level,
        balance: agent.balance,
        commission_balance: agent.commission_balance
      },
      token
    });
  } catch (error) {
    console.error('代理登入出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 創建代理
app.post(`${API_PREFIX}/create`, async (req, res) => {
  const { username, password, level, parent } = req.body;
  
  try {
    // 檢查用戶名是否已存在
    const existingAgent = await AgentModel.findByUsername(username);
    if (existingAgent) {
      return res.json({
        success: false,
        message: '該用戶名已被使用'
      });
    }
    
    // 獲取上級代理
    let parentId = null;
    if (parent) {
      const parentAgent = await AgentModel.findById(parent);
      if (!parentAgent) {
        return res.json({
          success: false,
          message: '上級代理不存在'
        });
      }
      parentId = parentAgent.id;
    }
    
    // 創建代理
    const newAgent = await AgentModel.create({
      username,
      password,
      parent_id: parentId,
      level: parseInt(level),
      commission_rate: 0.2 // 預設佣金比例
    });
    
    res.json({
      success: true,
      agent: {
        id: newAgent.id,
        username: newAgent.username,
        level: newAgent.level
      }
    });
  } catch (error) {
    console.error('創建代理出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 獲取代理統計
app.get(`${API_PREFIX}/stats`, async (req, res) => {
  const { agentId } = req.query;
  
  try {
    if (!agentId) {
      return res.json({
        success: false,
        message: '請提供代理ID'
      });
    }
    
    // 獲取代理信息
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 獲取代理統計
    const agentStats = await AgentModel.getStats(agentId);
    
    // 獲取今日交易統計
    const transactionStats = await TransactionModel.getAgentTodayStats(agentId);
    
    res.json({
      success: true,
      stats: {
        totalMembers: agentStats.memberCount,
        totalAmount: transactionStats.totalAmount,
        totalTransactions: transactionStats.totalCount,
        commission: agent.commission_balance
      }
    });
  } catch (error) {
    console.error('獲取代理統計出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 獲取下級代理
app.get(`${API_PREFIX}/sub-agents`, async (req, res) => {
  const { parentId, level, status, page = 1, limit = 20 } = req.query;
  
  try {
    // 獲取下級代理
    const agents = await AgentModel.findByParentId(
      parentId || null, 
      level, 
      status, 
      parseInt(page), 
      parseInt(limit)
    );
    
    // 獲取總數
    let total = agents.length;
    if (agents.length === parseInt(limit)) {
      // 這只是一個近似值，實際應用中應該進行準確的計數查詢
      total = parseInt(limit) * (parseInt(page) + 1);
    }
    
    res.json({
      success: true,
      agents,
      total
    });
  } catch (error) {
    console.error('獲取下級代理出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 更新代理狀態
app.put(`${API_PREFIX}/update-status`, async (req, res) => {
  const { id, status } = req.body;
  
  try {
    // 更新代理狀態
    const agent = await AgentModel.updateStatus(id, status);
    
    res.json({
      success: true,
      agent
    });
  } catch (error) {
    console.error('更新代理狀態出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 創建會員
app.post(`${API_PREFIX}/create-member`, async (req, res) => {
  const { username, password, agentId } = req.body;
  
  try {
    // 檢查用戶名是否已存在
    const existingMember = await MemberModel.findByUsername(username);
    if (existingMember) {
      return res.json({
        success: false,
        message: '該用戶名已被使用'
      });
    }
    
    // 檢查代理是否存在
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 創建會員
    const newMember = await MemberModel.create({
      username,
      password,
      agent_id: agentId,
      balance: 0 // 初始餘額
    });
    
    res.json({
      success: true,
      member: {
        id: newMember.id,
        username: newMember.username
      }
    });
  } catch (error) {
    console.error('創建會員出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 獲取代理的會員
app.get(`${API_PREFIX}/members`, async (req, res) => {
  const { agentId, status, page = 1, limit = 20 } = req.query;
  
  try {
    if (!agentId) {
      return res.json({
        success: false,
        message: '請提供代理ID'
      });
    }
    
    // 獲取會員
    const members = await MemberModel.findByAgentId(
      agentId, 
      status, 
      parseInt(page), 
      parseInt(limit)
    );
    
    // 獲取總數
    let total = members.length;
    if (members.length === parseInt(limit)) {
      // 這只是一個近似值，實際應用中應該進行準確的計數查詢
      total = parseInt(limit) * (parseInt(page) + 1);
    }
    
    res.json({
      success: true,
      members,
      total
    });
  } catch (error) {
    console.error('獲取會員出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 更新會員狀態
app.put(`${API_PREFIX}/update-member-status`, async (req, res) => {
  const { id, status } = req.body;
  
  try {
    // 更新會員狀態
    const member = await MemberModel.updateStatus(id, status);
    
    res.json({
      success: true,
      member
    });
  } catch (error) {
    console.error('更新會員狀態出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 會員登入驗證
app.post(`${API_PREFIX}/verify-member`, async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // 查詢會員
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 檢查密碼
    if (member.password !== password) {
      return res.json({
        success: false,
        message: '密碼錯誤'
      });
    }
    
    // 檢查狀態
    if (member.status !== 1) {
      return res.json({
        success: false,
        message: '會員帳號已被禁用'
      });
    }
    
    res.json({
      success: true,
      member: {
        id: member.id,
        username: member.username,
        balance: member.balance,
        status: member.status
      }
    });
  } catch (error) {
    console.error('會員驗證出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 獲取會員餘額
app.get(`${API_PREFIX}/member-balance`, async (req, res) => {
  const { username } = req.query;
  
  try {
    if (!username) {
      return res.json({
        success: false,
        message: '請提供會員用戶名'
      });
    }
    
    // 查詢會員
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    res.json({
      success: true,
      balance: member.balance
    });
  } catch (error) {
    console.error('獲取會員餘額出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 更新會員餘額
app.post(`${API_PREFIX}/update-member-balance`, async (req, res) => {
  const { username, amount, type } = req.body;
  
  try {
    if (!username || amount === undefined) {
      return res.json({
        success: false,
        message: '請提供會員用戶名和變更金額'
      });
    }
    
    // 查詢會員
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 更新餘額
    const updatedMember = await MemberModel.updateBalance(username, parseFloat(amount));
    
    // 如果是會員贏錢，給代理增加佣金
    if (type === 'settlement' && amount > 0) {
      // 查詢會員的代理
      const agent = await AgentModel.findById(member.agent_id);
      if (agent) {
        // 計算佣金
        const commission = parseFloat(amount) * parseFloat(agent.commission_rate);
        // 更新代理佣金
        await AgentModel.updateCommission(agent.id, commission);
      }
    }
    
    res.json({
      success: true,
      newBalance: updatedMember.balance
    });
  } catch (error) {
    console.error('更新會員餘額出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 設置會員餘額(絕對值)
app.post(`${API_PREFIX}/set-member-balance`, async (req, res) => {
  const { username, balance } = req.body;
  
  try {
    if (!username || balance === undefined) {
      return res.json({
        success: false,
        message: '請提供會員用戶名和餘額'
      });
    }
    
    // 查詢會員
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 設置餘額
    const updatedMember = await MemberModel.setBalance(username, parseFloat(balance));
    
    res.json({
      success: true,
      newBalance: updatedMember.balance
    });
  } catch (error) {
    console.error('設置會員餘額出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 獲取公告
app.get(`${API_PREFIX}/notices`, async (req, res) => {
  try {
    // 獲取公告
    const notices = await NoticeModel.findAll();
    
    res.json({
      success: true,
      notices
    });
  } catch (error) {
    console.error('獲取公告出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 初始化數據庫並啟動服務器
async function startServer() {
  try {
    // 初始化數據庫
    await initDatabase();
    
    // 啟動服務器
    app.listen(port, () => {
      console.log(`代理管理系統後端運行在端口 ${port}`);
    });
  } catch (error) {
    console.error('啟動服務器時出錯:', error);
  }
}

// 啟動服務器
startServer();