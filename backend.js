// backend.js - 極速賽車遊戲後端
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3002;

// 跨域設置 - 允許前端訪問
app.use(cors({
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
    big: 2.07, small: 1.66, odd: 1.66, even: 2.07 // 大小單雙
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
    big: 1.9, small: 1.9, odd: 1.9, even: 1.9
  },
  runnerup: {
    big: 1.9, small: 1.9, odd: 1.9, even: 1.9
  },
  // 龍虎賠率
  dragonTiger: 1.9
};

// 用戶餘額(簡化示例)
let userBalance = 10000;

// 用戶注單記錄
let betHistory = [];

// 遊戲結果歷史
let resultHistory = [];

// 用戶數據存儲
let users = [
  {
    username: "zbc111",
    password: "password",
    balance: 10000,
    createdAt: new Date()
  }
];

// 註冊API
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  
  // 驗證用戶數據
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '帳號和密碼不能為空' });
  }
  
  // 檢查用戶是否已存在
  const existingUser = users.find(user => user.username === username);
  if (existingUser) {
    return res.status(400).json({ success: false, message: '此帳號已被註冊' });
  }
  
  // 創建新用戶
  const newUser = {
    username,
    password, // 注意：實際應用中應該加密密碼
    balance: 1000, // 新用戶初始餘額
    createdAt: new Date()
  };
  
  // 添加用戶到數據庫
  users.push(newUser);
  
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
  
  // 處理每個注單
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
            win = parseInt(bet.value) === sumValue;
          }
          winAmount = win ? bet.amount * odds.sumValue[bet.value] : 0;
          break;
          
        case 'number':
          win = result[bet.position - 1] === parseInt(bet.value);
          winAmount = win ? bet.amount * odds.number[positionToKey(bet.position)] : 0;
          break;
          
        case 'champion':
          if (bet.value === 'big') {
            win = champion > 5;
          } else if (bet.value === 'small') {
            win = champion <= 5;
          } else if (bet.value === 'odd') {
            win = champion % 2 === 1;
          } else if (bet.value === 'even') {
            win = champion % 2 === 0;
          }
          winAmount = win ? bet.amount * odds.champion[bet.value] : 0;
          break;
          
        case 'runnerup':
          if (bet.value === 'big') {
            win = runnerup > 5;
          } else if (bet.value === 'small') {
            win = runnerup <= 5;
          } else if (bet.value === 'odd') {
            win = runnerup % 2 === 1;
          } else if (bet.value === 'even') {
            win = runnerup % 2 === 0;
          }
          winAmount = win ? bet.amount * odds.runnerup[bet.value] : 0;
          break;
          
        case 'dragonTiger':
          if (bet.value === 'dragon') {
            win = champion > runnerup;
          } else if (bet.value === 'tiger') {
            win = champion < runnerup;
          }
          winAmount = win ? bet.amount * odds.dragonTiger : 0;
          break;
      }
      
      // 更新注單狀態
      bet.settled = true;
      bet.win = win;
      bet.winAmount = winAmount;
      
      // 更新用戶餘額
      if (win) {
        const user = users.find(u => u.username === bet.username);
        if (user) {
          user.balance += winAmount;
        }
      }
    }
  });
}

// 根據名次獲取對應的賠率鍵名
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

// 獲取用戶餘額
app.get('/api/balance', (req, res) => {
  // 假設從請求中獲取用戶名
  const { username } = req.query;
  
  // 查找用戶
  const user = users.find(u => u.username === username);
  
  if (!user) {
    return res.status(404).json({ 
      success: false, 
      message: '用戶不存在' 
    });
  }
  
  res.json({ 
    success: true,
    balance: user.balance 
  });
});

// 用戶登入
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // 查找用戶
  const user = users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: '帳號或密碼錯誤'
    });
  }
  
  res.json({
    success: true,
    message: '登入成功',
    username: user.username,
    balance: user.balance
  });
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
  if (users.some(u => u.username === username)) {
    return res.status(400).json({
      success: false,
      message: '該帳號已被註冊'
    });
  }
  
  // 創建新用戶
  const newUser = {
    username,
    password,
    balance: 10000, // 新用戶初始餘額
    createdAt: new Date()
  };
  
  // 添加到用戶數組
  users.push(newUser);
  
  res.status(201).json({
    success: true,
    message: '註冊成功',
    username: newUser.username
  });
});

// 接收下注請求
app.post('/api/bet', (req, res) => {
  const { username, betType, value, position, amount } = req.body;
  
  // 檢查用戶是否存在
  const user = users.find(u => u.username === username);
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
  
  // 檢查餘額
  if (amount > user.balance) {
    return res.status(400).json({
      success: false,
      message: '餘額不足'
    });
  }
  
  // 扣除餘額
  user.balance -= amount;
  
  // 創建注單
  const betId = Date.now().toString();
  const newBet = {
    id: betId,
    username,
    period: gameData.currentPeriod,
    type: betType,
    value: value,
    position: position,
    amount: amount,
    time: new Date(),
    settled: false,
    win: false,
    winAmount: 0
  };
  
  // 保存注單
  betHistory.push(newBet);
  
  res.json({
    success: true,
    message: '下注成功',
    bet: newBet,
    balance: user.balance
  });
});

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
