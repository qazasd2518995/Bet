// agentBackend.js - 代理管理會員系統後端
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3003; // 使用不同於主遊戲系統的端口

// 跨域設置
app.use(cors({
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

// 代理系統數據存儲
let agents = [
  {
    id: "A001",
    username: "admin",
    password: "adminpwd",
    level: 0, // 0=總代理
    parent: null,
    status: 1, // 1=啟用, 0=停用
    balance: 100000,
    commission: 0.3, // 佣金比例
    createdAt: new Date(),
    lastLoginAt: null
  }
];

// 代理的會員數據
let members = [
  {
    id: "M0001",
    username: "aaa",
    password: "aaa",
    agentId: "A001",
    balance: 1000,
    status: 1,
    createdAt: new Date(),
    lastLoginAt: null
  }
];

// 交易記錄
let transactions = [];

// 系統公告
let notices = [
  {
    id: 1,
    title: "系統公告",
    content: "歡迎使用代理管理系統",
    createTime: new Date(),
    isRead: false
  }
];

// 登入 API
app.post('/api/agent/login', (req, res) => {
  const { username, password } = req.body;
  
  const agent = agents.find(a => a.username === username && a.password === password);
  
  if (!agent) {
    return res.status(401).json({
      success: false,
      message: '帳號或密碼錯誤'
    });
  }
  
  if (agent.status === 0) {
    return res.status(403).json({
      success: false,
      message: '帳號已被停用'
    });
  }
  
  // 更新最後登入時間
  agent.lastLoginAt = new Date();
  
  res.json({
    success: true,
    message: '登入成功',
    agent: {
      id: agent.id,
      username: agent.username,
      level: agent.level,
      balance: agent.balance
    },
    token: `agent_${agent.id}_${Date.now()}` // 簡單的token實現
  });
});

// 獲取代理資訊
app.get('/api/agent/info', (req, res) => {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '缺少代理ID'
    });
  }
  
  const agent = agents.find(a => a.id === id);
  
  if (!agent) {
    return res.status(404).json({
      success: false,
      message: '代理不存在'
    });
  }
  
  res.json({
    success: true,
    agent: {
      id: agent.id,
      username: agent.username,
      level: agent.level,
      parent: agent.parent,
      balance: agent.balance,
      commission: agent.commission,
      status: agent.status,
      createdAt: agent.createdAt,
      lastLoginAt: agent.lastLoginAt
    }
  });
});

// 獲取下級代理列表
app.get('/api/agent/sub-agents', (req, res) => {
  const { parentId, level, status, keyword, page = 1, limit = 20 } = req.query;
  
  let filteredAgents = [...agents];
  
  // 篩選條件
  if (parentId) {
    filteredAgents = filteredAgents.filter(a => a.parent === parentId);
  }
  
  if (level !== undefined && level !== '-1') {
    filteredAgents = filteredAgents.filter(a => a.level === parseInt(level));
  }
  
  if (status !== undefined && status !== '-1') {
    filteredAgents = filteredAgents.filter(a => a.status === parseInt(status));
  }
  
  if (keyword) {
    filteredAgents = filteredAgents.filter(a => 
      a.username.includes(keyword) || 
      a.id.includes(keyword)
    );
  }
  
  // 分頁
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedAgents = filteredAgents.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    total: filteredAgents.length,
    agents: paginatedAgents
  });
});

// 創建新代理
app.post('/api/agent/create', (req, res) => {
  const { username, password, level, parent, commission } = req.body;
  
  // 基本驗證
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: '用戶名和密碼不能為空'
    });
  }
  
  // 檢查用戶名是否已存在
  if (agents.some(a => a.username === username)) {
    return res.status(400).json({
      success: false,
      message: '該用戶名已被使用'
    });
  }
  
  // 生成新ID
  const newId = `A${(agents.length + 1).toString().padStart(3, '0')}`;
  
  // 創建新代理
  const newAgent = {
    id: newId,
    username,
    password,
    level: parseInt(level) || 1,
    parent: parent || null,
    status: 1,
    balance: 0,
    commission: parseFloat(commission) || 0.2,
    createdAt: new Date(),
    lastLoginAt: null
  };
  
  agents.push(newAgent);
  
  res.status(201).json({
    success: true,
    message: '創建代理成功',
    agent: {
      id: newAgent.id,
      username: newAgent.username
    }
  });
});

