# API 连接错误修复指南

## 问题诊断

您遇到的错误 `[Error] 获取游戏数据失败: – TypeError: Load failed` 表示前端无法连接到后端 API。

## 可能的原因

1. **CORS 配置问题** - 您的生产环境 URL 可能不在允许的来源列表中
2. **后端服务未启动** - 后端服务可能崩溃或未正确启动
3. **API 路径错误** - API 端点可能配置错误

## 立即解决方案

### 1. 使用诊断工具

请在您的生产网站上打开 `api-diagnostic.html` 文件：
```
https://你的网址/api-diagnostic.html
```

这个工具会测试所有 API 端点并显示详细的错误信息。

### 2. 检查 Render 部署状态

登入 Render Dashboard 确认：
- bet-game 服务是否正在运行
- 查看 Logs 是否有错误信息
- 确认 Deploy 状态是否为 "Live"

### 3. 更新 CORS 配置

如果您的生产 URL 不是 `https://bet-game.onrender.com` 或 `https://bet-game-vcje.onrender.com`，需要更新 backend.js 中的 CORS 配置：

```javascript
const allowedOrigins = [
  'https://bet-game.onrender.com', 
  'https://bet-game-vcje.onrender.com',
  'https://你的实际网址.onrender.com',  // 添加您的实际 URL
  // ... 其他来源
];
```

### 4. 临时解决方案

如果需要快速修复，可以暂时允许所有来源（仅用于测试）：

```javascript
app.use(cors({
  origin: true,  // 允许所有来源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
```

**注意：这只应该用于测试，生产环境应该限制允许的来源。**

### 5. 检查 API 路径

确认前端使用的 API 路径是否正确。在 `frontend/index.html` 中：

```javascript
API_BASE_URL: window.location.origin  // 这应该自动使用当前网址
```

## 下一步行动

1. 先使用诊断工具确定具体问题
2. 查看 Render 的日志找出错误详情
3. 如果是 CORS 问题，更新配置并重新部署
4. 如果服务崩溃，检查错误日志并修复

## 需要更多帮助？

如果诊断工具显示特定的错误信息，请将错误详情分享给我，我可以提供更具体的解决方案。