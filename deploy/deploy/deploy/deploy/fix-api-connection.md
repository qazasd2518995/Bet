# API 連接錯誤修復指南

## 問題診斷

您遇到的錯誤 `[Error] 获取游戏数据失败: – TypeError: Load failed` 表示前端無法連接到後端 API。

## 可能的原因

1. **CORS 配置問題** - 您的生產環境 URL 可能不在允許的來源列表中
2. **後端服務未啟動** - 後端服務可能崩潰或未正確啟動
3. **API 路徑錯誤** - API 端點可能配置錯誤

## 立即解決方案

### 1. 使用診斷工具

請在您的生產網站上打開 `api-diagnostic.html` 文件：
```
https://你的網址/api-diagnostic.html
```

這個工具會測試所有 API 端點並顯示詳細的錯誤信息。

### 2. 檢查 Render 部署狀態

登入 Render Dashboard 確認：
- bet-game 服務是否正在運行
- 查看 Logs 是否有錯誤信息
- 確認 Deploy 狀態是否為 "Live"

### 3. 更新 CORS 配置

如果您的生產 URL 不是 `https://bet-game.onrender.com` 或 `https://bet-game-vcje.onrender.com`，需要更新 backend.js 中的 CORS 配置：

```javascript
const allowedOrigins = [
  'https://bet-game.onrender.com', 
  'https://bet-game-vcje.onrender.com',
  'https://你的實際網址.onrender.com',  // 添加您的實際 URL
  // ... 其他來源
];
```

### 4. 臨時解決方案

如果需要快速修復，可以暫時允許所有來源（僅用於測試）：

```javascript
app.use(cors({
  origin: true,  // 允許所有來源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
```

**注意：這只應該用於測試，生產環境應該限制允許的來源。**

### 5. 檢查 API 路徑

確認前端使用的 API 路徑是否正確。在 `frontend/index.html` 中：

```javascript
API_BASE_URL: window.location.origin  // 這應該自動使用當前網址
```

## 下一步行動

1. 先使用診斷工具確定具體問題
2. 查看 Render 的日誌找出錯誤詳情
3. 如果是 CORS 問題，更新配置並重新部署
4. 如果服務崩潰，檢查錯誤日誌並修復

## 需要更多幫助？

如果診斷工具顯示特定的錯誤信息，請將錯誤詳情分享給我，我可以提供更具體的解決方案。