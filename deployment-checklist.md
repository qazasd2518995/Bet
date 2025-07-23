# 部署檢查清單 - API 連接問題

## 步驟 1: 使用診斷工具
1. 打開您的生產網站
2. 訪問 `/api-diagnostic.html`
3. 點擊「執行所有測試」
4. 記錄任何錯誤信息

## 步驟 2: 檢查 Render Dashboard
1. 登錄 [Render Dashboard](https://dashboard.render.com)
2. 檢查 **bet-game** 服務狀態：
   - 是否顯示為 "Live"？
   - 最近部署是否成功？
   - 查看 Logs 是否有錯誤

## 步驟 3: 確認您的生產 URL
您的實際生產 URL 是什麼？例如：
- `https://bet-game.onrender.com`
- `https://bet-game-vcje.onrender.com`
- 或其他？

## 步驟 4: 更新 CORS 配置（如果需要）

### 選項 A: 臨時修復（測試用）
在 `backend.js` 第 104 行附近，將 CORS 配置更改為：
```javascript
app.use(cors({
  origin: true,  // 暫時允許所有來源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
```

### 選項 B: 永久修復
添加您的實際生產 URL 到允許列表：
```javascript
const allowedOrigins = [
  'https://bet-game.onrender.com', 
  'https://bet-game-vcje.onrender.com',
  'https://您的實際網址.onrender.com',  // 添加這行
  // ... 其他來源
];
```

## 步驟 5: 重新部署
1. 提交更改到 Git
2. 推送到您的主分支
3. Render 應該自動重新部署

## 步驟 6: 驗證修復
1. 等待部署完成（約 5-10 分鐘）
2. 再次運行診斷工具
3. 確認 API 連接正常

## 常見問題

### 問題 1: "Load failed" 錯誤
**可能原因：**
- 後端服務未啟動
- CORS 阻擋請求
- SSL 證書問題

**解決方案：**
- 檢查 Render Logs
- 更新 CORS 配置
- 確認 HTTPS 正常工作

### 問題 2: 500 內部服務器錯誤
**可能原因：**
- 代碼錯誤
- 數據庫連接問題
- 環境變量缺失

**解決方案：**
- 查看詳細的錯誤日誌
- 確認所有環境變量已設置
- 檢查數據庫連接

### 問題 3: 404 Not Found
**可能原因：**
- API 路徑錯誤
- 部署不完整

**解決方案：**
- 確認 API 端點存在
- 重新部署應用

## 需要更多幫助？

如果問題仍然存在，請提供：
1. 診斷工具的完整輸出
2. Render Logs 的錯誤信息
3. 您的實際生產 URL

這將幫助我提供更具體的解決方案。