// backend.js - 極速賽車遊戲後端
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3002;

// 代理後端URL
const AGENT_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://bet-agent.onrender.com/api/agent'
  : 'http://localhost:3003/api/agent';

// 跨域設置 - 允許前端訪問
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://bet-game.onrender.com', 'https://bet-agent.onrender.com'] 
    : ['http://localhost:3002', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 提供靜態文件 - 這使得前端文件可以被訪問
app.use(express.static(path.join(__dirname, 'deploy/frontend')));

// 所有路由都導向 index.html (SPA 設置)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'deploy/frontend', 'index.html'));
});

// 健康檢查端點 - 用於 Render 監控
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 存儲遊戲數據
let gameData = {
  currentPeriod: 202505051077, // 當前期數
  countdownSeconds: 60,        // 倒計時秒數
  lastResult: [4, 2, 7, 9, 8, 10, 6, 3, 5, 1], // 上期結果
  status: 'betting'            // 遊戲狀態: betting(下注中), drawing(開獎中)
};

// 賠率數據 - 根據極速賽車實際賠率設置
let odds = {
  // 冠亞和值賠率
  sumValue: {
    '3': 40, '4': 40, '5': 20, '6': 20, '7': 13, '8': 13,
    '9': 10, '10': 10, '11': 8, '12': 8, '13': 8, '14': 8, 
    '15': 8, '16': 8, '17': 10, '18': 10, '19': 13, 
    big: 1.98, small: 1.98, odd: 1.98, even: 1.98 // 大小單雙
  },
  // 單車號碼賠率
  number: {
    first: 9.9,  // 冠軍號碼
    second: 9.9, // 亞軍號碼
    third: 9.9,  // 第三名
    fourth: 9.9, // 第四名
    fifth: 9.9   // 第五名
  },
  // 冠亞軍單雙大小賠率
  champion: {
    big: 1.98, small: 1.98, odd: 1.98, even: 1.98
  },
  runnerup: {
    big: 1.98, small: 1.98, odd: 1.98, even: 1.98
  },
  // 龍虎賠率
  dragonTiger: 1.98
};

// 用戶數據存儲
let users = {};

// 用戶注單記錄
let betHistory = [];

// 遊戲結果歷史
let resultHistory = [];

