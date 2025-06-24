// backend.js - 極速賽車遊戲後端
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import fs from 'fs';

// 導入數據庫模型
import db from './db/config.js';
import initDatabase from './db/init.js';
import UserModel from './db/models/user.js';
import BetModel from './db/models/bet.js';
import GameModel from './db/models/game.js';

// 初始化環境變量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3002;

// 代理後端URL
const AGENT_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://bet-agent.onrender.com/api/agent'
  : 'http://localhost:3003/api/agent';

// 立即同步開獎結果到代理系統
async function syncToAgentSystem(period, result) {
  try {
    console.log(`🚀 立即同步開獎結果到代理系統: 期數=${period}`);
    
    // 調用代理系統的內部同步API
    const response = await fetch(`${AGENT_API_URL}/sync-draw-record`, {
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
      console.log(`✅ 開獎結果同步成功: 期數=${period}`, data);
    } else {
      console.error(`❌ 開獎結果同步失敗: 期數=${period}, 狀態=${response.status}`);
    }
  } catch (error) {
    console.error(`❌ 同步開獎結果到代理系統出錯: 期數=${period}`, error.message);
    // 不要拋出錯誤，避免影響遊戲流程
  }
}

// 跨域設置 - 允許前端訪問
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://bet-game.onrender.com', 'https://bet-agent.onrender.com'] 
    : ['http://localhost:3002', 'http://localhost:3000', 'http://localhost:8082', 'http://127.0.0.1:8082'],
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

// Favicon 路由處理
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'deploy/frontend', 'favicon.svg'));
});

// 健康檢查端點 - 用於 Render 監控
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 會員登入API
app.post('/api/member/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`會員登入請求: ${username}`);
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '請提供帳號和密碼'
      });
    }
    
    // 向代理系統查詢會員資訊
    const response = await fetch(`${AGENT_API_URL}/member/verify-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });
    
    if (!response.ok) {
      console.error(`代理系統驗證失敗: ${response.status}`);
      return res.status(400).json({
        success: false,
        message: '帳號或密碼錯誤'
      });
    }
    
    const memberData = await response.json();
    
    if (!memberData.success) {
      return res.status(400).json({
        success: false,
        message: memberData.message || '帳號或密碼錯誤'
      });
    }
    
    // 檢查會員狀態
    if (memberData.member.status !== 1) {
      return res.status(400).json({
        success: false,
        message: '帳號已被停用，請聯繫客服'
      });
    }
    
    console.log(`會員登入成功: ${username}, ID: ${memberData.member.id}`);
    
    res.json({
      success: true,
      message: '登入成功',
      member: {
        id: memberData.member.id,
        username: memberData.member.username,
        balance: memberData.member.balance,
        agent_id: memberData.member.agent_id,
        status: memberData.member.status
      }
    });
    
  } catch (error) {
    console.error('會員登入錯誤:', error);
    res.status(500).json({
      success: false,
      message: '登入服務暫時不可用，請稍後再試'
    });
  }
});

// 獲取會員餘額API
app.get('/api/member/balance/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // 向代理系統查詢會員餘額
    const response = await fetch(`${AGENT_API_URL}/member/balance/${username}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: '用戶不存在'
      });
    }
    
    const balanceData = await response.json();
    
    res.json(balanceData);
    
  } catch (error) {
    console.error('獲取會員餘額錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取餘額失敗'
    });
  }
});

// 會員投注記錄API
app.get('/api/member/bet-records/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // 向代理系統查詢會員投注記錄
    const response = await fetch(`${AGENT_API_URL}/member/bet-records/${username}?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: '獲取投注記錄失敗'
      });
    }
    
    const recordsData = await response.json();
    
    res.json(recordsData);
    
  } catch (error) {
    console.error('獲取會員投注記錄錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取投注記錄失敗'
    });
  }
});

// 會員盈虧統計API
app.get('/api/member/profit-loss/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { period = 'today' } = req.query;
    
    // 向代理系統查詢會員盈虧
    const response = await fetch(`${AGENT_API_URL}/member/profit-loss/${username}?period=${period}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return res.status(400).json({
        success: false,
        message: '獲取盈虧統計失敗'
      });
    }
    
    const profitData = await response.json();
    
    res.json(profitData);
    
  } catch (error) {
    console.error('獲取會員盈虧統計錯誤:', error);
    res.status(500).json({
      success: false,
      message: '獲取盈虧統計失敗'
    });
  }
});

// 新增重啟遊戲循環端點 - 用於手動重啟遊戲循環
app.get('/api/restart-game-cycle', async (req, res) => {
  try {
    console.log('手動重啟遊戲循環...');
    
    // 重啟遊戲循環
    await startGameCycle();
    
    res.json({ 
      success: true, 
      message: '遊戲循環已重啟',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('重啟遊戲循環失敗:', error);
    res.status(500).json({ 
      success: false, 
      message: '重啟遊戲循環失敗', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 新增數據庫初始化端點 - 用於手動觸發數據庫初始化
app.get('/api/init-db', async (req, res) => {
  try {
    console.log('手動觸發數據庫初始化...');
    await initDatabase();
    
    // 初始化遊戲狀態
    const gameState = await GameModel.getCurrentState();
    if (!gameState) {
      // 如果不存在，創建初始遊戲狀態
      await GameModel.updateState({
        current_period: 202505051077,
        countdown_seconds: 60,
        last_result: [4, 2, 7, 9, 8, 10, 6, 3, 5, 1],
        status: 'betting'
      });
      console.log('創建初始遊戲狀態成功');
    }
    
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

// 賠率數據 - 根據極速賽車實際賠率設置 (包含退水0.41)
let odds = {
  // 冠亞和值賠率 (扣除退水0.41)
  sumValue: {
    '3': 40.59, '4': 20.59, '5': 15.59, '6': 12.59, '7': 10.59, '8': 8.59,
    '9': 7.59, '10': 6.59, '11': 6.59, '12': 7.59, '13': 8.59, '14': 10.59, 
    '15': 12.59, '16': 15.59, '17': 20.59, '18': 40.59, '19': 80.59, 
    big: 1.55, small: 1.55, odd: 1.55, even: 1.55 // 大小單雙
  },
  // 單車號碼賠率 (10.0 - 0.41 = 9.59)
  number: {
    first: 9.59,  // 冠軍號碼
    second: 9.59, // 亞軍號碼
    third: 9.59,  // 第三名
    fourth: 9.59, // 第四名
    fifth: 9.59,  // 第五名
    sixth: 9.59,  // 第六名
    seventh: 9.59,// 第七名
    eighth: 9.59, // 第八名
    ninth: 9.59,  // 第九名
    tenth: 9.59   // 第十名
  },
  // 冠亞軍單雙大小賠率 (1.96 × (1-4.1%) = 1.88)
  champion: {
    big: 1.88, small: 1.88, odd: 1.88, even: 1.88
  },
  runnerup: {
    big: 1.88, small: 1.88, odd: 1.88, even: 1.88
  },
  third: {
    big: 1.88, small: 1.88, odd: 1.88, even: 1.88
  },
  fourth: {
    big: 1.88, small: 1.88, odd: 1.88, even: 1.88
  },
  fifth: {
    big: 1.88, small: 1.88, odd: 1.88, even: 1.88
  },
  sixth: {
    big: 1.88, small: 1.88, odd: 1.88, even: 1.88
  },
  seventh: {
    big: 1.88, small: 1.88, odd: 1.88, even: 1.88
  },
  eighth: {
    big: 1.88, small: 1.88, odd: 1.88, even: 1.88
  },
  ninth: {
    big: 1.88, small: 1.88, odd: 1.88, even: 1.88
  },
  tenth: {
    big: 1.88, small: 1.88, odd: 1.88, even: 1.88
  },
  // 龍虎賠率 (1.96 × (1-4.1%) = 1.88)
  dragonTiger: 1.88
};

// 初始化一個特定用戶的本地資料
async function initializeUserData(username) {
  console.log('初始化用戶資料:', username);
  
  try {
    // 檢查用戶是否已在數據庫中存在
    const existingUser = await UserModel.findByUsername(username);
    if (existingUser) {
      console.log('用戶已存在於數據庫:', username);
      return existingUser;
    }
    
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
      // 初始化一個新用戶
      const newUser = await UserModel.createOrUpdate({
        username,
        balance: 0,
        status: 1
      });
      return newUser;
    }
    
    const data = await response.json();
    
    if (data.success) {
      // 設定初始用戶資料
      const newUser = await UserModel.createOrUpdate({
        username,
        balance: data.balance,
        status: 1
      });
      console.log('成功從代理系統初始化用戶資料:', newUser);
      return newUser;
    } else {
      // 初始化一個新用戶
      const newUser = await UserModel.createOrUpdate({
        username,
        balance: 0,
        status: 1
      });
      console.log('從代理系統獲取資料失敗，初始化空資料:', newUser);
      return newUser;
    }
  } catch (error) {
    console.error('初始化用戶資料出錯:', error);
    // 出錯時也嘗試創建用戶
    try {
      const newUser = await UserModel.createOrUpdate({
        username,
        balance: 0,
        status: 1
      });
      return newUser;
    } catch (innerError) {
      console.error('創建用戶時出錯:', innerError);
      throw error;
    }
  }
}

// 註冊API
app.post('/api/register', async (req, res) => {
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
  
  // 用戶名格式驗證
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({
      success: false,
      message: '用戶名長度必須在3-20個字符之間'
    });
  }
  
  // 密碼強度驗證
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: '密碼長度不能少於6個字符'
    });
  }
  
  try {
    // 檢查用戶名是否已存在
    const existingUser = await UserModel.findByUsername(username);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '該帳號已被註冊'
      });
    }
    
    // 創建新用戶
    await UserModel.createOrUpdate({
      username,
      password,
      balance: 10000 // 新用戶初始餘額
    });
    
    // 嘗試同步到代理系統
    try {
      await fetch(`${AGENT_API_URL}/sync-new-member`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username,
          balance: 10000,
          reason: '新用戶註冊'
        })
      });
    } catch (syncError) {
      console.warn('同步新用戶到代理系統失敗:', syncError);
    }
    
    res.status(201).json({
      success: true,
      message: '註冊成功',
      username: username
    });
  } catch (error) {
    console.error('註冊用戶出錯:', error);
    res.status(500).json({
      success: false,
      message: '註冊失敗，系統錯誤'
    });
  }
});

