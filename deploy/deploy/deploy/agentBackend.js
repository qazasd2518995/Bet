// agentBackend.js - 代理管理會員系統後端
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { createServer } from 'http';
import wsManager from './websocket/ws-manager.js';
// 使用優化過的數據庫配置
import db from './db/config.js';
// 導入基本數據庫初始化函數
import initDatabaseBase from './db/init.js';
import SessionManager from './security/session-manager.js';
import { generateBlockchainData } from './utils/blockchain.js';
import bcrypt from 'bcrypt';

// 初始化環境變量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3003; // 使用不同於主遊戲系統的端口

// 跨域設置 - 加強本地開發支持
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://bet-game.onrender.com', 'https://bet-game-vcje.onrender.com', 'https://bet-agent.onrender.com'] 
    : ['http://localhost:3002', 'http://localhost:3000', 'http://localhost:3003', 'http://127.0.0.1:3003', 'http://localhost:8081', 'http://127.0.0.1:8081'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Session-Token'],
  credentials: true
}));

app.use(express.json());

// 提供靜態文件
app.use(express.static(path.join(__dirname, 'agent/frontend')));

// 主頁面路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'agent/frontend', 'index.html'));
});

// Favicon 路由處理
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'agent/frontend', 'favicon.svg'));
});

// 健康檢查端點 - 用於 Render 監控
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 創建必要的資料庫表格
async function initializeWinLossControlTables() {
  try {
    console.log('初始化輸贏控制表格...');
    
    // 創建輸贏控制表
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
    
    // 如果表已存在，檢查並修改start_period欄位類型
    try {
      await db.none(`
        ALTER TABLE win_loss_control 
        ALTER COLUMN start_period TYPE VARCHAR(20)
      `);
      console.log('✅ start_period欄位類型已更新為VARCHAR(20)');
    } catch (alterError) {
      // 如果修改失敗（可能因為已經是正確類型），繼續執行
      if (!alterError.message.includes('already exists') && !alterError.message.includes('cannot be cast')) {
        console.log('start_period欄位類型修改:', alterError.message);
      }
    }
    
    // 創建輸贏控制日誌表
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
    
    console.log('輸贏控制表格初始化完成');
  } catch (error) {
    console.error('輸贏控制表格初始化錯誤:', error);
  }
}

// 在應用啟動時初始化資料庫
initializeWinLossControlTables();

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

// 新增數據庫檢查端點 - 用於檢查agents表是否存在
app.get('/api/check-profile-table', async (req, res) => {
  try {
    console.log('檢查 agents 表...');
    
    // 檢查表是否存在
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
    
    // 檢查表結構
    const columns = await db.any(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'agents' 
      ORDER BY ordinal_position
    `);
    
    // 檢查記錄數量
    const recordCount = await db.one('SELECT COUNT(*) as count FROM agents');
    
    res.json({
      success: true,
      message: 'agents 表檢查完成',
      tableExists: true,
      columns: columns,
      recordCount: parseInt(recordCount.count)
    });
    
  } catch (error) {
    console.error('檢查 agents 表失敗:', error);
    res.status(500).json({
      success: false,
      message: '檢查失敗',
      error: error.message
    });
  }
});



// 代理API路由前綴
const API_PREFIX = '/api/agent';

// 會員登入驗證API
app.post(`${API_PREFIX}/member/verify-login`, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`會員登入驗證請求: ${username}`);
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '請提供帳號和密碼'
      });
    }
    
    // 查詢會員資訊
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      console.log(`會員不存在: ${username}`);
      return res.status(400).json({
        success: false,
        message: '帳號或密碼錯誤'
      });
    }
    
    // 驗證密碼（這裡簡化處理，實際應該使用加密）
    if (member.password !== password) {
      console.log(`密碼錯誤: ${username}`);
      return res.status(400).json({
        success: false,
        message: '帳號或密碼錯誤'
      });
    }
    
    console.log(`會員登入驗證成功: ${username}, ID: ${member.id}`);
    console.log(`會員完整數據:`, JSON.stringify(member, null, 2));
    console.log(`會員market_type值:`, member.market_type);
    console.log(`會員market_type類型:`, typeof member.market_type);
    
    const responseData = {
      id: member.id,
      username: member.username,
      balance: member.balance,
      agent_id: member.agent_id,
      status: member.status,
      market_type: member.market_type || 'D'
    };
    
    console.log(`回應數據:`, JSON.stringify(responseData, null, 2));
    
    res.json({
      success: true,
      message: '驗證成功',
      member: responseData
    });
    
  } catch (error) {
    console.error('會員登入驗證錯誤:', error);
    res.status(500).json({
      success: false,
      message: '驗證服務暫時不可用'
    });
  }
});

// 獲取會員信息API（包含盤口類型）
app.get(`${API_PREFIX}/member/info/:username`, async (req, res) => {
  try {
    const { username } = req.params;
    
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.status(400).json({
        success: false,
        message: '用戶不存在'
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
    console.error('獲取會員信息錯誤:', error);
    res.status(500).json({
      success: false,
      message: '服務暫時不可用'
    });
  }
});

// 獲取會員餘額API
app.get(`${API_PREFIX}/member/balance/:username`, async (req, res) => {
  try {
    const { username } = req.params;
    
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.status(400).json({
        success: false,
        message: '用戶不存在'
      });
    }
    
    res.json({
      success: true,
      balance: member.balance,
      username: member.username
    });
    
  } catch (error) {
    console.error('獲取會員餘額錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取餘額失敗'
    });
  }
});

// 會員投注記錄API
app.get(`${API_PREFIX}/member/bet-records/:username`, async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.status(400).json({
        success: false,
        message: '用戶不存在'
      });
    }
    
    // 從遊戲資料庫查詢真實投注記錄
    try {
      const offset = (page - 1) * limit;
      
      // 查詢投注記錄
      const records = await db.many(`
        SELECT id, username, period, bet_type, bet_value, position, amount, odds, win, settled, created_at, win_amount
        FROM bet_history 
        WHERE username = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `, [username, limit, offset]);
      
      // 查詢總數
      const totalResult = await db.one(`
        SELECT COUNT(*) as total 
        FROM bet_history 
        WHERE username = $1
      `, [username]);
      
      // 格式化記錄
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
      console.error('查詢投注記錄資料庫錯誤:', dbError);
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
    console.error('獲取會員投注記錄錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取投注記錄失敗'
    });
  }
});

// 會員盈虧統計API
app.get(`${API_PREFIX}/member/profit-loss/:username`, async (req, res) => {
  try {
    const { username } = req.params;
    const { period = 'today' } = req.query;
    
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.status(400).json({
        success: false,
        message: '用戶不存在'
      });
    }
    
    // 根據period設定時間範圍（台灣時間 UTC+8）
    let timeCondition = '';
    if (period === 'today') {
      timeCondition = `AND DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei') = DATE(NOW() AT TIME ZONE 'Asia/Taipei')`;
    } else if (period === '7days') {
      timeCondition = `AND created_at >= (NOW() AT TIME ZONE 'Asia/Taipei' - INTERVAL '7 days') AT TIME ZONE 'Asia/Taipei' AT TIME ZONE 'UTC'`;
    } else if (period === '30days') {
      timeCondition = `AND created_at >= (NOW() AT TIME ZONE 'Asia/Taipei' - INTERVAL '30 days') AT TIME ZONE 'Asia/Taipei' AT TIME ZONE 'UTC'`;
    }
    
    // 查詢投注記錄並計算盈虧
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
    
    console.log(`查詢用戶 ${username} 的盈虧統計，期間: ${period}`);
    console.log('執行SQL:', profitQuery);
    
    const result = await db.one(profitQuery, [username]);
    
    console.log('查詢結果:', result);
    
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
    console.error('獲取會員盈虧統計錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取盈虧統計失敗'
    });
  }
});

// 接收遊戲端的即時開獎同步
app.post(`${API_PREFIX}/sync-draw-record`, async (req, res) => {
  try {
    const { period, result, draw_time } = req.body;
    
    if (!period || !result) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: period 或 result'
      });
    }
    
    console.log(`📨 收到即時開獎同步請求: 期數=${period}`);
    
    // 生成區塊鏈資料
    const blockchainData = generateBlockchainData(period, result);
    
    // 直接插入/更新到draw_records表，包含區塊鏈資料
    await db.none(`
      INSERT INTO draw_records (period, result, draw_time, created_at, block_height, block_hash)
      VALUES ($1, $2::jsonb, $3, $4, $5, $6)
      ON CONFLICT (period) DO UPDATE 
      SET result = $2::jsonb, draw_time = $3, created_at = $4, 
          block_height = $5, block_hash = $6
    `, [period, JSON.stringify(result), draw_time || new Date(), new Date(), 
        blockchainData.blockHeight, blockchainData.blockHash]);
    
    console.log(`✅ 即時開獎同步成功: 期數=${period}`);
    
    res.json({
      success: true,
      message: '開獎記錄同步成功',
      period: period,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('即時開獎同步失敗:', error);
    res.status(500).json({
      success: false,
      message: '開獎記錄同步失敗',
      error: error.message
    });
  }
});

// 切換代理狀態API
app.post(`${API_PREFIX}/toggle-agent-status`, async (req, res) => {
  try {
    const { agentId, status } = req.body;
    
    if (!agentId || status === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數: agentId 或 status'
      });
    }
    
    await AgentModel.updateStatus(agentId, status);
    
    const statusText = status === 1 ? '启用' : status === 0 ? '停用' : '凍結';
    res.json({
      success: true,
      message: `代理状态已更新为: ${statusText}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('更新代理狀態失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新代理狀態失敗',
      error: error.message
    });
  }
});

// 刪除代理API - 物理刪除
app.delete(`${API_PREFIX}/delete-agent/:agentId`, async (req, res) => {
  try {
    const { agentId } = req.params;
    
    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: '缺少代理ID'
      });
    }
    
    // 檢查代理是否存在
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 檢查代理餘額是否為0
    const balance = parseFloat(agent.balance) || 0;
    if (balance !== 0) {
      return res.status(400).json({
        success: false,
        message: `無法刪除：代理餘額為 $${balance.toFixed(2)}，必須先將餘額清空至0才能刪除`
      });
    }
    
    // 檢查是否有下級代理（只查詢啟用狀態的）
    const subAgents = await db.any(`
      SELECT * FROM agents WHERE parent_id = $1 AND status = 1
    `, [agentId]);
    
    // 檢查是否有會員（只查詢啟用狀態的）
    const members = await db.any(`
      SELECT * FROM members WHERE agent_id = $1 AND status = 1
    `, [agentId]);
    
    if (subAgents.length > 0 || members.length > 0) {
      const details = [];
      if (subAgents.length > 0) details.push(`${subAgents.length}個下級代理`);
      if (members.length > 0) details.push(`${members.length}個會員`);
      
      return res.status(400).json({
        success: false,
        message: `無法刪除：該代理下還有${details.join('和')}，請先處理這些下級關係`
      });
    }
    
    // 執行物理刪除（完全從數據庫移除）
    const deleted = await AgentModel.delete(agentId);
    
    if (deleted) {
      res.json({
        success: true,
        message: '代理已永久刪除',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: '刪除代理失敗'
      });
    }
    
  } catch (error) {
    console.error('刪除代理失敗:', error);
    res.status(500).json({
      success: false,
      message: '刪除代理失敗',
      error: error.message
    });
  }
});

// 刪除會員API - 物理刪除
app.delete(`${API_PREFIX}/delete-member/:memberId`, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: '缺少會員ID'
      });
    }
    
    // 檢查會員是否存在
    const member = await MemberModel.findById(memberId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 檢查會員餘額是否為0
    const balance = parseFloat(member.balance) || 0;
    if (balance !== 0) {
      return res.status(400).json({
        success: false,
        message: `無法刪除：會員餘額為 $${balance.toFixed(2)}，必須先將餘額清空至0才能刪除`
      });
    }
    
    // 執行物理刪除（完全從數據庫移除）
    const deleted = await MemberModel.delete(memberId);
    
    if (deleted) {
      res.json({
        success: true,
        message: '會員已永久刪除',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: '刪除會員失敗'
      });
    }
    
  } catch (error) {
    console.error('刪除會員失敗:', error);
    res.status(500).json({
      success: false,
      message: '刪除會員失敗',
      error: error.message
    });
  }
});

// 清理測試數據API
app.delete(`${API_PREFIX}/cleanup-test-data`, async (req, res) => {
  try {
    // 刪除測試期數
    await db.none(`DELETE FROM draw_records WHERE period = 'test123'`);
    
    res.json({
      success: true,
      message: '測試數據已清理',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('清理測試數據失敗:', error);
    res.status(500).json({
      success: false,
      message: '清理測試數據失敗',
      error: error.message
    });
  }
});

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
        rebate_percentage DECIMAL(5, 4) DEFAULT 0.041,
        rebate_mode VARCHAR(20) DEFAULT 'percentage',
        max_rebate_percentage DECIMAL(5, 4) DEFAULT 0.041,
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
        category VARCHAR(20) DEFAULT '最新公告',
        status INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 檢查並添加category字段（為現有表添加新字段）
    try {
      await db.none(`
        ALTER TABLE notices ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT '最新公告'
      `);
    } catch (error) {
      // 如果字段已存在，忽略錯誤
      console.log('公告分類字段已存在或添加失敗:', error.message);
    }

    // 檢查並添加代理退水相關字段
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
      // 新增盤口類型字段 - A盤(1.1%退水)或D盤(4.1%退水)
      await db.none(`
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS market_type VARCHAR(1) DEFAULT 'D'
      `);
      console.log('代理退水字段添加成功');
    } catch (error) {
      console.log('代理退水字段已存在或添加失敗:', error.message);
    }
    
    // 檢查並添加退水記錄相關字段
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
      console.log('退水記錄字段添加成功');
    } catch (error) {
      console.log('退水記錄字段已存在或添加失敗:', error.message);
    }
    
    // 檢查並添加備註字段
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
      // 新增會員盤口類型字段，從代理繼承
      await db.none(`
        ALTER TABLE members ADD COLUMN IF NOT EXISTS market_type VARCHAR(1) DEFAULT 'D'
      `);
      console.log('備註字段添加成功');
    } catch (error) {
      console.log('備註字段已存在或添加失敗:', error.message);
    }
    
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
    
    // 創建登錄日誌表
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

    // 為登錄日誌表創建索引
    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_user_login_logs_username ON user_login_logs(username);
      CREATE INDEX IF NOT EXISTS idx_user_login_logs_login_time ON user_login_logs(login_time DESC);
      CREATE INDEX IF NOT EXISTS idx_user_login_logs_ip ON user_login_logs(ip_address);
    `);
    
    // 創建會話管理表
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

    // 為會話表創建索引
    await db.none(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_type, user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);
    `);
    
    console.log('初始化代理系統數據庫表結構完成');
    
    // 檢查是否已有總代理
    const adminAgents = await db.any('SELECT * FROM agents WHERE level = 0');
    
    if (adminAgents.length === 0) {
      // 創建兩個獨立的總代理：A盤和D盤
      console.log('未找到總代理，開始創建A盤和D盤總代理...');
      
      // 創建A盤總代理
      console.log('創建A盤總代理 ti2025A...');
      await db.none(`
        INSERT INTO agents (username, password, level, balance, commission_rate, market_type, max_rebate_percentage, rebate_percentage) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, ['ti2025A', 'ti2025A', 0, 200000, 0.3, 'A', 0.011, 0.011]);
      console.log('A盤總代理 ti2025A 創建成功，初始餘額 200,000，退水1.1%');
      
      // 創建D盤總代理
      console.log('創建D盤總代理 ti2025D...');
      await db.none(`
        INSERT INTO agents (username, password, level, balance, commission_rate, market_type, max_rebate_percentage, rebate_percentage) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, ['ti2025D', 'ti2025D', 0, 200000, 0.3, 'D', 0.041, 0.041]);
      console.log('D盤總代理 ti2025D 創建成功，初始餘額 200,000，退水4.1%');
    } else {
      console.log(`已存在 ${adminAgents.length} 個總代理，檢查是否需要創建A盤和D盤總代理`);
      
      // 檢查是否已有A盤和D盤總代理
      const ti2025AAgent = adminAgents.find(agent => agent.username === 'ti2025A');
      const ti2025DAgent = adminAgents.find(agent => agent.username === 'ti2025D');
      
      // 如果沒有A盤總代理，創建一個
      if (!ti2025AAgent) {
        console.log('創建A盤總代理 ti2025A...');
        await db.none(`
          INSERT INTO agents (username, password, level, balance, commission_rate, market_type, max_rebate_percentage, rebate_percentage) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, ['ti2025A', 'ti2025A', 0, 200000, 0.3, 'A', 0.011, 0.011]);
        console.log('A盤總代理 ti2025A 創建成功');
      } else {
        console.log(`A盤總代理ti2025A已存在，ID=${ti2025AAgent.id}`);
      }
      
      // 如果沒有D盤總代理，創建一個
      if (!ti2025DAgent) {
        console.log('創建D盤總代理 ti2025D...');
        await db.none(`
          INSERT INTO agents (username, password, level, balance, commission_rate, market_type, max_rebate_percentage, rebate_percentage) 
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, ['ti2025D', 'ti2025D', 0, 200000, 0.3, 'D', 0.041, 0.041]);
        console.log('D盤總代理 ti2025D 創建成功');
      } else {
        console.log(`D盤總代理ti2025D已存在，ID=${ti2025DAgent.id}`);
      }
      
      // 處理舊的ti2025總代理（如果存在）
      const oldTi2025Agent = adminAgents.find(agent => agent.username === 'ti2025');
      if (oldTi2025Agent) {
        console.log(`發現舊的ti2025總代理，將其轉換為D盤總代理`);
        try {
          await db.none(`
            UPDATE agents 
            SET username = $1, market_type = $2, max_rebate_percentage = $3, rebate_percentage = $4 
            WHERE id = $5
          `, ['ti2025D_backup', 'D', 0.041, 0.041, oldTi2025Agent.id]);
          console.log(`舊ti2025總代理已重命名為ti2025D_backup`);
        } catch (renameError) {
          console.log('重命名舊總代理失敗:', renameError.message);
        }
      }
    }
    
    console.log('初始化代理系統數據庫完成');
    
    // 檢查並添加範例公告
    const existingNotices = await db.any('SELECT COUNT(*) as count FROM notices');
    if (existingNotices[0].count === 0) {
      console.log('添加範例公告...');
      
      // 添加範例公告
      const sampleNotices = [
        {
          title: '系統維護通知',
          content: '本系統將於今晚00:00-02:00進行例行維護，期間可能會暫停服務，請提前做好準備。維護期間如有緊急情況，請聯繫客服人員。',
          category: '維修'
        },
        {
          title: '歡迎使用代理管理系統',
          content: '歡迎使用全新的代理管理系統！系統提供會員管理、點數轉移、投注記錄查詢等完整功能。如有任何問題，請隨時聯繫技術支援。',
          category: '最新公告'
        },
        {
          title: '新春優惠活動開始',
          content: '🎉 新春特別優惠活動正式開始！活動期間新會員註冊即享首存100%優惠，最高可獲得5000元獎金。活動詳情請洽客服人員。',
          category: '活動'
        },
        {
          title: '系統功能更新',
          content: '系統已完成最新功能更新：1. 新增點數轉移記錄查詢 2. 優化投注統計報表 3. 增強系統安全性 4. 修復已知問題。請各位代理及時體驗新功能。',
          category: '最新公告'
        },
        {
          title: '每日維護時間調整',
          content: '為提供更好的服務品質，每日系統維護時間調整為凌晨01:30-02:30，維護期間系統將暫停服務約1小時。造成不便敬請見諒。',
          category: '維修'
        },
        {
          title: '週年慶回饋活動',
          content: '🎈 平台週年慶特別回饋！全體會員可享受特別優惠，代理商可獲得額外佣金加成。活動時間：本月1日-31日，詳細規則請查看活動專頁。',
          category: '活動'
        }
      ];
      
      for (const notice of sampleNotices) {
        await db.none(`
          INSERT INTO notices (title, content, category) 
          VALUES ($1, $2, $3)
        `, [notice.title, notice.content, notice.category]);
      }
      
      console.log(`成功添加 ${sampleNotices.length} 條範例公告`);
    }

    // 創建代理個人資料表
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
    
    console.log('代理個人資料表已創建');
    
    // 創建輸贏控制相關表
    try {
      // 創建輸贏控制設定表
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

      // 創建輸贏控制日誌表
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

      console.log('✅ 輸贏控制表創建成功');
    } catch (error) {
      console.log('輸贏控制表創建失敗:', error.message);
    }
    
    // 檢查是否需要遷移舊字段
    try {
      const hasOldFields = await db.oneOrNone(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'agents' AND column_name IN ('qq', 'wechat')
      `);
      
      if (hasOldFields) {
        console.log('檢測到舊字段，執行數據庫遷移...');
        
        // 添加新字段
        await db.none(`
          ALTER TABLE agents 
          ADD COLUMN IF NOT EXISTS line_id VARCHAR(50)
        `);
        
        // 如果需要，可以將微信號遷移到Line ID
        await db.none(`
          UPDATE agents 
          SET line_id = wechat 
          WHERE line_id IS NULL AND wechat IS NOT NULL AND wechat != ''
        `);
        
        // 刪除舊字段
        await db.none(`ALTER TABLE agents DROP COLUMN IF EXISTS qq`);
        await db.none(`ALTER TABLE agents DROP COLUMN IF EXISTS wechat`);
        
        console.log('數據庫遷移完成');
      }
    } catch (migrationError) {
      console.log('數據庫遷移檢查失敗:', migrationError.message);
    }
    
    console.log('代理個人資料表已創建');
  } catch (error) {
    console.error('初始化數據庫時出錯:', error);
    // 出錯時不結束進程，讓系統仍能啟動，方便調試
  }
}


