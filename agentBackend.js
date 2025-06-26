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

// 跨域設置 - 加強本地開發支持
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://bet-game.onrender.com', 'https://bet-agent.onrender.com'] 
    : ['http://localhost:3002', 'http://localhost:3000', 'http://localhost:3003', 'http://127.0.0.1:3003', 'http://localhost:8081', 'http://127.0.0.1:8081'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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

// 新增數據庫檢查端點 - 用於檢查agent_profiles表是否存在
app.get('/api/check-profile-table', async (req, res) => {
  try {
    console.log('檢查 agent_profiles 表...');
    
    // 檢查表是否存在
    const tableExists = await db.oneOrNone(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'agent_profiles'
    `);
    
    if (!tableExists) {
      return res.json({
        success: false,
        message: 'agent_profiles 表不存在',
        tableExists: false
      });
    }
    
    // 檢查表結構
    const columns = await db.any(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'agent_profiles' 
      ORDER BY ordinal_position
    `);
    
    // 檢查記錄數量
    const recordCount = await db.one('SELECT COUNT(*) as count FROM agent_profiles');
    
    res.json({
      success: true,
      message: 'agent_profiles 表檢查完成',
      tableExists: true,
      columns: columns,
      recordCount: parseInt(recordCount.count)
    });
    
  } catch (error) {
    console.error('檢查 agent_profiles 表失敗:', error);
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
    
    res.json({
      success: true,
      message: '驗證成功',
      member: {
        id: member.id,
        username: member.username,
        balance: member.balance,
        agent_id: member.agent_id,
        status: member.status
      }
    });
    
  } catch (error) {
    console.error('會員登入驗證錯誤:', error);
    res.status(500).json({
      success: false,
      message: '驗證服務暫時不可用'
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
    
    // 這裡需要從主遊戲系統獲取投注記錄
    // 暫時返回空數據
    res.json({
      success: true,
      records: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0
      }
    });
    
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
    
    // 直接插入/更新到draw_records表
    await db.none(`
      INSERT INTO draw_records (period, result, draw_time, created_at)
      VALUES ($1, $2::jsonb, $3, $4)
      ON CONFLICT (period) DO UPDATE 
      SET result = $2::jsonb, draw_time = $3, created_at = $4
    `, [period, JSON.stringify(result), draw_time || new Date(), new Date()]);
    
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
    
    res.json({
      success: true,
      message: `代理狀態已更新為: ${status ? '啟用' : '停用'}`,
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

// 刪除代理API
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
    
    // 檢查是否有下級代理或會員
    const subAgents = await AgentModel.findByParentId(agentId);
    const members = await MemberModel.findByAgentId(agentId);
    
    if (subAgents.agents.length > 0 || members.members.length > 0) {
      return res.status(400).json({
        success: false,
        message: '無法刪除：該代理下還有下級代理或會員'
      });
    }
    
    // 執行軟刪除（將狀態設為0）
    await AgentModel.updateStatus(agentId, 0);
    
    res.json({
      success: true,
      message: '代理已成功刪除',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('刪除代理失敗:', error);
    res.status(500).json({
      success: false,
      message: '刪除代理失敗',
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
      console.log('代理退水字段添加成功');
    } catch (error) {
      console.log('代理退水字段已存在或添加失敗:', error.message);
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
    
    console.log('初始化代理系統數據庫表結構完成');
    
    // 檢查是否已有總代理
    const adminAgents = await db.any('SELECT * FROM agents WHERE level = 0');
    
    if (adminAgents.length === 0) {
      // 只有在沒有總代理的情況下才創建新的總代理
      console.log('未找到總代理，開始創建新的總代理...');
      
      // 創建新的總代理
      console.log('創建新的總代理 ti2025...');
      await db.none(`
        INSERT INTO agents (username, password, level, balance, commission_rate) 
        VALUES ($1, $2, $3, $4, $5)
      `, ['ti2025', 'ti2025', 0, 200000, 0.3]);
      console.log('總代理 ti2025 創建成功，初始餘額 200,000');
    } else {
      console.log(`已存在 ${adminAgents.length} 個總代理，檢查是否需要重命名為ti2025`);
      
      // 檢查總代理是否為ti2025，如果不是則修改
      if (adminAgents[0].username !== 'ti2025') {
        console.log(`將總代理 "${adminAgents[0].username}" 重命名為 "ti2025"`);
        
        // 修改總代理的用戶名和密碼為ti2025，保留原餘額和其他數據
        await db.none(`
          UPDATE agents 
          SET username = $1, password = $2 
          WHERE id = $3
        `, ['ti2025', 'ti2025', adminAgents[0].id]);
        
        console.log(`總代理已重命名為 "ti2025"，ID=${adminAgents[0].id}`);
      } else {
        console.log(`總代理已是ti2025，無需修改`);
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
      CREATE TABLE IF NOT EXISTS agent_profiles (
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
    
    // 檢查是否需要遷移舊字段
    try {
      const hasOldFields = await db.oneOrNone(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'agent_profiles' AND column_name IN ('qq', 'wechat')
      `);
      
      if (hasOldFields) {
        console.log('檢測到舊字段，執行數據庫遷移...');
        
        // 添加新字段
        await db.none(`
          ALTER TABLE agent_profiles 
          ADD COLUMN IF NOT EXISTS line_id VARCHAR(50)
        `);
        
        // 如果需要，可以將微信號遷移到Line ID
        await db.none(`
          UPDATE agent_profiles 
          SET line_id = wechat 
          WHERE line_id IS NULL AND wechat IS NOT NULL AND wechat != ''
        `);
        
        // 刪除舊字段
        await db.none(`ALTER TABLE agent_profiles DROP COLUMN IF EXISTS qq`);
        await db.none(`ALTER TABLE agent_profiles DROP COLUMN IF EXISTS wechat`);
        
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
    const { username, password, parent_id, level, commission_rate, rebate_percentage, rebate_mode, max_rebate_percentage } = agentData;
    
    try {
      return await db.one(`
        INSERT INTO agents (username, password, parent_id, level, commission_rate, rebate_percentage, rebate_mode, max_rebate_percentage) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *
      `, [username, password, parent_id, level, commission_rate, rebate_percentage || 0.041, rebate_mode || 'percentage', max_rebate_percentage || 0.041]);
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
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, ['agent', id, amount, amount > 0 ? 'deposit' : 'withdraw', beforeBalance, afterBalance, '代理點數調整']);
      
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
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
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
  }
};

// 模型: 點數轉移
const PointTransferModel = {
  // 從代理轉移點數到會員
  async transferFromAgentToMember(agentId, memberId, amount, description = '') {
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
        
        // 記錄代理的交易（客服操作使用cs_withdraw表示代理向會員轉出點數）
        await t.none(`
          INSERT INTO transaction_records 
          (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['agent', agentId, -parsedAmount, 'cs_withdraw', agentBeforeBalance, agentAfterBalance, description || '客服會員存款操作']);
        
        // 記錄會員的交易（客服操作使用cs_deposit表示會員收到點數）
        await t.none(`
          INSERT INTO transaction_records 
          (user_type, user_id, amount, transaction_type, balance_before, balance_after, description) 
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, ['member', memberId, parsedAmount, 'cs_deposit', memberBeforeBalance, memberAfterBalance, description || '客服會員存款操作']);
        
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
  async transferFromMemberToAgent(memberId, agentId, amount, description = '') {
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
  async transferFromAgentToAgent(fromAgentId, toAgentId, amount, description = '') {
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
      balance_before, balance_after, reference_id, description 
    } = transactionData;
    
    try {
      return await db.one(`
        INSERT INTO transaction_records 
        (user_type, user_id, amount, transaction_type, balance_before, balance_after, reference_id, description) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *
      `, [user_type, user_id, amount, type, balance_before, balance_after, reference_id, description]);
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
        // 查詢真實的下注統計數據（從bet_history表通過members表關聯）
        const betStatsResult = await db.oneOrNone(`
          SELECT 
            COUNT(bh.*) as total_bets,
            COALESCE(SUM(bh.amount), 0) as total_bet_amount,
            COALESCE(SUM(bh.win_amount), 0) as total_win_amount,
            COALESCE(SUM(bh.amount) - SUM(bh.win_amount), 0) as agent_profit
          FROM bet_history bh
          JOIN members m ON bh.username = m.username
          WHERE m.agent_id = $1
            AND DATE(bh.created_at) = $2
        `, [parsedAgentId, today]);
        
        const totalBets = parseInt(betStatsResult ? betStatsResult.total_bets : 0);
        const totalBetAmount = parseFloat(betStatsResult ? betStatsResult.total_bet_amount : 0);
        const totalWinAmount = parseFloat(betStatsResult ? betStatsResult.total_win_amount : 0);
        const agentProfit = parseFloat(betStatsResult ? betStatsResult.agent_profit : 0);
        
        // 計算代理盈虧分解
        const agentEarnings = agentProfit > 0 ? agentProfit : 0;  // 代理盈利（會員虧損）
        const agentLosses = agentProfit < 0 ? Math.abs(agentProfit) : 0;  // 代理虧損（會員盈利）
        const netRevenue = agentProfit;  // 淨收益
        
        // 獲取今日活躍會員數（有下注的會員）
        const activeMembersResult = await db.oneOrNone(`
          SELECT COUNT(DISTINCT bh.username) as count 
          FROM bet_history bh
          JOIN members m ON bh.username = m.username
          WHERE m.agent_id = $1
            AND DATE(bh.created_at) = $2
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
  const { username, password, level, parent, commission_rate, rebate_mode, rebate_percentage } = req.body;
  
  try {
    // 檢查用戶名是否已存在
    const existingAgent = await AgentModel.findByUsername(username);
    if (existingAgent) {
      return res.json({
        success: false,
        message: '該用戶名已被使用'
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

      // 設定最大退水比例（不能超過上級代理的退水比例）
      maxRebatePercentage = parentAgent.rebate_percentage || 0.041;
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
      // 全拿所有退水
      finalRebatePercentage = maxRebatePercentage;
    } else if (rebate_mode === 'none') {
      // 全退給下級
      finalRebatePercentage = 0;
    } else if (rebate_mode === 'percentage' && rebate_percentage !== undefined) {
      // 設定具體百分比
      const parsedRebatePercentage = parseFloat(rebate_percentage);
      if (parsedRebatePercentage > maxRebatePercentage) {
        return res.json({
          success: false,
          message: `退水比例不能超過 ${(maxRebatePercentage * 100).toFixed(1)}%`
        });
      }
      finalRebatePercentage = parsedRebatePercentage;
    }
    
    // 創建代理
    const newAgent = await AgentModel.create({
      username,
      password,
      parent_id: parentId,
      level: parsedLevel,
      commission_rate: parseFloat(commission_rate),
      rebate_percentage: finalRebatePercentage,
      rebate_mode: finalRebateMode,
      max_rebate_percentage: maxRebatePercentage
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
    
    // 處理退水設定
    let finalRebatePercentage = agent.rebate_percentage;
    let finalRebateMode = rebate_mode || agent.rebate_mode;
    const maxRebatePercentage = agent.max_rebate_percentage || 0.041;
    
    if (rebate_mode === 'all') {
      // 全拿所有退水
      finalRebatePercentage = maxRebatePercentage;
    } else if (rebate_mode === 'none') {
      // 全退給下級
      finalRebatePercentage = 0;
    } else if (rebate_mode === 'percentage' && rebate_percentage !== undefined) {
      // 設定具體百分比
      const parsedRebatePercentage = parseFloat(rebate_percentage);
      if (parsedRebatePercentage > maxRebatePercentage) {
        return res.json({
          success: false,
          message: `退水比例不能超過 ${(maxRebatePercentage * 100).toFixed(1)}%`
        });
      }
      finalRebatePercentage = parsedRebatePercentage;
    }
    
    // 更新退水設定
    const updatedAgent = await AgentModel.updateRebateSettings(agentId, {
      rebate_percentage: finalRebatePercentage,
      rebate_mode: finalRebateMode,
      max_rebate_percentage: maxRebatePercentage
    });
    
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
    const { agentId, agentUsername, rebateAmount, memberUsername, betAmount, reason } = req.body;
    
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
    
    // 增加代理餘額
    const currentBalance = parseFloat(agent.balance) || 0;
    const newBalance = currentBalance + roundedRebateAmount;
    
    await AgentModel.updateBalance(agentId, newBalance);
    
    // 記錄交易
    await TransactionModel.create({
      user_id: agentId,
      user_type: 'agent',
      amount: roundedRebateAmount,
      type: 'rebate',
      description: `${reason} - 會員: ${memberUsername}, 下注: ${betAmount}`,
      balance_after: newBalance
    });
    
    console.log(`成功分配退水 ${roundedRebateAmount} 給代理 ${agentUsername}，餘額: ${currentBalance} → ${newBalance}`);
    
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

// 獲取代理鏈的輔助函數
async function getAgentChainForMember(agentId) {
  const agentChain = [];
  
  try {
    let currentAgentId = agentId;
    
    while (currentAgentId) {
      const agent = await AgentModel.findById(currentAgentId);
      if (!agent) break;
      
      agentChain.push({
        id: agent.id,
        username: agent.username,
        level: agent.level,
        rebate_mode: agent.rebate_mode || 'percentage',
        rebate_percentage: agent.rebate_percentage || 0.041,
        max_rebate_percentage: agent.max_rebate_percentage || 0.041
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

// 代為創建會員
app.post(`${API_PREFIX}/create-member-for-agent`, async (req, res) => {
  const { username, password, agentId, initialBalance, createdBy } = req.body;
  
  try {
    console.log(`代為創建會員請求: 用戶名=${username}, 代理ID=${agentId}, 初始餘額=${initialBalance}, 創建者=${createdBy}`);
    
    // 檢查用戶名是否已存在
    const existingMember = await MemberModel.findByUsername(username);
    if (existingMember) {
      return res.json({
        success: false,
        message: '該用戶名已被使用'
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
          message: '您的餘額不足以設定該初始餘額'
        });
      }
    }
    
    // 開始數據庫事務
    await db.tx(async t => {
      // 創建會員
      const newMember = await t.one(`
        INSERT INTO members (username, password, agent_id, balance, status, created_at)
        VALUES ($1, $2, $3, $4, 1, NOW())
        RETURNING id, username, balance
      `, [username, password, agentId, initialBal]);
      
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
    
    // 驗證代理層級關係
    if (subAgent.parent_id !== parentAgent.id) {
      console.error(`代理點數轉移失敗: 代理 ${subAgent.username} 不是 ${parentAgent.username} 的下級`);
      return res.json({
        success: false,
        message: '只能對直接下級代理進行點數轉移'
      });
    }
    
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
          description || ''
        );
        
      } else if (type === 'withdraw') {
        // 上級代理從下級代理提領點數
        console.log(`執行下級代理到上級代理的點數轉移: 金額=${transferAmount}`);
        result = await PointTransferModel.transferFromAgentToAgent(
          subAgent.id, 
          parentAgent.id, 
          transferAmount, 
          description || ''
        );
        
      } else {
        console.error('代理點數轉移失敗: 無效的轉移類型');
        return res.json({
          success: false,
          message: '無效的轉移類型'
        });
      }
      
      // 根據轉移類型決定最終餘額
      let finalParentBalance, finalSubAgentBalance;
      
      if (type === 'deposit') {
        // 存入：上級代理 -> 下級代理
        finalParentBalance = result.fromAgent.balance;
        finalSubAgentBalance = result.toAgent.balance;
      } else {
        // 提領：下級代理 -> 上級代理
        finalParentBalance = result.toAgent.balance;
        finalSubAgentBalance = result.fromAgent.balance;
      }
      
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
// 獲取下注記錄 - 修復400錯誤，支持更多查詢參數
app.get(`${API_PREFIX}/bets`, async (req, res) => {
  try {
    const { agentId, rootAgentId, includeDownline, username, date, period, page = 1, limit = 20 } = req.query;
    
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
        const allAgentIds = [currentAgentId, ...downlineAgents.map(agent => agent.id)];
        
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
    
    // 遞歸獲取所有下級代理
    const agents = await getAllDownlineAgents(rootAgentId);
    
    res.json({
      success: true,
      agents: agents,
      total: agents.length
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
    const allAgentIds = [rootAgentId, ...downlineAgents.map(agent => agent.id)];
    
    // 獲取所有這些代理的會員
    let allMembers = [];
    
    // 創建代理ID到代理資訊的映射
    const agentMap = {};
    agentMap[rootAgentId] = { username: '本代理' }; // 根代理
    downlineAgents.forEach(agent => {
      agentMap[agent.id] = { username: agent.username };
    });
    
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
        agentUsername: agentMap[agentId]?.username || '未知代理'
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
    allAgents.push(agent);
    
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
      console.log('沒有新的開獎記錄需要同步');
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
        
        console.log(`同步開獎記錄: 期數=${record.period} 成功`);
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
    
    // 首次同步開獎記錄
    await syncDrawRecords();
    
    // 每30秒同步一次開獎記錄作為備援（主要依靠即時同步）
    setInterval(syncDrawRecords, 30 * 1000);
    
    // 啟動Express服務器
    const PORT = process.env.PORT || 3003;
    app.listen(PORT, () => {
      console.log(`代理管理系統後端運行在端口 ${PORT}`);
    });
  } catch (error) {
    console.error('啟動服務器時出錯:', error);
  }
}

// ... existing code ...

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
    
    // 獲取總代理 (level = 0) - 只取第一個
    const adminAgents = await db.any('SELECT * FROM agents WHERE level = 0 ORDER BY id LIMIT 1');
    if (adminAgents.length === 0) {
      return res.json({
        success: false,
        message: '系統錯誤：未找到總代理'
      });
    }
    const adminAgent = adminAgents[0];
    
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
      // 存款：總代理 -> 目標代理
      console.log(`執行存款操作: 總代理(${adminAgent.username}) -> 目標代理(${targetAgent.username}), 金額=${transferAmount}`);
      result = await PointTransferModel.transferFromAgentToAgent(
        adminAgent.id, 
        targetAgentId, 
        transferAmount, 
        description || '客服存款操作'
      );
    } else if (transferType === 'withdraw') {
      // 提款：目標代理 -> 總代理
      console.log(`執行提款操作: 目標代理(${targetAgent.username}) -> 總代理(${adminAgent.username}), 金額=${transferAmount}`);
      result = await PointTransferModel.transferFromAgentToAgent(
        targetAgentId, 
        adminAgent.id, 
        transferAmount, 
        description || '客服提款操作'
      );
    } else {
      return res.json({
        success: false,
        message: '無效的轉移類型'
      });
    }
    
    console.log(`客服代理點數轉移成功`);
    
    res.json({
      success: true,
      message: '代理點數轉移成功',
      agent: {
        id: result.toAgent.id,
        username: result.toAgent.username,
        balance: result.toAgent.balance
      }
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
      // 存款：代理 -> 會員
      console.log(`執行存款操作: 代理(${agent.username}) -> 會員(${member.username}), 金額=${transferAmount}`);
      result = await PointTransferModel.transferFromAgentToMember(
        agentId, 
        member.id, 
        transferAmount, 
        description || '客服存款操作'
      );
    } else if (transferType === 'withdraw') {
      // 提款：會員 -> 代理
      console.log(`執行提款操作: 會員(${member.username}) -> 代理(${agent.username}), 金額=${transferAmount}`);
      result = await PointTransferModel.transferFromMemberToAgent(
        member.id, 
        agentId, 
        transferAmount, 
        description || '客服提款操作'
      );
    } else {
      return res.json({
        success: false,
        message: '無效的轉移類型'
      });
    }
    
    console.log(`客服會員點數轉移成功`);
    
    // 重新獲取最新的會員資料
    const updatedMember = await MemberModel.findById(member.id);
    
    res.json({
      success: true,
      message: '會員點數轉移成功',
      member: {
        id: updatedMember.id,
        username: updatedMember.username,
        balance: updatedMember.balance
      }
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
    
    // 檢查操作員是否為客服
    const isCS = await AgentModel.isCustomerService(operatorId);
    if (!isCS) {
      return res.json({
        success: false,
        message: '權限不足，只有客服可以查看此記錄'
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
      WHERE (t.transaction_type = 'cs_deposit' OR t.transaction_type = 'cs_withdraw')
    `;
    
    const params = [];
    
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
    
    // 如果是總代理，可以查看所有交易；否則只能查看自己和下級的交易
    if (agent.level === 0) {
      // 總代理可以查看所有交易，不加限制
    } else {
      // 獲取代理下的所有會員ID
      const members = await db.any('SELECT id FROM members WHERE agent_id = $1', [agentId]);
      const memberIds = members.map(m => m.id);
      
      if (memberIds.length > 0) {
        query += ` AND ((t.user_type = 'agent' AND t.user_id = $${params.length + 1}) OR (t.user_type = 'member' AND t.user_id IN ($${params.length + 2}:csv)))`;
        params.push(agentId, memberIds);
      } else {
        query += ` AND t.user_type = 'agent' AND t.user_id = $${params.length + 1}`;
        params.push(agentId);
      }
    }
    
    // 按類型篩選
    if (type === 'deposit') {
      // 存款記錄：包含 cs_deposit 和 deposit
      query += ` AND (t.transaction_type = 'cs_deposit' OR t.transaction_type = 'deposit')`;
    } else if (type === 'withdraw') {
      // 提款記錄：包含 cs_withdraw 和 withdraw
      query += ` AND (t.transaction_type = 'cs_withdraw' OR t.transaction_type = 'withdraw')`;
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
      SELECT * FROM agent_profiles WHERE agent_id = $1
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
      SELECT * FROM agent_profiles WHERE agent_id = $1
    `, [parsedAgentId]);
    
    if (existingProfile) {
      console.log(`找到現有個人資料記錄，ID=${existingProfile.id}，執行更新`);
      // 更新現有記錄
      await db.none(`
        UPDATE agent_profiles 
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
        INSERT INTO agent_profiles 
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