// 全局變量
let gameLoopInterval = null;
let drawingTimeoutId = null;
let hotBetsInterval = null;

// 內存遊戲狀態（減少數據庫I/O）
let memoryGameState = {
  current_period: null,
  countdown_seconds: 60,
  last_result: null,
  status: 'betting'
};

// 清理定時器
function cleanupTimers() {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
    console.log('遊戲循環定時器已清理');
  }
  
  if (drawingTimeoutId) {
    clearTimeout(drawingTimeoutId);
    drawingTimeoutId = null;
    console.log('開獎定時器已清理');
  }
  
  if (hotBetsInterval) {
    clearInterval(hotBetsInterval);
    hotBetsInterval = null;
    console.log('熱門投注定時器已清理');
  }
}

// 處理進程結束信號
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信號，正在清理資源...');
  cleanupTimers();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信號，正在清理資源...');
  cleanupTimers();
  process.exit(0);
});

// 模擬遊戲循環
async function startGameCycle() {
  try {
    // 如果已經有一個遊戲循環在運行，先清除它
    if (gameLoopInterval) {
      console.log('清除現有遊戲循環...');
      clearInterval(gameLoopInterval);
      gameLoopInterval = null;
    }
    
    // 如果有開獎過程在進行，也清除它
    if (drawingTimeoutId) {
      console.log('清除未完成的開獎過程...');
      clearTimeout(drawingTimeoutId);
      drawingTimeoutId = null;
    }
    
    // 初始化遊戲狀態
    let gameState = await GameModel.getCurrentState();
    if (!gameState) {
      // 如果不存在，創建初始遊戲狀態
      gameState = await GameModel.updateState({
        current_period: 202505081001, // 更新為今天的日期+期數
        countdown_seconds: 60,
        last_result: [4, 2, 7, 9, 8, 10, 6, 3, 5, 1],
        status: 'betting'
      });
      console.log('創建初始遊戲狀態成功');
    } else {
      // 如果是重啟，且狀態為drawing，重設為betting
      if (gameState.status === 'drawing') {
        console.log('遊戲之前卡在開獎狀態，重設為投注狀態');
        
        // 生成新結果
        const newResult = generateRaceResult();
        const current_period = parseInt(gameState.current_period) + 1;
        
        await GameModel.updateState({
          current_period,
          countdown_seconds: 60,
          last_result: newResult,
          status: 'betting'
        });
        
        // 更新遊戲狀態
        gameState = await GameModel.getCurrentState();
        console.log(`重設後的遊戲狀態: 期數=${gameState.current_period}, 狀態=${gameState.status}`);
      }
    }
    
    // 初始化內存狀態
    memoryGameState = {
      current_period: gameState.current_period,
      countdown_seconds: gameState.countdown_seconds,
      last_result: gameState.last_result,
      status: gameState.status
    };
    
    console.log(`啟動遊戲循環: 當前期數=${memoryGameState.current_period}, 狀態=${memoryGameState.status}`);
    
    // 每秒更新內存狀態，減少數據庫寫入
    gameLoopInterval = setInterval(async () => {
      try {
        if (memoryGameState.countdown_seconds > 0) {
          // 只更新內存計數器
          memoryGameState.countdown_seconds--;
        } else {
          // 倒計時結束，開獎
          if (memoryGameState.status === 'betting') {
            memoryGameState.status = 'drawing';
            console.log('開獎中...');
            
            // 寫入數據庫（關鍵狀態變更）
            await GameModel.updateState({
              current_period: memoryGameState.current_period,
              countdown_seconds: 0,
              last_result: memoryGameState.last_result,
              status: 'drawing'
            });
            
            // 模擬開獎過程(3秒後產生結果)
            drawingTimeoutId = setTimeout(async () => {
              try {
                // 清除timeoutId
                drawingTimeoutId = null;
                
                // 隨機產生新的遊戲結果(1-10的不重複隨機數)
                const newResult = await generateSmartRaceResult(memoryGameState.current_period);
                
                // 將結果添加到歷史記錄
                await GameModel.addResult(memoryGameState.current_period, newResult);
                
                // 立即同步到代理系統
                await syncToAgentSystem(memoryGameState.current_period, newResult);
                
                // 結算注單
                await settleBets(memoryGameState.current_period, newResult);
                
                // 更新期數和內存狀態
                memoryGameState.current_period++;
                memoryGameState.countdown_seconds = 60;
                memoryGameState.last_result = newResult;
                memoryGameState.status = 'betting';
                
                // 寫入數據庫（重要狀態變更）
                await GameModel.updateState({
                  current_period: memoryGameState.current_period,
                  countdown_seconds: 60,
                  last_result: newResult,
                  status: 'betting'
                });
                
                console.log(`第${memoryGameState.current_period}期開始，可以下注`);
                
                // 每5期執行一次系統監控與自動調整
                if (memoryGameState.current_period % 5 === 0) {
                  monitorAndAdjustSystem();
                }
              } catch (error) {
                console.error('開獎過程出錯:', error);
              }
            }, 3000);
          }
        }
      } catch (error) {
        console.error('遊戲循環出錯:', error);
      }
    }, 1000);
    
    return { success: true, message: '遊戲循環已啟動' };
  } catch (error) {
    console.error('啟動遊戲循環出錯:', error);
    throw error;
  }
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

// 控制參數 - 決定殺大賠小策略的強度和平衡
const CONTROL_PARAMS = {
  // 下注額判定閾值（超過此值視為大額下注）
  thresholdAmount: 3000,
  
  // 權重調整系數 (較大的值表示更強的干預)
  adjustmentFactor: 0.7,
  
  // 隨機性保留比例 (確保系統不會完全可預測)
  randomnessFactor: 0.3,
  
  // 單場損益控制 (平台單場最大可接受的虧損率)
  maxLossRate: 0.3,
  
  // 是否啟用殺大賠小機制
  enabled: true
};

// 根據下注情況生成智能結果
async function generateSmartRaceResult(period) {
  try {
    // 分析該期下注情況
    const betStats = await analyzeBetsForPeriod(period);
    
    // 記錄下注統計
    console.log(`期數 ${period} 的下注統計:`, 
      { 
        totalAmount: betStats.totalAmount, 
        typeCounts: {
          sumValue: Object.keys(betStats.sumValue).length,
          number: Object.keys(betStats.number).length,
          champion: Object.keys(betStats.champion).length,
          runnerup: Object.keys(betStats.runnerup).length,
          dragonTiger: Object.keys(betStats.dragonTiger).length
        }
      }
    );
    
    // 識別大額下注組合
    const highBets = findHighBetCombinations(betStats);
    
    if (highBets.length > 0) {
      console.log('檢測到大額下注，套用殺大賠小策略');
      console.log('大額下注統計:', JSON.stringify(highBets));
      
      // 建立一個權重系統，避免大額下注獲勝
      const weights = calculateResultWeights(highBets, betStats);
      
      // 基於權重生成結果
      return generateWeightedResult(weights);
    }
    
    // 即使沒有大額下注，也使用輕微權重，防止完全隨機
    console.log('無大額下注，使用標準權重開獎');
    const standardWeights = {
      positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
      sumValue: Array(17).fill(1)
    };
    
    // 根據所有下注建立輕微權重
    Object.entries(betStats).forEach(([betType, bets]) => {
      if (betType !== 'totalAmount') {
        Object.entries(bets).forEach(([value, amount]) => {
          if (betType === 'number') {
            // 號碼下注需特殊處理
            const [position, num] = value.split('_');
            if (position && num) {
              const posIndex = parseInt(position) - 1;
              const numIndex = parseInt(num) - 1;
              if (posIndex >= 0 && posIndex < 10 && numIndex >= 0 && numIndex < 10) {
                // 輕微減少該號碼的權重
                standardWeights.positions[posIndex][numIndex] *= 0.9;
              }
            }
          } else if (betType === 'sumValue') {
            // 處理冠亞和值
            if (!isNaN(parseInt(value))) {
              const sumIndex = parseInt(value) - 3;
              if (sumIndex >= 0 && sumIndex < 17) {
                standardWeights.sumValue[sumIndex] *= 0.9;
              }
            }
          }
        });
      }
    });
    
    return generateWeightedResult(standardWeights);
  } catch (error) {
    console.error('智能開獎過程出錯:', error);
    // 出錯時使用權重為1的均等開獎，確保公平性
    const defaultWeights = {
      positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
      sumValue: Array(17).fill(1)
    };
    return generateWeightedResult(defaultWeights);
  }
}

// 在開獎前分析此期所有注單
async function analyzeBetsForPeriod(period) {
  // 獲取該期所有注單
  const allBets = await BetModel.getUnsettledByPeriod(period);
  
  // 初始化統計
  const betStats = {
    sumValue: {}, // 冠亞和
    number: {}, // 號碼玩法
    champion: {}, // 冠軍
    runnerup: {}, // 亞軍
    third: {}, // 第三
    fourth: {}, // 第四
    fifth: {}, // 第五
    sixth: {}, // 第六
    seventh: {}, // 第七
    eighth: {}, // 第八
    ninth: {}, // 第九
    tenth: {}, // 第十
    dragonTiger: {}, // 龍虎
    totalAmount: 0 // 總下注金額
  };
  
  // 統計每種投注類型和值的下注總額
  allBets.forEach(bet => {
    const betType = bet.bet_type;
    const betValue = bet.bet_value;
    const position = bet.position ? bet.position : null;
    const amount = parseFloat(bet.amount);
    
    // 增加總金額
    betStats.totalAmount += amount;
    
    // 根據注單類型進行分類統計
    if (betType === 'number') {
      // 號碼玩法需要考慮位置
      const key = `${position}_${betValue}`;
      if (!betStats.number[key]) betStats.number[key] = 0;
      betStats.number[key] += amount;
    } else {
      // 其他類型直接按值統計
      if (!betStats[betType][betValue]) betStats[betType][betValue] = 0;
      betStats[betType][betValue] += amount;
    }
  });
  
  return betStats;
}

// 找出大額下注組合
function findHighBetCombinations(betStats) {
  const highBets = [];
  const threshold = CONTROL_PARAMS.thresholdAmount;
  
  // 檢查號碼玩法
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
  
  // 檢查冠亞和值
  for (const [value, amount] of Object.entries(betStats.sumValue)) {
    if (amount >= threshold) {
      highBets.push({
        type: 'sumValue',
        value: value,
        amount: amount
      });
    }
  }
  
  // 檢查冠軍
  for (const [value, amount] of Object.entries(betStats.champion)) {
    if (amount >= threshold) {
      highBets.push({
        type: 'champion',
        value: value,
        amount: amount
      });
    }
  }
  
  // 檢查亞軍
  for (const [value, amount] of Object.entries(betStats.runnerup)) {
    if (amount >= threshold) {
      highBets.push({
        type: 'runnerup',
        value: value,
        amount: amount
      });
    }
  }
  
  // 檢查龍虎
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

// 計算開獎結果的權重
function calculateResultWeights(highBets, betStats) {
  // 初始化權重，所有位置和號碼的起始權重為1
  const weights = {
    positions: Array.from({ length: 10 }, () => Array(10).fill(1)),
    sumValue: Array(17).fill(1) // 冠亞和值3-19的權重（3到19共17個值）
  };
  
  // 根據大額下注調整權重
  highBets.forEach(bet => {
    const adjustmentFactor = CONTROL_PARAMS.adjustmentFactor;
    const randomnessFactor = CONTROL_PARAMS.randomnessFactor;
    
    if (bet.type === 'number') {
      // 減少該位置該號碼的權重，使其不太可能中獎
      const position = bet.position - 1; // 轉換為0-based索引
      const value = bet.value - 1;
      weights.positions[position][value] *= randomnessFactor;
    } 
    else if (bet.type === 'champion') {
      // 大小單雙處理
      if (bet.value === 'big') {
        // 減少冠軍為大(6-10)的權重
        for (let i = 5; i < 10; i++) {
          weights.positions[0][i] *= randomnessFactor;
        }
      } else if (bet.value === 'small') {
        // 減少冠軍為小(1-5)的權重
        for (let i = 0; i < 5; i++) {
          weights.positions[0][i] *= randomnessFactor;
        }
      } else if (bet.value === 'odd') {
        // 減少冠軍為單數的權重
        for (let i = 0; i < 10; i += 2) {
          weights.positions[0][i] *= randomnessFactor;
        }
      } else if (bet.value === 'even') {
        // 減少冠軍為雙數的權重
        for (let i = 1; i < 10; i += 2) {
          weights.positions[0][i] *= randomnessFactor;
        }
      }
    }
    else if (bet.type === 'runnerup') {
      // 與冠軍類似的處理，但是對亞軍
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
      // 減少該和值的組合權重
      if (bet.value === 'big') {
        // 減少大值(12-19)的權重
        for (let i = 12 - 3; i <= 19 - 3; i++) {
          if (i < weights.sumValue.length) {
            weights.sumValue[i] *= randomnessFactor;
          }
        }
      } else if (bet.value === 'small') {
        // 減少小值(3-11)的權重
        for (let i = 0; i <= 11 - 3; i++) {
          if (i < weights.sumValue.length) {
            weights.sumValue[i] *= randomnessFactor;
          }
        }
      } else if (bet.value === 'odd') {
        // 減少單數和值的權重
        for (let i = 0; i < weights.sumValue.length; i++) {
          if ((i + 3) % 2 === 1) weights.sumValue[i] *= randomnessFactor;
        }
      } else if (bet.value === 'even') {
        // 減少雙數和值的權重
        for (let i = 0; i < weights.sumValue.length; i++) {
          if ((i + 3) % 2 === 0) weights.sumValue[i] *= randomnessFactor;
        }
      } else {
        // 具體和值
        const sumIndex = parseInt(bet.value) - 3;
        if (sumIndex >= 0 && sumIndex < weights.sumValue.length) {
          weights.sumValue[sumIndex] *= randomnessFactor;
        }
      }
    }
    else if (bet.type === 'dragonTiger') {
      // 龍虎處理
      if (bet.value === 'dragon') {
        // 減少龍(冠軍>亞軍)的可能性
        // 策略：增加冠軍小值和亞軍大值的權重
        for (let i = 0; i < 5; i++) {
          weights.positions[0][i] *= randomnessFactor;
          weights.positions[1][i+5] *= (2 - randomnessFactor);
        }
      } else if (bet.value === 'tiger') {
        // 減少虎(冠軍<亞軍)的可能性
        // 策略：增加冠軍大值和亞軍小值的權重
        for (let i = 5; i < 10; i++) {
          weights.positions[0][i] *= (2 - randomnessFactor);
          weights.positions[1][i-5] *= randomnessFactor;
        }
      }
    }
  });
  
  return weights;
}

// 基於權重生成結果
function generateWeightedResult(weights, attempts = 0) {
  const MAX_ATTEMPTS = 20; // 最大嘗試次數
  const numbers = Array.from({length: 10}, (_, i) => i + 1);
  const result = [];
  let availableNumbers = [...numbers];
  
  // 生成前兩名(冠軍和亞軍)，這兩個位置最關鍵
  for (let position = 0; position < 2; position++) {
    // 根據權重選擇位置上的號碼
    let numberWeights = [];
    for (let i = 0; i < availableNumbers.length; i++) {
      const num = availableNumbers[i];
      numberWeights.push(weights.positions[position][num-1] || 1);
    }
    
    // 使用權重進行選擇
    const selectedIndex = weightedRandomIndex(numberWeights);
    const selectedNumber = availableNumbers[selectedIndex];
    
    // 添加到結果並從可用號碼中移除
    result.push(selectedNumber);
    availableNumbers.splice(selectedIndex, 1);
  }
  
  // 檢查是否符合目標和值權重
  const sumValue = result[0] + result[1];
  const sumValueIndex = sumValue - 3;
  const sumWeight = weights.sumValue[sumValueIndex];
  
  // 如果和值權重較低(說明這個和值有大額下注)，並且機率檢測通過，且未達到最大嘗試次數
  if (sumWeight < 0.5 && Math.random() < CONTROL_PARAMS.adjustmentFactor && attempts < MAX_ATTEMPTS) {
    console.log(`檢測到和值${sumValue}有大額下注，嘗試重新生成冠亞軍 (第${attempts + 1}次嘗試)`);
    return generateWeightedResult(weights, attempts + 1); // 修復：正確傳遞attempts計數
  }
  
  // 如果達到最大嘗試次數，記錄警告但接受當前結果
  if (attempts >= MAX_ATTEMPTS) {
    console.warn(`達到最大嘗試次數(${MAX_ATTEMPTS})，使用當前結果 - 和值: ${sumValue}`);
  }
  
  // 剩餘位置隨機生成
  while (availableNumbers.length > 0) {
    const randomIndex = Math.floor(Math.random() * availableNumbers.length);
    result.push(availableNumbers[randomIndex]);
    availableNumbers.splice(randomIndex, 1);
  }
  
  return result;
}

// 根據權重隨機選擇索引
function weightedRandomIndex(weights) {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  
  // 如果總權重為0，直接返回0
  if (totalWeight === 0) {
    console.warn('權重總和為0，返回索引0');
    return 0;
  }
  
  let random = Math.random() * totalWeight;
  
  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return i;
    }
  }
  
  return weights.length - 1; // 防止浮點誤差
}

