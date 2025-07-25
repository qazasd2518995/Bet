// 临时 CORS 修复方案
// 这个文件显示如何修改 backend.js 来解决 CORS 问题

// 找到 backend.js 中的 CORS 配置部分（约第 104 行）：
/*
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://bet-game.onrender.com', 
      'https://bet-game-vcje.onrender.com',
      // ... 其他来源
    ];
    
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS错误: 不允许的来源 ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
*/

// 替换为以下代码来暂时允许所有来源：

app.use(cors({
  origin: true,  // 允许所有来源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

// 或者，如果您知道确切的生产 URL，添加到允许列表：

app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://bet-game.onrender.com', 
      'https://bet-game-vcje.onrender.com',
      'https://bet-game-1xor.onrender.com',  // 添加您的实际 URL
      'https://你的网址.onrender.com',        // 添加您的实际 URL
      'http://localhost:3002', 
      'http://localhost:3000', 
      'http://localhost:8082', 
      'http://127.0.0.1:8082',
      'http://localhost:3001',
      'http://127.0.0.1:3001'
    ];
    
    // 在生产环境中，也允许同源请求（没有origin头的请求）
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`❌ CORS错误: 不允许的来源 ${origin}`);
      // 暂时记录但仍然允许
      callback(null, true);  // 改为允许所有来源
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));