// 修改代理狀態
app.put('/api/agent/update-status', (req, res) => {
  const { id, status } = req.body;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '缺少代理ID'
    });
  }
  
  const agent = agents.find(a => a.id === id);
  
  if (!agent) {
    return res.status(404).json({
      success: false,
      message: '代理不存在'
    });
  }
  
  agent.status = parseInt(status);
  
  res.json({
    success: true,
    message: '更新狀態成功'
  });
});

// 編輯代理資訊
app.put('/api/agent/update', (req, res) => {
  const { id, password, commission, status } = req.body;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '缺少代理ID'
    });
  }
  
  const agent = agents.find(a => a.id === id);
  
  if (!agent) {
    return res.status(404).json({
      success: false,
      message: '代理不存在'
    });
  }
  
  // 更新資訊
  if (password && password.trim() !== '') {
    agent.password = password;
  }
  
  if (commission !== undefined) {
    agent.commission = parseFloat(commission);
  }
  
  if (status !== undefined) {
    agent.status = parseInt(status);
  }
  
  res.json({
    success: true,
    message: '更新代理資訊成功',
    agent: {
      id: agent.id,
      username: agent.username,
      level: agent.level,
      parent: agent.parent,
      commission: agent.commission,
      status: agent.status
    }
  });
});

// 獲取會員列表
app.get('/api/agent/members', (req, res) => {
  const { agentId, status, keyword, page = 1, limit = 20 } = req.query;
  
  let filteredMembers = [...members];
  
  // 篩選條件
  if (agentId) {
    filteredMembers = filteredMembers.filter(m => m.agentId === agentId);
  }
  
  if (status !== undefined && status !== '-1') {
    filteredMembers = filteredMembers.filter(m => m.status === parseInt(status));
  }
  
  if (keyword) {
    filteredMembers = filteredMembers.filter(m => 
      m.username.includes(keyword) || 
      m.id.includes(keyword)
    );
  }
  
  // 分頁
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedMembers = filteredMembers.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    total: filteredMembers.length,
    members: paginatedMembers
  });
});

// 創建新會員
app.post('/api/agent/create-member', (req, res) => {
  const { username, password, agentId } = req.body;
  
  // 基本驗證
  if (!username || !password || !agentId) {
    return res.status(400).json({
      success: false,
      message: '用戶名、密碼和代理ID不能為空'
    });
  }
  
  // 檢查用戶名是否已存在
  if (members.some(m => m.username === username)) {
    return res.status(400).json({
      success: false,
      message: '該用戶名已被使用'
    });
  }
  
  // 檢查代理是否存在且啟用
  const agent = agents.find(a => a.id === agentId && a.status === 1);
  if (!agent) {
    return res.status(400).json({
      success: false,
      message: '代理不存在或未啟用'
    });
  }
  
  // 生成新ID
  const newId = `M${(members.length + 1).toString().padStart(4, '0')}`;
  
  // 創建新會員
  const newMember = {
    id: newId,
    username,
    password,
    agentId: agentId,
    balance: 1000, // 初始餘額
    status: 1, // 1=啟用, 0=停用
    createdAt: new Date(),
    lastLoginAt: null
  };
  
  members.push(newMember);
  
  res.status(201).json({
    success: true,
    message: '創建會員成功',
    member: {
      id: newMember.id,
      username: newMember.username
    }
  });
});

// 修改會員狀態
app.put('/api/agent/update-member-status', (req, res) => {
  const { id, status } = req.body;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '缺少會員ID'
    });
  }
  
  const member = members.find(m => m.id === id);
  
  if (!member) {
    return res.status(404).json({
      success: false,
      message: '會員不存在'
    });
  }
  
  member.status = parseInt(status);
  
  res.json({
    success: true,
    message: '更新狀態成功'
  });
});

// 獲取會員詳細資訊
app.get('/api/agent/member-info', (req, res) => {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      message: '缺少會員ID'
    });
  }
  
  const member = members.find(m => m.id === id);
  
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
      agentId: member.agentId,
      balance: member.balance,
      status: member.status,
      createdAt: member.createdAt,
      lastLoginAt: member.lastLoginAt
    }
  });
});

// 獲取交易記錄
app.get('/api/agent/transactions', (req, res) => {
  const { agentId, type, startDate, endDate, page = 1, limit = 20 } = req.query;
  
  let filteredTransactions = [...transactions];
  
  // 篩選條件
  if (agentId) {
    filteredTransactions = filteredTransactions.filter(t => 
      t.fromId === agentId || t.toId === agentId
    );
  }
  
  if (type !== undefined && type !== '-1') {
    filteredTransactions = filteredTransactions.filter(t => t.type === parseInt(type));
  }
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    filteredTransactions = filteredTransactions.filter(t => {
      const txDate = new Date(t.createdAt);
      return txDate >= start && txDate <= end;
    });
  }
  
  // 分頁
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
  
  res.json({
    success: true,
    total: filteredTransactions.length,
    transactions: paginatedTransactions
  });
});