// 監控並調整系統
async function monitorAndAdjustSystem() {
  try {
    // 計算近期平台盈虧情況(最近10期)
    const recentProfitLoss = await calculateRecentProfitLoss(10);
    
    console.log('系統監控 - 近期平台盈虧:', recentProfitLoss);
    
    // 設定調整閾值
    const THRESHOLD = 5000;
    
    // 如果平台連續虧損，適當調整控制參數
    if (recentProfitLoss < -THRESHOLD) {
      CONTROL_PARAMS.adjustmentFactor += 0.05;
      CONTROL_PARAMS.randomnessFactor -= 0.05;
      console.log('系統監控 - 平台虧損過多，加強控制');
    } 
    // 如果平台獲利過多，適當放寬控制
    else if (recentProfitLoss > THRESHOLD * 2) {
      CONTROL_PARAMS.adjustmentFactor -= 0.03;
      CONTROL_PARAMS.randomnessFactor += 0.03;
      console.log('系統監控 - 平台獲利過多，放寬控制');
    }
    
    // 確保參數在合理範圍內
    CONTROL_PARAMS.adjustmentFactor = Math.max(0.3, Math.min(0.9, CONTROL_PARAMS.adjustmentFactor));
    CONTROL_PARAMS.randomnessFactor = Math.max(0.1, Math.min(0.5, CONTROL_PARAMS.randomnessFactor));
    
    console.log('系統監控 - 當前控制參數:', CONTROL_PARAMS);
  } catch (error) {
    console.error('監控與調整系統出錯:', error);
  }
}

