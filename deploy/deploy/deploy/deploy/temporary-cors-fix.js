// 臨時 CORS 修復方案
// 這個文件顯示如何修改 backend.js 來解決 CORS 問題

// 找到 backend.js 中的 CORS 配置部分（約第 104 行）：
/*
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://bet-game.onrender.com', 
      'https://bet-game-vcje.onrender.com',
      // ... 其他來源
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS錯誤: 不允許的來源 ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
*/

// 替換為以下代碼來暫時允許所有來源：

app.use(cors({
  origin: true,  // 允許所有來源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// 或者，如果您知道確切的生產 URL，添加到允許列表：

app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://bet-game.onrender.com', 
      'https://bet-game-vcje.onrender.com',
      'https://bet-game-1xor.onrender.com',  // 添加您的實際 URL
      'https://你的網址.onrender.com',        // 添加您的實際 URL
      'http://localhost:3002', 
      'http://localhost:3000', 
      'http://localhost:8082', 
      'http://127.0.0.1:8082',
      'http://localhost:3001',
      'http://127.0.0.1:3001'
    ];
    
    // 在生產環境中，也允許同源請求（沒有origin頭的請求）
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS錯誤: 不允許的來源 ${origin}`);
      // 暫時記錄但仍然允許
      callback(null, true);  // 改為允許所有來源
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));