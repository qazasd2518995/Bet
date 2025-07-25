# 部署检查清单 - API 连接问题

## 步骤 1: 使用诊断工具
1. 打开您的生产网站
2. 访问 `/api-diagnostic.html`
3. 点击「执行所有测试」
4. 记录任何错误信息

## 步骤 2: 检查 Render Dashboard
1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 检查 **bet-game** 服务状态：
   - 是否显示为 "Live"？
   - 最近部署是否成功？
   - 查看 Logs 是否有错误

## 步骤 3: 确认您的生产 URL
您的实际生产 URL 是什么？例如：
- `https://bet-game.onrender.com`
- `https://bet-game-vcje.onrender.com`
- 或其他？

## 步骤 4: 更新 CORS 配置（如果需要）

### 选项 A: 临时修复（测试用）
在 `backend.js` 第 104 行附近，将 CORS 配置更改为：
```javascript
app.use(cors({
  origin: true,  // 暂时允许所有来源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
```

### 选项 B: 永久修复
添加您的实际生产 URL 到允许列表：
```javascript
const allowedOrigins = [
  'https://bet-game.onrender.com', 
  'https://bet-game-vcje.onrender.com',
  'https://您的实际网址.onrender.com',  // 添加这行
  // ... 其他来源
];
```

## 步骤 5: 重新部署
1. 提交更改到 Git
2. 推送到您的主分支
3. Render 应该自动重新部署

## 步骤 6: 验证修复
1. 等待部署完成（约 5-10 分钟）
2. 再次运行诊断工具
3. 确认 API 连接正常

## 常见问题

### 问题 1: "Load failed" 错误
**可能原因：**
- 后端服务未启动
- CORS 阻挡请求
- SSL 证书问题

**解决方案：**
- 检查 Render Logs
- 更新 CORS 配置
- 确认 HTTPS 正常工作

### 问题 2: 500 内部服务器错误
**可能原因：**
- 代码错误
- 数据库连接问题
- 环境变量缺失

**解决方案：**
- 查看详细的错误日志
- 确认所有环境变量已设置
- 检查数据库连接

### 问题 3: 404 Not Found
**可能原因：**
- API 路径错误
- 部署不完整

**解决方案：**
- 确认 API 端点存在
- 重新部署应用

## 需要更多帮助？

如果问题仍然存在，请提供：
1. 诊断工具的完整输出
2. Render Logs 的错误信息
3. 您的实际生产 URL

这将帮助我提供更具体的解决方案。