// 安全查詢函數 - 避免 Multiple rows 錯誤
const SafeDB = {
  // 安全的單記錄查詢
  async safeOne(query, params = []) {
    try {
      const results = await db.any(query + ' LIMIT 1', params);
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('SafeDB.safeOne 錯誤:', error);
      throw error;
    }
  },
  
  // 安全的計數查詢
  async safeCount(query, params = []) {
    try {
      const result = await db.one(query, params);
      return parseInt(result.count || result.total || 0);
    } catch (error) {
      console.error('SafeDB.safeCount 錯誤:', error);
      return 0;
    }
  },
  
  // 安全的存在性檢查
  async exists(query, params = []) {
    try {
      const results = await db.any(query + ' LIMIT 1', params);
      return results.length > 0;
    } catch (error) {
      console.error('SafeDB.exists 錯誤:', error);
      return false;
    }
  }
};

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
    const { username, password, parent_id, level, commission_rate, rebate_percentage, rebate_mode, max_rebate_percentage, notes, market_type, betting_limit_level } = agentData;
    
    try {
      return await db.one(`
        INSERT INTO agents (username, password, parent_id, level, commission_rate, rebate_percentage, rebate_mode, max_rebate_percentage, notes, market_type, betting_limit_level) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
        RETURNING *
      `, [username, password, parent_id, level, commission_rate, rebate_percentage || 0.041, rebate_mode || 'percentage', max_rebate_percentage || 0.041, notes || '', market_type || 'D', betting_limit_level || 'level3']);
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
      if (afterBalance < 0) throw new Error('代理余额不足');
      
      const updatedAgent = await db.one(`
        UPDATE agents 
        SET balance = $1 
        WHERE id = $2 
        RETURNING *
      `, [afterBalance, id]);
      
      // 記錄交易
      await db.none(`
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['agent', id, amount, amount > 0 ? 'rebate' : 'withdraw', beforeBalance, afterBalance, amount > 0 ? '退水收入' : '代理點數調整']);
      
      return updatedAgent;
    } catch (error) {
      console.error('更新代理餘額出錯:', error);
      throw error;
    }
  },

  // 客服專用: 直接設置代理餘額
  async setBalanceByCustomerService(agentId, newBalance, description = '客服調整餘額') {
    try {
      const agent = await this.findById(agentId);
      if (!agent) throw new Error('代理不存在');
      
      const beforeBalance = parseFloat(agent.balance);
      const afterBalance = parseFloat(newBalance);
      const difference = afterBalance - beforeBalance;
      
      // 確保新餘額不會小於0
      if (afterBalance < 0) throw new Error('代理餘額不能小於0');
      
      const updatedAgent = await db.one(`
        UPDATE agents 
        SET balance = $1 
        WHERE id = $2 
        RETURNING *
      `, [afterBalance, agentId]);
      
      // 記錄客服操作交易
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
      console.error('客服設置代理餘額出錯:', error);
      throw error;
    }
  },

  // 檢查是否為客服權限（總代理）
  async isCustomerService(agentId) {
    try {
      const agents = await db.any('SELECT * FROM agents WHERE id = $1 AND level = 0 LIMIT 1', [agentId]);
      return agents.length > 0; // 總代理level為0
    } catch (error) {
      console.error('檢查客服權限出錯:', error);
      return false;
    }
  },

  // 更新代理密碼
  async updatePassword(id, newPassword) {
    try {
      const agent = await this.findById(id);
      if (!agent) throw new Error('代理不存在');
      
      // 更新密碼（後端會自動加密）
      const result = await db.one(`
        UPDATE agents 
        SET password = $1 
        WHERE id = $2 
        RETURNING *
      `, [newPassword, id]);
      
      return result;
    } catch (error) {
      console.error('更新代理密碼出錯:', error);
      throw error;
    }
  },

  // 更新代理退水設定
  async updateRebateSettings(id, rebateSettings) {
    try {
      const agent = await this.findById(id);
      if (!agent) throw new Error('代理不存在');
      
      const { rebate_percentage, rebate_mode, max_rebate_percentage } = rebateSettings;
      
      // 驗證退水設定
      if (parseFloat(rebate_percentage) > parseFloat(max_rebate_percentage)) {
        throw new Error('退水比例不能超過最大允許比例');
      }
      
      const result = await db.one(`
        UPDATE agents 
        SET rebate_percentage = $1, rebate_mode = $2, max_rebate_percentage = $3 
        WHERE id = $4 
        RETURNING *
      `, [rebate_percentage, rebate_mode, max_rebate_percentage, id]);
      
      return result;
    } catch (error) {
      console.error('更新代理退水設定出錯:', error);
      throw error;
    }
  },

  // 物理刪除代理（不可恢復）
  async delete(id) {
    try {
      const result = await db.result(`
        DELETE FROM agents WHERE id = $1
      `, [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('物理刪除代理出錯:', error);
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
    const { username, password, agent_id, balance = 0, notes, market_type, betting_limit_level } = memberData;
    
    try {
      // 如果沒有指定盤口類型或限紅等級，從代理繼承
      let finalMarketType = market_type;
      let finalBettingLimitLevel = betting_limit_level || 'level1';
      
      if ((!finalMarketType || !betting_limit_level) && agent_id) {
        const agent = await AgentModel.findById(agent_id);
        if (agent) {
          finalMarketType = finalMarketType || agent.market_type || 'D';
          
          // 如果有指定限紅等級，需要檢查是否不超過代理的限紅等級
          if (betting_limit_level) {
            const levelOrder = {
              'level1': 1,  // 新手
              'level2': 2,  // 一般
              'level3': 3,  // 標準
              'level4': 4,  // 高級
              'level5': 5,  // VIP
              'level6': 6   // VVIP
            };
            
            const agentLevel = levelOrder[agent.betting_limit_level || 'level3'] || 3;
            const requestedLevel = levelOrder[betting_limit_level] || 1;
            
            // 如果請求的等級超過代理的等級，使用代理的等級
            if (requestedLevel > agentLevel) {
              finalBettingLimitLevel = agent.betting_limit_level || 'level3';
            } else {
              finalBettingLimitLevel = betting_limit_level;
            }
          } else {
            // 如果沒有指定限紅等級，使用代理的限紅等級或預設值
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
      // 使用新的原子性更新函數
      const result = await db.one(`
        SELECT * FROM atomic_update_member_balance($1, $2)
      `, [username, amount]);
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      // 記錄交易 - 修復交易類型分類
      const member = await this.findByUsername(username);
      if (member) {
        await db.none(`
          INSERT INTO transaction_records 
          (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['member', member.id, amount, amount > 0 ? 'game_win' : 'game_bet', 
            result.before_balance, result.balance, '會員點數調整']);
      }
      
      return {
        ...member,
        balance: result.balance
      };
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
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
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
  },

  // 客服專用: 直接設置會員餘額
  async setBalanceByCustomerService(memberUsername, newBalance, description = '客服調整餘額') {
    try {
      // 獲取當前餘額
      const member = await this.findByUsername(memberUsername);
      if (!member) throw new Error('會員不存在');
      
      const beforeBalance = parseFloat(member.balance);
      const afterBalance = parseFloat(newBalance);
      const difference = afterBalance - beforeBalance;
      
      // 確保餘額不會小於0
      if (afterBalance < 0) throw new Error('會員餘額不能小於0');
      
      // 更新餘額
      const updatedMember = await db.one(`
        UPDATE members 
        SET balance = $1 
        WHERE username = $2 
        RETURNING *
      `, [afterBalance, memberUsername]);
      
      // 記錄客服操作交易
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
      console.error('客服設置會員餘額出錯:', error);
      throw error;
    }
  },

  // 更新會員密碼
  async updatePassword(id, newPassword) {
    try {
      const member = await this.findById(id);
      if (!member) throw new Error('會員不存在');
      
      // 更新密碼（後端會自動加密）
      const result = await db.one(`
        UPDATE members 
        SET password = $1 
        WHERE id = $2 
        RETURNING *
      `, [newPassword, id]);
      
      return result;
    } catch (error) {
      console.error('更新會員密碼出錯:', error);
      throw error;
    }
  },

  // 物理刪除會員（不可恢復）
  async delete(id) {
    try {
      const result = await db.result(`
        DELETE FROM members WHERE id = $1
      `, [id]);
      return result.rowCount > 0;
    } catch (error) {
      console.error('物理刪除會員出錯:', error);
      throw error;
    }
  }
};