// 初始化一個特定用戶的本地資料
async function initializeUserData(username) {
  console.log('初始化用戶資料:', username);
  
  // 檢查用戶是否已在本地存在
  if (users[username]) {
    console.log('用戶已存在於本地系統:', username);
    return users[username];
  }
  
  try {
    // 從代理系統獲取會員資料
    const response = await fetch(`${AGENT_API_URL}/member-balance?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('從代理系統獲取會員資料失敗:', response.status);
      // 初始化一個空的用戶資料
      users[username] = {
        username,
        balance: 0, // 初始餘額為 0
        status: 1,
        lastLoginAt: new Date()
      };
      return users[username];
    }
    
    const data = await response.json();
    
    if (data.success) {
      // 設定初始用戶資料
      users[username] = {
        username,
        balance: data.balance,
        status: 1,
        lastLoginAt: new Date()
      };
      console.log('成功從代理系統初始化用戶資料:', users[username]);
    } else {
      // 初始化一個空的用戶資料
      users[username] = {
        username,
        balance: 0, // 初始餘額為 0
        status: 1,
        lastLoginAt: new Date()
      };
      console.log('從代理系統獲取資料失敗，初始化空資料:', users[username]);
    }
    
    return users[username];
  } catch (error) {
    console.error('初始化用戶資料出錯:', error);
    // 出錯時初始化一個空的用戶資料
    users[username] = {
      username,
      balance: 0, // 初始餘額為 0
      status: 1,
      lastLoginAt: new Date()
    };
    return users[username];
  }
}

// 註冊API
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  
  // 驗證用戶數據
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '帳號和密碼不能為空' });
  }
  
  // 檢查用戶是否已存在
  if (users[username]) {
    return res.status(400).json({ success: false, message: '此帳號已被註冊' });
  }
  
  // 創建新用戶
  users[username] = {
    username,
    password, // 注意：實際應用中應該加密密碼
    balance: 1000, // 新用戶初始餘額
    createdAt: new Date()
  };
  
  res.status(201).json({ success: true, message: '註冊成功' });
});

// 模擬遊戲循環
function startGameCycle() {
  // 每分鐘更新一次遊戲狀態
  setInterval(() => {
    if (gameData.countdownSeconds > 0) {
      gameData.countdownSeconds--;
    } else {
      // 倒計時結束，開獎
      if (gameData.status === 'betting') {
        gameData.status = 'drawing';
        console.log('開獎中...');
        
        // 模擬開獎過程(3秒後產生結果)
        setTimeout(() => {
          // 隨機產生新的遊戲結果(1-10的不重複隨機數)
          gameData.lastResult = generateRaceResult();
          
          // 將結果添加到歷史記錄
          resultHistory.unshift({
            period: gameData.currentPeriod,
            result: [...gameData.lastResult]
          });
          
          // 限制歷史記錄條數
          if (resultHistory.length > 50) {
            resultHistory.pop();
          }
          
          // 結算注單
          settleBets();
          
          // 更新期數
          gameData.currentPeriod++;
          
          // 重置遊戲狀態
          gameData.status = 'betting';
          gameData.countdownSeconds = 60;
          
          console.log(`第${gameData.currentPeriod}期開始，可以下注`);
        }, 3000);
      }
    }
  }, 1000);
}

// 生成賽車比賽結果(1-10不重複的隨機數)
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

// 結算注單
function settleBets() {
  // 獲取當前開獎結果
  const result = gameData.lastResult;
  const champion = result[0];
  const runnerup = result[1];
  const sumValue = champion + runnerup;
  
  console.log(`結算第${gameData.currentPeriod}期注單...`);
  
  // 處理每個注單
  const winningUsers = new Set(); // 用於追蹤有贏錢的用戶
  const userWinnings = {}; // 用於記錄每個用戶的贏利金額
  
  betHistory.forEach(bet => {
    if (bet.period === gameData.currentPeriod && !bet.settled) {
      let win = false;
      let winAmount = 0;
      
      // 根據不同的投注類型計算贏利
      switch (bet.type) {
        case 'sumValue':
          if (bet.value === 'big') {
            win = sumValue > 11;
          } else if (bet.value === 'small') {
            win = sumValue <= 11;
          } else if (bet.value === 'odd') {
            win = sumValue % 2 === 1;
          } else if (bet.value === 'even') {
            win = sumValue % 2 === 0;
          } else {
            // 冠亞和值單點
            win = sumValue === parseInt(bet.value);
          }
          winAmount = win ? bet.amount * bet.odds : 0;
          break;
          
        case 'number':
          // 號碼玩法
          const position = bet.position;
          win = result[position - 1] === parseInt(bet.value);
          winAmount = win ? bet.amount * bet.odds : 0;
          break;
          
        case 'champion':
          // 冠軍玩法
          if (bet.value === 'big') {
            win = champion > 5;
          } else if (bet.value === 'small') {
            win = champion <= 5;
          } else if (bet.value === 'odd') {
            win = champion % 2 === 1;
          } else if (bet.value === 'even') {
            win = champion % 2 === 0;
          }
          winAmount = win ? bet.amount * bet.odds : 0;
          break;
          
        case 'runnerup':
          // 亞軍玩法
          if (bet.value === 'big') {
            win = runnerup > 5;
          } else if (bet.value === 'small') {
            win = runnerup <= 5;
          } else if (bet.value === 'odd') {
            win = runnerup % 2 === 1;
          } else if (bet.value === 'even') {
            win = runnerup % 2 === 0;
          }
          winAmount = win ? bet.amount * bet.odds : 0;
          break;
          
        case 'dragonTiger':
          // 龍虎玩法
          if (bet.value === 'dragon') {
            win = champion > runnerup;
          } else if (bet.value === 'tiger') {
            win = champion < runnerup;
          }
          winAmount = win ? bet.amount * bet.odds : 0;
          break;
      }
      
      // 更新注單狀態
      bet.settled = true;
      bet.win = win;
      bet.winAmount = winAmount;
      
      // 累計用戶贏利金額
      if (win && winAmount > 0) {
        if (!userWinnings[bet.username]) {
          userWinnings[bet.username] = 0;
          winningUsers.add(bet.username);
        }
        userWinnings[bet.username] += winAmount;
      }
    }
  });
  
  // 更新用戶餘額並同步到代理系統
  for (const username of winningUsers) {
    const winAmount = userWinnings[username];
    const user = users[username];
    
    if (user && winAmount > 0) {
      // 更新本地餘額
      user.balance += winAmount;
      console.log(`用戶 ${username} 贏得了 ${winAmount} 元，更新後餘額: ${user.balance}`);
      
      // 異步更新代理系統的餘額
      (async function updateAgentBalance() {
        try {
          console.log(`嘗試向代理系統同步用戶 ${username} 的餘額變更...`);
          
          // 向代理系統發送餘額更新請求
          const response = await fetch(`${AGENT_API_URL}/update-member-balance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              username,
              amount: winAmount, // 僅發送贏得的金額，而不是整個餘額
              type: 'settlement'
            })
          });
          
          if (!response.ok) {
            console.error(`更新用戶 ${username} 餘額至代理系統失敗, 狀態碼: ${response.status}`);
            const text = await response.text();
            console.error(`錯誤詳情: ${text}`);
          } else {
            const data = await response.json();
            if (data.success) {
              // 更新本地餘額為代理系統同步後的餘額，確保一致性
              user.balance = data.newBalance;
              console.log(`用戶 ${username} 餘額已同步至代理系統: ${data.newBalance}`);
            } else {
              console.error(`代理系統拒絕更新 ${username} 的餘額: ${data.message}`);
            }
          }
        } catch (error) {
          console.error(`同步用戶 ${username} 餘額時發生錯誤:`, error);
        }
      })();
    }
  }
}

