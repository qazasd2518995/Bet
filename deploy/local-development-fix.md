# 本地开发环境修复指南

## 问题总结
1. 登入后无法进入游戏（已修复）
2. CORS 错误阻止 API 调用

## 已完成的修复

### 1. 登入状态问题 ✅
**问题**：登入页面使用 `localStorage`，但主页面检查 `sessionStorage`

**解决方案**：已更新 `frontend/login.html`，现在同时保存到两个存储：
```javascript
// 保存到 sessionStorage 以供主页面使用
sessionStorage.setItem('isLoggedIn', 'true');
sessionStorage.setItem('username', data.member.username);
sessionStorage.setItem('memberId', data.member.id);
sessionStorage.setItem('balance', data.member.balance || '0');
sessionStorage.setItem('token', data.token);
```

## 需要进行的修复

### 2. CORS 错误
**错误信息**：
```
Fetch API cannot load http://localhost:3000/api/... due to access control checks.
```

**解决方案**：

#### 方法 A：确保后端正在运行
```bash
# 在项目根目录运行
npm run dev
```

#### 方法 B：更新 CORS 配置（backend.js）
找到 CORS 配置部分（约第 107 行），确保包含 localhost：

```javascript
const allowedOrigins = [
  'https://bet-game.onrender.com', 
  'https://bet-game-vcje.onrender.com',
  'http://localhost:3002', 
  'http://localhost:3000', 
  'http://localhost:8082', 
  'http://127.0.0.1:8082',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost',        // 添加这行
  'http://127.0.0.1',        // 添加这行
  'file://'                  // 如果直接打开 HTML 文件
];
```

#### 方法 C：使用 Live Server（推荐）
如果您是直接打开 HTML 文件，建议使用 VS Code 的 Live Server 扩展：

1. 安装 Live Server 扩展
2. 右键点击 `index.html`
3. 选择 "Open with Live Server"
4. 这将在 `http://127.0.0.1:5500` 运行

## 测试步骤

1. **确保后端运行**
   ```bash
   npm run dev
   ```

2. **清除浏览器存储**
   - 打开开发者工具
   - Application/Storage 标签
   - Clear site data

3. **重新登入**
   - 访问 `/login.html`
   - 输入账号密码
   - 应该能成功进入游戏

## 验证成功标志

✅ 登入后不会跳回登入页面
✅ 能看到用户名和余额
✅ 没有 "用户未登录" 错误
✅ API 调用正常（无 CORS 错误）
✅ 能正常下注和查看历史记录

## 如果问题仍然存在

请检查：
1. 后端服务是否在 3000 端口运行
2. 浏览器控制台是否有其他错误
3. Network 标签中 API 请求的具体错误