// 模型: 點數轉移
const PointTransferModel = {
  // 從代理轉移點數到會員
  async transferFromAgentToMember(agentId, memberId, amount, description = '', isCustomerServiceOperation = false) {
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
        
        // 只有客服操作才記錄到transaction_records表
        console.log(`🔍 transferFromAgentToMember: isCustomerServiceOperation=${isCustomerServiceOperation}`);
        if (isCustomerServiceOperation) {
          console.log(`✅ 客服操作：記錄代理交易記錄`);
          // 記錄代理的交易（客服操作使用cs_withdraw表示代理向會員轉出點數）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['agent', agentId, -parsedAmount, 'cs_withdraw', agentBeforeBalance, agentAfterBalance, description || '客服會員存款操作']);
          
          console.log(`✅ 客服操作：記錄會員交易記錄`);
          // 記錄會員的交易（客服操作使用cs_deposit表示會員收到點數）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['member', memberId, parsedAmount, 'cs_deposit', memberBeforeBalance, memberAfterBalance, description || '客服會員存款操作']);
        } else {
          console.log(`❌ 非客服操作：不記錄transaction_records`);
        }
        
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
  async transferFromMemberToAgent(memberId, agentId, amount, description = '', isCustomerServiceOperation = false) {
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
        
        // 只有客服操作才記錄到transaction_records表
        if (isCustomerServiceOperation) {
          // 記錄會員的交易（客服操作使用cs_withdraw表示會員轉出點數）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['member', memberId, -parsedAmount, 'cs_withdraw', memberBeforeBalance, memberAfterBalance, description || '客服會員提款操作']);
          
          // 記錄代理的交易（客服操作使用cs_deposit表示代理收到點數）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['agent', agentId, parsedAmount, 'cs_deposit', agentBeforeBalance, agentAfterBalance, description || '客服會員提款操作']);
        }
        
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
  
  // 從代理轉移點數到代理
  async transferFromAgentToAgent(fromAgentId, toAgentId, amount, description = '', isCustomerServiceOperation = false) {
    try {
      // 參數驗證
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('轉移的點數必須大於0');
      }
      
      // 獲取兩個代理的信息
      const fromAgent = await AgentModel.findById(fromAgentId);
      if (!fromAgent) throw new Error('轉出代理不存在');
      
      const toAgent = await AgentModel.findById(toAgentId);
      if (!toAgent) throw new Error('轉入代理不存在');
      
      // 檢查轉出代理餘額是否足夠
      if (parseFloat(fromAgent.balance) < parsedAmount) {
        throw new Error('轉出代理點數不足');
      }
      
      // 開始數據庫事務
      return await db.tx(async t => {
        // 更新轉出代理餘額
        const fromAgentBeforeBalance = parseFloat(fromAgent.balance);
        const fromAgentAfterBalance = fromAgentBeforeBalance - parsedAmount;
        
        await t.one(`
          UPDATE agents 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [fromAgentAfterBalance, fromAgentId]);
        
        // 更新轉入代理餘額
        const toAgentBeforeBalance = parseFloat(toAgent.balance);
        const toAgentAfterBalance = toAgentBeforeBalance + parsedAmount;
        
        const updatedToAgent = await t.one(`
          UPDATE agents 
          SET balance = $1 
          WHERE id = $2 
          RETURNING *
        `, [toAgentAfterBalance, toAgentId]);
        
        // 只有客服操作才記錄到transaction_records表
        if (isCustomerServiceOperation) {
          // 記錄轉出代理的交易（客服操作使用cs_withdraw表示從該代理提款）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['agent', fromAgentId, -parsedAmount, 'cs_withdraw', fromAgentBeforeBalance, fromAgentAfterBalance, description || '客服轉移操作']);
          
          // 記錄轉入代理的交易（客服操作使用cs_deposit表示為該代理存款）
          await t.none(`
            INSERT INTO transaction_records 
            (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, ['agent', toAgentId, parsedAmount, 'cs_deposit', toAgentBeforeBalance, toAgentAfterBalance, description || '客服轉移操作']);
        }
        
        // 記錄點數轉移
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
      console.error('代理間轉移點數出錯:', error);
      throw error;
    }
  },
  
  // 獲取點數轉移記錄
  async getTransferRecords(userType, userId, limit = 50) {
    try {
      // 更新SQL查詢以JOIN agents 和 members 表來獲取用戶名
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
      console.error('獲取點數轉移記錄出錯:', error);
      throw error;
    }
  }
};

// 模型: 公告
const NoticeModel = {
  // 獲取所有公告
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
      console.error('獲取公告出錯:', error);
      throw error;
    }
  },
  
  // 獲取公告分類列表
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
      console.error('獲取公告分類出錯:', error);
      return ['最新公告', '維修', '活動']; // 返回默認分類
    }
  },
  
  // 創建公告
  async create(title, content, category = '最新公告') {
    try {
      return await db.one(`
        INSERT INTO notices (title, content, category) 
        VALUES ($1, $2, $3) 
        RETURNING *
      `, [title, content, category]);
    } catch (error) {
      console.error('創建公告出錯:', error);
      throw error;
    }
  },
  
  // 根據ID獲取公告
  async findById(id) {
    try {
      return await db.oneOrNone(`
        SELECT * FROM notices WHERE id = $1 AND status = 1
      `, [id]);
    } catch (error) {
      console.error('獲取公告出錯:', error);
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
      console.error('更新公告出錯:', error);
      throw error;
    }
  },
  
  // 刪除公告（軟刪除）
  async delete(id) {
    try {
      return await db.one(`
        UPDATE notices 
        SET status = 0
        WHERE id = $1 AND status = 1
        RETURNING *
      `, [id]);
    } catch (error) {
      console.error('刪除公告出錯:', error);
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
      console.error('創建交易記錄出錯:', error);
      throw error;
    }
  },
  
  // 獲取用戶的交易記錄
  async getByUserId(userType, userId, limit = 50) {
    try {
      return await db.any(`
        SELECT * FROM transaction_records 
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
      
      // 計算今日所有交易總額（包括代理和會員的所有轉帳）
      try {
        // 查詢真實的下注統計數據（包含所有下線代理的會員）
        const betStatsResult = await db.oneOrNone(`
          WITH RECURSIVE agent_hierarchy AS (
            -- 起始：目標代理本身
            SELECT id FROM agents WHERE id = $1
            UNION ALL
            -- 遞歸：所有下級代理
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
        
        // 計算代理盈虧分解
        const agentEarnings = agentProfit > 0 ? agentProfit : 0;  // 代理盈利（會員虧損）
        const agentLosses = agentProfit < 0 ? Math.abs(agentProfit) : 0;  // 代理虧損（會員盈利）
        const netRevenue = agentProfit;  // 淨收益
        
        // 獲取今日活躍會員數（包含所有下線代理的會員）
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
        
        // 獲取下級代理數量
        const subAgentsResult = await db.oneOrNone(`
          SELECT COUNT(*) as count 
          FROM agents 
          WHERE parent_id = $1 AND status = 1
        `, [parsedAgentId]);
        
        const subAgentsCount = parseInt(subAgentsResult ? subAgentsResult.count : 0);
        
        console.log(`獲取代理統計: 成功獲取 ID=${parsedAgentId} 的統計數據`);
        
        return {
          totalDeposit: agentEarnings,        // 代理盈利（會員虧損）
          totalWithdraw: agentLosses,         // 代理虧損（會員盈利）
          totalRevenue: netRevenue,           // 淨收益
          totalTransactions: totalBetAmount,  // 總投注金額
          totalBets: totalBets,               // 總投注筆數
          memberCount: memberIds.length,      // 總會員數
          activeMembers,                      // 活躍會員數
          subAgentsCount                      // 下級代理數
        };
      } catch (queryError) {
        console.error('獲取代理統計 - 查詢錯誤:', queryError);
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
      console.error('獲取代理統計出錯:', error);
      // 出錯時返回默認值
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
    
    // 先嘗試查詢代理
    const agent = await AgentModel.findByUsername(username);
    
    if (agent) {
      // 檢查密碼
      let isValidPassword = false;
      
      // 檢查密碼是否已經是 bcrypt hash
      if (agent.password.startsWith('$2b$') || agent.password.startsWith('$2a$')) {
        // 使用 bcrypt 驗證
        isValidPassword = await bcrypt.compare(password, agent.password);
      } else {
        // 明文密碼直接比較（向後兼容）
        isValidPassword = (agent.password === password);
      }
      
      if (!isValidPassword) {
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
      
      user = agent;
    } else {
      // 如果不是代理，嘗試查詢子帳號
      const subAccount = await db.oneOrNone(`
        SELECT sa.*, a.username as parent_agent_username, a.id as parent_agent_id, a.level as parent_agent_level
        FROM sub_accounts sa
        JOIN agents a ON sa.parent_agent_id = a.id
        WHERE sa.username = $1
      `, [username]);
      
      if (!subAccount) {
        return res.json({
          success: false,
          message: '帳號不存在'
        });
      }
      
      // 驗證密碼
      const isValidPassword = await bcrypt.compare(password, subAccount.password);
      if (!isValidPassword) {
        return res.json({
          success: false,
          message: '密碼錯誤'
        });
      }
      
      // 檢查狀態
      if (subAccount.status !== 1) {
        return res.json({
          success: false,
          message: '子帳號已被停用'
        });
      }
      
      // 更新最後登入時間
      await db.none(`
        UPDATE sub_accounts 
        SET last_login = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [subAccount.id]);
      
      // 設置 user 為子帳號，但使用父代理的基本信息
      console.log('子帳號登入 - 查詢結果:', {
        subAccountUsername: subAccount.username,
        parentAgentId: subAccount.parent_agent_id,
        parentAgentLevel: subAccount.parent_agent_level,
        parentAgentUsername: subAccount.parent_agent_username
      });
      
      // 獲取父代理的完整信息
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
        level: parentAgent.level, // 使用父代理的等級
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
    
    // 獲取請求信息
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'] || '';
    
    // 檢查可疑活動
    const isSuspicious = await SessionManager.checkSuspiciousActivity(ipAddress);
    if (isSuspicious) {
      console.warn(`🚨 檢測到可疑登入活動 - IP: ${ipAddress}, 代理: ${username}`);
      // 可以選擇阻止登入或記錄警告
    }
    
    // 創建會話（這會自動登出其他裝置的會話）
    const sessionToken = await SessionManager.createSession('agent', user.id, ipAddress, userAgent);
    
    // 生成向後兼容的token
    const legacyToken = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');
    
    // 記錄登錄日誌
    try {
      // 簡單的IP歸屬地判斷
      let ipLocation = '未知地區';
      if (ipAddress) {
        if (ipAddress.includes('127.0.0.1') || ipAddress.includes('::1')) {
          ipLocation = '本地開發環境';
        } else if (ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.') || ipAddress.startsWith('172.')) {
          ipLocation = '內網地址';
        } else {
          // 這裡可以接入真實的IP歸屬地查詢服務
          ipLocation = '台灣省'; // 預設值
        }
      }
      
      await db.none(`
        INSERT INTO user_login_logs (username, user_type, login_time, ip_address, ip_location, user_agent, session_token)
        VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6)
      `, [username, isSubAccount ? 'subaccount' : 'agent', ipAddress, ipLocation, userAgent, sessionToken]);
      
      console.log(`📝 登錄日誌已記錄: ${username}, IP: ${ipAddress}`);
    } catch (logError) {
      console.error('記錄登錄日誌失敗:', logError);
      // 登錄日誌失敗不影響登錄流程
    }
    
    console.log(`✅ ${isSubAccount ? '子帳號' : '代理'}登入成功: ${username} (ID: ${user.id}), IP: ${ipAddress}`);
    
    // 在返回之前記錄將要發送的數據
    const responseAgent = {
      id: user.id,
      username: user.username,
      level: user.level,
      balance: user.balance,
      commission_balance: user.commission_balance,
      rebate_percentage: user.rebate_percentage,
      max_rebate_percentage: user.max_rebate_percentage,
      rebate_mode: user.rebate_mode,
      market_type: user.market_type || 'D', // 添加盤口類型
      betting_limit_level: user.betting_limit_level || 'level3', // 添加限紅等級
      is_sub_account: user.is_sub_account || false // 添加子帳號標記
    };
    
    console.log('登入響應 - 即將發送的代理數據:', {
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
      sessionToken: sessionToken // 新的會話token
    });
  } catch (error) {
    console.error('代理登入出錯:', error);
    console.error('錯誤堆疊:', error.stack);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 代理會話檢查API
app.get(`${API_PREFIX}/check-session`, async (req, res) => {
  try {
    const sessionToken = req.headers['x-session-token'] || req.query.sessionToken;
    const legacyToken = req.headers['authorization']?.replace('Bearer ', '');
    
    if (sessionToken) {
      // 使用新的會話管理系統驗證
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
      // 向後兼容舊的token系統
      console.log('使用舊版token檢查代理會話');
      return res.json({ 
        success: true, 
        message: 'Legacy session valid',
        isAuthenticated: true 
      });
    } else {
      // 沒有會話憑證
      return res.json({ 
        success: false, 
        message: 'No session found',
        needLogin: true,
        isAuthenticated: false,
        reason: 'no_token'
      });
    }
  } catch (error) {
    console.error('代理會話檢查錯誤:', error);
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
    console.error('代理登出錯誤:', error);
    res.json({
      success: true, // 即使出錯也返回成功，因為登出應該總是成功
      message: '登出成功'
    });
  }
});

// 創建代理 - 修改路由名稱
app.post(`${API_PREFIX}/create-agent`, async (req, res) => {
  const { username, password, level, parent, commission_rate, rebate_mode, rebate_percentage, notes, market_type } = req.body;
  
  try {
    // 驗證用戶名格式（只允許英文、數字）
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!username || !usernameRegex.test(username)) {
      return res.json({
        success: false,
        message: '用戶名只能包含英文字母和數字'
      });
    }
    
    // 驗證密碼長度（至少6碼）
    if (!password || password.length < 6) {
      return res.json({
        success: false,
        message: '密碼至少需要6個字符'
      });
    }
    
    // 檢查用戶名是否已存在（檢查代理表、會員表和子帳號表）
    const existingAgent = await AgentModel.findByUsername(username);
    if (existingAgent) {
      return res.json({
        success: false,
        message: '該用戶名已被使用（代理）'
      });
    }
    
    const existingMember = await MemberModel.findByUsername(username);
    if (existingMember) {
      return res.json({
        success: false,
        message: '該用戶名已被使用（會員）'
      });
    }
    
    // 檢查子帳號表
    const existingSubAccount = await db.oneOrNone(`
      SELECT id FROM sub_accounts WHERE username = $1
    `, [username]);
    
    if (existingSubAccount) {
      return res.json({
        success: false,
        message: '該用戶名已被使用（子帳號）'
      });
    }
    
    // 驗證代理級別範圍 (0-15)
    const parsedLevel = parseInt(level);
    if (isNaN(parsedLevel) || parsedLevel < 0 || parsedLevel > 15) {
      return res.json({
        success: false,
        message: '代理級別必須在0到15之間'
      });
    }
    
    // 獲取上級代理ID 和 上級代理信息
    let parentId = null;
    let parentAgent = null; 
    let maxRebatePercentage = 0.041; // 預設最大退水比例 4.1%
    
    if (parent) {
      parentAgent = await AgentModel.findById(parent);
      if (!parentAgent) {
        return res.json({
          success: false,
          message: '上級代理不存在'
        });
      }
      parentId = parentAgent.id;
      
      // 修改驗證邏輯：代理級別必須恰好比上級代理高1級
      if (parsedLevel !== parentAgent.level + 1) {
        return res.json({
          success: false,
          message: `必須嚴格按照代理層級結構創建，${parentAgent.level}級代理只能創建${parentAgent.level + 1}級代理`
        });
      }
      
      // 驗證佣金比例是否合理
      if (parseFloat(commission_rate) > parentAgent.commission_rate) {
          return res.json({
              success: false,
              message: '下級代理的佣金比例不能高於上級代理'
          });
      }

      // 設定最大退水比例
      // 如果上級是總代理（level 0），根據新代理的盤口類型決定最大退水
      if (parentAgent.level === 0) {
        // 總代理創建下級時，根據新代理的盤口類型決定最大退水
        maxRebatePercentage = market_type === 'A' ? 0.011 : 0.041;
      } else {
        // 一般代理創建下級時，不能超過自己的退水比例
        maxRebatePercentage = parentAgent.rebate_percentage || 0.041;
      }
      
      // 驗證限紅等級
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
            message: `不能設定高於上級代理限紅等級(${parentBettingLevel})的限紅等級`
          });
        }
      }
    } else {
         // 如果沒有指定上級，檢查是否正在創建總代理
         if (parsedLevel !== 0) {
              return res.json({
                success: false,
                message: '只有總代理可以沒有上級'
              })
         }
    }
    
    // 處理退水設定
    let finalRebatePercentage = 0.041;
    let finalRebateMode = rebate_mode || 'percentage';
    
    if (rebate_mode === 'all') {
      // 全拿退水：上級代理（本代理）拿走所有退水，下級代理拿0%
      finalRebatePercentage = 0;
    } else if (rebate_mode === 'none') {
      // 全退下級：上級代理（本代理）不拿退水，下級代理拿最大值
      finalRebatePercentage = maxRebatePercentage;
    } else if (rebate_mode === 'percentage' && rebate_percentage !== undefined) {
      // 按比例分配：下級代理拿設定的比例，其餘歸上級代理
      const parsedRebatePercentage = parseFloat(rebate_percentage);
      if (isNaN(parsedRebatePercentage) || parsedRebatePercentage < 0 || parsedRebatePercentage > maxRebatePercentage) {
        return res.json({
          success: false,
          message: `退水比例必須在 0% - ${(maxRebatePercentage * 100).toFixed(1)}% 之間`
        });
      }
      finalRebatePercentage = parsedRebatePercentage;
    }
    
    // 處理盤口類型繼承邏輯 - 必須繼承上級代理的盤口類型
    let finalMarketType = 'D'; // 預設D盤
    
    // 如果有上級代理，必須繼承其盤口類型
    if (parentAgent) {
      finalMarketType = parentAgent.market_type || 'D';
      
      // 驗證傳入的盤口類型必須與上級代理一致
      if (market_type && market_type !== finalMarketType) {
        return res.json({
          success: false,
          message: `必須使用與上級代理相同的盤口類型（${finalMarketType}盤）`
        });
      }
    } else {
      // 創建總代理時，使用傳入的盤口類型
      finalMarketType = market_type || 'D';
    }
    
    // 創建代理 - 限紅等級需要參考父代理的限紅等級
    let finalBettingLimitLevel = req.body.betting_limit_level || 'level3';
    
    // 如果有父代理，限紅等級不能超過父代理
    if (parentAgent) {
      const levelOrder = {
        'level1': 1,  // 新手
        'level2': 2,  // 一般
        'level3': 3,  // 標準
        'level4': 4,  // 高級
        'level5': 5,  // VIP
        'level6': 6   // VVIP
      };
      
      const parentLevel = levelOrder[parentAgent.betting_limit_level || 'level3'] || 3;
      const requestedLevel = levelOrder[req.body.betting_limit_level] || 3;
      
      // 如果請求的等級超過父代理的等級，使用父代理的等級
      if (requestedLevel > parentLevel) {
        finalBettingLimitLevel = parentAgent.betting_limit_level || 'level3';
        console.log(`⚠️ 代理 ${username} 請求的限紅等級 ${req.body.betting_limit_level} 超過父代理 ${parentAgent.username} 的限紅等級 ${parentAgent.betting_limit_level}，已調整為 ${finalBettingLimitLevel}`);
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
    console.error('創建代理出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 更新代理退水設定
app.put(`${API_PREFIX}/update-rebate-settings/:agentId`, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { rebate_mode, rebate_percentage } = req.body;
    
    console.log('🔧 更新退水設定請求:', {
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
    
    // 獲取代理資訊
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    console.log('📋 原始代理資料:', {
      id: agent.id,
      username: agent.username,
      rebate_mode: agent.rebate_mode,
      rebate_percentage: agent.rebate_percentage,
      max_rebate_percentage: agent.max_rebate_percentage
    });
    
    // 處理退水設定
    let finalRebatePercentage = agent.rebate_percentage;
    let finalRebateMode = rebate_mode || agent.rebate_mode;
    const maxRebatePercentage = agent.max_rebate_percentage || 0.041;
    
    if (rebate_mode === 'all') {
      // 全拿退水：上級代理（本代理）拿走所有退水，下級代理拿0%
      finalRebatePercentage = 0;
    } else if (rebate_mode === 'none') {
      // 全退下級：上級代理（本代理）不拿退水，下級代理拿最大值
      finalRebatePercentage = maxRebatePercentage;
    } else if (rebate_mode === 'percentage' && rebate_percentage !== undefined) {
      // 按比例分配：下級代理拿設定的比例，其餘歸上級代理
      const parsedRebatePercentage = parseFloat(rebate_percentage);
      if (isNaN(parsedRebatePercentage) || parsedRebatePercentage < 0 || parsedRebatePercentage > maxRebatePercentage) {
        return res.json({
          success: false,
          message: `退水比例必須在 0% - ${(maxRebatePercentage * 100).toFixed(1)}% 之間`
        });
      }
      finalRebatePercentage = parsedRebatePercentage;
    }
    
    console.log('🎯 最終設定:', {
      finalRebateMode,
      finalRebatePercentage,
      maxRebatePercentage
    });
    
    // 更新退水設定
    const updatedAgent = await AgentModel.updateRebateSettings(agentId, {
      rebate_percentage: finalRebatePercentage,
      rebate_mode: finalRebateMode,
      max_rebate_percentage: maxRebatePercentage
    });
    
    console.log('✅ 更新後的代理資料:', {
      id: updatedAgent.id,
      username: updatedAgent.username,
      rebate_mode: updatedAgent.rebate_mode,
      rebate_percentage: updatedAgent.rebate_percentage,
      max_rebate_percentage: updatedAgent.max_rebate_percentage
    });
    
    // 執行級聯更新 - 調整所有下級代理的退水設定
    console.log('🔗 開始級聯更新下級代理退水設定...');
    
    // 遞迴函數：調整下級代理的退水設定
    async function adjustDownlineRebateSettings(parentAgentId, maxRebatePercentage) {
      // 獲取該代理的所有直接下級代理
      const childAgents = await db.any(`
        SELECT id, username, rebate_percentage, max_rebate_percentage 
        FROM agents 
        WHERE parent_id = $1 AND status = 1
      `, [parentAgentId]);
      
      for (const childAgent of childAgents) {
        const currentRebate = parseFloat(childAgent.rebate_percentage);
        const currentMaxRebate = parseFloat(childAgent.max_rebate_percentage);
        
        // 如果下級代理的退水超過上級的新限制，則調整為上級的限制
        if (currentRebate > maxRebatePercentage || currentMaxRebate > maxRebatePercentage) {
          const newRebate = Math.min(currentRebate, maxRebatePercentage);
          const newMaxRebate = maxRebatePercentage;
          
          await db.none(`
            UPDATE agents 
            SET rebate_percentage = $1, max_rebate_percentage = $2, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $3
          `, [newRebate, newMaxRebate, childAgent.id]);
          
          console.log(`  - 調整下級代理 ${childAgent.username} 的退水: ${(currentRebate * 100).toFixed(1)}% -> ${(newRebate * 100).toFixed(1)}%`);
          
          // 記錄調整日誌
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
            `退水設定連鎖調整: ${(currentRebate * 100).toFixed(1)}% -> ${(newRebate * 100).toFixed(1)}% (因上級代理 ${agent.username} 退水調整)`
          ]);
        }
        
        // 遞迴處理此代理的下級
        await adjustDownlineRebateSettings(childAgent.id, maxRebatePercentage);
      }
    }
    
    // 開始連鎖調整
    await adjustDownlineRebateSettings(agentId, finalRebatePercentage);
    
    console.log(`連鎖調整完成`);
    
    res.json({
      success: true,
      message: '退水設定更新成功',
      agent: {
        id: updatedAgent.id,
        username: updatedAgent.username,
        rebate_percentage: updatedAgent.rebate_percentage,
        rebate_mode: updatedAgent.rebate_mode,
        max_rebate_percentage: updatedAgent.max_rebate_percentage
      }
    });
    
  } catch (error) {
    console.error('更新代理退水設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新退水設定失敗',
      error: error.message
    });
  }
});

// 獲取會員的代理鏈
app.get(`${API_PREFIX}/member-agent-chain`, async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.json({
        success: false,
        message: '缺少會員用戶名'
      });
    }
    
    // 獲取會員資訊
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 獲取代理鏈
    const agentChain = await getAgentChainForMember(member.agent_id);
    
    res.json({
      success: true,
      agentChain: agentChain
    });
  } catch (error) {
    console.error('獲取會員代理鏈錯誤:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤'
    });
  }
});

// 分配退水給代理
app.post(`${API_PREFIX}/allocate-rebate`, async (req, res) => {
  try {
    const { agentId, agentUsername, rebateAmount, memberUsername, betAmount, reason, period } = req.body;
    
    console.log(`收到退水分配請求: 代理=${agentUsername}(${agentId}), 退水金額=${rebateAmount}, 會員=${memberUsername}, 下注=${betAmount}`);
    
    if (!agentId || !rebateAmount || rebateAmount <= 0) {
      console.warn('無效的退水分配請求:', { agentId, rebateAmount });
      return res.json({
        success: false,
        message: '無效的退水分配請求'
      });
    }
    
    // 驗證退水金額是否合理（防止異常大額）
    const maxReasonableRebate = parseFloat(betAmount) * 0.1; // 最多10%下注金額作為安全閾值
    if (parseFloat(rebateAmount) > maxReasonableRebate) {
      console.error(`退水金額異常: ${rebateAmount} 超過安全閾值 ${maxReasonableRebate}`);
      return res.json({
        success: false,
        message: '退水金額異常，請檢查計算邏輯'
      });
    }
    
    // 獲取代理資訊
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 保證金額精度，四捨五入到小數點後2位
    const roundedRebateAmount = Math.round(parseFloat(rebateAmount) * 100) / 100;
    
    // 計算退水比例
    const rebatePercentage = parseFloat(betAmount) > 0 ? roundedRebateAmount / parseFloat(betAmount) : 0;
    
    const beforeBalance = parseFloat(agent.balance);
    const afterBalance = beforeBalance + roundedRebateAmount;
    
    // 增加代理餘額
    await db.none(`UPDATE agents SET balance = $1 WHERE id = $2`, [afterBalance, agentId]);
    
    // 記錄詳細的退水交易記錄（包含會員信息）
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
      `退水收入 - ${memberUsername || '未知會員'}`, 
      memberUsername || null,
      parseFloat(betAmount) || 0,
      rebatePercentage,
      period ? String(period) : null
    ]);
    
    // 獲取更新後的代理資訊
    const updatedAgent = await AgentModel.findById(agentId);
    
    console.log(`成功分配退水 ${roundedRebateAmount} 給代理 ${agentUsername}，新餘額: ${updatedAgent.balance}`);
    
    res.json({
      success: true,
      message: '退水分配成功'
    });
  } catch (error) {
    console.error('分配退水錯誤:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤'
    });
  }
});

// 獲取投注記錄的佔成明細（代理鏈）
async function getCommissionDetailsForBet(memberUsername, betAmount) {
  try {
    console.log(`🔍 查詢會員 ${memberUsername} 的佔成明細...`);
    
    // 首先查找會員所屬的代理
    const member = await db.oneOrNone(`
      SELECT m.id, m.username, m.agent_id, a.username as agent_username, a.level, a.rebate_percentage, a.parent_id
      FROM members m
      LEFT JOIN agents a ON m.agent_id = a.id
      WHERE m.username = $1
    `, [memberUsername]);

    console.log(`👤 會員查詢結果:`, member);

    if (!member || !member.agent_id) {
      console.log(`⚠️ 會員 ${memberUsername} 不存在或沒有綁定代理`);
      return []; // 如果會員不存在或沒有綁定代理，返回空陣列
    }

    const commissionDetails = [];
    let currentAgentId = member.agent_id;
    let level = 1;

    console.log(`🔗 開始遍歷代理鏈，起始代理ID: ${currentAgentId}`);

    // 從會員的直屬代理開始，向上遍歷代理鏈
    while (currentAgentId && level <= 15) { // 限制最多15級，避免無限循環
      console.log(`🔄 查詢代理 ID: ${currentAgentId}, 層級: ${level}`);
      
      const agent = await db.oneOrNone(`
        SELECT id, username, level, rebate_percentage, commission_rate, parent_id
        FROM agents 
        WHERE id = $1 AND status = 1
      `, [currentAgentId]);

      console.log(`👥 代理查詢結果:`, agent);

      if (!agent) {
        console.log(`⚠️ 代理ID ${currentAgentId} 不存在或已停用`);
        break;
      }

      // 計算這個代理的退水率（這裡使用簡單的邏輯，實際可能更複雜）
      const rebateRate = parseFloat(agent.rebate_percentage) || 0.038; // 預設3.8%
      const commissionRate = 0.0; // 佔成固定為 0%

      // 格式化代理級別名稱
      const levelNames = ['總代理', '一級代理', '二級代理', '三級代理', '四級代理', '五級代理', 
                         '六級代理', '七級代理', '八級代理', '九級代理', '十級代理', 
                         '十一級代理', '十二級代理', '十三級代理', '十四級代理', '十五級代理'];
      
      const agentType = levelNames[agent.level] || `${agent.level}級代理`;

      const detail = {
        id: agent.id,
        agent_type: agentType,
        username: agent.username,
        commission_rate: commissionRate, // 固定為 0
        rebate_rate: rebateRate,
        level: agent.level
      };
      
      console.log(`✅ 添加代理明細:`, detail);
      commissionDetails.push(detail);

      // 移動到上級代理
      currentAgentId = agent.parent_id;
      level++;
      console.log(`⬆️ 下個查詢代理 ID: ${currentAgentId}`);
    }

    console.log(`📊 最終佔成明細 (共 ${commissionDetails.length} 級):`, commissionDetails);
    return commissionDetails;
  } catch (error) {
    console.error(`❌ 獲取會員 ${memberUsername} 佔成明細時發生錯誤:`, error);
    return [];
  }
}

// 獲取代理鏈的輔助函數
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
        market_type: agent.market_type || 'D'  // 添加 market_type，預設為 D 盤
      });
      
      // 移動到上級代理
      currentAgentId = agent.parent_id;
    }
    
    return agentChain;
  } catch (error) {
    console.error('獲取代理鏈時發生錯誤:', error);
    return [];
  }
}

// 檢查代理是否有權限對會員進行操作（檢查是否為上級代理）
async function canAgentManageMember(agentId, memberId) {
  try {
    // 獲取會員信息
    const member = await MemberModel.findById(memberId);
    if (!member) return false;
    
    // 如果代理直接創建了這個會員，當然有權限
    if (member.agent_id === agentId) return true;
    
    // 獲取會員的代理鏈（從會員的直接代理開始，往上級查找）
    const agentChain = await getAgentChainForMember(member.agent_id);
    
    // 檢查當前代理是否在會員的代理鏈中（即是否為上級代理）
    return agentChain.some(chainAgent => chainAgent.id === agentId);
  } catch (error) {
    console.error('檢查代理權限時發生錯誤:', error);
    return false;
  }
}

// 檢查代理是否有權限對另一個代理進行操作（檢查是否為上級代理）
async function canAgentManageAgent(parentAgentId, subAgentId) {
  try {
    // 獲取下級代理信息
    const subAgent = await AgentModel.findById(subAgentId);
    if (!subAgent) return false;
    
    // 如果是直接下級，當然有權限
    if (subAgent.parent_id === parentAgentId) return true;
    
    // 獲取下級代理的代理鏈（從下級代理開始，往上級查找）
    const agentChain = await getAgentChainForAgent(subAgentId);
    
    // 檢查當前代理是否在下級代理的代理鏈中（即是否為上級代理）
    return agentChain.some(chainAgent => chainAgent.id === parentAgentId);
  } catch (error) {
    console.error('檢查代理層級權限時發生錯誤:', error);
    return false;
  }
}

// 獲取代理的代理鏈（從指定代理開始往上級查找）
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
      
      // 移動到上級代理
      currentAgentId = agent.parent_id;
    }
    
    return agentChain;
  } catch (error) {
    console.error('獲取代理鏈時發生錯誤:', error);
    return [];
  }
}

// 獲取會員的代理鏈
app.get(`${API_PREFIX}/member-agent-chain`, async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.json({
        success: false,
        message: '請提供會員用戶名'
      });
    }
    
    // 查找會員
    const member = await db.oneOrNone(`
      SELECT id, username, agent_id
      FROM members 
      WHERE username = $1
    `, [username]);
    
    if (!member) {
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 獲取代理鏈
    const agentChain = await getAgentChainForMember(member.agent_id);
    
    res.json({
      success: true,
      agentChain: agentChain
    });
  } catch (error) {
    console.error('獲取會員代理鏈錯誤:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤'
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

// 輸贏控制相關API
  
// 檢查操作權限 - 只有特定的總代理帳號可以使用
const checkWinLossControlPermission = (agent) => {
  // 舊帳號名稱（為了相容性）
  const legacyUsernames = ['ti2025A', 'ti2025D'];
  // 新帳號名稱
  const newUsernames = ['MA@x9Kp#2025$zL7', 'MD@y7Rw#2025$qX4'];
  
  return legacyUsernames.includes(agent.username) || newUsernames.includes(agent.username);
};

// 安全記錄輸贏控制日誌的函數
async function safeLogWinLossControl(controlId, action, oldValues = null, newValues = null, operatorId, operatorUsername) {
  try {
    console.log(`[日誌] 嘗試記錄 ${action} 操作:`, { controlId, operatorId, operatorUsername });
    
    // 確保 JSON 序列化不會失敗
    let oldValuesStr = null;
    let newValuesStr = null;
    
    if (oldValues) {
      try {
        oldValuesStr = JSON.stringify(oldValues);
      } catch (jsonError) {
        console.warn('舊數據 JSON 序列化失敗:', jsonError.message);
        oldValuesStr = JSON.stringify({ error: 'JSON序列化失敗' });
      }
    }
    
    if (newValues) {
      try {
        newValuesStr = JSON.stringify(newValues);
      } catch (jsonError) {
        console.warn('新數據 JSON 序列化失敗:', jsonError.message);
        newValuesStr = JSON.stringify({ error: 'JSON序列化失敗' });
      }
    }
    
    // 刪除操作時使用 NULL 避免外鍵約束
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
    
    console.log(`[日誌] ${action} 操作記錄成功`);
  } catch (logError) {
    console.warn(`記錄輸贏控制日誌失敗 (${action}):`, logError.message);
    console.warn('詳細錯誤:', logError);
    // 日誌失敗不影響主要操作
  }
}

// 獲取輸贏控制列表
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
    
    // 檢查權限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '權限不足，只有總代理可以使用此功能' 
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
    console.error('獲取輸贏控制列表錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 創建輸贏控制
app.post(`${API_PREFIX}/win-loss-control`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 檢查權限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '權限不足，只有總代理可以使用此功能' 
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

    // 🔧 修復CHECK約束錯誤：將空字串轉換為NULL
    const dbTargetType = (target_type === '' || target_type === undefined) ? null : target_type;
    const dbTargetUsername = (target_username === '' || target_username === undefined) ? null : target_username;

    console.log('創建輸贏控制:', { control_mode, target_type: dbTargetType, target_username: dbTargetUsername, control_percentage, win_control, loss_control });

    // 驗證必要參數
    if (!control_mode || !['normal', 'agent_line', 'single_member', 'auto_detect'].includes(control_mode)) {
      return res.status(400).json({ success: false, message: '無效的控制模式' });
    }

    // 驗證控制類型 - 必須選擇贏控制或輸控制其中一種（除了正常機率和自動偵測模式）
    if (control_mode !== 'normal' && control_mode !== 'auto_detect') {
      if (win_control === undefined || loss_control === undefined) {
        return res.status(400).json({ 
          success: false, 
          message: '請選擇控制類型（贏控制或輸控制）' 
        });
      }
      
      if (win_control === loss_control) {
        return res.status(400).json({ 
          success: false, 
          message: win_control ? '不能同時選擇贏控制和輸控制' : '必須選擇贏控制或輸控制其中一種' 
        });
      }
    }
    
    // 自動偵測模式不需要設定贏控制或輸控制
    if (control_mode === 'auto_detect') {
      win_control = false;
      loss_control = false;
    }

    let target_id = null;
    let validated_username = dbTargetUsername;

    // 如果不是正常模式或自動偵測，需要驗證目標
    if (control_mode === 'agent_line' || control_mode === 'single_member') {
      if (!dbTargetType || !dbTargetUsername) {
        return res.status(400).json({ success: false, message: '必須指定目標類型和用戶名' });
      }

      // 驗證目標是否存在
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
          return res.status(400).json({ success: false, message: '找不到指定的會員' });
        }
        target_id = targetMember.id;
        validated_username = targetMember.username;
      }
    }

    // 如果是正常機率模式或自動偵測模式，需要停用所有其他控制設定
    if (control_mode === 'normal' || control_mode === 'auto_detect') {
      await db.none('UPDATE win_loss_control SET is_active = false, updated_at = CURRENT_TIMESTAMP');
      console.log(`✅ ${control_mode === 'normal' ? '正常機率模式' : '自動偵測模式'}：已停用所有其他控制設定`);
    }
    
    // 如果是代理線控制或單會員控制，需要停用正常機率和自動偵測控制
    if (control_mode === 'agent_line' || control_mode === 'single_member') {
      await db.none(`
        UPDATE win_loss_control 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP 
        WHERE control_mode IN ('normal', 'auto_detect') AND is_active = true
      `);
      console.log(`✅ ${control_mode === 'agent_line' ? '代理線控制' : '單會員控制'}：已停用正常機率和自動偵測控制`);
    }

    // 創建新的控制設定
    const newControl = await db.one(`
      INSERT INTO win_loss_control 
      (control_mode, target_type, target_id, target_username, control_percentage, win_control, loss_control, is_active, start_period, operator_id, operator_username)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, $10)
      RETURNING *
    `, [
      control_mode, 
      dbTargetType,  // 🔧 使用轉換後的值，避免空字串
      target_id, 
      validated_username, 
      control_percentage,
      win_control,
      loss_control,
      start_period,
      agent.id, 
      agent.username
    ]);

    // 記錄操作日誌
    await safeLogWinLossControl(newControl.id, 'create', null, newControl, agent.id, agent.username);

    console.log('✅ 輸贏控制創建成功:', newControl);

    res.json({
      success: true,
      message: '輸贏控制設定成功',
      data: newControl
    });
  } catch (error) {
    console.error('創建輸贏控制錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 更新輸贏控制
app.put(`${API_PREFIX}/win-loss-control/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 檢查權限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '權限不足，只有總代理可以使用此功能' 
      });
    }

    const { 
      control_percentage = 50,
      win_control,
      loss_control,
      is_active = true
    } = req.body;

    // 獲取舊資料
    const oldControl = await db.oneOrNone('SELECT * FROM win_loss_control WHERE id = $1', [id]);
    if (!oldControl) {
      return res.status(404).json({ success: false, message: '找不到指定的控制設定' });
    }

    // 驗證控制類型 - 必須選擇贏控制或輸控制其中一種（除了正常機率和自動偵測模式）
    if (oldControl.control_mode !== 'normal' && oldControl.control_mode !== 'auto_detect') {
      const finalWinControl = win_control !== undefined ? win_control : oldControl.win_control;
      const finalLossControl = loss_control !== undefined ? loss_control : oldControl.loss_control;
      
      if (finalWinControl === finalLossControl) {
        return res.status(400).json({ 
          success: false, 
          message: finalWinControl ? '不能同時選擇贏控制和輸控制' : '必須選擇贏控制或輸控制其中一種' 
        });
      }
    }

    // 如果要啟用此控制，先停用其他所有控制
    if (is_active) {
      await db.none('UPDATE win_loss_control SET is_active = false WHERE id != $1', [id]);
    }

    // 使用實際值或保留原值
    const finalWinControl = win_control !== undefined ? win_control : oldControl.win_control;
    const finalLossControl = loss_control !== undefined ? loss_control : oldControl.loss_control;
    
    // 更新控制設定
    const updatedControl = await db.one(`
      UPDATE win_loss_control 
      SET control_percentage = $1, win_control = $2, loss_control = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [control_percentage, finalWinControl, finalLossControl, is_active, id]);

    // 記錄操作日誌
    await safeLogWinLossControl(id, 'update', oldControl, updatedControl, agent.id, agent.username);

    res.json({
      success: true,
      message: '輸贏控制更新成功',
      data: updatedControl
    });
  } catch (error) {
    console.error('更新輸贏控制錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 刪除輸贏控制
app.delete(`${API_PREFIX}/win-loss-control/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 檢查權限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '權限不足，只有總代理可以使用此功能' 
      });
    }

    console.log(`[刪除] 開始刪除控制設定 ID: ${id}`);

    // 獲取要刪除的資料
    const controlToDelete = await db.oneOrNone('SELECT * FROM win_loss_control WHERE id = $1', [id]);
    if (!controlToDelete) {
      console.log(`[刪除] 控制設定 ID ${id} 不存在`);
      return res.status(404).json({ success: false, message: '找不到指定的控制設定' });
    }

    console.log(`[刪除] 找到控制設定:`, controlToDelete);

    // 使用事務確保數據一致性
    try {
      await db.tx(async t => {
        // 先刪除相關的日誌記錄
        const deleteLogCount = await t.result('DELETE FROM win_loss_control_logs WHERE control_id = $1', [id]);
        console.log(`[刪除] 刪除了 ${deleteLogCount.rowCount} 條相關日誌記錄`);
        
        // 再刪除主記錄
        await t.none('DELETE FROM win_loss_control WHERE id = $1', [id]);
        console.log(`[刪除] 主記錄刪除成功 ID: ${id}`);
        
        // 記錄刪除操作（control_id 設為 NULL 避免外鍵約束）
        await t.none(`
          INSERT INTO win_loss_control_logs 
          (control_id, action, old_values, new_values, operator_id, operator_username, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [null, 'delete', JSON.stringify(controlToDelete), null, agent.id, agent.username]);
        console.log(`[刪除] 操作日誌記錄成功`);
      });
    } catch (deleteError) {
      console.error(`[刪除] 刪除過程失敗:`, deleteError);
      throw deleteError;
    }

    res.json({
      success: true,
      message: '輸贏控制刪除成功'
    });
  } catch (error) {
    console.error('刪除輸贏控制錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 內部API - 獲取當前活躍的輸贏控制設定 (遊戲後端專用，無需認證)
app.get(`${API_PREFIX}/internal/win-loss-control/active`, async (req, res) => {
  try {
    // 獲取所有活躍的控制設定
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

    // 如果有多個控制設定，返回數組；為了向後兼容，如果只有一個或沒有，返回單個對象
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
    console.error('獲取活躍輸贏控制錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 獲取當前活躍的輸贏控制設定
app.get(`${API_PREFIX}/win-loss-control/active`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 檢查權限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '權限不足，只有總代理可以使用此功能' 
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
    console.error('獲取活躍輸贏控制錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 獲取代理列表 - 用於輸贏控制目標選擇
app.get(`${API_PREFIX}/win-loss-control/agents`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 檢查權限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '權限不足，只有總代理可以使用此功能' 
      });
    }

    // 獲取所有代理，包含層級信息
    const agents = await db.any(`
      SELECT id, username, level, status, created_at,
        CASE 
          WHEN level = 0 THEN '總代理'
          WHEN level = 1 THEN '一級代理'
          WHEN level = 2 THEN '二級代理'
          WHEN level = 3 THEN '三級代理'
          ELSE level::text || '級代理'
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
    console.error('獲取代理列表錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 獲取會員列表 - 用於輸贏控制目標選擇
app.get(`${API_PREFIX}/win-loss-control/members`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 檢查權限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '權限不足，只有總代理可以使用此功能' 
      });
    }

    // 獲取所有會員，包含創建代理信息
    const members = await db.any(`
      SELECT m.id, m.username, m.status, m.created_at, m.agent_id,
        a.username as agent_username,
        CASE 
          WHEN a.level = 0 THEN '總代理'
          WHEN a.level = 1 THEN '一級代理'
          WHEN a.level = 2 THEN '二級代理'
          WHEN a.level = 3 THEN '三級代理'
          ELSE a.level::text || '級代理'
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
    console.error('獲取會員列表錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 獲取當前期數 - 用於設定控制開始期數
app.get(`${API_PREFIX}/win-loss-control/current-period`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 檢查權限
    if (!checkWinLossControlPermission(agent)) {
      return res.status(403).json({ 
        success: false, 
        message: '權限不足，只有總代理可以使用此功能' 
      });
    }

    // 從資料庫獲取當前期數（優先使用資料庫，因為遊戲系統可能未運行）
    let currentPeriod;
    try {
      // 從result_history表中查詢最新期數（這是實際開獎記錄表）
      const latestDraw = await db.oneOrNone(`
        SELECT period 
        FROM result_history 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      
      if (latestDraw && latestDraw.period) {
        currentPeriod = parseInt(latestDraw.period);
        console.log('從資料庫獲取當前期數:', currentPeriod);
      } else {
        // 如果沒有記錄，使用當天的第一期
        const today = new Date();
        const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
        currentPeriod = parseInt(todayStr + '001');
      }
    } catch (error) {
      console.error('查詢期數錯誤:', error);
      // 使用當天的第一期作為預設值
      const today = new Date();
      const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
      currentPeriod = parseInt(todayStr + '001');
    }
    
    // 使用正確的期數遞增邏輯
    function getNextPeriod(currentPeriod) {
      const today = new Date();
      const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
      
      const currentPeriodStr = currentPeriod.toString();
      
      // 檢查當前期號是否為今天
      if (currentPeriodStr.startsWith(todayStr)) {
        // 提取期號後綴並遞增
        const suffix = parseInt(currentPeriodStr.substring(8)) + 1;
        
        // 如果超過999場，使用4位數字，但保持日期部分不變
        if (suffix > 999) {
          return `${todayStr}${suffix.toString().padStart(4, '0')}`;
        } else {
          return parseInt(`${todayStr}${suffix.toString().padStart(3, '0')}`);
        }
      } else {
        // 新的一天，重置期號為001
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
    console.error('獲取當前期數錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 激活輸贏控制設定
app.put(`${API_PREFIX}/win-loss-control/:id/activate`, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 身份驗證 - 優先使用會話token
    const sessionToken = req.headers['x-session-token'];
    const authHeader = req.headers.authorization;
    
    if (!sessionToken && !authHeader) {
      return res.status(401).json({ success: false, message: '需要身份驗證' });
    }

    let sessionData;
    if (sessionToken) {
      sessionData = await SessionManager.validateSession(sessionToken);
    } else {
      const token = authHeader.split(' ')[1];
      sessionData = await SessionManager.validateSession(token);
    }
    
    if (!sessionData || sessionData.userType !== 'agent') {
      return res.status(401).json({ success: false, message: '無效的會話' });
    }

    const agent = await AgentModel.findById(sessionData.userId);
    if (!agent || !checkWinLossControlPermission(agent)) {
      return res.status(403).json({ success: false, message: '權限不足' });
    }

    // 檢查控制設定是否存在
    const control = await db.oneOrNone('SELECT * FROM win_loss_control WHERE id = $1', [id]);
    if (!control) {
      return res.status(404).json({ success: false, message: '控制設定不存在' });
    }

    // 如果啟用的是正常機率模式或自動偵測模式，需要先停用所有其他控制
    if (control.control_mode === 'normal' || control.control_mode === 'auto_detect') {
      await db.none('UPDATE win_loss_control SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id != $1', [id]);
      console.log(`✅ 啟用${control.control_mode === 'normal' ? '正常機率模式' : '自動偵測模式'}：已停用所有其他控制設定`);
    }
    
    // 如果啟用的是代理線控制或單會員控制，需要停用正常機率和自動偵測控制
    if (control.control_mode === 'agent_line' || control.control_mode === 'single_member') {
      await db.none(`
        UPDATE win_loss_control 
        SET is_active = false, updated_at = CURRENT_TIMESTAMP 
        WHERE control_mode IN ('normal', 'auto_detect') AND is_active = true AND id != $1
      `, [id]);
      console.log(`✅ 啟用${control.control_mode === 'agent_line' ? '代理線控制' : '單會員控制'}：已停用正常機率和自動偵測控制`);
    }

    // 激活指定控制
    await db.none('UPDATE win_loss_control SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
    
    // 如果不是正常機率模式，檢查是否有相同目標的其他活躍控制
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
        console.log(`⚠️ 目標 ${control.target_username} 現在有 ${otherControls.length + 1} 個活躍的控制設定`);
      }
    }

    // 記錄操作日誌
    await safeLogWinLossControl(id, 'activate', null, null, agent.id, agent.username);

    res.json({ success: true, message: '控制設定已激活' });
  } catch (error) {
    console.error('激活控制設定錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 停用輸贏控制設定
app.put(`${API_PREFIX}/win-loss-control/:id/deactivate`, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 身份驗證 - 優先使用會話token
    const sessionToken = req.headers['x-session-token'];
    const authHeader = req.headers.authorization;
    
    if (!sessionToken && !authHeader) {
      return res.status(401).json({ success: false, message: '需要身份驗證' });
    }

    let sessionData;
    if (sessionToken) {
      sessionData = await SessionManager.validateSession(sessionToken);
    } else {
      const token = authHeader.split(' ')[1];
      sessionData = await SessionManager.validateSession(token);
    }
    
    if (!sessionData || sessionData.userType !== 'agent') {
      return res.status(401).json({ success: false, message: '無效的會話' });
    }

    const agent = await AgentModel.findById(sessionData.userId);
    if (!agent || !checkWinLossControlPermission(agent)) {
      return res.status(403).json({ success: false, message: '權限不足' });
    }

    // 檢查控制設定是否存在
    const control = await db.oneOrNone('SELECT * FROM win_loss_control WHERE id = $1', [id]);
    if (!control) {
      return res.status(404).json({ success: false, message: '控制設定不存在' });
    }

    // 停用控制
    await db.none('UPDATE win_loss_control SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    // 記錄操作日誌
    await safeLogWinLossControl(id, 'deactivate', null, null, agent.id, agent.username);

    res.json({ success: true, message: '控制設定已停用' });
  } catch (error) {
    console.error('停用控制設定錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 跑馬燈API
// 獲取跑馬燈訊息
app.get(`${API_PREFIX}/marquee-messages`, async (req, res) => {
  try {
    console.log('獲取跑馬燈訊息');
    
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
    console.error('獲取跑馬燈訊息錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 新增跑馬燈訊息
app.post(`${API_PREFIX}/marquee-messages`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 檢查是否是總代理
    if (agent.level !== 0) {
      return res.status(403).json({ success: false, message: '只有總代理可以設定跑馬燈' });
    }

    const { message, priority = 0 } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: '請提供訊息內容' });
    }

    const result = await db.one(`
      INSERT INTO marquee_messages (message, priority, created_by) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `, [message.trim(), priority, agent.id]);

    res.json({
      success: true,
      message: '跑馬燈訊息已新增',
      data: result
    });
  } catch (error) {
    console.error('新增跑馬燈訊息錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 更新跑馬燈訊息狀態
app.put(`${API_PREFIX}/marquee-messages/:id`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 檢查是否是總代理
    if (agent.level !== 0) {
      return res.status(403).json({ success: false, message: '只有總代理可以設定跑馬燈' });
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
      message: `跑馬燈訊息已${is_active ? '啟用' : '停用'}`
    });
  } catch (error) {
    console.error('更新跑馬燈訊息錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
  }
});

// 刪除跑馬燈訊息
app.delete(`${API_PREFIX}/marquee-messages/:id`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }
    const { agent } = authResult;
    
    // 檢查是否是總代理
    if (agent.level !== 0) {
      return res.status(403).json({ success: false, message: '只有總代理可以設定跑馬燈' });
    }

    const { id } = req.params;
    
    await db.none('DELETE FROM marquee_messages WHERE id = $1', [id]);

    res.json({
      success: true,
      message: '跑馬燈訊息已刪除'
    });
  } catch (error) {
    console.error('刪除跑馬燈訊息錯誤:', error);
    res.status(500).json({ success: false, message: '伺服器錯誤' });
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

// 獲取單個代理詳細資料
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
    console.error('獲取代理詳細資料失敗:', error);
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

// 更新代理備註
app.post(`${API_PREFIX}/update-agent-notes`, async (req, res) => {
  try {
    const { agentId, notes } = req.body;
    
    if (!agentId) {
      return res.json({
        success: false,
        message: '缺少代理ID'
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
    
    // 更新備註
    await db.none('UPDATE agents SET notes = $1, updated_at = NOW() WHERE id = $2', [notes || '', agentId]);
    
    res.json({
      success: true,
      message: '代理備註更新成功'
    });
    
  } catch (error) {
    console.error('更新代理備註失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新代理備註失敗'
    });
  }
});

// 更新會員備註
app.post(`${API_PREFIX}/update-member-notes`, async (req, res) => {
  try {
    const { memberId, notes } = req.body;
    
    if (!memberId) {
      return res.json({
        success: false,
        message: '缺少會員ID'
      });
    }
    
    // 檢查會員是否存在
    const member = await MemberModel.findById(memberId);
    if (!member) {
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 更新備註
    await db.none('UPDATE members SET notes = $1, updated_at = NOW() WHERE id = $2', [notes || '', memberId]);
    
    res.json({
      success: true,
      message: '會員備註更新成功'
    });
    
  } catch (error) {
    console.error('更新會員備註失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新會員備註失敗'
    });
  }
});

// 創建會員
app.post(`${API_PREFIX}/create-member`, async (req, res) => {
  const { username, password, agentId, notes } = req.body;
  
  try {
    // 驗證用戶名格式（只允許英文、數字）
    const usernameRegex = /^[a-zA-Z0-9]+$/;
    if (!username || !usernameRegex.test(username)) {
      return res.json({
        success: false,
        message: '用戶名只能包含英文字母和數字'
      });
    }
    
    // 驗證密碼長度（至少6碼）
    if (!password || password.length < 6) {
      return res.json({
        success: false,
        message: '密碼至少需要6個字符'
      });
    }
    
    // 檢查用戶名是否已存在（檢查會員表、代理表和子帳號表）
    const existingMember = await MemberModel.findByUsername(username);
    if (existingMember) {
      return res.json({
        success: false,
        message: '該用戶名已被使用（會員）'
      });
    }
    
    const existingAgent = await AgentModel.findByUsername(username);
    if (existingAgent) {
      return res.json({
        success: false,
        message: '該用戶名已被使用（代理）'
      });
    }
    
    // 檢查子帳號表
    const existingSubAccount = await db.oneOrNone(`
      SELECT id FROM sub_accounts WHERE username = $1
    `, [username]);
    
    if (existingSubAccount) {
      return res.json({
        success: false,
        message: '該用戶名已被使用（子帳號）'
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
    
    // 創建會員 - 繼承代理的盤口類型
    const newMember = await MemberModel.create({
      username,
      password,
      agent_id: agentId,
      balance: 0, // 初始餘額
      notes: notes || '',
      market_type: agent.market_type || 'D' // 繼承代理的盤口類型
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

// 代為創建會員
app.post(`${API_PREFIX}/create-member-for-agent`, async (req, res) => {
  const { username, password, agentId, initialBalance, createdBy } = req.body;
  
  try {
    console.log(`代為創建會員請求: 用戶名=${username}, 代理ID=${agentId}, 初始餘額=${initialBalance}, 創建者=${createdBy}`);
    
    // 檢查用戶名是否已存在（檢查會員表、代理表和子帳號表）
    const existingMember = await MemberModel.findByUsername(username);
    if (existingMember) {
      return res.json({
        success: false,
        message: '該用戶名已被使用（會員）'
      });
    }
    
    const existingAgent = await AgentModel.findByUsername(username);
    if (existingAgent) {
      return res.json({
        success: false,
        message: '該用戶名已被使用（代理）'
      });
    }
    
    // 檢查子帳號表
    const existingSubAccount = await db.oneOrNone(`
      SELECT id FROM sub_accounts WHERE username = $1
    `, [username]);
    
    if (existingSubAccount) {
      return res.json({
        success: false,
        message: '該用戶名已被使用（子帳號）'
      });
    }
    
    // 檢查目標代理是否存在
    const targetAgent = await AgentModel.findById(agentId);
    if (!targetAgent) {
      return res.json({
        success: false,
        message: '目標代理不存在'
      });
    }
    
    // 檢查創建者是否存在
    const creator = await AgentModel.findById(createdBy);
    if (!creator) {
      return res.json({
        success: false,
        message: '創建者代理不存在'
      });
    }
    
    // 檢查代理層級是否達到最大值 (15層)
    if (targetAgent.level >= 15) {
      return res.json({
        success: false,
        message: '該代理已達到最大層級（15層），無法再創建下級會員'
      });
    }
    
    const initialBal = parseFloat(initialBalance) || 0;
    
    // 如果設定了初始餘額，檢查創建者餘額是否足夠
    if (initialBal > 0) {
      if (parseFloat(creator.balance) < initialBal) {
        return res.json({
          success: false,
          message: '您的余额不足以设定该初始余额'
        });
      }
    }
    
    // 開始數據庫事務
    await db.tx(async t => {
      // 創建會員 - 繼承代理的盤口類型
      const newMember = await t.one(`
        INSERT INTO members (username, password, agent_id, balance, status, market_type, created_at)
        VALUES ($1, $2, $3, $4, 1, $5, NOW())
        RETURNING id, username, balance
      `, [username, password, agentId, initialBal, targetAgent.market_type || 'D']);
      
      // 如果設定了初始餘額，從創建者餘額中扣除
      if (initialBal > 0) {
        // 扣除創建者餘額
        await t.none(`
          UPDATE agents 
          SET balance = balance - $1, updated_at = NOW()
          WHERE id = $2
        `, [initialBal, createdBy]);
        
        // 記錄點數轉移
        await t.none(`
          INSERT INTO point_transfers (from_user_type, from_user_id, to_user_type, to_user_id, amount, transfer_type, description, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, ['agent', createdBy, 'member', newMember.id, initialBal, 'agent_to_member', `代為創建會員 ${username} 的初始餘額`]);
      }
      
      return newMember;
    });
    
    // 獲取更新後的創建者餘額
    const updatedCreator = await AgentModel.findById(createdBy);
    
    console.log(`成功代為創建會員: ${username}, 代理: ${targetAgent.username}, 初始餘額: ${initialBal}`);
    
    res.json({
      success: true,
      message: `成功為代理 ${targetAgent.username} 創建會員 ${username}`,
      member: {
        id: newMember.id,
        username: newMember.username,
        balance: initialBal,
        agent_id: agentId
      },
      newBalance: updatedCreator.balance
    });
    
  } catch (error) {
    console.error('代為創建會員出錯:', error);
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
          description || ''
        );
      } else if (parsedAmount < 0) {
        // 從會員轉移點數到代理
        console.log(`執行會員到代理的點數轉移: 金額=${Math.abs(parsedAmount)}`);
        result = await PointTransferModel.transferFromMemberToAgent(
          member.id, 
          agent.id, 
          Math.abs(parsedAmount), 
          description || ''
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

// 新增: 會員餘額同步API（用於下注/中獎，不扣代理點數）
app.post(`${API_PREFIX}/sync-member-balance`, async (req, res) => {
  const { username, balance, reason } = req.body;
  
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
      console.log(`同步餘額失敗: 會員 ${username} 不存在`);
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 更新會員餘額（不影響代理餘額）
    await MemberModel.setBalance(username, balance);
    
    console.log(`會員 ${username} 餘額已同步為: ${balance}，原因: ${reason || '系統同步'}`);
    
    res.json({
      success: true,
      message: '餘額同步成功',
      balance: balance
    });
  } catch (error) {
    console.error('同步會員餘額出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 新增: 清空點數轉移記錄API（僅用於測試）
app.delete(`${API_PREFIX}/clear-transfers`, async (req, res) => {
  try {
    // 刪除所有點數轉移記錄
    await db.none('DELETE FROM point_transfers');
    
    // 也清空相關的transactions記錄（可選）
    await db.none('DELETE FROM transactions');
    
    console.log('所有點數轉移記錄已清空');
    
    res.json({
      success: true,
      message: '所有點數轉移記錄已清空'
    });
  } catch (error) {
    console.error('清空點數轉移記錄出錯:', error);
    res.status(500).json({
      success: false,
      message: '清空記錄失敗，請稍後再試'
    });
  }
});

// 新增: 點數轉移記錄API
app.get(`${API_PREFIX}/point-transfers`, async (req, res) => {
  const { userType, userId, agentId, limit = 50 } = req.query;
  
  try {
    // 如果提供了 agentId，優先使用它
    const actualUserType = agentId ? 'agent' : userType;
    const actualUserId = agentId || userId;
    
    if (!actualUserType || !actualUserId) {
      return res.json({
        success: false,
        message: '請提供用戶類型和ID或代理ID'
      });
    }
    
    const transfers = await PointTransferModel.getTransferRecords(actualUserType, actualUserId, limit);
    
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

// 代理間點數轉移 API 端點
app.post(`${API_PREFIX}/transfer-agent-balance`, async (req, res) => {
  const { agentId, subAgentId, amount, type, description } = req.body;
  
  console.log(`收到代理點數轉移請求: 上級代理ID=${agentId}, 下級代理ID=${subAgentId}, 金額=${amount}, 類型=${type}, 說明=${description}`);
  console.log(`請求體:`, JSON.stringify(req.body));
  
  try {
    if (!agentId || !subAgentId || amount === undefined || !type) {
      console.error('代理點數轉移失敗: 缺少必要參數');
      return res.json({
        success: false,
        message: '請提供完整的轉移參數'
      });
    }
    
    // 查詢上級代理
    const parentAgent = await AgentModel.findById(agentId);
    if (!parentAgent) {
      console.error(`代理點數轉移失敗: 上級代理 ID=${agentId} 不存在`);
      return res.json({
        success: false,
        message: '上級代理不存在'
      });
    }
    console.log(`找到上級代理: ID=${parentAgent.id}, 用戶名=${parentAgent.username}, 餘額=${parentAgent.balance}`);
    
    // 查詢下級代理
    const subAgent = await AgentModel.findById(subAgentId);
    if (!subAgent) {
      console.error(`代理點數轉移失敗: 下級代理 ID=${subAgentId} 不存在`);
      return res.json({
        success: false,
        message: '下級代理不存在'
      });
    }
    console.log(`找到下級代理: ID=${subAgent.id}, 用戶名=${subAgent.username}, 餘額=${subAgent.balance}`);
    
    // 驗證代理層級關係（檢查是否為上級代理）
    const canManageAgent = await canAgentManageAgent(parentAgent.id, subAgent.id);
    if (!canManageAgent) {
      console.error(`代理點數轉移失敗: 代理 ${parentAgent.username} 無權限操作代理 ${subAgent.username}`);
      return res.json({
        success: false,
        message: '只能對下線代理進行點數轉移'
      });
    }
    console.log(`權限檢查通過: 代理 ${parentAgent.username} 可以操作代理 ${subAgent.username}`);
    
    const transferAmount = Math.abs(parseFloat(amount));
    console.log(`處理代理點數轉移: 金額=${transferAmount}, 類型=${type}`);
    
    // 根據操作類型執行不同的點數轉移
    let result;
    try {
      if (type === 'deposit') {
        // 上級代理存入點數給下級代理
        console.log(`執行上級代理到下級代理的點數轉移: 金額=${transferAmount}`);
        result = await PointTransferModel.transferFromAgentToAgent(
          parentAgent.id, 
          subAgent.id, 
          transferAmount, 
          description || '',
          false // 一般點數轉移，不是客服操作
        );
        
      } else if (type === 'withdraw') {
        // 上級代理從下級代理提領點數
        console.log(`執行下級代理到上級代理的點數轉移: 金額=${transferAmount}`);
        result = await PointTransferModel.transferFromAgentToAgent(
          subAgent.id, 
          parentAgent.id, 
          transferAmount, 
          description || '',
          false // 一般點數轉移，不是客服操作
        );
        
      } else {
        console.error('代理點數轉移失敗: 無效的轉移類型');
        return res.json({
          success: false,
          message: '無效的轉移類型'
        });
      }
      
      // 重新查詢最新的上級代理和下級代理餘額
      const updatedParentAgent = await AgentModel.findById(parentAgent.id);
      const updatedSubAgent = await AgentModel.findById(subAgent.id);
      
      const finalParentBalance = parseFloat(updatedParentAgent.balance);
      const finalSubAgentBalance = parseFloat(updatedSubAgent.balance);
      
      console.log(`代理點數轉移成功: 上級代理餘額=${finalParentBalance}, 下級代理餘額=${finalSubAgentBalance}`);
      
      res.json({
        success: true,
        message: '代理點數轉移成功',
        parentBalance: finalParentBalance,
        subAgentBalance: finalSubAgentBalance
      });
      
    } catch (error) {
      console.error('代理點數轉移處理出錯:', error);
      res.status(500).json({
        success: false,
        message: error.message || '代理點數轉移處理出錯，請稍後再試'
      });
    }
  } catch (error) {
    console.error('代理點數轉移出錯:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系統錯誤，請稍後再試'
    });
  }
});

// 會員點數轉移 API 端點
app.post(`${API_PREFIX}/transfer-member-balance`, async (req, res) => {
  const { agentId, memberId, amount, type, description } = req.body;
  
  console.log(`收到會員點數轉移請求: 代理ID=${agentId}, 會員ID=${memberId}, 金額=${amount}, 類型=${type}, 說明=${description}`);
  console.log(`請求體:`, JSON.stringify(req.body));
  
  try {
    if (!agentId || !memberId || amount === undefined || !type) {
      console.error('會員點數轉移失敗: 缺少必要參數');
      return res.json({
        success: false,
        message: '請提供完整的轉移參數'
      });
    }
    
    // 查詢代理
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      console.error(`會員點數轉移失敗: 代理 ID=${agentId} 不存在`);
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    console.log(`找到代理: ID=${agent.id}, 用戶名=${agent.username}, 餘額=${agent.balance}`);
    
    // 查詢會員
    const member = await MemberModel.findById(memberId);
    if (!member) {
      console.error(`會員點數轉移失敗: 會員 ID=${memberId} 不存在`);
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    console.log(`找到會員: ID=${member.id}, 用戶名=${member.username}, 餘額=${member.balance}`);
    
    // 驗證會員歸屬關係（檢查是否為上級代理）
    const canManage = await canAgentManageMember(agent.id, member.id);
    if (!canManage) {
      console.error(`會員點數轉移失敗: 代理 ${agent.username} 無權限操作會員 ${member.username}`);
      return res.json({
        success: false,
        message: '只能對下線代理創建的會員進行點數轉移'
      });
    }
    console.log(`權限檢查通過: 代理 ${agent.username} 可以操作會員 ${member.username}`);
    
    const transferAmount = Math.abs(parseFloat(amount));
    console.log(`處理會員點數轉移: 金額=${transferAmount}, 類型=${type}`);
    
          // 根據操作類型執行不同的點數轉移
      let result;
      try {
        if (type === 'deposit') {
          // 代理存入點數給會員
          console.log(`執行代理到會員的點數轉移: 金額=${transferAmount}`);
          console.log(`🔍 調用transferFromAgentToMember: agentId=${agent.id}, memberId=${member.id}, amount=${transferAmount}, isCustomerServiceOperation=false`);
          result = await PointTransferModel.transferFromAgentToMember(
            agent.id, 
            member.id, 
            transferAmount, 
            description || '',
            false // 一般點數轉移，不是客服操作
          );
          
        } else if (type === 'withdraw') {
          // 代理從會員提領點數
          console.log(`執行會員到代理的點數轉移: 金額=${transferAmount}`);
          console.log(`🔍 調用transferFromMemberToAgent: memberId=${member.id}, agentId=${agent.id}, amount=${transferAmount}, isCustomerServiceOperation=false`);
          result = await PointTransferModel.transferFromMemberToAgent(
            member.id, 
            agent.id, 
            transferAmount, 
            description || '',
            false // 一般點數轉移，不是客服操作
          );
          
        } else {
          console.error('會員點數轉移失敗: 無效的轉移類型');
          return res.json({
            success: false,
            message: '無效的轉移類型'
          });
        }
        
        // 重新查詢最新的代理和會員餘額
        const updatedAgent = await AgentModel.findById(agent.id);
        const updatedMember = await MemberModel.findById(member.id);
        
        const finalAgentBalance = parseFloat(updatedAgent.balance);
        const finalMemberBalance = parseFloat(updatedMember.balance);
        
        console.log(`會員點數轉移成功: 代理餘額=${finalAgentBalance}, 會員餘額=${finalMemberBalance}`);
        
        res.json({
          success: true,
          message: '會員點數轉移成功',
          parentBalance: finalAgentBalance,
          memberBalance: finalMemberBalance
        });
      
    } catch (error) {
      console.error('會員點數轉移處理出錯:', error);
      res.status(500).json({
        success: false,
        message: error.message || '會員點數轉移處理出錯，請稍後再試'
      });
    }
  } catch (error) {
    console.error('會員點數轉移出錯:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系統錯誤，請稍後再試'
    });
  }
});

// 獲取公告
app.get(`${API_PREFIX}/notices`, async (req, res) => {
  try {
    const { category = null, limit = 50 } = req.query;
    
    // 獲取公告
    const notices = await NoticeModel.findAll(parseInt(limit), category);
    
    // 獲取所有分類
    const categories = await NoticeModel.getCategories();
    
    res.json({
      success: true,
      notices,
      categories
    });
  } catch (error) {
    console.error('獲取公告出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 新增系統公告 (僅總代理可用)
app.post(`${API_PREFIX}/create-notice`, async (req, res) => {
  try {
    const { operatorId, title, content, category } = req.body;
    
    // 參數驗證
    if (!operatorId || !title || !content) {
      return res.json({
        success: false,
        message: '請提供操作員ID、標題和內容'
      });
    }
    
    // 檢查操作員是否為總代理（客服）
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '權限不足，只有總代理可以創建系統公告'
      });
    }
    
    // 驗證分類
    const validCategories = ['最新公告', '維修', '活動'];
    const finalCategory = validCategories.includes(category) ? category : '最新公告';
    
    // 創建公告
    const newNotice = await NoticeModel.create(
      title.substring(0, 100), // 限制標題長度
      content,
      finalCategory
    );
    
    console.log(`總代理 ${operatorId} 創建新公告: "${title}"`);
    
    res.json({
      success: true,
      message: '系統公告創建成功',
      notice: newNotice
    });
    
  } catch (error) {
    console.error('創建系統公告出錯:', error);
    res.status(500).json({
      success: false,
      message: '創建公告失敗，請稍後再試'
    });
  }
});

// 編輯系統公告 (僅總代理可用)
app.put(`${API_PREFIX}/notice/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    const { operatorId, title, content, category } = req.body;
    
    // 參數驗證
    if (!operatorId || !title || !content) {
      return res.json({
        success: false,
        message: '請提供操作員ID、標題和內容'
      });
    }
    
    // 檢查操作員是否為總代理（客服）
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '權限不足，只有總代理可以編輯系統公告'
      });
    }
    
    // 檢查公告是否存在
    const existingNotice = await NoticeModel.findById(id);
    if (!existingNotice) {
      return res.json({
        success: false,
        message: '公告不存在或已被刪除'
      });
    }
    
    // 驗證分類
    const validCategories = ['最新公告', '維修', '活動'];
    const finalCategory = validCategories.includes(category) ? category : '最新公告';
    
    // 更新公告
    const updatedNotice = await NoticeModel.update(
      id,
      title.substring(0, 100), // 限制標題長度
      content,
      finalCategory
    );
    
    console.log(`總代理 ${operatorId} 編輯公告 ${id}: "${title}"`);
    
    res.json({
      success: true,
      message: '系統公告更新成功',
      notice: updatedNotice
    });
    
  } catch (error) {
    console.error('編輯系統公告出錯:', error);
    res.status(500).json({
      success: false,
      message: '編輯公告失敗，請稍後再試'
    });
  }
});

// 刪除系統公告 (僅總代理可用)
app.delete(`${API_PREFIX}/notice/:id`, async (req, res) => {
  try {
    const { id } = req.params;
    const { operatorId } = req.body;
    
    // 參數驗證
    if (!operatorId) {
      return res.json({
        success: false,
        message: '請提供操作員ID'
      });
    }
    
    // 檢查操作員是否為總代理（客服）
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '權限不足，只有總代理可以刪除系統公告'
      });
    }
    
    // 檢查公告是否存在
    const existingNotice = await NoticeModel.findById(id);
    if (!existingNotice) {
      return res.json({
        success: false,
        message: '公告不存在或已被刪除'
      });
    }
    
    // 刪除公告（軟刪除）
    await NoticeModel.delete(id);
    
    console.log(`總代理 ${operatorId} 刪除公告 ${id}: "${existingNotice.title}"`);
    
    res.json({
      success: true,
      message: '系統公告刪除成功'
    });
    
  } catch (error) {
    console.error('刪除系統公告出錯:', error);
    res.status(500).json({
      success: false,
      message: '刪除公告失敗，請稍後再試'
    });
  }
});

// 新增: 獲取總代理API端點
app.get(`${API_PREFIX}/admin-agent`, async (req, res) => {
  try {
    // 獲取總代理 (level = 0)，如果有多個則取第一個
    const adminAgents = await db.any('SELECT * FROM agents WHERE level = 0 ORDER BY id ASC LIMIT 1');
    
    if (adminAgents.length === 0) {
      return res.json({
        success: false,
        message: '系統還未設置總代理'
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
    const agents = await db.one('SELECT COUNT(*) as count FROM agents');
    
    // 獲取所有會員
    const members = await db.one('SELECT COUNT(*) as count FROM members');
    
    // 獲取今日交易總額
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const transactions = await db.one(`
      SELECT COALESCE(SUM(ABS(amount)), 0) as total_amount, COUNT(*) as count 
      FROM transaction_records 
      WHERE created_at >= $1
    `, [today]);
    
    // 獲取總佣金
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
    console.error('獲取會員列表出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 切換會員狀態 - 支持三种状态：0=停用, 1=启用, 2=凍結
app.post(`${API_PREFIX}/toggle-member-status`, async (req, res) => {
  const { memberId, status } = req.body;
  
  try {
    if (!memberId) {
      return res.json({
        success: false,
        message: '請提供會員ID'
      });
    }
    
    // 驗證狀態值：0=停用, 1=启用, 2=凍結
    const newStatus = parseInt(status);
    if (![0, 1, 2].includes(newStatus)) {
      return res.json({
        success: false,
        message: '無效的狀態值，必須是0(停用)、1(启用)或2(凍結)'
      });
    }
    
    // 更新會員狀態
    await db.none('UPDATE members SET status = $1 WHERE id = $2', [newStatus, memberId]);
    
    const statusText = newStatus === 1 ? '启用' : newStatus === 0 ? '停用' : '凍結';
    res.json({
      success: true,
      message: `會員狀態已更新为: ${statusText}`
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
// 獲取下注記錄 - 修復400錯誤，支持更多查詢參數
app.get(`${API_PREFIX}/bets`, async (req, res) => {
  try {
    // 使用通用認證中間件
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { agent } = authResult;
    const { agentId, rootAgentId, includeDownline, username, date, startDate, endDate, period, page = 1, limit = 20 } = req.query;
    
    // 基本參數驗證 - 支持agentId或rootAgentId
    const currentAgentId = agentId || rootAgentId;
    if (!currentAgentId) {
      return res.status(400).json({
        success: false,
        message: '代理ID為必填項 (agentId或rootAgentId)'
      });
    }
    
    console.log(`📡 查詢下注記錄: agentId=${currentAgentId}, includeDownline=${includeDownline}, username=${username}`);
    
    // 查詢該代理下的所有會員
    let members = [];
    
    // 如果指定了會員用戶名
    if (username) {
      // 檢查這個會員是否屬於該代理
      const member = await MemberModel.findByAgentAndUsername(currentAgentId, username);
      if (member) {
        members = [member];
      } else {
        return res.status(403).json({
          success: false,
          message: '該會員不存在或不屬於你的下線'
        });
      }
    } else {
      // 根據includeDownline參數決定是否包含下級代理的會員
      if (includeDownline === 'true') {
        // 獲取所有下級代理的會員
        const downlineAgents = await getAllDownlineAgents(currentAgentId);
        const allAgentIds = [parseInt(currentAgentId), ...downlineAgents]; // 修復：downlineAgents已經是整數數組
        
        for (const agentId of allAgentIds) {
          const agentMembers = await MemberModel.findByAgentId(agentId);
          members = members.concat(agentMembers || []);
        }
      } else {
        // 只獲取直系下線會員
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
    
    // 創建會員到代理的映射
    const memberToAgentMap = {};
    const agentInfoMap = {};
    
    // 獲取代理信息
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
    } else if (startDate && endDate) {
      // 期間查詢
      whereClause += ` AND DATE(created_at) BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startDate, endDate);
      paramIndex += 2;
    } else if (startDate) {
      // 只有開始日期
      whereClause += ` AND DATE(created_at) >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    } else if (endDate) {
      // 只有結束日期
      whereClause += ` AND DATE(created_at) <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }
    
    // 添加期數過濾  
    if (period) {
      whereClause += ` AND period::text LIKE $${paramIndex}`;
      params.push(`%${period}%`);
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
    
    // 為每筆下注添加代理信息
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
      bets: betsWithAgentInfo,
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

// 獲取下級代理列表API - 修復404錯誤
app.get(`${API_PREFIX}/downline-agents`, async (req, res) => {
  try {
    const { rootAgentId } = req.query;
    
    console.log(`📡 獲取下級代理API: rootAgentId=${rootAgentId}`);
    
    if (!rootAgentId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：rootAgentId'
      });
    }
    
    // 輔助函數：獲取級別名稱
    function getLevelName(level) {
      const levels = {
        0: '總代理',
        1: '一級代理', 
        2: '二級代理',
        3: '三級代理',
        4: '四級代理',
        5: '五級代理',
        6: '六級代理',
        7: '七級代理',
        8: '八級代理',
        9: '九級代理',
        10: '十級代理',
        11: '十一級代理',
        12: '十二級代理',
        13: '十三級代理',
        14: '十四級代理',
        15: '十五級代理'
      };
      return levels[level] || `${level}級代理`;
    }
    
    // 獲取所有下級代理ID
    const downlineAgentIds = await getAllDownlineAgents(rootAgentId);
    
    if (downlineAgentIds.length === 0) {
      return res.json({
        success: true,
        agents: [],
        total: 0
      });
    }
    
    // 查詢代理詳細信息
    let agentQuery = 'SELECT id, username, level, balance, status FROM agents WHERE id IN (';
    agentQuery += downlineAgentIds.map((_, i) => `$${i + 1}`).join(',');
    agentQuery += ') ORDER BY level, username';
    
    const agents = await db.any(agentQuery, downlineAgentIds);
    
    // 添加級別名稱
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
    console.error('❌ 獲取下級代理錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取下級代理失敗',
      error: error.message
    });
  }
});

// 獲取整條代理線會員API - 修復404錯誤  
app.get(`${API_PREFIX}/downline-members`, async (req, res) => {
  try {
    const { rootAgentId } = req.query;
    
    console.log(`📡 獲取整條代理線會員API: rootAgentId=${rootAgentId}`);
    
    if (!rootAgentId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：rootAgentId'
      });
    }
    
    // 首先獲取所有下級代理ID
    const downlineAgents = await getAllDownlineAgents(rootAgentId);
    const allAgentIds = [parseInt(rootAgentId), ...downlineAgents];
    
    // 獲取所有這些代理的會員
    let allMembers = [];
    
    // 創建代理ID到代理資訊的映射，包含完整的代理信息
    const agentMap = {};
    
    // 獲取根代理信息
    const rootAgent = await AgentModel.findById(rootAgentId);
    agentMap[rootAgentId] = { 
      username: rootAgent ? rootAgent.username : '未知代理',
      level: rootAgent ? rootAgent.level : 0,
      level_name: rootAgent ? getLevelName(rootAgent.level) : '未知級別'
    };
    
    // 獲取所有下級代理的完整信息並添加到映射中
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
    
    // 輔助函數：獲取級別名稱
    function getLevelName(level) {
      const levels = {
        0: '總代理',
        1: '一級代理', 
        2: '二級代理',
        3: '三級代理',
        4: '四級代理',
        5: '五級代理',
        6: '六級代理',
        7: '七級代理',
        8: '八級代理',
        9: '九級代理',
        10: '十級代理',
        11: '十一級代理',
        12: '十二級代理',
        13: '十三級代理',
        14: '十四級代理',
        15: '十五級代理'
      };
      return levels[level] || `${level}級代理`;
    }
    
    for (const agentId of allAgentIds) {
      const { status, keyword } = req.query;
      const members = await MemberModel.findByAgentId(agentId, status !== '-1' ? status : null, 1, 1000);
      
      // 如果有關鍵字篩選，進行過濾
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
        agentLevelName: agentMap[agentId]?.level_name || '未知級別'
      })));
    }
    
    res.json({
      success: true,
      members: allMembers,
      total: allMembers.length
    });
    
  } catch (error) {
    console.error('❌ 獲取整條代理線會員錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取會員列表失敗',
      error: error.message
    });
  }
});

// 獲取指定代理的會員API
app.get(`${API_PREFIX}/agent-members`, async (req, res) => {
  try {
    const { agentId } = req.query;
    
    console.log(`📡 獲取指定代理會員API: agentId=${agentId}`);
    
    if (!agentId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：agentId'
      });
    }
    
    const members = await MemberModel.findByAgentId(agentId, null, 1, 1000);
    
    res.json({
      success: true,
      members: members,
      total: members.length
    });
    
  } catch (error) {
    console.error('❌ 獲取指定代理會員錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取會員列表失敗',
      error: error.message
    });
  }
});

// 遞歸獲取所有下級代理的輔助函數
async function getAllDownlineAgents(rootAgentId) {
  const allAgents = [];
  
  // 獲取直接下級代理
  const directSubAgents = await AgentModel.findByParentId(rootAgentId, null, null, 1, 1000);
  
  for (const agent of directSubAgents) {
    allAgents.push(parseInt(agent.id)); // 只返回ID，確保是整數
    
    // 遞歸獲取該代理的下級代理
    const subAgents = await getAllDownlineAgents(agent.id);
    allAgents.push(...subAgents);
  }
  
  return allAgents;
}

// 定期同步開獎記錄的函數
async function syncDrawRecords() {
  try {
    console.log('開始同步開獎記錄...');
    
    // 獲取draw_records表中最新的一筆記錄，用來確定從哪裡開始同步
    const latestRecord = await db.oneOrNone(`
      SELECT period FROM draw_records ORDER BY period DESC LIMIT 1
    `);
    
    let whereClause = '';
    const params = [];
    
    if (latestRecord && latestRecord.period) {
      whereClause = 'WHERE period > $1';
      params.push(latestRecord.period);
      console.log(`從期數 ${latestRecord.period} 以後開始同步`);
    } else {
      console.log('沒有現有記錄，將同步全部開獎歷史');
    }
    
    // 從result_history表獲取需要同步的記錄
    const recordsToSync = await db.any(`
      SELECT period, result, created_at 
      FROM result_history 
      ${whereClause}
      ORDER BY period ASC
    `, params);
    
    if (recordsToSync.length === 0) {
      // console.log('沒有新的開獎記錄需要同步'); // 減少日誌輸出
      return;
    }
    
    console.log(`找到 ${recordsToSync.length} 筆開獎記錄需要同步`);
    
    // 逐一同步記錄
    for (const record of recordsToSync) {
      try {
        // 正確處理result為JSONB格式
        let result = record.result;
        if (typeof result === 'string') {
          result = JSON.parse(result);
        }
        
        // 使用to_jsonb轉換確保PostgreSQL正確處理JSONB類型
        await db.none(`
          INSERT INTO draw_records (period, result, draw_time, created_at)
          VALUES ($1, $2::jsonb, $3, $4)
          ON CONFLICT (period) DO UPDATE 
          SET result = $2::jsonb, draw_time = $3
        `, [record.period, JSON.stringify(result), record.created_at, new Date()]);
        
        // console.log(`同步開獎記錄: 期數=${record.period} 成功`); // 減少日誌輸出
      } catch (insertError) {
        console.error(`同步開獎記錄: 期數=${record.period} 失敗:`, insertError);
      }
    }
    
    console.log('開獎記錄同步完成');
  } catch (error) {
    console.error('同步開獎記錄時出錯:', error);
  }
}

// 在服務器啟動時調用一次同步函數
async function startServer() {
  try {
    // 檢測是否在Render環境運行
    const isRenderPlatform = process.env.RENDER === 'true' || 
                             process.env.RENDER_EXTERNAL_URL || 
                             process.env.RENDER_SERVICE_ID;
    
    // 檢查是否已經存在標記文件，用於判斷是否為首次運行
    let isFirstRun = false;
    try {
      // 嘗試讀取標記文件
      await fs.access(path.join(__dirname, '.render_initialized'));
      console.log('檢測到Render初始化標記，非首次運行');
    } catch (err) {
      // 文件不存在，說明是首次運行
      isFirstRun = true;
      console.log('未檢測到Render初始化標記，視為首次運行');
    }
    
    if (isRenderPlatform) {
      console.log('檢測到Render部署環境');
      process.env.RENDER = 'true';
      
      if (isFirstRun) {
        console.log('設置為Render首次運行，將在需要時修改總代理為ti2025');
        process.env.RENDER_FIRST_RUN = 'true';
      }
    }
    
    await initDatabase();
    
    // 初始化會話管理系統
    await SessionManager.initialize();
    
    // 如果是Render環境且首次運行，創建標記文件避免下次重置
    if (isRenderPlatform && isFirstRun) {
      try {
        // 創建標記文件
        await fs.writeFile(
          path.join(__dirname, '.render_initialized'), 
          `Initialized at ${new Date().toISOString()}`
        );
        console.log('已創建Render初始化標記文件');
      } catch (err) {
        console.error('創建初始化標記文件失敗:', err);
      }
    }
    
    // 子帳號相關 API
    
    // 獲取子帳號列表
    app.get(`${API_PREFIX}/subaccounts`, async (req, res) => {
      try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        
        // 查詢該代理的所有子帳號
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
        console.error('獲取子帳號列表失敗:', error);
        res.status(500).json({
          success: false,
          message: '系統錯誤，請稍後再試'
        });
      }
    });
    
    // 創建子帳號
    app.post(`${API_PREFIX}/subaccounts`, async (req, res) => {
      try {
        console.log('📝 創建子帳號請求:', req.body);
        
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          console.log('❌ 認證失敗');
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        const { username, password } = req.body;
        
        console.log('📋 代理ID:', agentId, '子帳號名稱:', username);
        
        // 輸入驗證
        if (!username || !password) {
          return res.status(400).json({
            success: false,
            message: '請提供子帳號名稱和密碼'
          });
        }
        
        // 檢查是否已有 2 個子帳號
        const count = await db.one(`
          SELECT COUNT(*) as count
          FROM sub_accounts
          WHERE parent_agent_id = $1
        `, [agentId]);
        
        console.log('📊 現有子帳號數量:', count.count);
        
        if (parseInt(count.count) >= 2) {
          return res.json({
            success: false,
            message: '每個代理最多只能創建 2 個子帳號'
          });
        }
        
        // 檢查用戶名是否在三個表中都唯一
        console.log('🔍 檢查用戶名唯一性:', username);
        
        // 檢查代理表
        const existingAgent = await db.oneOrNone(`
          SELECT id FROM agents WHERE username = $1
        `, [username]);
        
        if (existingAgent) {
          console.log('❌ 用戶名已被代理使用');
          return res.json({
            success: false,
            message: '此用戶名已被代理使用，請選擇其他名稱'
          });
        }
        
        // 檢查會員表
        const existingMember = await db.oneOrNone(`
          SELECT id FROM members WHERE username = $1
        `, [username]);
        
        if (existingMember) {
          console.log('❌ 用戶名已被會員使用');
          return res.json({
            success: false,
            message: '此用戶名已被會員使用，請選擇其他名稱'
          });
        }
        
        // 檢查子帳號表
        const existingSubAccount = await db.oneOrNone(`
          SELECT id FROM sub_accounts WHERE username = $1
        `, [username]);
        
        if (existingSubAccount) {
          console.log('❌ 用戶名已被其他子帳號使用');
          return res.json({
            success: false,
            message: '此用戶名已被其他子帳號使用，請選擇其他名稱'
          });
        }
        
        console.log('✅ 用戶名可以使用');
        
        // 加密密碼
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 創建子帳號
        const newSubAccount = await db.one(`
          INSERT INTO sub_accounts (parent_agent_id, username, password)
          VALUES ($1, $2, $3)
          RETURNING id, username, status, created_at
        `, [agentId, username, hashedPassword]);
        
        console.log('✅ 子帳號創建成功:', newSubAccount);
        
        res.json({
          success: true,
          message: '子帳號創建成功',
          subAccount: newSubAccount
        });
      } catch (error) {
        console.error('❌ 創建子帳號失敗:', error);
        console.error('錯誤詳情:', {
          name: error.name,
          message: error.message,
          code: error.code,
          detail: error.detail,
          table: error.table,
          constraint: error.constraint
        });
        
        // 檢查是否是資料庫錯誤
        if (error.code === '42P01') {
          res.status(500).json({
            success: false,
            message: '資料表不存在，請聯繫系統管理員'
          });
        } else if (error.code === '23505') {
          res.status(400).json({
            success: false,
            message: '子帳號名稱已存在'
          });
        } else {
          res.status(500).json({
            success: false,
            message: '系統錯誤，請稍後再試'
          });
        }
      }
    });
    
    // 更新子帳號狀態
    app.put(`${API_PREFIX}/subaccounts/:id/status`, async (req, res) => {
      try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        const subAccountId = req.params.id;
        const { status } = req.body;
        
        // 確認子帳號屬於該代理
        const subAccount = await db.oneOrNone(`
          SELECT id FROM sub_accounts
          WHERE id = $1 AND parent_agent_id = $2
        `, [subAccountId, agentId]);
        
        if (!subAccount) {
          return res.json({
            success: false,
            message: '找不到該子帳號'
          });
        }
        
        // 更新狀態
        await db.none(`
          UPDATE sub_accounts
          SET status = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [status, subAccountId]);
        
        res.json({
          success: true,
          message: status === 1 ? '子帳號已啟用' : '子帳號已停用'
        });
      } catch (error) {
        console.error('更新子帳號狀態失敗:', error);
        res.status(500).json({
          success: false,
          message: '系統錯誤，請稍後再試'
        });
      }
    });
    
    // 代理更改自己的密碼
    app.put(`${API_PREFIX}/change-password`, async (req, res) => {
      try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        const { currentPassword, newPassword } = req.body;
        
        console.log('📝 代理更改密碼請求，代理ID:', agentId);
        
        // 驗證輸入
        if (!currentPassword || !newPassword) {
          return res.status(400).json({
            success: false,
            message: '請提供當前密碼和新密碼'
          });
        }
        
        if (newPassword.length < 6) {
          return res.status(400).json({
            success: false,
            message: '新密碼長度至少需要 6 個字符'
          });
        }
        
        // 獲取代理當前密碼
        const agent = await db.oneOrNone(`
          SELECT id, username, password 
          FROM agents 
          WHERE id = $1
        `, [agentId]);
        
        if (!agent) {
          return res.status(404).json({
            success: false,
            message: '找不到代理資料'
          });
        }
        
        // 驗證當前密碼
        let isValidPassword = false;
        
        // 檢查密碼是否已經是 bcrypt hash
        if (agent.password.startsWith('$2b$') || agent.password.startsWith('$2a$')) {
          // 使用 bcrypt 驗證
          isValidPassword = await bcrypt.compare(currentPassword, agent.password);
        } else {
          // 明文密碼直接比較
          isValidPassword = (agent.password === currentPassword);
        }
        
        if (!isValidPassword) {
          console.log('❌ 當前密碼驗證失敗');
          return res.status(401).json({
            success: false,
            message: '當前密碼錯誤'
          });
        }
        
        // 加密新密碼
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // 更新密碼
        await db.none(`
          UPDATE agents 
          SET password = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [hashedPassword, agentId]);
        
        console.log('✅ 代理密碼更改成功:', agent.username);
        
        res.json({
          success: true,
          message: '密碼已成功更改'
        });
      } catch (error) {
        console.error('❌ 更改密碼失敗:', error);
        res.status(500).json({
          success: false,
          message: '系統錯誤，請稍後再試'
        });
      }
    });
    
    // 重設子帳號密碼
    app.put(`${API_PREFIX}/subaccounts/:id/password`, async (req, res) => {
      try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        const subAccountId = req.params.id;
        const { newPassword } = req.body;
        
        console.log('📝 重設子帳號密碼請求:', { subAccountId, agentId });
        
        // 驗證新密碼
        if (!newPassword || newPassword.length < 6) {
          return res.status(400).json({
            success: false,
            message: '密碼長度至少需要 6 個字符'
          });
        }
        
        // 確認子帳號屬於該代理
        const subAccount = await db.oneOrNone(`
          SELECT id, username FROM sub_accounts
          WHERE id = $1 AND parent_agent_id = $2
        `, [subAccountId, agentId]);
        
        if (!subAccount) {
          return res.json({
            success: false,
            message: '找不到該子帳號'
          });
        }
        
        // 加密新密碼
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // 更新密碼
        await db.none(`
          UPDATE sub_accounts 
          SET password = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [hashedPassword, subAccountId]);
        
        console.log('✅ 子帳號密碼重設成功:', subAccount.username);
        
        res.json({
          success: true,
          message: '密碼已成功重設'
        });
      } catch (error) {
        console.error('❌ 重設子帳號密碼失敗:', error);
        res.status(500).json({
          success: false,
          message: '系統錯誤，請稍後再試'
        });
      }
    });
    
    // 刪除子帳號
    app.delete(`${API_PREFIX}/subaccounts/:id`, async (req, res) => {
      try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
          return res.status(401).json(authResult);
        }
        
        const agentId = authResult.agent.id;
        const subAccountId = req.params.id;
        
        // 確認子帳號屬於該代理
        const subAccount = await db.oneOrNone(`
          SELECT id FROM sub_accounts
          WHERE id = $1 AND parent_agent_id = $2
        `, [subAccountId, agentId]);
        
        if (!subAccount) {
          return res.json({
            success: false,
            message: '找不到該子帳號'
          });
        }
        
        // 刪除子帳號
        await db.none(`
          DELETE FROM sub_accounts WHERE id = $1
        `, [subAccountId]);
        
        res.json({
          success: true,
          message: '子帳號已刪除'
        });
      } catch (error) {
        console.error('刪除子帳號失敗:', error);
        res.status(500).json({
          success: false,
          message: '系統錯誤，請稍後再試'
        });
      }
    });
    
    // 創建 HTTP 服務器
    const server = createServer(app);
    
    // 初始化 WebSocket
    wsManager.initialize(server);
    
    // 先啟動Express服務器，確保 Render 能檢測到端口
    const PORT = process.env.PORT || 3003;
    server.listen(PORT, () => {
      console.log(`代理管理系統後端運行在端口 ${PORT}`);
      console.log('WebSocket 服務已啟動');
      
      // 端口啟動後，異步執行開獎記錄同步，避免阻塞部署
      setImmediate(async () => {
        try {
          console.log('開始異步同步開獎記錄...');
          await syncDrawRecords();
          console.log('開獎記錄同步完成');
          
          // 每60秒同步一次開獎記錄作為備援（主要依靠即時同步）
          setInterval(syncDrawRecords, 60 * 1000);
        } catch (error) {
          console.error('同步開獎記錄失敗:', error);
          // 即使同步失敗，服務器仍然可以運行
        }
      });
    });
  } catch (error) {
    console.error('啟動服務器時出錯:', error);
  }
}

// ... existing code ...

// 會員下注記錄查詢 API
app.get(`${API_PREFIX}/member-bet-records`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { agent: currentAgent } = authResult;
    const { memberUsername, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    console.log('📊 查詢會員下注記錄:', { 
      memberUsername, startDate, endDate, page, limit, currentAgentId: currentAgent.id
    });
    
    if (!memberUsername) {
      return res.json({
        success: false,
        message: '請提供會員用戶名'
      });
    }

    try {
      // 驗證會員是否屬於當前代理的下線（簡化版，直接查詢會員）
      const member = await db.oneOrNone(`
        SELECT m.id, m.username, m.agent_id, m.balance, m.market_type
        FROM members m
        WHERE m.username = $1
      `, [memberUsername]);

      if (!member) {
        return res.json({
          success: false,
          message: '會員不存在'
        });
      }

      // 檢查會員是否在當前代理的管理範圍內（暫時跳過，用於測試）
      console.log('找到會員:', member);

      // 構建查詢條件，支援結算狀態篩選
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

      // 如果有結算狀態篩選
      const { settlementStatus } = req.query;
      if (settlementStatus === 'settled') {
        whereClause += ` AND bh.settled = true`;
      } else if (settlementStatus === 'unsettled') {
        whereClause += ` AND bh.settled = false`;
      }
      // 如果不指定或指定為空，則顯示全部（已結算和未結算）

      // 查詢總數
      const totalQuery = `SELECT COUNT(*) as total FROM bet_history bh ${whereClause}`;
      const totalResult = await db.one(totalQuery, params);
      const total = parseInt(totalResult.total);
      const totalPages = Math.ceil(total / limit);

      // 查詢下注記錄（使用正確的欄位名稱）
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

      // 格式化記錄，加上必要的欄位和佔成明細
      const formattedRecords = await Promise.all(records.map(async (record) => {
        // 獲取這筆下注的代理鏈佔成明細
        const commissionDetails = await getCommissionDetailsForBet(record.username, parseFloat(record.bet_amount));
        
        // 判斷結算狀態和結果
        let result, profitLoss;
        if (!record.settled) {
          // 未結算注單
          result = '未結算';
          profitLoss = 0; // 未結算時盈虧為0
        } else {
          // 已結算注單
          result = record.win ? '贏' : '輸';
          profitLoss = record.win ? parseFloat(record.win_amount) - parseFloat(record.bet_amount) : -parseFloat(record.bet_amount);
        }
        
        return {
          id: record.id,
          bet_id: record.id, // 使用 id 作為 bet_id
          username: record.username,
          game_type: record.game_type,
          bet_type: record.game_type, // 為前端兼容性添加 bet_type
          period_number: record.period,
          bet_content: record.bet_content,
          bet_value: record.bet_content, // 為前端兼容性添加 bet_value
          position: record.position, // 添加位置信息
          bet_amount: parseFloat(record.bet_amount),
          odds: parseFloat(record.odds),
          result: result,
          profit_loss: profitLoss,
          settled: record.settled, // 添加結算狀態欄位
          rebate_percentage: commissionDetails.length > 0 ? commissionDetails[0].rebate_rate * 100 : 2.0, // 轉換為百分比
          market_type: member.market_type || 'A', // 從會員資料取得
          created_at: record.created_at,
          commission_rate: 0.0,
          commission_details: commissionDetails
        };
      }));

      // 計算統計資訊
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
        data: formattedRecords, // 直接返回記錄陣列
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
      console.error('查詢會員下注記錄數據庫錯誤:', dbError);
      res.json({
        success: false,
        message: '查詢失敗，請稍後再試'
      });
    }
    
  } catch (error) {
    console.error('查詢會員下注記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 佔成明細查詢 API  
app.get(`${API_PREFIX}/bet-commission-details/:betId`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { betId } = req.params;
    
    console.log('🔍 查詢佔成明細:', betId);
    
    try {
      // 查詢投注記錄（使用正確的欄位名稱）
      const bet = await db.oneOrNone(`
        SELECT id, username, amount as bet_amount, bet_type as game_type, period
        FROM bet_history 
        WHERE id = $1
      `, [betId]);

      if (!bet) {
        return res.json({
          success: false,
          message: '投注記錄不存在'
        });
      }

      // 模擬佔成明細數據（實際應從佣金分配表查詢）
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
      console.error('查詢佔成明細數據庫錯誤:', dbError);
      res.json({
        success: false,
        message: '查詢失敗，請稍後再試'
      });
    }
    
  } catch (error) {
    console.error('查詢佔成明細失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 開獎結果查詢 API
app.get(`${API_PREFIX}/draw-result/:gameType/:periodNumber`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { gameType, periodNumber } = req.params;
    
    console.log('🎲 查詢開獎結果:', gameType, periodNumber);
    
    try {
      // 查詢開獎結果
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
          message: '該期開獎結果暫未公布'
        });
      }

      // 解析開獎號碼
      let resultNumbers = [];
      try {
        if (typeof drawResult.result === 'string') {
          resultNumbers = JSON.parse(drawResult.result);
        } else if (Array.isArray(drawResult.result)) {
          resultNumbers = drawResult.result;
        }
      } catch (parseError) {
        console.warn('解析開獎號碼失敗:', parseError);
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
      console.error('查詢開獎結果數據庫錯誤:', dbError);
      res.json({
        success: false,
        message: '查詢失敗，請稍後再試'
      });
    }
    
  } catch (error) {
    console.error('查詢開獎結果失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// ... 保持 startServer() 函數的調用 ...
startServer();

// 客服專用: 代理點數轉移操作
app.post(`${API_PREFIX}/cs-agent-transfer`, async (req, res) => {
  const { operatorId, targetAgentId, amount, transferType, description } = req.body;
  
  try {
    console.log(`客服代理點數轉移: 操作員=${operatorId}, 目標代理=${targetAgentId}, 金額=${amount}, 類型=${transferType}`);
    
    // 檢查操作員是否為客服
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '權限不足，只有客服可以執行此操作'
      });
    }
    
    // 獲取客服代理（操作員）
    const csAgent = await AgentModel.findById(operatorId);
    if (!csAgent) {
      return res.json({
        success: false,
        message: '客服用戶不存在'
      });
    }
    
    // 獲取目標代理
    const targetAgent = await AgentModel.findById(targetAgentId);
    if (!targetAgent) {
      return res.json({
        success: false,
        message: '目標代理不存在'
      });
    }
    
    const transferAmount = parseFloat(amount);
    let result;
    
    if (transferType === 'deposit') {
      // 存款：客服 -> 目標代理
      console.log(`執行存款操作: 客服(${csAgent.username}) -> 目標代理(${targetAgent.username}), 金額=${transferAmount}`);
      
      // 檢查客服餘額是否足夠
      if (parseFloat(csAgent.balance) < transferAmount) {
        return res.json({
          success: false,
          message: '客服餘額不足'
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
      // 提款：目標代理 -> 客服
      console.log(`執行提款操作: 目標代理(${targetAgent.username}) -> 客服(${csAgent.username}), 金額=${transferAmount}`);
      
      // 檢查目標代理餘額是否足夠
      if (parseFloat(targetAgent.balance) < transferAmount) {
        return res.json({
          success: false,
          message: '目標代理餘額不足'
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
        message: '無效的轉移類型'
      });
    }
    
    console.log(`客服代理點數轉移成功`);
    
    // 獲取更新後的客服餘額
    const updatedCSAgent = await AgentModel.findById(operatorId);
    
    res.json({
      success: true,
      message: '代理點數轉移成功',
      agent: {
        id: result.toAgent.id,
        username: result.toAgent.username,
        balance: result.toAgent.balance
      },
      csBalance: updatedCSAgent.balance // 返回客服最新餘額
    });
    
  } catch (error) {
    console.error('客服代理點數轉移失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系統錯誤，請稍後再試'
    });
  }
});

// 客服專用: 會員點數轉移操作
app.post(`${API_PREFIX}/cs-member-transfer`, async (req, res) => {
  const { operatorId, agentId, targetMemberUsername, amount, transferType, description } = req.body;
  
  try {
    console.log(`客服會員點數轉移: 操作員=${operatorId}, 代理=${agentId}, 目標會員=${targetMemberUsername}, 金額=${amount}, 類型=${transferType}`);
    
    // 檢查操作員是否為客服
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '權限不足，只有客服可以執行此操作'
      });
    }
    
    // 獲取客服代理（操作員）
    const csAgent = await AgentModel.findById(operatorId);
    if (!csAgent) {
      return res.json({
        success: false,
        message: '客服用戶不存在'
      });
    }
    
    // 獲取代理
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 獲取會員
    const member = await MemberModel.findByUsername(targetMemberUsername);
    if (!member) {
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 驗證會員屬於該代理
    if (member.agent_id !== parseInt(agentId)) {
      return res.json({
        success: false,
        message: '會員不屬於指定的代理'
      });
    }
    
    const transferAmount = parseFloat(amount);
    let result;
    
    if (transferType === 'deposit') {
      // 存款：客服 -> 會員（先從客服轉給代理，再從代理轉給會員）
      console.log(`執行存款操作: 客服(${csAgent.username}) -> 會員(${member.username}), 金額=${transferAmount}`);
      
      // 檢查客服餘額是否足夠
      if (parseFloat(csAgent.balance) < transferAmount) {
        return res.json({
          success: false,
          message: '客服餘額不足'
        });
      }
      
      // 開始數據庫事務
      result = await db.tx(async t => {
        // 1. 客服轉給代理
        await PointTransferModel.transferFromAgentToAgent(
          operatorId, 
          agentId, 
          transferAmount, 
          `客服給${member.username}存款-轉給代理`,
          true // 客服操作
        );
        
        // 2. 代理轉給會員
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
      // 提款：會員 -> 客服（先從會員轉給代理，再從代理轉給客服）
      console.log(`執行提款操作: 會員(${member.username}) -> 客服(${csAgent.username}), 金額=${transferAmount}`);
      
      // 檢查會員餘額是否足夠
      if (parseFloat(member.balance) < transferAmount) {
        return res.json({
          success: false,
          message: '會員餘額不足'
        });
      }
      
      // 開始數據庫事務
      result = await db.tx(async t => {
        // 1. 會員轉給代理
        await PointTransferModel.transferFromMemberToAgent(
          member.id, 
          agentId, 
          transferAmount, 
          `客服從${member.username}提款-先給代理`,
          true // 客服操作
        );
        
        // 2. 代理轉給客服
        await PointTransferModel.transferFromAgentToAgent(
          agentId, 
          operatorId, 
          transferAmount, 
          description || '客服提款操作',
          true // 客服操作
        );
        
        // 返回更新後的會員資料
        return await MemberModel.findById(member.id);
      });
    } else {
      return res.json({
        success: false,
        message: '無效的轉移類型'
      });
    }
    
    console.log(`客服會員點數轉移成功`);
    
    // 重新獲取最新的會員和客服資料
    const updatedMember = await MemberModel.findById(member.id);
    const updatedCSAgent = await AgentModel.findById(operatorId);
    
    res.json({
      success: true,
      message: '會員點數轉移成功',
      member: {
        id: updatedMember.id,
        username: updatedMember.username,
        balance: updatedMember.balance
      },
      csBalance: updatedCSAgent.balance // 返回客服最新餘額
    });
    
  } catch (error) {
    console.error('客服會員點數轉移失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '系統錯誤，請稍後再試'
    });
  }
});

// 獲取客服交易記錄（包含所有cs_deposit和cs_withdraw類型的交易）
app.get(`${API_PREFIX}/cs-transactions`, async (req, res) => {
  const { operatorId, page = 1, limit = 20, userType = 'all', transactionType = 'all' } = req.query;
  
  try {
    console.log(`獲取客服交易記錄: 操作員=${operatorId}, 頁碼=${page}, 數量=${limit}`);
    
    // 檢查操作員是否為客服（總代理）
    const operator = await AgentModel.findById(operatorId);
    if (!operator || operator.level !== 0) {
      return res.json({
        success: false,
        message: '權限不足，只有總代理可以查看此記錄'
      });
    }
    
    // 獲取該總代理下的所有下級代理ID（包括自己）
    const allDownlineAgents = await getAllDownlineAgents(operatorId);
    const allAgentIds = [...allDownlineAgents, parseInt(operatorId)]; // 包含自己
    
    // 獲取這些代理下的所有會員ID - 使用IN語法替代ANY
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
    
    // 使用IN語法替代ANY語法
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
      // 沒有代理ID，返回空結果
      query += ` AND 1=0`;
    }
    
    // 篩選用戶類型
    if (userType !== 'all') {
      query += ` AND t.user_type = $${params.length + 1}`;
      params.push(userType);
    }
    
    // 篩選交易類型
    if (transactionType !== 'all') {
      query += ` AND t.transaction_type = $${params.length + 1}`;
      params.push(transactionType);
    }
    
    // 獲取總數
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/i, 'SELECT COUNT(*) FROM');
    const totalResult = await db.one(countQuery, params);
    const total = parseInt(totalResult.count);
    
    // 添加排序和分頁
    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const transactions = await db.any(query, params);
    
    console.log(`獲取客服交易記錄成功: 找到 ${transactions.length} 筆記錄，總計 ${total} 筆`);
    
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
    console.error('獲取客服交易記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 獲取代理交易記錄（按類型篩選）
app.get(`${API_PREFIX}/transactions`, async (req, res) => {
  const { agentId, type, page = 1, limit = 20 } = req.query;
  
  try {
    console.log(`獲取交易記錄: 代理ID=${agentId}, 類型=${type}, 頁碼=${page}, 數量=${limit}`);
    
    if (!agentId) {
      return res.json({
        success: false,
        message: '請提供代理ID'
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
    
    // 數據隔離：每個代理只能查看自己線下的交易記錄
    if (agent.level === 0) {
      // 總代理只能查看自己盤口線下的交易記錄，不能查看其他盤口
      // 獲取該總代理下的所有下級代理ID（包括自己）
      const allDownlineAgents = await getAllDownlineAgents(agentId);
      const allAgentIds = [...allDownlineAgents, agentId]; // 包含自己
      
      // 獲取這些代理下的所有會員ID - 使用IN語法替代ANY
      let memberQuery = 'SELECT id FROM members WHERE agent_id IN (';
      memberQuery += allAgentIds.map((_, i) => `$${i + 1}`).join(',');
      memberQuery += ')';
      const members = await db.any(memberQuery, allAgentIds);
      const memberIds = members.map(m => parseInt(m.id));
      
      // 使用IN語法替代ANY語法
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
        // 沒有代理ID，返回空結果
        query += ` AND 1=0`;
      }
    } else {
      // 非總代理只能查看自己和直接下級的交易
      const members = await db.any('SELECT id FROM members WHERE agent_id = $1', [agentId]);
      const memberIds = members.map(m => parseInt(m.id)); // 確保是整數
      
      console.log(`非總代理${agentId}的會員IDs:`, memberIds);
      
      if (memberIds.length > 0) {
        const memberPlaceholders = memberIds.map((_, i) => `$${params.length + 2 + i}`).join(',');
        query += ` AND ((t.user_type = 'agent' AND t.user_id = $${params.length + 1}) OR (t.user_type = 'member' AND t.user_id IN (${memberPlaceholders})))`;
        params.push(parseInt(agentId), ...memberIds);
      } else {
        query += ` AND t.user_type = 'agent' AND t.user_id = $${params.length + 1}`;
        params.push(parseInt(agentId));
      }
    }
    
    // 按類型篩選 - 修復交易類型分類
    if (type === 'deposit') {
      // 存款記錄：只有客服存款操作
      query += ` AND t.transaction_type = 'cs_deposit'`;
    } else if (type === 'withdraw') {
      // 提款記錄：只有客服提款操作
      query += ` AND t.transaction_type = 'cs_withdraw'`;
    } else if (type === 'rebate') {
      // 退水記錄
      query += ` AND t.transaction_type = 'rebate'`;
    } else if (type === 'bet') {
      // 下注記錄：包含遊戲下注和中獎
      query += ` AND (t.transaction_type = 'game_bet' OR t.transaction_type = 'game_win')`;
    }
    
    // 獲取總數
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/i, 'SELECT COUNT(*) FROM');
    const totalResult = await db.one(countQuery, params);
    const total = parseInt(totalResult.count);
    
    // 添加排序和分頁
    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const transactions = await db.any(query, params);
    
    console.log(`獲取交易記錄成功: 找到 ${transactions.length} 筆記錄，總計 ${total} 筆`);
    
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
    console.error('獲取交易記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// ... existing code ...

// 重設代理密碼
app.post(`${API_PREFIX}/reset-agent-password`, async (req, res) => {
  const { userId, newPassword, operatorId } = req.body;
  
  try {
    console.log(`重設代理密碼: 代理ID=${userId}, 操作員=${operatorId}`);
    
    // 驗證參數
    if (!userId || !newPassword || !operatorId) {
      return res.json({
        success: false,
        message: '參數不完整'
      });
    }
    
    // 驗證密碼長度
    if (newPassword.length < 6) {
      return res.json({
        success: false,
        message: '密碼長度至少6個字符'
      });
    }
    
    // 檢查操作員權限（只有上級代理可以重設下級密碼）
    const operator = await AgentModel.findById(operatorId);
    if (!operator) {
      return res.json({
        success: false,
        message: '操作員不存在'
      });
    }
    
    // 檢查目標代理是否存在
    const targetAgent = await AgentModel.findById(userId);
    if (!targetAgent) {
      return res.json({
        success: false,
        message: '目標代理不存在'
      });
    }
    
    // 權限檢查：只有總代理或直接上級可以重設密碼
    if (operator.level !== 0 && targetAgent.parent_id !== operator.id) {
      return res.json({
        success: false,
        message: '權限不足，只能重設直接下級代理的密碼'
      });
    }
    
    // 更新密碼（後端會自動加密）
    const result = await AgentModel.updatePassword(userId, newPassword);
    
    if (result) {
      // 記錄操作日誌
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
        `密碼重設 by ${operator.username}`
      ]);
      
      console.log(`代理密碼重設成功: ${targetAgent.username}`);
      res.json({
        success: true,
        message: '密碼重設成功'
      });
    } else {
      res.json({
        success: false,
        message: '密碼重設失敗'
      });
    }
  } catch (error) {
    console.error('重設代理密碼錯誤:', error);
    res.json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

// 重設會員密碼
app.post(`${API_PREFIX}/reset-member-password`, async (req, res) => {
  const { userId, newPassword, operatorId } = req.body;
  
  try {
    console.log(`重設會員密碼: 會員ID=${userId}, 操作員=${operatorId}`);
    
    // 驗證參數
    if (!userId || !newPassword || !operatorId) {
      return res.json({
        success: false,
        message: '參數不完整'
      });
    }
    
    // 驗證密碼長度
    if (newPassword.length < 6) {
      return res.json({
        success: false,
        message: '密碼長度至少6個字符'
      });
    }
    
    // 檢查操作員權限
    const operator = await AgentModel.findById(operatorId);
    if (!operator) {
      return res.json({
        success: false,
        message: '操作員不存在'
      });
    }
    
    // 檢查目標會員是否存在
    const targetMember = await MemberModel.findById(userId);
    if (!targetMember) {
      return res.json({
        success: false,
        message: '目標會員不存在'
      });
    }
    
    // 權限檢查：只有該會員的代理或總代理可以重設密碼
    if (operator.level !== 0 && targetMember.agent_id !== operator.id) {
      return res.json({
        success: false,
        message: '權限不足，只能重設自己旗下會員的密碼'
      });
    }
    
    // 更新密碼
    const result = await MemberModel.updatePassword(userId, newPassword);
    
    if (result) {
      // 記錄操作日誌
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
        `密碼重設 by ${operator.username}`
      ]);
      
      console.log(`會員密碼重設成功: ${targetMember.username}`);
      res.json({
        success: true,
        message: '密碼重設成功'
      });
    } else {
      res.json({
        success: false,
        message: '密碼重設失敗'
      });
    }
  } catch (error) {
    console.error('重設會員密碼錯誤:', error);
    res.json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

// ... existing code ...

//獲取代理個人資料
app.get(`${API_PREFIX}/agent-profile/:agentId`, async (req, res) => {
  const { agentId } = req.params;
  
  try {
    console.log(`獲取代理個人資料: 代理ID=${agentId}`);
    
    // 參數驗證
    const parsedAgentId = parseInt(agentId);
    if (isNaN(parsedAgentId)) {
      console.error(`獲取個人資料失敗: 代理ID "${agentId}" 不是有效的數字`);
      return res.json({
        success: false,
        message: '代理ID格式錯誤'
      });
    }
    
    // 檢查代理是否存在
    const agent = await AgentModel.findById(parsedAgentId);
    if (!agent) {
      console.error(`獲取個人資料失敗: 代理ID ${parsedAgentId} 不存在`);
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 查詢個人資料
    const profile = await db.oneOrNone(`
      SELECT * FROM agents WHERE agent_id = $1
    `, [parsedAgentId]);
    
    console.log('查詢到的個人資料:', profile);
    
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
    console.error('獲取代理個人資料錯誤:', error);
    console.error('錯誤堆疊:', error.stack);
    res.json({
      success: false,
      message: '服務器錯誤'
    });
  }
});

// 更新代理個人資料
app.post(`${API_PREFIX}/update-agent-profile`, async (req, res) => {
  const { agentId, realName, phone, email, lineId, telegram, address, remark } = req.body;
  
  try {
    console.log(`更新代理個人資料: 代理ID=${agentId}`);
    console.log('請求參數:', req.body);
    
    // 參數驗證
    if (!agentId) {
      console.error('更新個人資料失敗: 缺少代理ID');
      return res.json({
        success: false,
        message: '缺少代理ID'
      });
    }
    
    // 確保agentId是數字
    const parsedAgentId = parseInt(agentId);
    if (isNaN(parsedAgentId)) {
      console.error(`更新個人資料失敗: 代理ID "${agentId}" 不是有效的數字`);
      return res.json({
        success: false,
        message: '代理ID格式錯誤'
      });
    }
    
    // 檢查代理是否存在
    const agent = await AgentModel.findById(parsedAgentId);
    if (!agent) {
      console.error(`更新個人資料失敗: 代理ID ${parsedAgentId} 不存在`);
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 處理可能為空的字段值
    const safeRealName = realName || null;
    const safePhone = phone || null;
    const safeEmail = email || null;
    const safeLineId = lineId || null;
    const safeTelegram = telegram || null;
    const safeAddress = address || null;
    const safeRemark = remark || null;
    
    console.log('安全處理後的參數:', {
      agentId: parsedAgentId,
      realName: safeRealName,
      phone: safePhone,
      email: safeEmail,
      lineId: safeLineId,
      telegram: safeTelegram,
      address: safeAddress,
      remark: safeRemark
    });
    
    // 檢查是否已有個人資料記錄
    const existingProfile = await db.oneOrNone(`
      SELECT * FROM agents WHERE agent_id = $1
    `, [parsedAgentId]);
    
    if (existingProfile) {
      console.log(`找到現有個人資料記錄，ID=${existingProfile.id}，執行更新`);
      // 更新現有記錄
      await db.none(`
        UPDATE agents 
        SET real_name = $1, phone = $2, email = $3, line_id = $4, 
            telegram = $5, address = $6, remark = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE agent_id = $8
      `, [safeRealName, safePhone, safeEmail, safeLineId, safeTelegram, safeAddress, safeRemark, parsedAgentId]);
      console.log('個人資料更新完成');
    } else {
      console.log('未找到現有記錄，創建新的個人資料記錄');
      // 創建新記錄
      await db.none(`
        INSERT INTO agents 
        (agent_id, real_name, phone, email, line_id, telegram, address, remark)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [parsedAgentId, safeRealName, safePhone, safeEmail, safeLineId, safeTelegram, safeAddress, safeRemark]);
      console.log('個人資料創建完成');
    }
    
    console.log(`代理個人資料更新成功: ${agent.username}`);
    res.json({
      success: true,
      message: '個人資料更新成功'
    });
    
  } catch (error) {
    console.error('更新代理個人資料錯誤:', error);
    console.error('錯誤堆疊:', error.stack);
    
    // 更詳細的錯誤信息
    let errorMessage = '服務器錯誤';
    if (error.code === '23505') {
      errorMessage = '代理個人資料記錄已存在';
    } else if (error.code === '23503') {
      errorMessage = '代理不存在或已被刪除';
    } else if (error.code === '22001') {
      errorMessage = '輸入的資料過長，請檢查各欄位長度';
    } else if (error.message) {
      errorMessage = `數據庫錯誤: ${error.message}`;
    }
    
    res.json({
      success: false,
      message: errorMessage
    });
  }
});

// ... existing code ...

// 全局錯誤處理中間件
app.use((err, req, res, next) => {
  console.error('未捕獲的錯誤:', err);
  
  // 處理 pg-promise 的 "Multiple rows were not expected" 錯誤
  if (err.message && err.message.includes('Multiple rows were not expected')) {
    console.error('數據庫查詢返回了多筆記錄，但期望只有一筆');
    return res.status(500).json({
      success: false,
      message: '數據庫查詢異常，請聯繫系統管理員'
    });
  }
  
  // 處理其他數據庫錯誤
  if (err.code) {
    console.error('數據庫錯誤代碼:', err.code);
    return res.status(500).json({
      success: false,
      message: '數據庫操作失敗'
    });
  }
  
  // 通用錯誤處理
  return res.status(500).json({
    success: false,
    message: '系統內部錯誤'
  });
});

// 特殊處理：期數格式的直接訪問 (例如 /20250705510)
app.get(/^\/\d{11}$/, (req, res) => {
  const period = req.url.substring(1);
  console.log(`🎯 檢測到期數格式的直接訪問: ${period}`);
  console.log(`📍 請求來源: ${req.headers.referer || '直接訪問'}`);
  
  res.status(404).json({
    success: false,
    message: `期數 ${period} 不能直接訪問，請使用 API`,
    error: 'PERIOD_DIRECT_ACCESS_NOT_ALLOWED',
    suggestion: `請使用 /api/agent/draw-history?period=${period} 查詢開獎記錄`
  });
});

// 為所有客服相關 API 添加 try-catch 包裝器
function wrapAsync(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// 新增: 下注/中獎交易同步API（建立交易記錄用於統計）
app.post(`${API_PREFIX}/sync-bet-transaction`, async (req, res) => {
  const { agentId, username, amount, newBalance, type, description } = req.body;
  
  console.log(`收到下注/中獎同步請求: 代理ID=${agentId}, 會員=${username}, 金額=${amount}, 新餘額=${newBalance}, 類型=${type}, 說明=${description}`);
  
  try {
    if (!username || amount === undefined || !agentId || newBalance === undefined) {
      console.error('同步下注/中獎失敗: 缺少必要參數');
      return res.json({
        success: false,
        message: '請提供完整的同步參數'
      });
    }
    
    // 查詢會員
    const member = await MemberModel.findByUsername(username);
    if (!member) {
      console.error(`同步下注/中獎失敗: 會員 ${username} 不存在`);
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 查詢代理
    const agent = await AgentModel.findById(agentId);
    if (!agent) {
      console.error(`同步下注/中獎失敗: 代理 ID=${agentId} 不存在`);
      return res.json({
        success: false,
        message: '代理不存在'
      });
    }
    
    // 驗證會員是否屬於該代理
    if (member.agent_id !== agent.id) {
      console.error(`同步下注/中獎失敗: 會員 ${username} 不屬於代理 ${agent.username}`);
      return res.json({
        success: false,
        message: '會員與代理不匹配'
      });
    }
    
    // 更新會員餘額
    await MemberModel.setBalance(username, newBalance);
    console.log(`會員 ${username} 餘額已更新為: ${newBalance}`);
    
    // 建立交易記錄用於統計
    const transactionType = type === 'win' ? 'game_win' : 'game_bet';
    await TransactionModel.create({
      user_type: 'member',
      user_id: member.id,
      amount: parseFloat(amount),
      type: transactionType,
      description: description || `遊戲${type === 'win' ? '中獎' : '下注'}`,
      balance_after: parseFloat(newBalance)
    });
    
    console.log(`交易記錄已建立: 會員ID=${member.id}, 金額=${amount}, 類型=${transactionType}`);
    
    res.json({
      success: true,
      message: '下注/中獎同步成功',
      balance: newBalance
    });
  } catch (error) {
    console.error('同步下注/中獎出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 獲取會員信息API
app.get(`${API_PREFIX}/member/info/:username`, async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '缺少用戶名參數'
      });
    }
    
    // 查找會員
    const member = await MemberModel.findByUsername(username);
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: '會員不存在'
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
    console.error('獲取會員信息失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取會員信息失敗',
      error: error.message
    });
  }
});

// 新增: 扣除會員餘額API（用於遊戲下注）- 使用安全鎖定機制
app.post(`${API_PREFIX}/deduct-member-balance`, async (req, res) => {
  const { username, amount, reason } = req.body;
  
  console.log(`收到扣除會員餘額請求: 會員=${username}, 金額=${amount}, 原因=${reason}`);
  
  try {
    if (!username || amount === undefined) {
      return res.json({
        success: false,
        message: '請提供會員用戶名和扣除金額'
      });
    }
    
    const deductAmount = parseFloat(amount);
    if (isNaN(deductAmount) || deductAmount <= 0) {
      return res.json({
        success: false,
        message: '扣除金額必須大於0'
      });
    }
    
    // 生成唯一的下注ID用於鎖定
    const betId = `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // 使用安全的扣款函數（帶鎖定機制）
      const result = await db.one(`
        SELECT * FROM safe_bet_deduction($1, $2, $3)
      `, [username, deductAmount, betId]);
      
      if (result.success) {
        console.log(`成功扣除會員 ${username} 餘額 ${deductAmount} 元，新餘額: ${result.balance}`);
        
        // 記錄交易歷史
        try {
          const member = await MemberModel.findByUsername(username);
          if (member) {
            await db.none(`
              INSERT INTO transaction_records 
              (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, ['member', member.id, -deductAmount, 'game_bet', 
                parseFloat(result.balance) + deductAmount, parseFloat(result.balance), 
                reason || '遊戲下注']);
          }
        } catch (logError) {
          console.error('記錄交易歷史失敗:', logError);
          // 不影響主要操作
        }
        
        res.json({
          success: true,
          message: '餘額扣除成功',
          balance: parseFloat(result.balance),
          deductedAmount: deductAmount
        });
      } else {
        console.log(`扣除餘額失敗: ${result.message}`);
        res.json({
          success: false,
          message: result.message,
          balance: parseFloat(result.balance)
        });
      }
    } catch (dbError) {
      console.error('執行安全扣款函數失敗:', dbError);
      
      // 如果函數不存在，使用傳統方式（向後兼容）
      if (dbError.code === '42883') { // function does not exist
        console.log('安全扣款函數不存在，使用傳統方式');
        
        // 查詢會員
        const member = await MemberModel.findByUsername(username);
        if (!member) {
          console.log(`扣除餘額失敗: 會員 ${username} 不存在`);
          return res.json({
            success: false,
            message: '會員不存在'
          });
        }
        
        const currentBalance = parseFloat(member.balance);
        const afterBalance = currentBalance - deductAmount;
        
        // 檢查餘額是否足夠
        if (afterBalance < 0) {
          console.log(`扣除余额失败: 会员 ${username} 余额不足 (当前: ${currentBalance}, 尝试扣除: ${deductAmount})`);
          return res.json({
            success: false,
            message: '余额不足'
          });
        }
        
        // 執行扣除操作（使用負金額表示扣除）
        const updatedMember = await MemberModel.updateBalance(username, -deductAmount);
        
        console.log(`成功扣除會員 ${username} 餘額 ${deductAmount} 元，新餘額: ${updatedMember.balance}`);
        
        res.json({
          success: true,
          message: '餘額扣除成功',
          balance: parseFloat(updatedMember.balance),
          deductedAmount: deductAmount
        });
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('扣除會員餘額出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 新增: 批量扣除會員餘額API（用於多筆同時下注）
app.post(`${API_PREFIX}/batch-deduct-member-balance`, async (req, res) => {
  const { username, bets } = req.body;
  
  console.log(`收到批量扣除會員餘額請求: 會員=${username}, 下注筆數=${bets?.length || 0}`);
  
  try {
    if (!username || !bets || !Array.isArray(bets) || bets.length === 0) {
      return res.json({
        success: false,
        message: '請提供會員用戶名和下注列表'
      });
    }
    
    // 驗證所有下注金額
    for (let i = 0; i < bets.length; i++) {
      const bet = bets[i];
      if (!bet.amount || parseFloat(bet.amount) <= 0) {
        return res.json({
          success: false,
          message: `第 ${i + 1} 筆下注金額無效`
        });
      }
    }
    
    // 生成每筆下注的唯一ID
    const betsWithIds = bets.map((bet, index) => ({
      amount: parseFloat(bet.amount),
      bet_id: bet.bet_id || `bet_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`
    }));
    
    try {
      // 使用批量扣款函數
      const result = await db.one(`
        SELECT * FROM batch_bet_deduction($1, $2::jsonb)
      `, [username, JSON.stringify(betsWithIds)]);
      
      if (result.success) {
        console.log(`成功批量扣除會員 ${username} 餘額，總金額: ${result.total_deducted} 元，新餘額: ${result.balance}`);
        
        // 記錄交易歷史
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
                `批量下注 ${bets.length} 筆`]);
          }
        } catch (logError) {
          console.error('記錄交易歷史失敗:', logError);
          // 不影響主要操作
        }
        
        res.json({
          success: true,
          message: '批量餘額扣除成功',
          balance: parseFloat(result.balance),
          totalDeducted: parseFloat(result.total_deducted),
          processedBets: betsWithIds,
          failedBets: result.failed_bets || []
        });
      } else {
        console.log(`批量扣除餘額失敗: ${result.message}`);
        res.json({
          success: false,
          message: result.message,
          balance: parseFloat(result.balance),
          failedBets: result.failed_bets || bets
        });
      }
    } catch (dbError) {
      console.error('執行批量扣款函數失敗:', dbError);
      
      // 如果函數不存在，降級到逐筆處理
      if (dbError.code === '42883') { // function does not exist
        console.log('批量扣款函數不存在，降級到逐筆處理');
        
        // 使用事務逐筆處理
        let totalDeducted = 0;
        let finalBalance = 0;
        const processedBets = [];
        const failedBets = [];
        
        try {
          await db.tx(async t => {
            // 先檢查總餘額是否足夠
            const member = await t.oneOrNone('SELECT * FROM members WHERE username = $1 FOR UPDATE', [username]);
            if (!member) {
              throw new Error('會員不存在');
            }
            
            const totalAmount = betsWithIds.reduce((sum, bet) => sum + bet.amount, 0);
            if (parseFloat(member.balance) < totalAmount) {
              throw new Error('余额不足');
            }
            
            // 執行批量扣款
            finalBalance = await t.one(`
              UPDATE members 
              SET balance = balance - $1 
              WHERE username = $2 
              RETURNING balance
            `, [totalAmount, username]).then(r => parseFloat(r.balance));
            
            totalDeducted = totalAmount;
            processedBets.push(...betsWithIds);
          });
          
          console.log(`降級處理成功: 總扣款 ${totalDeducted} 元，新餘額 ${finalBalance}`);
          
          res.json({
            success: true,
            message: '批量餘額扣除成功（降級處理）',
            balance: finalBalance,
            totalDeducted: totalDeducted,
            processedBets: processedBets,
            failedBets: failedBets
          });
        } catch (txError) {
          console.error('降級處理失敗:', txError);
          res.json({
            success: false,
            message: txError.message || '批量扣款失敗',
            failedBets: betsWithIds
          });
        }
      } else {
        throw dbError;
      }
    }
  } catch (error) {
    console.error('批量扣除會員餘額出錯:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 登錄日誌API - 獲取當前用戶的登錄記錄
app.get(`${API_PREFIX}/login-logs`, async (req, res) => {
  try {
    // 使用通用認證中間件
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { agent } = authResult;

    const { startDate, endDate } = req.query;
    
    // 構建查詢條件
    let whereClause = 'WHERE username = $1';
    let queryParams = [agent.username];
    
    // 檢查日期參數是否有效（不是空字符串、undefined或null）
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
    
    // 查詢登錄日誌（假設有 user_login_logs 表）
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
    console.error('獲取登錄日誌失敗:', error);
    
    // 如果表不存在，返回空數據而不是錯誤
    if (error.message.includes('does not exist') || error.message.includes('relation')) {
      return res.json({
        success: true,
        logs: [],
        message: '登錄日誌表尚未創建'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '獲取登錄日誌失敗',
      error: error.message
    });
  }
});

// 報表查詢API - 獲取投注報表數據
app.get(`${API_PREFIX}/reports`, async (req, res) => {
  try {
    // 使用通用認證中間件
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { agent } = authResult;

    const { startDate, endDate, gameTypes, settlementStatus, betType, username, minAmount, maxAmount } = req.query;
    
    // 構建查詢條件
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramIndex = 1;
    
    // 暫時移除代理權限過濾，因為bet_history表沒有agent_id欄位
    // TODO: 未來需要加入代理關聯查詢
    
    // 檢查日期參數是否有效
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
    
    // 查詢投注記錄（使用真實的 bet_history 表）
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

    // 計算統計數據
    const totalBets = records.length;
    const totalAmount = records.reduce((sum, r) => sum + parseFloat(r.bet_amount || 0), 0);
    const validAmount = totalAmount; // 假設所有投注都是有效投注
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
    console.error('獲取報表數據失敗:', error);
    
    // 如果表不存在，返回空數據而不是錯誤
    if (error.message.includes('does not exist') || error.message.includes('relation')) {
      return res.json({
        success: true,
        totalBets: 0,
        totalAmount: 0,
        validAmount: 0,
        profitLoss: 0,
        records: [],
        message: '投注記錄表尚未創建'
      });
    }
    
    res.status(500).json({
      success: false,
      message: '獲取報表數據失敗',
      error: error.message
    });
  }
});

// 層級會員管理 API
app.get(`${API_PREFIX}/hierarchical-members`, async (req, res) => {
    try {
        const authResult = await authenticateAgent(req);
        if (!authResult.success) {
            return res.status(401).json(authResult);
        }

        const { agent: currentAgent } = authResult;
        const queryAgentId = parseInt(req.query.agentId) || currentAgent.id;
        const { status, keyword } = req.query;
        
        console.log('📊 層級會員管理API調用:', { queryAgentId, status, keyword });
        
        // 輔助函數：獲取級別名稱
        function getLevelName(level) {
            const levels = {
                0: '總代理',
                1: '一級代理', 
                2: '二級代理',
                3: '三級代理',
                4: '四級代理',
                5: '五級代理',
                6: '六級代理',
                7: '七級代理',
                8: '八級代理',
                9: '九級代理',
                10: '十級代理',
                11: '十一級代理',
                12: '十二級代理',
                13: '十三級代理',
                14: '十四級代理',
                15: '十五級代理'
            };
            return levels[level] || `${level}級代理`;
        }
        
        // 獲取直接創建的代理
        const directAgents = await db.any(`
            SELECT id, username, level, balance, status, created_at, notes,
                   rebate_mode, rebate_percentage, max_rebate_percentage, market_type, betting_limit_level
            FROM agents WHERE parent_id = $1 ORDER BY level, username
        `, [queryAgentId]);
        
        // 獲取直接創建的會員
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
        
        // 檢查每個代理是否有下級
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
                    // 保持 level 為原始數字，讓前端處理顯示
                    level: agent.level
                };
            })
        );
        
        // 處理會員數據
        const membersWithType = directMembers.map(member => ({
            ...member,
            userType: 'member',
            hasDownline: false,
            level: '會員'
        }));
        
        // 合併代理和會員數據
        const combinedData = [...agentsWithDownline, ...membersWithType];
        
        // 過濾關鍵字（如果有的話）
        let filteredData = combinedData;
        if (keyword) {
            filteredData = combinedData.filter(item => 
                item.username.toLowerCase().includes(keyword.toLowerCase()) ||
                item.id.toString().includes(keyword)
            );
        }
        
        // 過濾狀態（如果有的話）
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
            message: '層級會員管理數據獲取成功'
        });
        
    } catch (error) {
        console.error('❌ 層級會員管理API錯誤:', error);
        res.status(500).json({
            success: false,
            message: '獲取層級會員管理數據失敗',
            error: error.message
        });
    }
});

// 代理層級分析報表API - 簡化版：統一顯示本級創建的代理和會員
// 代理層級分析報表API - 高性能優化版本，消除遞歸查詢
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
    
    console.log(`🔍 當前登入代理: ${currentAgent.username} (退水: ${(currentAgent.rebate_percentage * 100).toFixed(1)}%)`);
    console.log(`🎯 目標代理參數: ${targetAgent || '無'}`);
    
    if (targetAgent) {
      const targetAgentData = await AgentModel.findByUsername(targetAgent);
      if (targetAgentData) {
        queryAgentId = targetAgentData.id;
        queryAgent = targetAgentData;
        console.log(`✅ 找到目標代理: ${targetAgentData.username} (退水: ${(targetAgentData.rebate_percentage * 100).toFixed(1)}%)`);
      } else {
        return res.json({ success: true, reportData: [], hasData: false, currentAgent: queryAgent, totalSummary: {}, message: `目標代理 ${targetAgent} 不存在` });
      }
    }
    
    console.log('📊 代理層級分析查詢:', { queryAgentId, startDate, endDate, username, targetAgent });
    
    // 查詢本級下所有直屬代理（包含退水百分比）
    const agents = await db.any(`SELECT * FROM agents WHERE parent_id = $1 AND status = 1`, [queryAgentId]);
    // 查詢本級下所有直屬會員
    const members = await db.any(`SELECT * FROM members WHERE agent_id = $1 AND status = 1`, [queryAgentId]);
    
    // 獲取查詢代理的退水百分比
    const queryAgentRebate = parseFloat(queryAgent.rebate_percentage || 0);
    
    console.log(`📈 查詢結果: ${agents.length}個代理, ${members.length}個會員`);
    console.log(`💰 查詢代理 ${queryAgent.username} 的退水設定: ${(queryAgentRebate * 100).toFixed(1)}%`);
    
    // 構建日期篩選條件
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
    
    // 統計每個代理的下注數據
    const agentStats = await Promise.all(agents.map(async agent => {
      let stats = { betcount: 0, betamount: 0, memberwinloss: 0 };
      
      if (dateParams.length > 0) {
        // 有日期篩選條件時，查詢該期間的下注數據
        stats = await db.oneOrNone(
          `SELECT COUNT(*) as betCount, COALESCE(SUM(amount),0) as betAmount, COALESCE(SUM(CASE WHEN settled THEN win_amount-amount ELSE 0 END),0) as memberWinLoss
           FROM bet_history bh WHERE username IN (SELECT username FROM members WHERE agent_id = $1) ${dateFilter}`, 
          [agent.id, ...dateParams]
        ) || { betcount: 0, betamount: 0, memberwinloss: 0 };
      } else {
        // 無日期篩選條件時，查詢所有下注數據
        stats = await db.oneOrNone(
          `SELECT COUNT(*) as betCount, COALESCE(SUM(amount),0) as betAmount, COALESCE(SUM(CASE WHEN settled THEN win_amount-amount ELSE 0 END),0) as memberWinLoss
           FROM bet_history WHERE username IN (SELECT username FROM members WHERE agent_id = $1)`, 
          [agent.id]
        ) || { betcount: 0, betamount: 0, memberwinloss: 0 };
      }
      
      // 新退水邏輯：查看下級代理時，顯示退水差額（自己的退水% - 下級代理的退水%）
      const agentRebatePercentage = parseFloat(agent.rebate_percentage || 0);
      const queryAgentRebatePercentage = parseFloat(queryAgent.rebate_percentage || 0);
      const earnedRebatePercentage = queryAgentRebatePercentage - agentRebatePercentage; // 退水差額
      const earnedRebateAmount = parseFloat(stats.betamount || 0) * earnedRebatePercentage;
      
      console.log(`💰 下級代理 ${agent.username}: 查詢代理退水 ${(queryAgentRebatePercentage * 100).toFixed(1)}% - 下級代理退水 ${(agentRebatePercentage * 100).toFixed(1)}% = 賺水 ${(earnedRebatePercentage * 100).toFixed(1)}%`);
      
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
    
    // 統計每個會員的下注數據
    const memberStats = await Promise.all(members.map(async member => {
      let stats = { betcount: 0, betamount: 0, memberwinloss: 0 };
      
      if (dateParams.length > 0) {
        // 有日期篩選條件時，查詢該期間的下注數據
        stats = await db.oneOrNone(
          `SELECT COUNT(*) as betCount, COALESCE(SUM(amount),0) as betAmount, COALESCE(SUM(CASE WHEN settled THEN win_amount-amount ELSE 0 END),0) as memberWinLoss
           FROM bet_history bh WHERE username = $1 ${dateFilter}`, 
          [member.username, ...dateParams]
        ) || { betcount: 0, betamount: 0, memberwinloss: 0 };
      } else {
        // 無日期篩選條件時，查詢所有下注數據
        stats = await db.oneOrNone(
          `SELECT COUNT(*) as betCount, COALESCE(SUM(amount),0) as betAmount, COALESCE(SUM(CASE WHEN settled THEN win_amount-amount ELSE 0 END),0) as memberWinLoss
           FROM bet_history WHERE username = $1`, 
          [member.username]
        ) || { betcount: 0, betamount: 0, memberwinloss: 0 };
      }
      
      // 新退水邏輯：查看會員時，顯示自己的完整退水百分比
      const earnedRebatePercentage = queryAgentRebate; // 使用查詢代理的完整退水設定
      const earnedRebateAmount = parseFloat(stats.betamount || 0) * earnedRebatePercentage;
      
      return {
        id: member.id,
        username: member.username,
        userType: 'member',
        level: '會員',
        balance: parseFloat(member.balance || 0),
        betCount: parseInt(stats.betcount) || 0,
        betAmount: parseFloat(stats.betamount) || 0,
        validAmount: parseFloat(stats.betamount) || 0,
        memberWinLoss: parseFloat(stats.memberwinloss) || 0,
        rebatePercentage: 0, // 會員沒有退水
        earnedRebatePercentage: earnedRebatePercentage,
        earnedRebateAmount: earnedRebateAmount,
        hasDownline: false
      };
    }));
    
    const reportData = [...agentStats, ...memberStats];
    
    // 計算總計時，賺水金額為所有個別項目的賺水金額之和
    const totalBetAmount = reportData.reduce((a, b) => a + (b.betAmount || 0), 0);
    const totalEarnedRebateAmount = reportData.reduce((a, b) => a + (b.earnedRebateAmount || 0), 0);
    
    console.log(`💵 總計計算: 總下注 ${totalBetAmount}, 總賺水 ${totalEarnedRebateAmount.toFixed(2)}`);
    
    const totalSummary = {
      betCount: reportData.reduce((a, b) => a + (b.betCount || 0), 0),
      betAmount: totalBetAmount,
      validAmount: reportData.reduce((a, b) => a + (b.validAmount || 0), 0),
      memberWinLoss: reportData.reduce((a, b) => a + (b.memberWinLoss || 0), 0),
      earnedRebateAmount: totalEarnedRebateAmount // 使用查詢代理的退水百分比計算
    };
    
    // 添加agentInfo字段
    const agentInfo = {
      id: queryAgent.id,
      username: queryAgent.username,
      agentCount: agents.length,
      memberCount: members.length
    };
    
    console.log(`📊 返回數據: ${reportData.length}個項目 (${agents.length}代理 + ${members.length}會員)`);
    
    res.json({ 
      success: true, 
      reportData, 
      totalSummary, 
      hasData: reportData.length > 0, 
      currentAgent: queryAgent,
      agentInfo: agentInfo
    });
  } catch (error) {
    console.error('代理層級分析API錯誤:', error);
    res.json({ success: false, reportData: [], totalSummary: {}, hasData: false, message: error.message });
  }
});



// 創建通用認證中間件
async function authenticateAgent(req) {
  const legacyToken = req.headers.authorization?.replace('Bearer ', '');
  const sessionToken = req.headers['x-session-token'] || req.headers['X-Session-Token'];
  
  console.log('🔐 認證中間件調用:', { 
    hasLegacyToken: !!legacyToken, 
    hasSessionToken: !!sessionToken,
    headers: Object.keys(req.headers)
  });
  
  // 優先使用新的session token
  if (sessionToken) {
    try {
      const session = await SessionManager.validateSession(sessionToken);
      if (session && session.userType === 'agent') {
        const agent = await AgentModel.findById(session.userId);
        if (agent) {
          console.log('✅ Session token認證成功:', agent.username);
          return { success: true, agent, session };
        }
      }
    } catch (error) {
      console.error('Session token驗證失敗:', error);
    }
  }
  
  // 向後兼容舊的legacy token
  if (legacyToken) {
    try {
      // 解析legacy token格式: agentId:timestamp
      const decoded = Buffer.from(legacyToken, 'base64').toString();
      const [agentId, timestamp] = decoded.split(':');
      
      if (agentId && timestamp) {
        const agent = await AgentModel.findById(parseInt(agentId));
        if (agent) {
          console.log('✅ Legacy token認證成功:', agent.username);
          return { success: true, agent, session: { userId: agent.id, userType: 'agent' } };
        }
      }
    } catch (error) {
      console.error('Legacy token解析錯誤:', error);
    }
  }
  
  console.log('❌ 認證失敗: 無有效token');
  return { success: false, message: '無效的授權令牌' };
}

// 新增：代理層級分析API別名路由 - 優化版本，減少查詢次數並返回實際報表數據
app.get(`${API_PREFIX}/agent-hierarchical-analysis`, async (req, res) => {
  try {
    const authResult = await authenticateAgent(req);
    if (!authResult.success) {
      return res.status(401).json(authResult);
    }

    const { agent: currentAgent } = authResult;
    const { startDate, endDate, username, agentId } = req.query;
    
    console.log('📊 代理層級分析API (優化版):', { 
      startDate, endDate, username, agentId, currentAgentId: currentAgent.id
    });
    
    const targetAgentId = parseInt(agentId) || currentAgent.id;
    
    try {
      // 使用單一SQL查詢獲取所有下級代理和會員的下注數據
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
      
      // 獲取目標代理的直接下級代理和會員，以及他們的下注統計
      try {
        // 1. 獲取直接下級代理的統計  
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
        
        // 獲取當前查詢代理的退水百分比
        const targetAgent = await db.oneOrNone('SELECT rebate_percentage FROM agents WHERE id = $1', [targetAgentId]);
        const targetAgentRebate = parseFloat(targetAgent?.rebate_percentage || 0.041);
        
        // 2. 獲取直接會員的統計
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
        
        // 處理代理數據
        for (const agent of agentStats) {
          if (parseInt(agent.bet_count) > 0) {
            const agentRebatePercentage = parseFloat(agent.rebate_percentage || 0);
            // 新退水邏輯：查看下級代理時，顯示退水差額（自己的退水% - 下級代理的退水%）
            const earnedRebatePercentage = targetAgentRebate - agentRebatePercentage; // 退水差額
            const earnedRebateAmount = parseFloat(agent.total_bet_amount) * earnedRebatePercentage;
            
            console.log(`📊 代理 ${agent.agent_username} 退水計算:`, {
              查詢代理退水: `${(targetAgentRebate * 100).toFixed(1)}%`,
              下級代理退水: `${(agentRebatePercentage * 100).toFixed(1)}%`,
              退水差額: `${(earnedRebatePercentage * 100).toFixed(1)}%`,
              下注金額: agent.total_bet_amount,
              賺水金額: earnedRebateAmount.toFixed(2)
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
        
        // 處理會員數據
        for (const member of memberStats) {
          if (parseInt(member.bet_count) > 0) {
            // 新退水邏輯：查看會員時，顯示自己的完整退水百分比
            const earnedRebatePercentage = targetAgentRebate; // 使用查詢代理的完整退水設定
            const earnedRebateAmount = parseFloat(member.total_bet_amount) * earnedRebatePercentage;
            
            console.log(`👤 會員 ${member.username} 退水計算:`, {
              代理退水設定: `${(targetAgentRebate * 100).toFixed(1)}%`,
              下注金額: member.total_bet_amount,
              賺水金額: earnedRebateAmount.toFixed(2)
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
              rebatePercentage: 0, // 會員沒有退水
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
        
        // 計算其他統計值
        totalSummary.validAmount = totalSummary.betAmount;
        totalSummary.profitLoss = -totalSummary.memberWinLoss; // 平台盈虧與會員輸贏相反
        
        // 新退水邏輯：總計賺水為所有個別項目的賺水金額之和
        totalSummary.earnedRebateAmount = totalSummary.rebateProfit; // 已經在處理個別項目時累加了
        totalSummary.finalProfitLoss = totalSummary.profitLoss + totalSummary.earnedRebateAmount; // 最終盈虧（含退水）
        
        console.log('📊 總計統計:', {
          總下注金額: totalSummary.betAmount.toFixed(2),
          總賺水金額: totalSummary.earnedRebateAmount.toFixed(2),
          會員輸贏: totalSummary.memberWinLoss.toFixed(2),
          最終盈虧: totalSummary.finalProfitLoss.toFixed(2)
        });
        
      } catch (dbError) {
        console.log('統計查詢出錯，嘗試簡化查詢:', dbError.message);
        
        // 簡化查詢：只檢查是否有下注記錄
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
      
      // 獲取會員總數
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
        message: hasData ? '查詢成功' : null
      });
      
    } catch (dbError) {
      console.log('數據庫查詢出錯，返回空結果:', dbError.message);
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
    console.error('代理層級分析API錯誤:', error);
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
      message: error.message || '查詢失敗'
    });
  }
});

// 獲取所有限紅配置
app.get(`${API_PREFIX}/betting-limit-configs`, async (req, res) => {
  try {
    console.log('獲取限紅配置列表');
    
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
    
    console.log(`找到 ${configs.length} 個限紅配置`);
    
    res.json({
      success: true,
      configs: configs
    });
    
  } catch (error) {
    console.error('獲取限紅配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 獲取會員的限紅設定
app.get(`${API_PREFIX}/member-betting-limit/:memberId`, async (req, res) => {
  const { memberId } = req.params;
  
  try {
    console.log(`獲取會員 ${memberId} 的限紅設定`);
    
    // 獲取會員資料、限紅配置和所屬代理的限紅等級
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
        message: '會員不存在'
      });
    }
    
    console.log(`會員 ${memberData.username} 當前限紅等級: ${memberData.betting_limit_level}`);
    console.log(`所屬代理 ${memberData.agent_username} 限紅等級: ${memberData.agent_betting_limit_level}`);
    
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
    console.error('獲取會員限紅設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 根據用戶名獲取會員限紅設定
app.get(`${API_PREFIX}/member-betting-limit-by-username`, async (req, res) => {
  const { username } = req.query;
  
  try {
    console.log(`根據用戶名 ${username} 獲取限紅設定`);
    
    if (!username) {
      return res.json({
        success: false,
        message: '請提供用戶名'
      });
    }
    
    // 獲取會員資料和限紅配置
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
        message: '會員不存在'
      });
    }
    
    console.log(`會員 ${memberData.username} 當前限紅等級: ${memberData.betting_limit_level}`);
    
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
    console.error('根據用戶名獲取會員限紅設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 更新會員的限紅設定
app.post(`${API_PREFIX}/update-member-betting-limit`, async (req, res) => {
  const { operatorId, memberId, newLimitLevel, reason } = req.body;
  
  try {
    console.log(`更新會員 ${memberId} 的限紅設定: ${newLimitLevel}`);
    
    // 檢查操作權限 - 只有總代理可以修改限紅
    const operator = await AgentModel.findById(operatorId);
    if (!operator || operator.level !== 0) {
      return res.json({
        success: false,
        message: '權限不足，只有總代理可以調整會員限紅'
      });
    }
    
    // 驗證限紅等級是否存在
    const limitConfig = await db.oneOrNone(`
      SELECT level_name, level_display_name 
      FROM betting_limit_configs 
      WHERE level_name = $1
    `, [newLimitLevel]);
    
    if (!limitConfig) {
      return res.json({
        success: false,
        message: '無效的限紅等級'
      });
    }
    
    // 獲取會員資料
    const member = await MemberModel.findById(memberId);
    if (!member) {
      return res.json({
        success: false,
        message: '會員不存在'
      });
    }
    
    // 獲取會員所屬代理的限紅等級
    const memberAgent = await AgentModel.findById(member.agent_id);
    if (!memberAgent) {
      return res.json({
        success: false,
        message: '找不到會員所屬代理'
      });
    }
    
    // 檢查新限紅等級是否超過代理的限紅等級
    const levelOrder = {
      'level1': 1,  // 新手
      'level2': 2,  // 一般
      'level3': 3,  // 標準
      'level4': 4,  // 高級
      'level5': 5,  // VIP
      'level6': 6   // VVIP
    };
    
    const agentLevel = levelOrder[memberAgent.betting_limit_level || 'level3'] || 3;
    const newLevel = levelOrder[newLimitLevel] || 1;
    
    if (newLevel > agentLevel) {
      return res.json({
        success: false,
        message: `不能設定高於代理限紅等級的限紅 (代理限紅: ${memberAgent.betting_limit_level || 'level3'})`
      });
    }
    
    const oldLimitLevel = member.betting_limit_level;
    
    // 更新會員限紅等級
    await db.none(`
      UPDATE members 
      SET betting_limit_level = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [newLimitLevel, memberId]);
    
    // 記錄操作日誌到交易記錄
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
      `限紅等級調整: ${oldLimitLevel || 'level1'} → ${newLimitLevel} (${reason || '管理員調整'})`
    ]);
    
    console.log(`✅ 會員 ${member.username} 限紅等級已更新: ${oldLimitLevel} → ${newLimitLevel}`);
    
    res.json({
      success: true,
      message: '限紅設定更新成功',
      member: {
        id: member.id,
        username: member.username,
        oldLimitLevel: oldLimitLevel,
        newLimitLevel: newLimitLevel,
        levelDisplayName: limitConfig.level_display_name
      }
    });
    
  } catch (error) {
    console.error('更新會員限紅設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 代理限紅設定相關 API

// 獲取代理的限紅設定
app.get(`${API_PREFIX}/agent-betting-limit/:agentId`, async (req, res) => {
  const { agentId } = req.params;
  
  try {
    console.log(`獲取代理 ${agentId} 的限紅設定`);
    
    // 獲取代理資料和限紅配置
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
    
    console.log(`代理 ${agentData.username} 當前限紅等級: ${agentData.betting_limit_level}`);
    
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
    console.error('獲取代理限紅設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

// 更新代理的限紅設定
app.post(`${API_PREFIX}/update-agent-betting-limit`, async (req, res) => {
  const { operatorId, agentId, newLimitLevel, reason } = req.body;
  
  try {
    console.log(`更新代理 ${agentId} 的限紅設定: ${newLimitLevel}`);
    
    // 檢查操作者權限
    const operator = await AgentModel.findById(operatorId);
    if (!operator) {
      return res.json({
        success: false,
        message: '操作者不存在'
      });
    }
    
    // 獲取目標代理資訊
    const targetAgent = await AgentModel.findById(agentId);
    if (!targetAgent) {
      return res.json({
        success: false,
        message: '目標代理不存在'
      });
    }
    
    // 檢查是否有權限修改（只能修改自己的下級代理）
    if (targetAgent.parent_id !== operatorId && operator.level !== 0) {
      return res.json({
        success: false,
        message: '無權限修改此代理的限紅設定'
      });
    }
    
    // 檢查限紅等級是否存在
    const limitConfig = await db.oneOrNone(`
      SELECT * FROM betting_limit_configs 
      WHERE level_name = $1
    `, [newLimitLevel]);
    
    if (!limitConfig) {
      return res.json({
        success: false,
        message: '無效的限紅等級'
      });
    }
    
    // 獲取操作者的限紅等級，確保不能設定高於自己的等級
    const operatorLimit = await db.oneOrNone(`
      SELECT betting_limit_level FROM agents WHERE id = $1
    `, [operatorId]);
    
    // 比較限紅等級（level1 < level2 < level3 < level4 < level5 < level6）
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
        message: '不能設定高於自己限紅等級的代理'
      });
    }
    
    const oldLimitLevel = targetAgent.betting_limit_level || 'level3';
    
    // 更新代理限紅等級
    await db.none(`
      UPDATE agents 
      SET betting_limit_level = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [newLimitLevel, agentId]);
    
    // 記錄操作日誌
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
      `限紅等級變更: ${oldLimitLevel} -> ${newLimitLevel}, 操作者: ${operator.username}, 原因: ${reason || '未說明'}`
    ]);
    
    console.log(`代理 ${targetAgent.username} 限紅等級已更新: ${oldLimitLevel} -> ${newLimitLevel}`);
    
    // 如果是調降限紅等級，需要連鎖調整所有下級
    if (levelOrder[newLimitLevel] < levelOrder[oldLimitLevel]) {
      console.log(`開始連鎖調整代理 ${targetAgent.username} 的所有下級限紅等級...`);
      
      // 遞迴函數：調整所有下級代理和會員的限紅等級
      async function adjustDownlineBettingLimits(parentAgentId, maxLevel) {
        // 獲取所有直接下級代理
        const childAgents = await db.any(`
          SELECT id, username, betting_limit_level 
          FROM agents 
          WHERE parent_id = $1
        `, [parentAgentId]);
        
        for (const childAgent of childAgents) {
          const childLevel = childAgent.betting_limit_level || 'level3';
          
          // 如果下級代理的限紅等級超過上級的新限制，則調整為上級的限制
          if (levelOrder[childLevel] > levelOrder[maxLevel]) {
            await db.none(`
              UPDATE agents 
              SET betting_limit_level = $1, updated_at = CURRENT_TIMESTAMP 
              WHERE id = $2
            `, [maxLevel, childAgent.id]);
            
            console.log(`  - 調整下級代理 ${childAgent.username} 的限紅等級: ${childLevel} -> ${maxLevel}`);
            
            // 記錄調整日誌
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
              `限紅等級連鎖調整: ${childLevel} -> ${maxLevel} (因上級代理 ${targetAgent.username} 限紅調降)`
            ]);
          }
          
          // 遞迴處理此代理的下級
          await adjustDownlineBettingLimits(childAgent.id, maxLevel);
        }
        
        // 獲取該代理的所有會員
        const members = await db.any(`
          SELECT id, username, betting_limit_level 
          FROM members 
          WHERE agent_id = $1
        `, [parentAgentId]);
        
        for (const member of members) {
          const memberLevel = member.betting_limit_level || 'level1';
          
          // 如果會員的限紅等級超過代理的新限制，則調整為代理的限制
          if (levelOrder[memberLevel] > levelOrder[maxLevel]) {
            await db.none(`
              UPDATE members 
              SET betting_limit_level = $1, updated_at = CURRENT_TIMESTAMP 
              WHERE id = $2
            `, [maxLevel, member.id]);
            
            console.log(`  - 調整會員 ${member.username} 的限紅等級: ${memberLevel} -> ${maxLevel}`);
            
            // 記錄調整日誌
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
              `限紅等級連鎖調整: ${memberLevel} -> ${maxLevel} (因所屬代理限紅調降)`
            ]);
          }
        }
      }
      
      // 開始連鎖調整
      await adjustDownlineBettingLimits(agentId, newLimitLevel);
      
      console.log(`連鎖調整完成`);
    }
    
    // 重新獲取更新後的代理資料
    const updatedAgent = await db.oneOrNone(`
      SELECT id, username, betting_limit_level, level, status, balance
      FROM agents
      WHERE id = $1
    `, [agentId]);
    
    res.json({
      success: true,
      message: '限紅設定更新成功',
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
    console.error('更新代理限紅設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '系統錯誤，請稍後再試'
    });
  }
});

