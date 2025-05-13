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
    
    // 創建點數轉移記錄表
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
    
    // 創建開獎記錄表
    await db.none(`
      CREATE TABLE IF NOT EXISTS draw_records (
        id SERIAL PRIMARY KEY,
        period VARCHAR(50) UNIQUE NOT NULL,
        result JSONB,
        draw_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 為開獎記錄表創建索引
    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_draw_records_period ON draw_records(period);
      CREATE INDEX IF NOT EXISTS idx_draw_records_draw_time ON draw_records(draw_time);
    `);
    
    console.log('初始化代理系統數據庫表結構完成');
    
    // 檢查是否已有總代理 - 修改為使用 db.any 並處理多筆結果
    const adminAgents = await db.any('SELECT * FROM agents WHERE level = 0');
    if (adminAgents.length === 0) {
      // 創建總代理，初始餘額設為20萬
      await db.none(`
        INSERT INTO agents (username, password, level, balance, commission_rate) 
        VALUES ($1, $2, $3, $4, $5)
      `, ['admin', 'adminpwd', 0, 200000, 0.3]);
      
      console.log('創建總代理成功，初始餘額 200,000');
    } else if (adminAgents.length > 1) {
        // 如果找到多個總代理，記錄警告，但繼續執行
        console.warn(`警告：數據庫中發現 ${adminAgents.length} 個 level=0 的總代理。系統將使用第一個找到的代理 (ID: ${adminAgents[0].id})。建議清理數據庫，確保只有一個總代理。`);
    } else {
        console.log(`已存在總代理 (ID: ${adminAgents[0].id})，無需創建。`);
    }
    
    // 檢查是否有預設的測試會員
    const testMember = await db.oneOrNone('SELECT * FROM members WHERE username = $1', ['aaa']);
    if (!testMember) {
      // 獲取總代理 - 使用第一個找到的總代理
      const adminAgent = adminAgents[0];
      
      // 創建預設測試會員 (初始餘額為0，需要從代理轉移點數)
      await db.none(`
        INSERT INTO members (username, password, agent_id, balance) 
        VALUES ($1, $2, $3, $4)
      `, ['aaa', 'aaapwd', adminAgent.id, 0]);
      
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
      return null; // 返回空值而非拋出異常
    }
  },
  
  // 獲取代理by ID
  async findById(id) {
    try {
      // 參數驗證：確認ID是整數
      const parsedId = parseInt(id);
      if (isNaN(parsedId)) {
        console.log(`查詢代理: ID "${id}" 不是有效的整數ID`);
        return null;
      }
      
      return await db.oneOrNone('SELECT * FROM agents WHERE id = $1', [parsedId]);
    } catch (error) {
      console.error('查詢代理出錯:', error);
      return null; // 返回空值而非拋出異常
    }
  },
  
  // 獲取代理下級
  async findByParentId(parentId, level = null, status = null, page = 1, limit = 20) {
    try {
      console.log(`查詢代理下級: parentId=${parentId}, level=${level}, status=${status}, page=${page}, limit=${limit}`);
      
      // 驗證參數
      if (parentId && parentId !== '') {
        const parsedParentId = parseInt(parentId);
        if (isNaN(parsedParentId)) {
          console.log(`查詢代理下級: 父級代理ID "${parentId}" 不是有效的整數ID`);
          return [];
        }
        
        const parentExists = await db.oneOrNone('SELECT id FROM agents WHERE id = $1', [parsedParentId]);
        if (!parentExists) {
          console.log(`查詢代理下級: 父級代理ID ${parsedParentId} 不存在`);
          return [];
        }
      }
      
      let query = 'SELECT * FROM agents WHERE 1=1';
      const params = [];
      
      if (parentId && parentId !== '') {
        query += ' AND parent_id = $' + (params.length + 1);
        params.push(parseInt(parentId));
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
      
      console.log(`查詢代理下級: 執行SQL查詢: ${query.replace(/\$\d+/g, '?')}`);
      
      const agents = await db.any(query, params);
      console.log(`查詢代理下級: 找到 ${agents.length} 位代理`);
      
      return agents;
    } catch (error) {
      console.error('查詢代理下級出錯:', error);
      return []; // 出錯時返回空數組而不是拋出異常
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
  },
  
  // 更新代理餘額
  async updateBalance(id, amount) {
    try {
      const agent = await this.findById(id);
      if (!agent) throw new Error('代理不存在');
      
      const beforeBalance = parseFloat(agent.balance);
      const afterBalance = beforeBalance + parseFloat(amount);
      
      // 確保餘額不會小於0
      if (afterBalance < 0) throw new Error('代理餘額不足');
      
      const updatedAgent = await db.one(`
        UPDATE agents 
        SET balance = $1 
        WHERE id = $2 
        RETURNING *
      `, [afterBalance, id]);
      
      // 記錄交易
      await db.none(`
        INSERT INTO transactions 
        (user_type, user_id, amount, type, before_balance, after_balance, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['agent', id, amount, amount > 0 ? 'deposit' : 'withdraw', beforeBalance, afterBalance, '代理點數調整']);
      
      return updatedAgent;
    } catch (error) {
      console.error('更新代理餘額出錯:', error);
      throw error;
    }
  }
};

// 模型: 會員
const MemberModel = {
  // 獲取會員
  async findByAgentId(agentId, status = null, page = 1, limit = 20) {
    try {
      console.log(`查詢會員: agentId=${agentId}, status=${status}, page=${page}, limit=${limit}`);
      
      // 驗證代理ID
      if (!agentId || agentId === '') {
        console.log(`查詢會員: 未提供有效的代理ID`);
        return [];
      }
      
      // 檢查代理是否存在
      const parsedAgentId = parseInt(agentId);
      if (isNaN(parsedAgentId)) {
        console.log(`查詢會員: 代理ID "${agentId}" 不是有效的整數ID`);
        return [];
      }
      
      const agentExists = await db.oneOrNone('SELECT id FROM agents WHERE id = $1', [parsedAgentId]);
      if (!agentExists) {
        console.log(`查詢會員: 代理ID ${parsedAgentId} 不存在`);
        return [];
      }
      
      let query = 'SELECT * FROM members WHERE agent_id = $1';
      const params = [parsedAgentId];
      
      if (status && status !== '-1') {
        query += ' AND status = $' + (params.length + 1);
        params.push(status);
      }
      
      query += ' ORDER BY created_at DESC';
      
      // 添加分頁
      const offset = (page - 1) * limit;
      query += ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
      params.push(limit, offset);
      
      console.log(`查詢會員: 執行SQL查詢: ${query.replace(/\$\d+/g, '?')}`);
      
      const members = await db.any(query, params);
      console.log(`查詢會員: 找到 ${members.length} 位會員`);
      
      return members;
    } catch (error) {
      console.error('查詢會員出錯:', error);
      return []; // 出錯時返回空數組
    }
  },
  
  // 獲取會員總數
  async countByAgentId(agentId, status = null) {
    try {
      console.log(`計算會員數量: agentId=${agentId}, status=${status}`);
      
      // 驗證代理ID
      if (!agentId || agentId === '') {
        console.log(`計算會員數量: 未提供有效的代理ID`);
        return 0;
      }
      
      // 解析並驗證代理ID
      const parsedAgentId = parseInt(agentId);
      if (isNaN(parsedAgentId)) {
        console.log(`計算會員數量: 代理ID "${agentId}" 不是有效的整數ID`);
        return 0;
      }
      
      let query = 'SELECT COUNT(*) FROM members WHERE agent_id = $1';
      const params = [parsedAgentId];
      
      if (status && status !== '-1') {
        query += ' AND status = $' + (params.length + 1);
        params.push(status);
      }
      
      console.log(`計算會員數量: 執行SQL查詢: ${query.replace(/\$\d+/g, '?')}`);
      
      const result = await db.one(query, params);
      console.log(`計算會員數量: 共計 ${result.count} 位會員`);
      
      return parseInt(result.count);
    } catch (error) {
      console.error('計算會員數量出錯:', error);
      return 0; // 出錯時返回0
    }
  },
  
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
      
      const beforeBalance = parseFloat(member.balance);
      const afterBalance = beforeBalance + parseFloat(amount);
      
      // 確保餘額不會小於0
      if (afterBalance < 0) throw new Error('會員餘額不足');
      
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
      `, ['member', member.id, amount, amount > 0 ? 'deposit' : 'withdraw', beforeBalance, afterBalance, '會員點數調整']);
      
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
      
      const beforeBalance = parseFloat(member.balance);
      const afterBalance = parseFloat(balance);
      
      // 確保餘額不會小於0
      if (afterBalance < 0) throw new Error('會員餘額不能小於0');
      
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
      `, ['member', member.id, afterBalance - beforeBalance, 'adjustment', beforeBalance, afterBalance, '會員點數設置']);
      
      return updatedMember;
    } catch (error) {
      console.error('設置會員餘額出錯:', error);
      throw error;
    }
  },
  
  // 查詢特定代理下的特定會員
  async findByAgentAndUsername(agentId, username) {
    try {
      return await db.oneOrNone(`
        SELECT * FROM members 
        WHERE agent_id = $1 AND username = $2
      `, [agentId, username]);
    } catch (error) {
      console.error('查詢特定代理下的特定會員出錯:', error);
      throw error;
    }
  }
};

// 模型: 點數轉移
const PointTransferModel = {
  // 從代理轉移點數到會員
  async transferFromAgentToMember(agentId, memberId, amount, description = '從代理轉移點數到會員') {
    try {
      // 參數驗證
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('轉移的點數必須大於0');
      }
      
      // 獲取代理和會員信息
      const agent = await AgentModel.findById(agentId);
      if (!agent) throw new Error('代理不存在');
      
      const member = await MemberModel.findById(memberId);
      if (!member) throw new Error('會員不存在');
      
      // 檢查代理餘額是否足夠
      if (parseFloat(agent.balance) < parsedAmount) {
        throw new Error('代理點數不足');
      }
      
      // 開始數據庫事務
      return await db.tx(async t => {
        // 更新代理餘額
        const agentBeforeBalance = parseFloat(agent.balance);
        const agentAfterBalance = agentBeforeBalance - parsedAmount;
        
        await t.one(`
          UPDATE agents 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [agentAfterBalance, agentId]);
        
        // 更新會員餘額
        const memberBeforeBalance = parseFloat(member.balance);
        const memberAfterBalance = memberBeforeBalance + parsedAmount;
        
        const updatedMember = await t.one(`
          UPDATE members 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [memberAfterBalance, memberId]);
        
        // 記錄代理的交易
        await t.none(`
          INSERT INTO transactions 
          (user_type, user_id, amount, type, before_balance, after_balance, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['agent', agentId, -parsedAmount, 'transfer_out', agentBeforeBalance, agentAfterBalance, '轉移點數到會員']);
        
        // 記錄會員的交易
        await t.none(`
          INSERT INTO transactions 
          (user_type, user_id, amount, type, before_balance, after_balance, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['member', memberId, parsedAmount, 'transfer_in', memberBeforeBalance, memberAfterBalance, '從代理收到點數']);
        
        // 記錄點數轉移
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
      console.error('轉移點數出錯:', error);
      throw error;
    }
  },
  
  // 從會員轉移點數到代理
  async transferFromMemberToAgent(memberId, agentId, amount, description = '從會員轉移點數到代理') {
    try {
      // 參數驗證
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('轉移的點數必須大於0');
      }
      
      // 獲取代理和會員信息
      const member = await MemberModel.findById(memberId);
      if (!member) throw new Error('會員不存在');
      
      const agent = await AgentModel.findById(agentId);
      if (!agent) throw new Error('代理不存在');
      
      // 檢查會員餘額是否足夠
      if (parseFloat(member.balance) < parsedAmount) {
        throw new Error('會員點數不足');
      }
      
      // 開始數據庫事務
      return await db.tx(async t => {
        // 更新會員餘額
        const memberBeforeBalance = parseFloat(member.balance);
        const memberAfterBalance = memberBeforeBalance - parsedAmount;
        
        await t.one(`
          UPDATE members 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [memberAfterBalance, memberId]);
        
        // 更新代理餘額
        const agentBeforeBalance = parseFloat(agent.balance);
        const agentAfterBalance = agentBeforeBalance + parsedAmount;
        
        const updatedAgent = await t.one(`
          UPDATE agents 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [agentAfterBalance, agentId]);
        
        // 記錄會員的交易
        await t.none(`
          INSERT INTO transactions 
          (user_type, user_id, amount, type, before_balance, after_balance, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['member', memberId, -parsedAmount, 'transfer_out', memberBeforeBalance, memberAfterBalance, '轉移點數到代理']);
        
        // 記錄代理的交易
        await t.none(`
          INSERT INTO transactions 
          (user_type, user_id, amount, type, before_balance, after_balance, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['agent', agentId, parsedAmount, 'transfer_in', agentBeforeBalance, agentAfterBalance, '從會員收到點數']);
        
        // 記錄點數轉移
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
      console.error('轉移點數出錯:', error);
      throw error;
    }
  },
  
  // 獲取點數轉移記錄
  async getTransferRecords(userType, userId, limit = 50) {
    try {
      return await db.any(`
        SELECT * FROM point_transfers 
        WHERE (from_type = $1 AND from_id = $2) OR (to_type = $1 AND to_id = $2) 
        ORDER BY created_at DESC 
        LIMIT $3
      `, [userType, userId, limit]);
    } catch (error) {
      console.error('獲取點數轉移記錄出錯:', error);
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

// 模型: 交易
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
  
  // 獲取代理今日統計數據
  async getAgentTodayStats(agentId) {
    try {
      console.log(`獲取代理統計: agentId=${agentId}`);
      
      // 驗證代理ID
      if (!agentId || agentId === '') {
        console.log(`獲取代理統計: 未提供有效的代理ID`);
        return {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          memberCount: 0,
          activeMembers: 0
        };
      }
      
      // 解析並驗證代理ID
      const parsedAgentId = parseInt(agentId);
      if (isNaN(parsedAgentId)) {
        console.log(`獲取代理統計: 代理ID "${agentId}" 不是有效的整數ID`);
        return {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          memberCount: 0,
          activeMembers: 0
        };
      }
      
      // 檢查代理是否存在
      const agentExists = await db.oneOrNone('SELECT id FROM agents WHERE id = $1', [parsedAgentId]);
      if (!agentExists) {
        console.log(`獲取代理統計: 代理ID ${parsedAgentId} 不存在`);
        return {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          memberCount: 0,
          activeMembers: 0
        };
      }
      
      // 獲取代理下的所有會員ID
      const members = await db.any('SELECT id FROM members WHERE agent_id = $1', [parsedAgentId]);
      if (!members || members.length === 0) {
        console.log(`獲取代理統計: 代理ID ${parsedAgentId} 下無會員`);
        return {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          memberCount: 0,
          activeMembers: 0
        };
      }
      
      const memberIds = members.map(m => m.id);
      console.log(`獲取代理統計: 代理 ${parsedAgentId} 下有 ${memberIds.length} 位會員`);
      
      // 獲取今日日期
      const today = new Date().toISOString().split('T')[0];
      console.log(`獲取代理統計: 查詢日期=${today}`);
      
      // 計算今日充值總額 - 使用正確的列名user_type和user_id
      try {
        const depositResult = await db.oneOrNone(`
          SELECT COALESCE(SUM(amount), 0) as total 
          FROM transactions 
          WHERE user_type = 'member' 
            AND user_id IN ($1:csv) 
            AND type = $2 
            AND DATE(created_at) = $3
        `, [memberIds, 'deposit', today]);
        
        const totalDeposit = parseFloat(depositResult ? depositResult.total : 0);
        
        // 計算今日提現總額
        const withdrawResult = await db.oneOrNone(`
          SELECT COALESCE(SUM(amount), 0) as total 
          FROM transactions 
          WHERE user_type = 'member' 
            AND user_id IN ($1:csv) 
            AND type = $2 
            AND DATE(created_at) = $3
        `, [memberIds, 'withdraw', today]);
        
        const totalWithdraw = parseFloat(withdrawResult ? withdrawResult.total : 0);
        
        // 計算今日收入總額
        const revenueResult = await db.oneOrNone(`
          SELECT COALESCE(SUM(amount), 0) as total 
          FROM transactions 
          WHERE user_type = 'member' 
            AND user_id IN ($1:csv) 
            AND type = $2 
            AND DATE(created_at) = $3
        `, [memberIds, 'revenue', today]);
        
        const totalRevenue = parseFloat(revenueResult ? revenueResult.total : 0);
        
        // 獲取活躍會員數 - 使用正確的列名
        const activeMembersResult = await db.oneOrNone(`
          SELECT COUNT(DISTINCT user_id) as count 
          FROM transactions 
          WHERE user_type = 'member' 
            AND user_id IN ($1:csv) 
            AND DATE(created_at) = $2
        `, [memberIds, today]);
        
        const activeMembers = parseInt(activeMembersResult ? activeMembersResult.count : 0);
        
        console.log(`獲取代理統計: 成功獲取 ID=${parsedAgentId} 的統計數據`);
        
        return {
          totalDeposit,
          totalWithdraw,
          totalRevenue,
          memberCount: memberIds.length,
          activeMembers
        };
      } catch (queryError) {
        console.error('獲取代理統計 - 查詢錯誤:', queryError);
        return {
          totalDeposit: 0,
          totalWithdraw: 0,
          totalRevenue: 0,
          memberCount: memberIds.length,
          activeMembers: 0
        };
      }
    } catch (error) {
      console.error('獲取代理統計出錯:', error);
      // 出錯時返回默認值
      return {
        totalDeposit: 0,
        totalWithdraw: 0,
        totalRevenue: 0,
        memberCount: 0,
        activeMembers: 0
      };
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

// 創建代理 - 修改路由名稱
app.post(`${API_PREFIX}/create-agent`, async (req, res) => {
  const { username, password, level, parent, commission_rate } = req.body; // 添加 commission_rate
  
  try {
    // 檢查用戶名是否已存在
    const existingAgent = await AgentModel.findByUsername(username);
    if (existingAgent) {
      return res.json({
        success: false,
        message: '該用戶名已被使用'
      });
    }
    
    // 獲取上級代理ID 和 上級代理信息
    let parentId = null;
    let parentAgent = null; 
    if (parent) {
      parentAgent = await AgentModel.findById(parent);
      if (!parentAgent) {
        return res.json({
          success: false,
          message: '上級代理不存在'
        });
      }
      parentId = parentAgent.id;
       // 驗證代理級別是否合理
      if (parseInt(level) <= parentAgent.level) {
        return res.json({
          success: false,
          message: '下級代理的級別必須低於上級代理'
        });
      }
      // 驗證佣金比例是否合理
      if (parseFloat(commission_rate) > parentAgent.commission_rate) {
          return res.json({
              success: false,
              message: '下級代理的佣金比例不能高於上級代理'
          });
      }

    } else {
         // 如果沒有指定上級，檢查是否正在創建總代理
         if (parseInt(level) !== 0) {
              return res.json({
                success: false,
                message: '只有總代理可以沒有上級'
              })
         }
    }
    
    // 創建代理
    const newAgent = await AgentModel.create({
      username,
      password,
      parent_id: parentId,
      level: parseInt(level),
      commission_rate: parseFloat(commission_rate) // 使用傳入的佣金比例
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

// 設置儀表板路由
app.get(`${API_PREFIX}/stats`, async (req, res) => {
  try {
    console.log('獲取儀表板統計API: 接收請求', req.query);
    
    // 直接從查詢參數獲取agentId
    const { agentId } = req.query;
    
    if (!agentId) {
      console.log('獲取儀表板統計API: 未提供agentId');
      return res.json({
        success: false,
        message: '請提供代理ID'
      });
    }
    
    try {
      // 獲取代理統計數據
      const stats = await TransactionModel.getAgentTodayStats(agentId);
      console.log('獲取儀表板統計API: 成功獲取數據', stats);
      
      return res.json({
        success: true,
        data: stats
      });
    } catch (statsError) {
      console.error('獲取儀表板統計API: 統計數據查詢錯誤', statsError);
      // 返回空數據而非500錯誤
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
    console.error('獲取儀表板統計API: 處理錯誤', error);
    return res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 獲取代理的會員列表
app.get(`${API_PREFIX}/members`, async (req, res) => {
  try {
    console.log('獲取會員列表API: 接收請求', req.query);
    
    // 直接從查詢參數獲取agentId
    const { agentId, status = '-1', page = 1, limit = 20 } = req.query;
    
    if (!agentId) {
      console.log('獲取會員列表API: 未提供agentId');
      return res.json({
        success: false,
        message: '請提供代理ID'
      });
    }
    
    try {
      // 獲取會員列表
      const members = await MemberModel.findByAgentId(agentId, status, page, limit);
      
      // 獲取會員總數
      const total = await MemberModel.countByAgentId(agentId, status);
      
      console.log(`獲取會員列表API: 成功找到 ${members.length} 位會員，總計 ${total} 位`);
      
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
      console.error('獲取會員列表API: 查詢錯誤', queryError);
      // 返回空列表而非500錯誤
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
    console.error('獲取會員列表API: 處理錯誤', error);
    return res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 獲取代理的下級代理列表
app.get(`${API_PREFIX}/sub-agents`, async (req, res) => {
  try {
    console.log('獲取下級代理API: 接收請求', req.query);
    
    // 直接從查詢參數獲取
    const { parentId = '', level = '-1', status = '-1', page = 1, limit = 20 } = req.query;
    
    console.log(`獲取下級代理API: 接收請求 parentId=${parentId}, level=${level}, status=${status}, page=${page}, limit=${limit}`);
    
    try {
      // 獲取下級代理列表
      const agents = await AgentModel.findByParentId(parentId, level, status, page, limit);
      console.log(`獲取下級代理API: 成功找到 ${agents.length} 位代理`);
      
      // 獲取下級代理總數
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
      
      console.log(`獲取下級代理API: 總共 ${total} 位代理`);
      
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
      console.error('獲取下級代理API: 查詢錯誤', queryError);
      // 返回空列表而非500錯誤
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
    console.error('獲取下級代理API: 處理錯誤', error);
    return res.status(500).json({ success: false, message: '伺服器錯誤' });
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

// 修復會員驗證端點
app.post(`${API_PREFIX}/verify-member`, async (req, res) => {
  const { username, password } = req.body;
  
  console.log('收到會員驗證請求:', { username, password: '***' });
  
  try {
    // 查詢會員
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      console.log(`會員 ${username} 不存在`);
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 檢查密碼
    if (member.password !== password) {
      console.log(`會員 ${username} 密碼錯誤`);
      return res.json({
        success: false,
        message: '密碼錯誤'
      });
    }
    
    // 檢查狀態
    if (member.status !== 1) {
      console.log(`會員 ${username} 帳號已被禁用`);
      return res.json({
        success: false,
        message: '帳號已被禁用'
      });
    }
    
    // 獲取會員的代理
    const agent = await AgentModel.findById(member.agent_id);
    
    console.log(`會員 ${username} 驗證成功`);
    
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
    console.error('會員驗證出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 新增: 會員餘額查詢API
app.get(`${API_PREFIX}/member-balance`, async (req, res) => {
  const { username } = req.query;
  
  try {
    if (!username) {
      return res.json({
        success: false,
        message: '請提供會員用戶名'
      });
    }
    
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

// 更新會員餘額 API 端點 - 修改為點數轉移邏輯
app.post(`${API_PREFIX}/update-member-balance`, async (req, res) => {
  const { agentId, username, amount, type, description } = req.body;
  
  console.log(`收到更新會員餘額請求: 代理ID=${agentId}, 會員=${username}, 金額=${amount}, 類型=${type}, 說明=${description}`);
  console.log(`請求體:`, JSON.stringify(req.body));
  
  try {
    if (!username || amount === undefined || !agentId) {
      console.error('更新會員餘額失敗: 缺少必要參數');
      return res.json({
        success: false,
        message: '請提供代理ID、會員用戶名和變更金額'
      });
    }
    
    // 查詢會員
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      console.error(`更新會員餘額失敗: 會員 ${username} 不存在`);
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    console.log(`找到會員: ID=${member.id}, 用戶名=${member.username}`);
    
    // 查詢代理
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      console.error(`更新會員餘額失敗: 代理 ID=${agentId} 不存在`);
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    console.log(`找到代理: ID=${agent.id}, 用戶名=${agent.username}`);
    
    const parsedAmount = parseFloat(amount);
    console.log(`處理點數轉移: 金額=${parsedAmount}`);
    
    // 根據操作類型執行不同的點數轉移
    let result;
    
    try {
      if (parsedAmount > 0) {
        // 從代理轉移點數到會員
        console.log(`執行代理到會員的點數轉移: 金額=${parsedAmount}`);
        result = await PointTransferModel.transferFromAgentToMember(
          agent.id, 
          member.id, 
          parsedAmount, 
          description || '代理存入點數給會員'
        );
      } else if (parsedAmount < 0) {
        // 從會員轉移點數到代理
        console.log(`執行會員到代理的點數轉移: 金額=${Math.abs(parsedAmount)}`);
        result = await PointTransferModel.transferFromMemberToAgent(
          member.id, 
          agent.id, 
          Math.abs(parsedAmount), 
          description || '會員提領點數給代理'
        );
      } else {
        console.error('更新會員餘額失敗: 轉移點數必須不等於0');
        return res.json({
          success: false,
          message: '轉移點數必須不等於0'
        });
      }
      
      // 查詢更新後的代理餘額
      const updatedAgent = await AgentModel.findById(agent.id);
      
      console.log(`點數轉移成功: 會員餘額=${result.balance}, 代理餘額=${updatedAgent.balance}`);
      
      res.json({
        success: true,
        newBalance: result.balance,
        agentBalance: updatedAgent.balance
      });
    } catch (error) {
      console.error('點數轉移處理出錯:', error);
      res.status(500).json({
        success: false,
        message: error.message || '點數轉移處理出錯，請稍後再試'
      });
    }
  } catch (error) {
    console.error('更新會員餘額出錯:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系統錯誤，請稍後再試'
    });
  }
});

// 新增: 點數轉移記錄API
app.get(`${API_PREFIX}/point-transfers`, async (req, res) => {
  const { userType, userId, limit = 50 } = req.query;
  
  try {
    if (!userType || !userId) {
      return res.json({
        success: false,
        message: '請提供用戶類型和ID'
      });
    }
    
    const transfers = await PointTransferModel.getTransferRecords(userType, userId, limit);
    
    res.json({
      success: true,
      transfers
    });
  } catch (error) {
    console.error('獲取點數轉移記錄出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 獲取代理餘額
app.get(`${API_PREFIX}/agent-balance`, async (req, res) => {
  const { agentId } = req.query;
  
  try {
    if (!agentId) {
      return res.json({
        success: false,
        message: '請提供代理ID'
      });
    }
    
    // 查詢代理信息
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
    console.error('獲取代理餘額出錯:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系統錯誤，請稍後再試'
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

// 新增: 獲取總代理API端點
app.get(`${API_PREFIX}/admin-agent`, async (req, res) => {
  try {
    // 獲取總代理 (level = 0)
    const adminAgent = await db.oneOrNone('SELECT * FROM agents WHERE level = 0');
    
    if (!adminAgent) {
      return res.json({
        success: false,
        message: '系統還未設置總代理'
      });
    }
    
    res.json({
      success: true,
      agent: {
        id: adminAgent.id,
        username: adminAgent.username,
        balance: adminAgent.balance
      }
    });
  } catch (error) {
    console.error('獲取總代理信息出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 添加系統級別的儀表板API - 使用適當的API前綴
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // 獲取所有代理
    const agents = await db.one('SELECT COUNT(*) AS count FROM agents');
    
    // 獲取所有會員
    const members = await db.one('SELECT COUNT(*) AS count FROM members');
    
    // 獲取今日交易總額
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const transactions = await db.one(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total_amount, COUNT(*) as count 
      FROM transactions 
      WHERE created_at >= $1
    `, [today]);
    
    // 獲取總佣金
    const commission = await db.one(`
      SELECT COALESCE(SUM(commission_balance), 0) as total 
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
    console.error('獲取儀表板統計數據出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 添加系統級別的會員列表API - 使用適當的API前綴
app.get('/api/dashboard/members', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  
  try {
    // 獲取所有會員
    const query = `
      SELECT m.*, a.username as agent_username 
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      ORDER BY m.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const members = await db.any(query, [limit, offset]);
    
    // 獲取總數
    const totalCount = await db.one('SELECT COUNT(*) as count FROM members');
    
    res.json({
      success: true,
      members,
      total: parseInt(totalCount.count)
    });
  } catch (error) {
    console.error('獲取會員列表出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 切換會員狀態
app.post(`${API_PREFIX}/toggle-member-status`, async (req, res) => {
  const { memberId, status } = req.body;
  
  try {
    if (!memberId) {
      return res.json({
        success: false,
        message: '請提供會員ID'
      });
    }
    
    // 確保狀態值為0或1
    const newStatus = status === 1 ? 1 : 0;
    
    // 更新會員狀態
    await db.none('UPDATE members SET status = $1 WHERE id = $2', [newStatus, memberId]);
    
    res.json({
      success: true,
      message: '會員狀態更新成功'
    });
  } catch (error) {
    console.error('更新會員狀態出錯:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系統錯誤，請稍後再試'
    });
  }
});

// 獲取開獎結果歷史記錄
app.get(`${API_PREFIX}/draw-history`, async (req, res) => {
  try {
    const { page = 1, limit = 20, period = '', date = '' } = req.query;
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    const offset = (parsedPage - 1) * parsedLimit;

    let countQuery = 'SELECT COUNT(*) FROM draw_records';
    let dataQuery = 'SELECT * FROM draw_records';
    const params = [];
    const countParams = [];

    let whereClause = '';

    if (period) {
      whereClause += (whereClause ? ' AND ' : ' WHERE ') + `period = $${params.length + 1}`;
      params.push(period);
      countParams.push(period);
    }

    if (date) {
      whereClause += (whereClause ? ' AND ' : ' WHERE ') + `DATE(draw_time) = $${params.length + 1}`;
      params.push(date);
      countParams.push(date);
    }

    countQuery += whereClause;
    dataQuery += whereClause;

    dataQuery += ` ORDER BY period DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parsedLimit, offset);

    console.log(`Executing count query: ${countQuery} with params: ${JSON.stringify(countParams)}`);
    console.log(`Executing data query: ${dataQuery} with params: ${JSON.stringify(params)}`);

    // 執行查詢
    const totalResult = await db.one(countQuery, countParams);
    const totalRecords = parseInt(totalResult.count);
    const records = await db.any(dataQuery, params);

    res.json({
      success: true,
      records: records,
      totalPages: Math.ceil(totalRecords / parsedLimit),
      currentPage: parsedPage,
      totalRecords: totalRecords
    });

  } catch (error) {
    console.error('獲取開獎歷史出錯 (直接查詢數據庫):', error);
    res.status(500).json({
      success: false,
      message: error.message || '獲取開獎歷史失敗'
    });
  }
});

// API 路由
// 獲取下注記錄
app.get(`${API_PREFIX}/bets`, async (req, res) => {
  try {
    const { agentId, username, date, period, page = 1, limit = 20 } = req.query;
    
    // 基本參數驗證
    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: '代理ID為必填項'
      });
    }
    
    // 查詢該代理下的所有會員
    let members = [];
    
    // 如果指定了會員用戶名
    if (username) {
      // 檢查這個會員是否屬於該代理
      const member = await MemberModel.findByAgentAndUsername(agentId, username);
      if (member) {
        members = [member];
      } else {
        return res.status(403).json({
          success: false,
          message: '該會員不存在或不屬於你的下線'
        });
      }
    } else {
      // 獲取所有直系下線會員
      const memberList = await MemberModel.findByAgentId(agentId);
      members = memberList.data || [];
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
    
    // 獲取這些會員的用戶名
    const memberUsernames = members.map(m => m.username);
    
    // 構建查詢條件
    let whereClause = `WHERE username IN (${memberUsernames.map((_, i) => `$${i + 1}`).join(',')})`;
    let params = [...memberUsernames];
    let paramIndex = memberUsernames.length + 1;
    
    // 添加日期過濾
    if (date) {
      whereClause += ` AND DATE(created_at) = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }
    
    // 添加期數過濾
    if (period) {
      whereClause += ` AND period = $${paramIndex}`;
      params.push(period);
      paramIndex++;
    }
    
    // 計算總記錄數
    const countQuery = `SELECT COUNT(*) AS total FROM bet_history ${whereClause}`;
    const totalResult = await db.one(countQuery, params);
    const total = parseInt(totalResult.total);
    
    // 計算分頁
    const offset = (page - 1) * limit;
    
    // 獲取投注記錄
    const betQuery = `
      SELECT * FROM bet_history 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const bets = await db.any(betQuery, params);
    
    // 計算統計數據
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
      bets,
      total,
      stats: {
        totalBets: parseInt(stats.total_bets),
        totalAmount: parseFloat(stats.total_amount) || 0,
        totalProfit: parseFloat(stats.total_profit) || 0
      }
    });
    
  } catch (error) {
    console.error('獲取下注記錄出錯:', error);
    res.status(500).json({
      success: false,
      message: '獲取下注記錄失敗',
      error: error.message
    });
  }
});

// 從主遊戲系統同步開獎歷史
async function syncDrawHistory(forceSync = false) {
  try {
    console.log(`開始同步開獎歷史數據，強制同步: ${forceSync}`);
    
    // 獲取最新的開獎記錄期數
    let latestPeriod = null;
    if (!forceSync) {
      const latestRecord = await db.oneOrNone(`
        SELECT period FROM draw_records 
        ORDER BY CAST(period AS BIGINT) DESC 
        LIMIT 1
      `);
      
      if (latestRecord) {
        latestPeriod = latestRecord.period;
        console.log(`最新一期開獎記錄: ${latestPeriod}`);
      } else {
        console.log('沒有找到現有開獎記錄，將同步所有歷史');
      }
    }
    
    // 構建遊戲系統API URL
    let apiUrl = process.env.NODE_ENV === 'production' 
      ? 'https://bet-game.onrender.com/api/history'
      : 'http://localhost:3002/api/history';
    
    // 添加同步參數
    const params = new URLSearchParams();
    params.append('limit', '100'); // 每次同步100條記錄
    if (latestPeriod) {
      params.append('after_period', latestPeriod);
    }
    apiUrl += `?${params.toString()}`;
    
    console.log(`請求主遊戲系統API: ${apiUrl}`);
    
    // 發送請求到遊戲系統
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`遊戲系統API返回錯誤: ${response.status}`);
    }
    
    const data = await response.json();
    const records = Array.isArray(data) ? data : (data.records || []);
    
    if (records.length === 0) {
      console.log('沒有新的開獎記錄需要同步');
      return { success: true, syncedCount: 0 };
    }
    
    console.log(`獲取到 ${records.length} 條開獎記錄，準備插入數據庫`);
    
    // 使用數據庫事務同步資料
    return await db.tx(async t => {
      let syncedCount = 0;
      
      for (const record of records) {
        try {
          // 檢查記錄是否已存在
          const exists = await t.oneOrNone(`
            SELECT id FROM draw_records WHERE period = $1
          `, [record.period]);
          
          if (!exists) {
            // 插入新記錄
            await t.none(`
              INSERT INTO draw_records (period, result, draw_time) 
              VALUES ($1, $2, $3)
            `, [
              record.period,
              JSON.stringify(record.result || record.numbers || []),
              record.draw_time || record.created_at || new Date()
            ]);
            
            syncedCount++;
          }
        } catch (err) {
          console.error(`同步第 ${record.period} 期開獎記錄時出錯:`, err);
          // 繼續處理其他記錄
        }
      }
      
      console.log(`成功同步 ${syncedCount} 條開獎記錄`);
      return { success: true, syncedCount };
    });
  } catch (error) {
    console.error('同步開獎歷史出錯:', error);
    return { success: false, error: error.message };
  }
}

// 初始化數據庫並啟動服務器
async function startServer() {
  try {
    await initDatabase();
    
    // 啟動服務器
    app.listen(port, () => {
      console.log(`代理管理系統後端運行在端口 ${port}`);
      
      // 啟動後立即同步一次開獎歷史
      syncDrawHistory().then(result => {
        console.log('服務啟動初始同步結果:', result);
      }).catch(err => {
        console.error('服務啟動初始同步出錯:', err);
      });
      
      // 設置定時同步任務 - 每5分鐘同步一次
      setInterval(() => {
        syncDrawHistory().then(result => {
          console.log('定時同步結果:', result);
        }).catch(err => {
          console.error('定時同步出錯:', err);
        });
      }, 5 * 60 * 1000); // 5分鐘
    });
  } catch (error) {
    console.error('啟動服務器時出錯:', error);
    process.exit(1);
  }
}

// 添加手動同步開獎歷史的API端點
app.get(`${API_PREFIX}/sync-draw-history`, async (req, res) => {
  try {
    const forceSync = req.query.force === 'true';
    const result = await syncDrawHistory(forceSync);
    res.json(result);
  } catch (error) {
    console.error('手動同步開獎歷史出錯:', error);
    res.status(500).json({
      success: false,
      message: error.message || '同步失敗'
    });
  }
});

startServer();