// 獲取統計數據
app.get('/api/agent/stats', (req, res) => {
  const { agentId, startDate, endDate } = req.query;
  
  // 這裡應該有更複雜的統計數據計算邏輯
  // 簡化版的實現返回一些模擬數據
  
  res.json({
    success: true,
    stats: {
      totalMembers: 120,
      activeMembers: 65,
      totalBets: 3450,
      totalAmount: 245600,
      winAmount: 198750,
      commission: 14024
    }
  });
});

// 獲取系統公告
app.get('/api/agent/notices', (req, res) => {
  res.json({
    success: true,
    notices
  });
});

// 獲取開獎記錄
app.get('/api/agent/draw-records', (req, res) => {
  const { date, gameId, page = 1, limit = 20 } = req.query;
  
  // 從主遊戲系統獲取開獎記錄
  // 簡化版返回模擬數據
  
  const drawRecords = Array(20).fill(0).map((_, index) => ({
    id: `D${(index + 1).toString().padStart(4, '0')}`,
    period: `202505060${(index + 1).toString().padStart(2, '0')}`,
    gameId: gameId || '100201',
    result: Array(10).fill(0).map(() => Math.floor(Math.random() * 10) + 1),
    drawTime: new Date(new Date().setHours(0, index * 30, 0, 0)),
  }));
  
  res.json({
    success: true,
    total: 100, // 示例總數
    records: drawRecords
  });
});

// 驗證會員
app.post('/api/agent/verify-member', (req, res) => {
  const { username, password } = req.body;
  console.log('驗證會員請求:', { username, password });

  // 查找會員
  const member = members.find(m => m.username === username);
  console.log('查找到的會員:', member);

  if (!member) {
    console.log('會員不存在');
    return res.json({
      success: false,
      message: '帳號或密碼錯誤'
    });
  }

  // 驗證密碼
  if (member.password !== password) {
    console.log('密碼不匹配');
    return res.json({
      success: false,
      message: '帳號或密碼錯誤'
    });
  }

  // 檢查會員狀態
  if (member.status !== 1) {
    console.log('會員狀態異常:', member.status);
    return res.json({
      success: false,
      message: '帳號已被停用'
    });
  }

  // 更新最後登入時間
  member.lastLoginAt = new Date();
  console.log('會員驗證成功，更新最後登入時間');

  // 返回成功
  res.json({
    success: true,
    message: '登入成功',
    member: {
      id: member.id,
      username: member.username,
      balance: member.balance,
      status: member.status
    }
  });
});

// 更新會員餘額
app.post('/api/agent/update-member-balance', (req, res) => {
  const { username, amount, type } = req.body;
  
  if (!username || amount === undefined) {
    return res.status(400).json({
      success: false,
      message: '缺少必要參數'
    });
  }
  
  const member = members.find(m => m.username === username);
  if (!member) {
    return res.status(404).json({
      success: false,
      message: '會員不存在'
    });
  }
  
  // 更新餘額
  member.balance += amount;
  
  // 記錄交易
  const transaction = {
    id: Date.now().toString(),
    memberId: member.id,
    type: type || 'adjustment',
    amount: amount,
    balance: member.balance,
    createdAt: new Date()
  };
  transactions.push(transaction);
  
  res.json({
    success: true,
    message: '更新餘額成功',
    newBalance: member.balance
  });
});

// 獲取會員餘額
app.get('/api/agent/member-balance', (req, res) => {
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({
      success: false,
      message: '請提供用戶名'
    });
  }
  
  const member = members.find(m => m.username === username);
  
  if (!member) {
    return res.status(404).json({
      success: false,
      message: '會員不存在'
    });
  }
  
  res.json({
    success: true,
    balance: member.balance
  });
});

// 啟動服務器
app.listen(port, () => {
  console.log(`代理管理會員系統服務運行在端口 ${port}`);
  
  // 確保目錄存在
  const agentDir = path.join(__dirname, 'agent');
  const frontendDir = path.join(agentDir, 'frontend');
  
  if (!fs.existsSync(agentDir)) {
    fs.mkdirSync(agentDir);
  }
  
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir);
  }
});