// 餘額查詢API - 合併兩個相同路由
app.get('/api/balance', async (req, res) => {
  const { username } = req.query;
  
  console.log('接收到餘額查詢請求:', req.query);
  
  if (!username) {
    console.log('未提供用戶名，返回錯誤');
    return res.status(400).json({ 
      success: false, 
      message: '請提供用戶名參數' 
    });
  }

  // 檢查用戶是否存在，如不存在則初始化
  if (!users[username]) {
    console.log('用戶不存在於本地，嘗試初始化:', username);
    await initializeUserData(username);
  }
  
  // 檢查用戶是否存在於本地
  const user = users[username];
  if (!user) {
    console.log('用戶初始化失敗:', username);
    return res.status(404).json({
      success: false,
      message: '用戶不存在或初始化失敗'
    });
  }

  try {
    // 向代理系統查詢餘額
    console.log('向代理系統發送查詢餘額請求:', username);
    const response = await fetch(`${AGENT_API_URL}/member-balance?username=${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('代理系統響應狀態碼:', response.status);
      const text = await response.text();
      console.error('代理系統響應內容:', text);
      
      // 代理系統無法訪問時，使用本地餘額
      console.log('使用本地餘額數據:', user.balance);
      return res.json({ 
        success: true, 
        balance: user.balance,
        source: 'local' 
      });
    }

    const data = await response.json();
    console.log('代理系統返回的餘額數據:', data);
    
    if (data.success) {
      // 更新本地用戶資料
      user.balance = data.balance;
      console.log('更新本地餘額為:', data.balance);
      res.json({ 
        success: true, 
        balance: data.balance,
        source: 'agent' 
      });
    } else {
      // 代理系統回應失敗時，使用本地餘額
      console.log('代理系統回應失敗，使用本地餘額:', user.balance);
      res.json({ 
        success: true, 
        balance: user.balance,
        source: 'local',
        message: data.message || '代理系統獲取餘額失敗，使用本地餘額' 
      });
    }
  } catch (error) {
    console.error('獲取餘額錯誤:', error);
    // 發生錯誤時，使用本地餘額
    console.log('發生錯誤，使用本地餘額:', user.balance);
    res.json({ 
      success: true, 
      balance: user.balance,
      source: 'local',
      message: '與代理系統通信錯誤，使用本地餘額' 
    });
  }
});

// 位置轉換函數
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

// 獲取當前遊戲數據
app.get('/api/game-data', (req, res) => {
  res.json({
    gameData,
    odds
  });
});

// 獲取歷史開獎結果
app.get('/api/history', (req, res) => {
  res.json(resultHistory);
});

// 用戶登入
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  console.log('收到登入請求:', { username, password: '***' });
  
  try {
    // 向代理系統發送驗證請求
    console.log('正在向代理系統發送驗證請求...');
    const response = await fetch(`${AGENT_API_URL}/verify-member`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      console.error('代理系統響應狀態碼:', response.status);
      const text = await response.text();
      console.error('代理系統響應內容:', text);
      
      // 如果代理系統連接失敗，但用戶存在於本地，則允許登入
      if (users[username]) {
        console.log('代理系統無法連接，使用本地數據進行登入');
        return res.json({
          success: true,
          message: '登入成功（本地驗證）',
          user: users[username]
        });
      }
      
      // 嘗試初始化用戶資料
      await initializeUserData(username);
      
      if (users[username]) {
        console.log('已初始化用戶資料，使用本地數據進行登入');
        return res.json({
          success: true,
          message: '登入成功（本地驗證）',
          user: users[username]
        });
      }
      
      return res.status(500).json({
        success: false,
        message: '無法連接代理系統，請稍後再試'
      });
    }

    const data = await response.json();
    console.log('代理系統回應:', data);

    if (data.success) {
      // 更新本地用戶資料
      users[username] = {
        username: data.member.username,
        balance: data.member.balance,
        status: data.member.status,
        lastLoginAt: new Date()
      };
      
      console.log('用戶登入成功，更新本地資料:', users[username]);
      
      res.json({
        success: true,
        message: '登入成功',
        user: users[username]
      });
    } else {
      res.json({
        success: false,
        message: data.message || '登入失敗'
      });
    }
  } catch (error) {
    console.error('登入錯誤:', error);
    
    // 如果發生錯誤，但用戶存在於本地，則允許登入
    if (users[username]) {
      console.log('登入過程出錯，使用本地數據進行登入');
      return res.json({
        success: true,
        message: '登入成功（本地驗證）',
        user: users[username]
      });
    }
    
    // 嘗試初始化用戶資料
    await initializeUserData(username);
    
    if (users[username]) {
      console.log('已初始化用戶資料，使用本地數據進行登入');
      return res.json({
        success: true,
        message: '登入成功（本地驗證）',
        user: users[username]
      });
    }
    
    res.status(500).json({
      success: false,
      message: '登入過程發生錯誤，請稍後再試'
    });
  }
});

// 用戶註冊
app.post('/api/register', (req, res) => {
  const { username, password, confirmPassword } = req.body;
  
  // 基本驗證
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: '帳號和密碼不能為空'
    });
  }
  
  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: '兩次輸入的密碼不一致'
    });
  }
  
  // 檢查用戶名是否已存在
  if (users[username]) {
    return res.status(400).json({
      success: false,
      message: '該帳號已被註冊'
    });
  }
  
  // 創建新用戶
  users[username] = {
    username,
    password,
    balance: 10000, // 新用戶初始餘額
    createdAt: new Date()
  };
  
  res.status(201).json({
    success: true,
    message: '註冊成功',
    username: username
  });
});

// 接收下注請求
app.post('/api/bet', async (req, res) => {
  const { username, betType, value, position, amount } = req.body;
  
  console.log('收到下注請求:', { username, betType, value, position, amount });
  
  // 檢查用戶是否存在
  const user = users[username];
  if (!user) {
    return res.status(404).json({
      success: false,
      message: '用戶不存在'
    });
  }
  
  // 檢查遊戲狀態
  if (gameData.status !== 'betting') {
    return res.status(400).json({
      success: false,
      message: '當前不在下注時間'
    });
  }
  
  // 檢查餘額是否足夠
  if (user.balance < amount) {
    return res.status(400).json({
      success: false,
      message: '餘額不足'
    });
  }
  
  try {
    // 向代理系統發送餘額更新請求
    const updateResponse = await fetch(`${AGENT_API_URL}/update-member-balance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        username,
        amount: -amount, // 下注是扣除餘額
        type: 'bet'
      })
    });
    
    // 檢查更新請求的響應
    if (!updateResponse.ok) {
      console.error('餘額更新失敗，HTTP狀態碼:', updateResponse.status);
      const errorText = await updateResponse.text();
      console.error('更新餘額錯誤詳情:', errorText);
      return res.status(500).json({
        success: false,
        message: '系統錯誤，無法處理下注'
      });
    }
    
    const updateData = await updateResponse.json();
    
    if (!updateData.success) {
      return res.status(400).json({
        success: false,
        message: updateData.message || '下注處理失敗'
      });
    }
    
    // 更新本地餘額
    user.balance = updateData.newBalance;
    console.log(`用戶 ${username} 下注 ${amount} 元後餘額更新為: ${user.balance}`);
    
    // 創建新的注單
    const newBet = {
      id: Date.now().toString(),
      username,
      type: betType,
      value,
      position: position !== null ? parseInt(position) : null,
      amount: parseFloat(amount),
      odds: getOdds(betType, value, position),
      period: gameData.currentPeriod,
      time: new Date(),
      settled: false
    };
    
    // 添加到注單歷史
    betHistory.push(newBet);
    
    res.json({
      success: true,
      message: '下注成功',
      bet: newBet,
      balance: user.balance
    });
    
  } catch (error) {
    console.error('下注錯誤:', error);
    
    // 發生錯誤時，不扣除餘額
    res.status(500).json({
      success: false,
      message: '系統錯誤，下注失敗'
    });
  }
});

// 獲取下注相應的賠率
function getOdds(betType, value, position) {
  switch (betType) {
    case 'sumValue':
      return odds.sumValue[value];
    case 'number':
      return odds.number[positionToKey(position)];
    case 'champion':
      return odds.champion[value];
    case 'runnerup':
      return odds.runnerup[value];
    case 'dragonTiger':
      return odds.dragonTiger;
    default:
      return 0;
  }
}

// 獲取注單歷史
app.get('/api/bet-history', (req, res) => {
  const { username } = req.query;
  
  // 如果提供了用戶名，只返回該用戶的注單
  if (username) {
    const userBets = betHistory.filter(bet => bet.username === username);
    return res.json(userBets);
  }
  
  // 否則返回所有注單
  res.json(betHistory);
});

// 啟動服務器
app.listen(port, () => {
  console.log(`極速賽車遊戲服務運行在端口 ${port}`);
  startGameCycle(); // 啟動遊戲循環
});
