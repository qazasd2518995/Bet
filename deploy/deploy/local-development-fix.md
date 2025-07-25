# 本地開發環境修復指南

## 問題總結
1. 登入後無法進入遊戲（已修復）
2. CORS 錯誤阻止 API 調用

## 已完成的修復

### 1. 登入狀態問題 ✅
**問題**：登入頁面使用 `localStorage`，但主頁面檢查 `sessionStorage`

**解決方案**：已更新 `frontend/login.html`，現在同時保存到兩個存儲：
```javascript
// 保存到 sessionStorage 以供主頁面使用
sessionStorage.setItem('isLoggedIn', 'true');
sessionStorage.setItem('username', data.member.username);
sessionStorage.setItem('memberId', data.member.id);
sessionStorage.setItem('balance', data.member.balance || '0');
sessionStorage.setItem('token', data.token);
```

## 需要進行的修復

### 2. CORS 錯誤
**錯誤信息**：
```
Fetch API cannot load http://localhost:3000/api/... due to access control checks.
```

**解決方案**：

#### 方法 A：確保後端正在運行
```bash
# 在項目根目錄運行
npm run dev
```

#### 方法 B：更新 CORS 配置（backend.js）
找到 CORS 配置部分（約第 107 行），確保包含 localhost：

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
  'http://localhost',        // 添加這行
  'http://127.0.0.1',        // 添加這行
  'file://'                  // 如果直接打開 HTML 文件
];
```

#### 方法 C：使用 Live Server（推薦）
如果您是直接打開 HTML 文件，建議使用 VS Code 的 Live Server 擴展：

1. 安裝 Live Server 擴展
2. 右鍵點擊 `index.html`
3. 選擇 "Open with Live Server"
4. 這將在 `http://127.0.0.1:5500` 運行

## 測試步驟

1. **確保後端運行**
   ```bash
   npm run dev
   ```

2. **清除瀏覽器存儲**
   - 打開開發者工具
   - Application/Storage 標籤
   - Clear site data

3. **重新登入**
   - 訪問 `/login.html`
   - 輸入賬號密碼
   - 應該能成功進入遊戲

## 驗證成功標誌

✅ 登入後不會跳回登入頁面
✅ 能看到用戶名和餘額
✅ 沒有 "用戶未登录" 錯誤
✅ API 調用正常（無 CORS 錯誤）
✅ 能正常下注和查看歷史記錄

## 如果問題仍然存在

請檢查：
1. 後端服務是否在 3000 端口運行
2. 瀏覽器控制台是否有其他錯誤
3. Network 標籤中 API 請求的具體錯誤