// 計算近期平台盈虧
async function calculateRecentProfitLoss(periods = 10) {
  try {
    // 獲取最近幾期的所有已結算注單
    const recentBets = await BetModel.getRecentSettledBets(periods);
    
    // 計算平台淨收益
    let platformProfit = 0;
    
    recentBets.forEach(bet => {
      if (bet.win) {
        // 玩家贏錢，平台虧損
        platformProfit -= parseFloat(bet.win_amount) - parseFloat(bet.amount);
      } else {
        // 玩家輸錢，平台獲利
        platformProfit += parseFloat(bet.amount);
      }
    });
    
    return platformProfit;
  } catch (error) {
    console.error('計算近期盈虧出錯:', error);
    return 0;
  }
}

// 在遊戲結算邏輯中處理點數發放和退水分配
async function settleBets(period, winResult) {
  console.log(`結算第${period}期注單...`);
  
  // 獲取系統時間內未結算的注單
  const bets = await BetModel.getUnsettledByPeriod(period);
  
  console.log(`找到${bets.length}個未結算注單`);
  
  if (bets.length === 0) {
    console.log(`第${period}期注單結算完成`);
    return;
  }
  
  // 獲取總代理ID
  const adminAgent = await getAdminAgentId();
  if (!adminAgent) {
    console.error('結算注單失敗: 找不到總代理帳戶');
    return;
  }
  
  // 遍歷並結算每個注單
  for (const bet of bets) {
    try {
      const username = bet.username;
      
      // 計算贏錢金額
      const winAmount = calculateWinAmount(bet, winResult);
      const isWin = winAmount > 0;
      
      console.log(`結算用戶 ${username} 的注單 ${bet.id}，下注類型: ${bet.bet_type}，下注值: ${bet.bet_value}，贏錢金額: ${winAmount}`);
      
      // 標記為已結算
      await BetModel.updateSettlement(bet.id, isWin, winAmount);
      
      // 如果贏了，直接增加會員餘額（不從代理扣除）
      if (isWin) {
        try {
          // 獲取當前餘額用於日誌記錄
          const currentBalance = await getBalance(username);
          
          // 原子性增加會員餘額（解決並發安全問題）
          const newBalance = await UserModel.addBalance(username, parseFloat(winAmount));
          
          // 只同步餘額到代理系統（不扣代理點數）
          try {
            await fetch(`${AGENT_API_URL}/sync-member-balance`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                username: username,
                balance: newBalance,
                reason: `第${period}期中獎 ${bet.bet_type}:${bet.bet_value}`
              })
            });
          } catch (syncError) {
            console.warn('同步餘額到代理系統失敗，但會員餘額已更新:', syncError);
          }
          
          console.log(`用戶 ${username} 贏得了 ${winAmount} 元，餘額從 ${currentBalance} 更新為 ${newBalance}`);
        } catch (error) {
          console.error(`更新用戶 ${username} 中獎餘額失敗:`, error);
        }
      }
      
      // 在結算時分配退水給代理（不論輸贏，基於下注金額）
      try {
        await distributeRebate(username, parseFloat(bet.amount));
        console.log(`已為會員 ${username} 的注單 ${bet.id} 分配退水到代理`);
      } catch (rebateError) {
        console.error(`分配退水失敗 (注單ID=${bet.id}):`, rebateError);
      }
        } catch (error) {
      console.error(`結算用戶注單出錯 (ID=${bet.id}):`, error);
      }
    }
    
    console.log(`第${period}期注單結算完成`);
}

// 退水分配函數
async function distributeRebate(username, betAmount) {
  try {
    console.log(`開始為會員 ${username} 分配退水，下注金額: ${betAmount}`);
    
    // 計算總退水金額（4.1% 的下注金額）
    const totalRebateAmount = parseFloat(betAmount) * 0.041;
    
    // 獲取會員的代理鏈
    const agentChain = await getAgentChain(username);
    if (!agentChain || agentChain.length === 0) {
      console.log(`會員 ${username} 沒有代理鏈，退水歸平台所有`);
      return;
    }
    
    console.log(`會員 ${username} 的代理鏈:`, agentChain.map(a => `${a.username}(${a.level})`));
    
    // 從最下級代理開始分配退水
    let remainingRebate = totalRebateAmount;
    
    for (let i = 0; i < agentChain.length; i++) {
      const agent = agentChain[i];
      let agentRebateAmount = 0;
      
      // 如果沒有剩餘退水，結束分配
      if (remainingRebate <= 0.01) {
        console.log(`退水已全部分配完畢`);
        break;
      }
      
      if (agent.rebate_mode === 'all') {
        // 全拿模式：該代理拿走所有剩餘退水（不需要安全截斷）
        agentRebateAmount = remainingRebate;
        remainingRebate = 0;
      } else if (agent.rebate_mode === 'percentage') {
        // 比例模式：從剩餘退水中按比例分配（修復超發問題）
        agentRebateAmount = remainingRebate * parseFloat(agent.rebate_percentage);
        remainingRebate -= agentRebateAmount;
        // 只對比例模式做安全截斷
        agentRebateAmount = Math.max(0, Math.min(agentRebateAmount, remainingRebate + agentRebateAmount));
      } else if (agent.rebate_mode === 'none') {
        // 全退模式：該代理不拿退水，留給上級
        agentRebateAmount = 0;
      }
      
      if (agentRebateAmount > 0) {
        // 分配退水給代理
        await allocateRebateToAgent(agent.id, agent.username, agentRebateAmount, username, betAmount);
        console.log(`分配退水 ${agentRebateAmount.toFixed(2)} 給代理 ${agent.username} (剩餘: ${remainingRebate.toFixed(2)})`);
        
        // 如果是全拿模式，直接結束分配
        if (agent.rebate_mode === 'all') {
          break;
        }
      }
    }
    
    // 剩餘退水歸平台所有
    if (remainingRebate > 0.01) { // 考慮浮點數精度問題
      console.log(`剩餘退水 ${remainingRebate.toFixed(2)} 歸平台所有`);
    }
    
  } catch (error) {
    console.error('分配退水時發生錯誤:', error);
  }
}

// 獲取會員的代理鏈（從直屬代理到總代理）
async function getAgentChain(username) {
  try {
    // 從代理系統獲取會員所屬的代理
    const response = await fetch(`${AGENT_API_URL}/member-agent-chain?username=${username}`);
    const data = await response.json();
    
    if (data.success && data.agentChain) {
      return data.agentChain;
    }
    
    console.log(`無法獲取會員 ${username} 的代理鏈`);
    return [];
  } catch (error) {
    console.error('獲取代理鏈時發生錯誤:', error);
    return [];
  }
}

// 分配退水給代理
async function allocateRebateToAgent(agentId, agentUsername, rebateAmount, memberUsername, betAmount) {
  try {
    // 調用代理系統的退水分配API
    const response = await fetch(`${AGENT_API_URL}/allocate-rebate`, {
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
        reason: '會員投注退水'
      })
    });
    
    // 檢查HTTP狀態碼
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
      console.error(`分配退水給代理 ${agentUsername} 失敗:`, result.message);
    }
  } catch (error) {
    console.error(`分配退水給代理 ${agentUsername} 時發生錯誤:`, error);
  }
}

// 修改獲取餘額的API端點
app.get('/api/balance', async (req, res) => {
  const { username } = req.query;
  
  try {
    // 參數驗證
  if (!username) {
    return res.status(400).json({ 
      success: false, 
        message: '請提供用戶名' 
    });
  }

    // 獲取用戶信息
    const user = await UserModel.findByUsername(username);
    if (!user) {
      console.log(`用戶不存在: ${username}`);
      return res.json({ 
          success: false,
        message: '用戶不存在', 
        balance: 0 
        });
    }
    
    console.log(`為用戶 ${username} 獲取餘額`);

    try {
      // 從代理系統獲取餘額
      const response = await fetch(`${AGENT_API_URL}/member-balance?username=${username}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('代理系統返回的餘額數據:', data);
        
        // 更新本地餘額
        await UserModel.setBalance(username, data.balance);
        console.log('更新本地餘額為:', data.balance);
        
        return res.json({ 
          success: true, 
          balance: data.balance,
          source: 'agent_system'
        });
      } else {
        console.log('代理系統回應失敗，使用本地餘額:', user.balance);
        return res.json({ 
          success: true, 
          balance: user.balance,
          source: 'local_db' 
        });
      }
    } catch (error) {
      console.error('獲取代理系統餘額出錯:', error);
      console.log('發生錯誤，使用本地餘額:', user.balance);
      return res.json({ 
        success: true, 
        balance: user.balance,
        source: 'local_db_error' 
      });
    }
  } catch (error) {
    console.error('獲取餘額出錯:', error);
    res.status(500).json({ 
      success: false, 
      message: '系統錯誤，請稍後再試' 
    });
  }
});

// 獲取今日盈虧的API端點
app.get('/api/daily-profit', async (req, res) => {
  const { username } = req.query;
  
  try {
    // 參數驗證
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: '請提供用戶名' 
      });
    }

    // 獲取用戶信息
    const user = await UserModel.findByUsername(username);
    if (!user) {
      return res.json({ 
        success: false,
        message: '用戶不存在', 
        profit: 0 
      });
    }

    // 獲取今日開始和結束時間（使用UTC時間）
    const today = new Date();
    const startOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const endOfDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));

    // 查詢今日投注記錄
    const result = await db.oneOrNone(
      `SELECT 
        COALESCE(SUM(amount), 0) as total_bet,
        COALESCE(SUM(CASE WHEN win = true THEN win_amount ELSE 0 END), 0) as total_win
      FROM bet_history 
      WHERE username = $1 
        AND settled = true 
        AND created_at >= $2 
        AND created_at < $3`,
      [username, startOfDay, endOfDay]
    );

    const totalBet = result ? parseFloat(result.total_bet) || 0 : 0;
    const totalWin = result ? parseFloat(result.total_win) || 0 : 0;
    const dailyProfit = totalWin - totalBet;

    console.log(`用戶 ${username} 今日盈虧: 投注 ${totalBet}, 贏得 ${totalWin}, 盈虧 ${dailyProfit}`);

    res.json({ 
      success: true, 
      profit: dailyProfit,
      totalBet: totalBet,
      totalWin: totalWin
    });

  } catch (error) {
    console.error('獲取今日盈虧出錯:', error);
    res.status(500).json({ 
      success: false, 
      message: '系統錯誤，請稍後再試' 
    });
  }
});

// 獲取盈虧記錄的API端點
app.get('/api/profit-records', async (req, res) => {
  const { username, days = 7 } = req.query;
  
  try {
    // 參數驗證
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: '請提供用戶名' 
      });
    }

    // 獲取用戶信息
    const user = await UserModel.findByUsername(username);
    if (!user) {
      return res.json({ 
        success: false,
        message: '用戶不存在',
        records: [],
        totalBetCount: 0,
        totalProfit: 0
      });
    }

    // 計算日期範圍
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - parseInt(days));

    // 獲取指定天數內的每日盈虧記錄
    const query = `
      SELECT 
        DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei') as date,
        COUNT(*) as bet_count,
        COALESCE(SUM(amount), 0) as total_bet,
        COALESCE(SUM(win_amount), 0) as total_win
      FROM bet_history 
      WHERE username = $1 
        AND settled = true 
        AND created_at >= $2 
        AND created_at < $3
      GROUP BY DATE(created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei')
      ORDER BY date DESC
    `;

    // 執行查詢
    const result = await db.any(query, [username, startDate, endDate]);
    
    // 處理查詢結果
    const records = result && result.length > 0 ? result.map(row => ({
      date: row.date,
      betCount: parseInt(row.bet_count),
      profit: parseFloat(row.total_win) - parseFloat(row.total_bet)
    })) : [];
    
    // 計算總計
    const totalBetCount = records.reduce((sum, record) => sum + record.betCount, 0);
    const totalProfit = records.reduce((sum, record) => sum + record.profit, 0);
    
    console.log(`獲取用戶 ${username} 的 ${days} 天盈虧記錄: ${records.length} 天記錄`);
    
    res.json({
      success: true,
      records,
      totalBetCount,
      totalProfit
    });

  } catch (error) {
    console.error('獲取盈虧記錄出錯:', error);
    res.status(500).json({ 
      success: false, 
      message: '獲取盈虧記錄失敗',
      records: [],
      totalBetCount: 0,
      totalProfit: 0
    });
  }
});

// 獲取單日詳細記錄的API端點
app.get('/api/day-detail', async (req, res) => {
  const { username, date } = req.query;
  
  try {
    // 參數驗證
    if (!username || !date) {
      return res.status(400).json({ 
        success: false, 
        message: '請提供用戶名和日期' 
      });
    }

    // 檢查用戶名是否有效
    if (!username || username.trim() === '') {
      return res.json({ 
        success: false,
        message: '無效的用戶名',
        records: [],
        stats: { betCount: 0, profit: 0 }
      });
    }

    // 計算日期範圍（當日的開始和結束，使用台北時區）
    const inputDate = new Date(date);
    
    // 如果輸入的是ISO字符串，需要正確解析
    let targetDate;
    if (typeof date === 'string' && date.includes('T')) {
      // 如果是完整的ISO字符串，轉換為台北時區的日期部分
      targetDate = new Date(date);
      targetDate.setHours(targetDate.getHours() + 8); // 轉換為台北時間
    } else {
      // 如果是簡單的日期字符串，直接使用
      targetDate = new Date(date);
    }
    
    // 計算台北時區的日期邊界
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const day = targetDate.getDate();
    
    // 台北時間的當日開始和結束
    const startOfDayTaipei = new Date(year, month, day, 0, 0, 0);
    const endOfDayTaipei = new Date(year, month, day + 1, 0, 0, 0);
    
    // 轉換為UTC時間（台北時間減去8小時）
    const startOfDay = new Date(startOfDayTaipei.getTime() - 8 * 60 * 60 * 1000);
    const endOfDay = new Date(endOfDayTaipei.getTime() - 8 * 60 * 60 * 1000);

    console.log(`查詢用戶 ${username} 在 ${date} 的記錄，時間範圍: ${startOfDay.toISOString()} 到 ${endOfDay.toISOString()}`);

    // 獲取當日的所有注單記錄，包含開獎結果
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

    console.log(`執行查詢: ${query}`);
    console.log(`查詢參數: [${username}, ${startOfDay.toISOString()}, ${endOfDay.toISOString()}]`);

    // 執行查詢
    const result = await db.any(query, [username, startOfDay, endOfDay]);
    console.log(`查詢結果: ${result ? result.length : 0} 條記錄`);
    
    // 處理查詢結果
    const records = result && result.length > 0 ? result.map(row => {
      let drawResult = null;
      try {
        if (row.draw_result && typeof row.draw_result === 'string') {
          drawResult = JSON.parse(row.draw_result);
        } else if (Array.isArray(row.draw_result)) {
          drawResult = row.draw_result;
        }
      } catch (e) {
        console.error('解析開獎結果出錯:', e, row.draw_result);
      }
      
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
    
    // 計算統計數據
    const stats = {
      betCount: records.length,
      profit: records.reduce((sum, record) => {
        return sum + (record.win ? record.winAmount : 0) - record.amount;
      }, 0)
    };
    
    console.log(`獲取用戶 ${username} 在 ${date} 的詳細記錄: ${records.length} 條記錄`);

    res.json({
      success: true,
      records,
      stats
    });

  } catch (error) {
    console.error('獲取單日詳細記錄出錯:', error);
    res.status(500).json({ 
      success: false, 
      message: '獲取單日詳細記錄失敗',
      records: [],
      stats: { betCount: 0, profit: 0 }
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
app.get('/api/game-data', async (req, res) => {
  try {
    const gameState = await GameModel.getCurrentState();
    
    // 解析JSON格式的last_result
    let last_result = gameState.last_result;
    if (typeof last_result === 'string') {
      last_result = JSON.parse(last_result);
    }
    
    const gameData = {
      currentPeriod: gameState.current_period,
      countdownSeconds: gameState.countdown_seconds,
      lastResult: last_result,
      status: gameState.status
    };
    
    res.json({
      gameData,
      odds
    });
  } catch (error) {
    console.error('獲取遊戲數據出錯:', error);
    res.status(500).json({ success: false, message: '獲取遊戲數據失敗' });
  }
});

// 獲取當前遊戲數據 (供API內部使用)
async function getGameData() {
  // 使用內存狀態，避免頻繁數據庫查詢
  let last_result = memoryGameState.last_result;
  if (typeof last_result === 'string' && last_result) {
    try {
      last_result = JSON.parse(last_result);
    } catch (e) {
      console.error('解析last_result出錯:', e);
      last_result = null;
    }
  }
  
  return {
    period: memoryGameState.current_period,
    countdown: memoryGameState.countdown_seconds,
    lastResult: last_result,
    status: memoryGameState.status
  };
}

// 計算下注獎金
function calculateWinAmount(bet, winResult) {
  try {
    // 比賽尚未結束
    if (!winResult || !Array.isArray(winResult) || winResult.length !== 10) {
      console.error('無效的開獎結果:', winResult);
      return 0;
    }
    
    // 檢查投注金額
    const amount = parseFloat(bet.amount);
    if (isNaN(amount) || amount <= 0) {
      console.error('無效的投注金額:', bet.amount);
      return 0;
    }
    
    // 獲取賠率
    const betOdds = parseFloat(bet.odds);
    if (isNaN(betOdds) || betOdds <= 0) {
      console.error('無效的賠率:', bet.odds);
      return 0;
    }
    
    // 冠軍和亞軍的值
    const champion = winResult[0];
    const runnerup = winResult[1];
    const sumValue = champion + runnerup;
    
    switch (bet.bet_type) {
      case 'number':
        // 號碼玩法
        const position = parseInt(bet.position) || 1;
        const value = parseInt(bet.bet_value);
        
        // 檢查結果
        if (position >= 1 && position <= 10 && value === winResult[position - 1]) {
          return Math.floor(amount * betOdds * 100) / 100;
        }
        break;
        
      case 'sumValue':
        // 冠亞和值
        const betValue = bet.bet_value;
        
        if (betValue === 'big' && sumValue > 11) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (betValue === 'small' && sumValue <= 11) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (betValue === 'odd' && sumValue % 2 === 1) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (betValue === 'even' && sumValue % 2 === 0) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (parseInt(betValue) === sumValue) {
          return Math.floor(amount * betOdds * 100) / 100;
        }
        break;
        
      case 'champion':
        // 冠軍投注
        if (bet.bet_value === 'big' && champion > 5) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (bet.bet_value === 'small' && champion <= 5) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (bet.bet_value === 'odd' && champion % 2 === 1) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (bet.bet_value === 'even' && champion % 2 === 0) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (!isNaN(parseInt(bet.bet_value)) && parseInt(bet.bet_value) === champion) {
          // 指定號碼投注
          return Math.floor(amount * betOdds * 100) / 100;
        }
        break;
        
      case 'runnerup':
        // 亞軍投注
        if (bet.bet_value === 'big' && runnerup > 5) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (bet.bet_value === 'small' && runnerup <= 5) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (bet.bet_value === 'odd' && runnerup % 2 === 1) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (bet.bet_value === 'even' && runnerup % 2 === 0) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (!isNaN(parseInt(bet.bet_value)) && parseInt(bet.bet_value) === runnerup) {
          // 指定號碼投注
          return Math.floor(amount * betOdds * 100) / 100;
        }
        break;
        
      case 'dragonTiger':
        // 龍虎
        if (bet.bet_value === 'dragon' && champion > runnerup) {
          return Math.floor(amount * betOdds * 100) / 100;
        } else if (bet.bet_value === 'tiger' && champion < runnerup) {
          return Math.floor(amount * betOdds * 100) / 100;
        }
        break;
        
      default:
        // 其他位置的大小單雙
        const posMap = {
          'third': 2, 'fourth': 3, 'fifth': 4, 
          'sixth': 5, 'seventh': 6, 'eighth': 7, 
          'ninth': 8, 'tenth': 9
        };
        
        if (posMap[bet.bet_type]) {
          const pos = posMap[bet.bet_type];
          const ballValue = winResult[pos];
          
          if (bet.bet_value === 'big' && ballValue > 5) {
            return Math.floor(amount * betOdds * 100) / 100;
          } else if (bet.bet_value === 'small' && ballValue <= 5) {
            return Math.floor(amount * betOdds * 100) / 100;
          } else if (bet.bet_value === 'odd' && ballValue % 2 === 1) {
            return Math.floor(amount * betOdds * 100) / 100;
          } else if (bet.bet_value === 'even' && ballValue % 2 === 0) {
            return Math.floor(amount * betOdds * 100) / 100;
          } else if (!isNaN(parseInt(bet.bet_value)) && parseInt(bet.bet_value) === ballValue) {
            // 指定號碼投注
            return Math.floor(amount * betOdds * 100) / 100;
          }
        }
        break;
    }
    
    // 未中獎
    return 0;
  } catch (error) {
    console.error('計算獎金時出錯:', error);
    return 0;
  }
}

// 獲取歷史開獎結果
app.get('/api/history', async (req, res) => {
  try {
    console.log('收到開獎歷史查詢請求:', req.query);
    
    const { page = 1, limit = 20, period = '', date = '' } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    
    // 構建查詢條件
    let whereClause = '';
    let params = [];
    let conditions = [];
    
    // 期數篩選
    if (period) {
      conditions.push('period::text LIKE $' + (params.length + 1));
      params.push(`%${period}%`);
    }
    
    // 日期篩選
    if (date) {
      conditions.push('DATE(created_at) = $' + (params.length + 1));
      params.push(date);
    }
    
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    console.log('查詢條件:', { whereClause, params });
    
    try {
      // 計算總記錄數
      const countQuery = `SELECT COUNT(*) as total FROM result_history ${whereClause}`;
      console.log('執行計數查詢:', countQuery);
      const countResult = await db.one(countQuery, params);
      const totalRecords = parseInt(countResult.total);
      const totalPages = Math.ceil(totalRecords / pageSize);
      
      // 獲取分頁數據
      const offset = (pageNumber - 1) * pageSize;
      const query = `
        SELECT period, result, created_at 
        FROM result_history 
        ${whereClause} 
        ORDER BY created_at DESC 
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      console.log('執行查詢:', query);
      const results = await db.any(query, params);
    
    // 轉換格式使其與前端相容
    const formattedResults = results.map(record => {
      let result = record.result;
      if (typeof result === 'string') {
        result = JSON.parse(result);
      }
      
      return {
        period: record.period,
        result,
        time: record.created_at
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
      console.error('資料庫查詢錯誤:', dbError);
      throw new Error(`資料庫查詢錯誤: ${dbError.message}`);
    }
  } catch (error) {
    console.error('獲取歷史開獎結果出錯:', error);
    res.status(500).json({ 
      success: false, 
      message: '獲取歷史開獎結果失敗',
      error: error.message
    });
  }
});

// 獲取下注記錄API
app.get('/api/bet-history', async (req, res) => {
  try {
    console.log('收到下注記錄查詢請求:', req.query);
    
    const { username, page = 1, limit = 20, period = '', date = '' } = req.query;
    const pageNumber = parseInt(page);
    const pageSize = parseInt(limit);
    
    if (!username) {
      return res.status(400).json({
        success: false,
        message: '未提供用戶名'
      });
    }
    
    // 構建查詢條件
    let whereClause = 'WHERE username = $1';
    let params = [username];
    
    // 期數篩選
    if (period) {
      whereClause += ' AND period::text LIKE $' + (params.length + 1);
      params.push(`%${period}%`);
    }
    
    // 日期篩選
    if (date) {
      whereClause += ' AND DATE(created_at) = $' + (params.length + 1);
      params.push(date);
    }
    
    console.log('查詢條件:', { whereClause, params });
    
    try {
      // 計算總記錄數
      const countQuery = `SELECT COUNT(*) as total FROM bet_history ${whereClause}`;
      console.log('執行計數查詢:', countQuery);
      const countResult = await db.one(countQuery, params);
      const totalRecords = parseInt(countResult.total);
      const totalPages = Math.ceil(totalRecords / pageSize);
      
      // 獲取分頁數據
      const offset = (pageNumber - 1) * pageSize;
      const query = `
        SELECT 
          id, 
          username, 
          amount, 
          bet_type as "betType", 
          bet_value as "value", 
          position, 
          period, 
          created_at as "time", 
          win, 
          win_amount as "winAmount", 
          settled
        FROM bet_history 
        ${whereClause} 
        ORDER BY created_at DESC 
        LIMIT ${pageSize} OFFSET ${offset}
      `;
      console.log('執行查詢:', query);
      const results = await db.any(query, params);
      
      // 格式化結果，確保前端可以直接使用
      const formattedResults = results.map(bet => ({
        id: bet.id,
        username: bet.username,
        amount: bet.amount,
        betType: bet.betType,
        value: bet.value,
        position: bet.position,
        period: bet.period,
        time: bet.time,
        win: bet.win,
        winAmount: bet.winAmount,
        settled: bet.settled
      }));
      
      res.json({
        success: true,
        records: formattedResults,
        totalPages,
        currentPage: pageNumber,
        totalRecords
      });
    } catch (dbError) {
      console.error('資料庫查詢錯誤:', dbError);
      throw new Error(`資料庫查詢錯誤: ${dbError.message}`);
    }
  } catch (error) {
    console.error('獲取下注記錄出錯:', error);
    res.status(500).json({ 
      success: false, 
      message: '獲取下注記錄失敗',
      error: error.message,
      records: [] // 確保即使錯誤也返回空數組
    });
  }
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
      
      return res.status(500).json({
        success: false,
        message: '無法連接代理系統，請稍後再試'
      });
    }

    const data = await response.json();
    console.log('代理系統回應:', data);

    if (data.success) {
      // 更新本地用戶資料
      await UserModel.createOrUpdate({
        username: data.member.username,
        balance: data.member.balance,
        status: data.member.status,
      });
      
      console.log('用戶登入成功，更新本地資料');
      
      res.json({
        success: true,
        message: '登入成功',
        balance: data.member.balance
      });
    } else {
      res.json({
        success: false,
        message: data.message || '登入失敗'
      });
    }
  } catch (error) {
    console.error('登入錯誤:', error);
    
    res.status(500).json({
      success: false,
      message: '登入過程發生錯誤，請稍後再試'
    });
  }
});

// 重複的register路由已移除

// 更新下注處理邏輯
app.post('/api/bet', async (req, res) => {
  try {
    // 驗證必要參數
    const { username, amount, betType, value, position } = req.body;
    
    console.log(`收到下注請求: 用戶=${username}, 金額=${amount}, 類型=${betType}, 值=${value}, 位置=${position || 'N/A'}`);
    
    if (!username || !amount || !betType || !value) {
      console.error('下注失敗: 請提供完整的下注信息');
      return res.status(400).json({ success: false, message: '請提供完整的下注信息' });
    }
    
    // 檢查參數有效性
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      console.error('下注失敗: 無效的下注金額');
      return res.status(400).json({ success: false, message: '無效的下注金額' });
    }
    
    // 檢查下注類型和選項的有效性
    if (!isValidBet(betType, value, position)) {
      console.error(`下注失敗: 無效的下注選項 ${betType}=${value}`);
      return res.status(400).json({ success: false, message: '無效的下注選項' });
    }
    
    // 獲取當前遊戲狀態
    const gameState = await getGameData();
    const { period, status } = gameState;
    
    // 檢查遊戲狀態
    if (status !== 'betting') {
      console.error('下注失敗: 當前不是下注階段');
      return res.status(400).json({ success: false, message: '當前不是下注階段' });
    }
    
    // 獲取賠率
    const odds = getOdds(betType, value);
    console.log(`下注賠率: ${odds}`);
    
    try {
      // 獲取總代理ID
      const adminAgent = await getAdminAgentId();
      if (!adminAgent) {
        console.error('下注失敗: 找不到總代理帳戶');
        return res.status(500).json({ success: false, message: '系統錯誤：找不到總代理帳戶' });
      }
      
      console.log(`使用總代理 ID: ${adminAgent.id}, 用戶名: ${adminAgent.username}`);
      
      // 原子性扣除用戶餘額（內建餘額檢查，解決並發安全問題）
      let updatedBalance;
      try {
        updatedBalance = await UserModel.deductBalance(username, amountNum);
        console.log(`用戶 ${username} 下注 ${amountNum} 元後餘額: ${updatedBalance}`);
      } catch (balanceError) {
        console.error(`下注失敗: ${balanceError.message}`);
        return res.status(400).json({ success: false, message: '餘額不足' });
      }
      
      // 只同步餘額到代理系統（不扣代理點數）
      try {
        await fetch(`${AGENT_API_URL}/sync-member-balance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: username,
            balance: updatedBalance,
            reason: '下注扣除'
          })
        });
      } catch (syncError) {
        console.warn('同步餘額到代理系統失敗，但會員餘額已更新:', syncError);
      }
      
      // 準備下注數據
      const betData = {
        username: username,
        amount: amountNum,
        bet_type: betType,  // 注意: 這裡使用 bet_type 而不是 betType
        bet_value: value,   // 注意: 這裡使用 bet_value 而不是 value
        position: position,
        period: period,
        odds: odds
      };
      
      console.log('準備創建下注記錄:', JSON.stringify(betData));
      
      // 嘗試創建下注記錄
      let betResult;
      try {
        // 使用BetModel創建下注記錄
        betResult = await BetModel.create(betData);
        console.log(`創建了一個新的下注記錄: ID=${betResult.id}`);
      } catch (dbError) {
        console.error('創建下注記錄失敗:', dbError);
        // 如果記錄創建失敗，返還用戶餘額
        await UserModel.addBalance(username, amountNum);
        return res.status(500).json({ success: false, message: `創建下注記錄失敗: ${dbError.message}` });
      }
      
      // 移除立即退水分配 - 退水將在結算階段處理
      console.log(`用戶 ${username} 下注 ${amountNum} 元成功，退水將在結算後分配`);
      
      // 獲取新的餘額
      const newBalance = await getBalance(username);
      
      console.log(`用戶 ${username} 下注 ${amountNum} 元，類型：${betType}，值：${value}，位置：${position || 'N/A'}`);
      console.log(`用戶 ${username} 下注 ${amountNum} 元後餘額更新為: ${newBalance}`);
      
      // 返回成功和更新後的餘額
      return res.json({ 
        success: true, 
        message: '下注成功', 
        betId: betResult.id, 
        balance: newBalance.toString() 
      });
    } catch (innerError) {
      console.error('下注處理過程中發生錯誤:', innerError);
      return res.status(500).json({ success: false, message: `系統錯誤: ${innerError.message}` });
    }
    
  } catch (error) {
    console.error('下注處理過程中發生錯誤:', error);
    return res.status(500).json({ success: false, message: `系統錯誤: ${error.message}` });
  }
});

// 驗證下注是否有效
function isValidBet(betType, value, position) {
  // 檢查下注類型
  const validBetTypes = [
    'sumValue', 'champion', 'runnerup', 'third', 'fourth', 'fifth', 
    'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'dragonTiger', 'number'
  ];
  
  if (!validBetTypes.includes(betType)) {
    return false;
  }
  
  // 檢查數值
  if (betType === 'number') {
    // 對於單號投注，需要檢查數字和位置
    if (!position || position < 1 || position > 10) {
      return false;
    }
    
    const numValue = parseInt(value);
    if (isNaN(numValue) || numValue < 1 || numValue > 10) {
      return false;
    }
    
    return true;
  } else if (betType === 'sumValue') {
    // 對於冠亞和值，檢查是否為有效的和值或大小單雙
    const validValues = ['big', 'small', 'odd', 'even', '3', '4', '5', '6', '7', 
                          '8', '9', '10', '11', '12', '13', '14', '15', '16', 
                          '17', '18', '19'];
    return validValues.includes(value.toString());
  } else if (betType === 'dragonTiger') {
    // 龍虎，檢查是否為龍或虎
    return value === 'dragon' || value === 'tiger';
  } else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
    // 位置投注：支援大小單雙 AND 指定號碼(1-10)
    const validPropertyValues = ['big', 'small', 'odd', 'even'];
    if (validPropertyValues.includes(value)) {
      return true; // 大小單雙投注
    }
    
    // 檢查是否為有效的號碼投注(1-10)
    const numValue = parseInt(value);
    return !isNaN(numValue) && numValue >= 1 && numValue <= 10;
  }
  
  return false;
}

// 重複的createBet函數已移除，統一使用BetModel.create

// 新增: 獲取總代理ID的函數
async function getAdminAgentId() {
  try {
    // 從代理系統獲取總代理ID
    const response = await fetch(`${AGENT_API_URL}/admin-agent`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      return { id: data.agent.id, username: data.agent.username };
    } else {
      console.error('獲取總代理ID失敗:', data.message);
      // 返回本地默認總代理
      console.log('使用本地默認總代理ID');
      return { id: 1, username: 'admin' };
    }
  } catch (error) {
    console.error('獲取總代理ID出錯:', error);
    // 出錯時也返回本地默認總代理
    console.log('連接代理系統失敗，使用本地默認總代理ID');
    return { id: 1, username: 'admin' };
  }
}

// 初始化數據庫並啟動服務器
async function startServer() {
  try {
    // 初始化數據庫
    await initDatabase();
    
    console.log('開始初始化熱門投注數據...');
    // 更新熱門投注數據
    try {
      await updateHotBets();
      console.log('熱門投注數據初始化成功');
    } catch (hotBetsError) {
      console.error('初始化熱門投注數據時出錯:', hotBetsError);
    }
    
    // 設置定時更新熱門投注（每10分鐘）
    hotBetsInterval = setInterval(async () => {
      try {
        console.log('定時更新熱門投注數據...');
        await updateHotBets();
      } catch (error) {
        console.error('定時更新熱門投注數據時出錯:', error);
      }
    }, 10 * 60 * 1000);
    
    // 啟動服務器
    app.listen(port, () => {
      console.log(`極速賽車遊戲服務運行在端口 ${port}`);
      console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
      console.log(`API Base URL: ${AGENT_API_URL}`);
      
      // 確認熱門投注API端點可用
      console.log('已註冊 API 端點: /api/hot-bets');
      
      // 啟動遊戲循環
      startGameCycle();
    });
  } catch (error) {
    console.error('啟動服務器時出錯:', error);
  }
}

// 啟動服務器
startServer();

// 獲取下注賠率函數
function getOdds(betType, value) {
  try {
    // 退水比例 4.1%
    const rebatePercentage = 0.041;
    
    // 冠亞和值賠率
    if (betType === 'sumValue') {
      if (value === 'big' || value === 'small' || value === 'odd' || value === 'even') {
        return parseFloat((1.96 * (1 - rebatePercentage)).toFixed(3));  // 大小單雙賠率：1.96 × (1-4.1%) = 1.88
      } else {
        // 和值賠率表 (扣除退水4.1%)
        const sumOdds = {
          '3': parseFloat((41.0 * (1 - rebatePercentage)).toFixed(3)), 
          '4': parseFloat((21.0 * (1 - rebatePercentage)).toFixed(3)), 
          '5': parseFloat((16.0 * (1 - rebatePercentage)).toFixed(3)), 
          '6': parseFloat((13.0 * (1 - rebatePercentage)).toFixed(3)), 
          '7': parseFloat((11.0 * (1 - rebatePercentage)).toFixed(3)), 
          '8': parseFloat((9.0 * (1 - rebatePercentage)).toFixed(3)), 
          '9': parseFloat((8.0 * (1 - rebatePercentage)).toFixed(3)), 
          '10': parseFloat((7.0 * (1 - rebatePercentage)).toFixed(3)), 
          '11': parseFloat((7.0 * (1 - rebatePercentage)).toFixed(3)), 
          '12': parseFloat((8.0 * (1 - rebatePercentage)).toFixed(3)), 
          '13': parseFloat((9.0 * (1 - rebatePercentage)).toFixed(3)), 
          '14': parseFloat((11.0 * (1 - rebatePercentage)).toFixed(3)), 
          '15': parseFloat((13.0 * (1 - rebatePercentage)).toFixed(3)), 
          '16': parseFloat((16.0 * (1 - rebatePercentage)).toFixed(3)), 
          '17': parseFloat((21.0 * (1 - rebatePercentage)).toFixed(3)),
          '18': parseFloat((41.0 * (1 - rebatePercentage)).toFixed(3)), 
          '19': parseFloat((81.0 * (1 - rebatePercentage)).toFixed(3))
        };
        return sumOdds[value] || 1.0;
      }
    } 
    // 單號投注
    else if (betType === 'number') {
      return parseFloat((10.0 * (1 - rebatePercentage)).toFixed(3));  // 10.0 × (1-4.1%) = 9.59
    }
    // 龍虎
    else if (betType === 'dragonTiger') {
      return parseFloat((1.96 * (1 - rebatePercentage)).toFixed(3));  // 1.96 × (1-4.1%) = 1.88
    } 
    // 冠軍、亞軍等位置投注
    else if (['champion', 'runnerup', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'].includes(betType)) {
      if (['big', 'small', 'odd', 'even'].includes(value)) {
        return parseFloat((1.96 * (1 - rebatePercentage)).toFixed(3));  // 大小單雙：1.96 × (1-4.1%) = 1.88
      } else {
        // 指定號碼投注：10.0 × (1-4.1%) = 9.59 (與單號投注相同賠率)
        const numValue = parseInt(value);
        if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
          return parseFloat((10.0 * (1 - rebatePercentage)).toFixed(3));
        } else {
          // 無效值，返回最低賠率並記錄警告
          console.warn(`位置投注 ${betType} 收到無效值: ${value}，返回默認賠率 1.0`);
          return 1.0;
        }
      }
    }
    
    // 預設賠率
    return 1.0;
  } catch (error) {
    console.error('計算賠率時出錯:', error);
    return 1.0;
  }
}

// 獲取餘額函數，由多個API使用
async function getBalance(username) {
  try {
    if (!username) {
      console.log('獲取餘額失敗: 未提供用戶名');
      return 0;
    }
    
    // 嘗試從代理系統獲取餘額
    try {
      const response = await fetch(`${AGENT_API_URL}/member-balance?username=${username}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 更新本地餘額
        await UserModel.setBalance(username, data.balance);
        return parseFloat(data.balance);
      }
    } catch (error) {
      console.error('從代理系統獲取餘額失敗:', error);
    }
    
    // 如果從代理系統獲取失敗，則使用本地餘額
    const user = await UserModel.findByUsername(username);
    if (user) {
      return parseFloat(user.balance);
    }
    
    console.log(`用戶 ${username} 不存在，餘額為 0`);
    return 0;
  } catch (error) {
    console.error('獲取餘額出錯:', error);
    return 0;
  }
}

// 更新會員餘額的函數
async function updateMemberBalance(username, amount, adminAgent, reason) {
  try {
    console.log(`嘗試更新會員 ${username} 的餘額：${amount}，原因：${reason}`);
    console.log(`代理信息:`, JSON.stringify(adminAgent));
    
    if (!username) {
      console.error('更新會員餘額失敗: 未提供用戶名');
      return { success: false, message: '未提供用戶名' };
    }

    // 獲取當前餘額
    const currentBalance = await getBalance(username);
    console.log(`用戶 ${username} 的當前餘額: ${currentBalance}`);
    
    // 計算新餘額
    const newBalance = parseFloat(currentBalance) + parseFloat(amount);
    console.log(`用戶 ${username} 的新餘額將為: ${newBalance}`);
    
    // 檢查餘額是否為負數
    if (newBalance < 0) {
      console.error(`更新會員餘額失敗: 餘額不足 (當前: ${currentBalance}, 嘗試扣除: ${Math.abs(amount)})`);
      return { success: false, message: '餘額不足' };
    }
    
    // 先更新本地用戶餘額
    try {
      await UserModel.setBalance(username, newBalance);
      console.log(`本地餘額已更新為: ${newBalance}`);
    } catch (localError) {
      console.error('更新本地餘額失敗:', localError);
      return { success: false, message: `更新本地餘額失敗: ${localError.message}` };
    }
    
    // 嘗試同步到代理系統，但即使失敗也不影響本地更新結果
    let agentSystemSuccess = false;
    if (adminAgent) {
      try {
        console.log(`向代理系統發送餘額同步請求: ${AGENT_API_URL}/sync-member-balance`);
        console.log(`請求體:`, JSON.stringify({
          username: username,
          balance: newBalance,
          reason: reason
        }));
        
        const response = await fetch(`${AGENT_API_URL}/sync-member-balance`, {
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
      
        console.log(`代理系統響應狀態碼: ${response.status}`);
        
        const data = await response.json();
        console.log(`代理系統響應數據:`, JSON.stringify(data));
        
        if (!data.success) {
          console.error('代理系統同步餘額失敗:', data.message);
          // 即使代理系統失敗，我們也繼續使用本地更新的餘額
        } else {
          console.log(`代理系統成功同步餘額`);
          agentSystemSuccess = true;
        }
      } catch (error) {
        console.error('呼叫代理系統API出錯:', error);
        // 繼續使用本地更新的餘額
      }
    } else {
      console.log('未提供代理信息，僅更新本地餘額');
    }
    
    console.log(`用戶 ${username} 餘額已更新: ${currentBalance} -> ${newBalance} (代理系統同步狀態: ${agentSystemSuccess ? '成功' : '失敗'})`);
    return { success: true, balance: newBalance };
    
  } catch (error) {
    console.error('更新會員餘額時出錯:', error);
    return { success: false, message: `系統錯誤: ${error.message}` };
  }
}

// 初始化全局熱門投注數據結構
const hotBetsData = {
  // 按下注類型和值保存熱門程度
  byType: {
    sumValue: {}, // 冠亞和值
    dragonTiger: {}, // 龍虎
    champion: {}, // 冠軍位置
    runnerup: {}, // 亞軍位置
    number: {} // 單號投注
  },
  // 熱門投注排行榜（按下注次數排序）
  topBets: [],
  // 最後更新時間
  lastUpdate: null
};

// 定期更新熱門投注數據
async function updateHotBets() {
  try {
    console.log('開始更新熱門投注數據');
    const now = new Date();
    
    // 獲取最近24小時的下注數據
    const period = 24 * 60 * 60 * 1000; // 24小時的毫秒數
    const startTime = new Date(now.getTime() - period);
    
    // 查詢數據庫，獲取最近下注
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
      
      console.log(`查詢到 ${recentBets.length} 條近期投注數據`);
    } catch (dbError) {
      console.error('查詢數據庫獲取熱門投注數據失敗:', dbError);
      // 如果數據庫查詢失敗，設置為空數組
      recentBets = [];
      throw new Error('查詢數據庫獲取熱門投注數據失敗');
    }
    
    // 重置熱門投注數據
    for (const type in hotBetsData.byType) {
      hotBetsData.byType[type] = {};
    }
    
    // 如果沒有數據，則直接返回空數組
    if (recentBets.length === 0) {
      console.log('沒有查詢到投注數據，返回空數據');
      hotBetsData.topBets = [];
      hotBetsData.lastUpdate = now;
      return;
    }
    
    // 正常處理查詢結果
    recentBets.forEach(bet => {
      const betType = bet.bet_type;
      const betValue = bet.bet_value;
      const position = bet.position;
      const count = parseInt(bet.bet_count);
      const amount = parseFloat(bet.total_amount);
      
      if (betType === 'number' && position) {
        // 單號投注需要考慮位置
        const key = `${position}_${betValue}`;
        hotBetsData.byType.number[key] = { count, amount, position, value: betValue };
      } else if (hotBetsData.byType[betType]) {
        // 其他投注類型
        hotBetsData.byType[betType][betValue] = { count, amount, value: betValue };
      }
    });
    
    // 整理熱門投注排行榜
    const allBets = [];
    
    // 處理號碼投注
    Object.entries(hotBetsData.byType.number).forEach(([key, data]) => {
      const [position, value] = key.split('_');
      allBets.push({
        type: 'number',
        typeLabel: '單號',
        position: parseInt(position),
        value,
        count: data.count,
        amount: data.amount,
        label: `第${position}名 ${value}號`
      });
    });
    
    // 處理冠亞和值
    Object.entries(hotBetsData.byType.sumValue).forEach(([value, data]) => {
      let label = '';
      if (['big', 'small', 'odd', 'even'].includes(value)) {
        const valueMap = {
          'big': '大',
          'small': '小',
          'odd': '單',
          'even': '雙'
        };
        label = `冠亞和 ${valueMap[value]}`;
      } else {
        label = `冠亞和 ${value}`;
      }
      
      allBets.push({
        type: 'sumValue',
        typeLabel: '冠亞和',
        value,
        count: data.count,
        amount: data.amount,
        label
      });
    });
    
    // 處理龍虎
    Object.entries(hotBetsData.byType.dragonTiger).forEach(([value, data]) => {
      const valueMap = {
        'dragon': '龍',
        'tiger': '虎'
      };
      
      allBets.push({
        type: 'dragonTiger',
        typeLabel: '龍虎',
        value,
        count: data.count,
        amount: data.amount,
        label: `龍虎 ${valueMap[value] || value}`
      });
    });
    
    // 處理冠軍
    Object.entries(hotBetsData.byType.champion).forEach(([value, data]) => {
      let label = '';
      if (['big', 'small', 'odd', 'even'].includes(value)) {
        const valueMap = {
          'big': '大',
          'small': '小',
          'odd': '單',
          'even': '雙'
        };
        label = `冠軍 ${valueMap[value]}`;
      } else {
        label = `冠軍 ${value}號`;
      }
      
      allBets.push({
        type: 'champion',
        typeLabel: '冠軍',
        value,
        count: data.count,
        amount: data.amount,
        label
      });
    });
    
    // 處理亞軍
    Object.entries(hotBetsData.byType.runnerup).forEach(([value, data]) => {
      let label = '';
      if (['big', 'small', 'odd', 'even'].includes(value)) {
        const valueMap = {
          'big': '大',
          'small': '小',
          'odd': '單',
          'even': '雙'
        };
        label = `亞軍 ${valueMap[value]}`;
      } else {
        label = `亞軍 ${value}號`;
      }
      
      allBets.push({
        type: 'runnerup',
        typeLabel: '亞軍',
        value,
        count: data.count,
        amount: data.amount,
        label
      });
    });
    
    // 排序並只保留前10個
    hotBetsData.topBets = allBets
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    hotBetsData.lastUpdate = now;
    console.log(`熱門投注數據更新完成，共有 ${hotBetsData.topBets.length} 個熱門選項`);
  } catch (error) {
    console.error('更新熱門投注數據失敗:', error);
    // 出錯時不產生默認數據，將topBets保持為原來的值，不影響已有數據
  }
}

// REST API端點 - 獲取熱門投注
app.get('/api/hot-bets', (req, res) => {
  console.log('收到熱門投注API請求');
  try {
    // 如果hotBetsData.topBets為空或未初始化，返回空數據
    if (!hotBetsData.topBets || hotBetsData.topBets.length === 0) {
      console.log('熱門投注數據為空，返回空數組');
      return res.json({
        success: true,
        message: '暫無熱門投注數據',
        hotBets: [],
        lastUpdate: null
      });
    }
    
    // 正常數據處理
    const hotBets = hotBetsData.topBets.map(bet => ({
      type: bet.type,
      typeLabel: bet.typeLabel,
      value: bet.value,
      position: bet.position,
      count: bet.count,
      label: bet.label,
      isHot: true
    }));
    
    console.log(`熱門投注API返回 ${hotBets.length} 個數據`);
    
    res.json({
      success: true,
      hotBets,
      lastUpdate: hotBetsData.lastUpdate
    });
  } catch (error) {
    console.error('獲取熱門投注數據失敗:', error);
    res.status(500).json({ 
      success: false, 
      message: '獲取熱門投注數據失敗',
      error: error.message,
      hotBets: []
    });
  }
});
