# 部署說明

## Render 部署配置

### 遊戲端 (bet-game-vcje.onrender.com)
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `NODE_ENV=production`
  - `PORT=3000`

### 代理端 (bet-agent.onrender.com)
- **Build Command**: `npm install`
- **Start Command**: `npm run start:agent`
- **Environment Variables**:
  - `NODE_ENV=production`
  - `PORT=3003`

## 常見問題解決

### 1. API 請求失敗
- 檢查 CORS 設定是否包含正確的域名
- 確認前端 API_BASE_URL 設定正確

### 2. 靜態文件無法載入
- 確認 express.static 路徑正確
- 檢查文件權限

### 3. 舊版頁面快取
- 清除瀏覽器快取
- 使用版本號防止快取 (例如: main.js?v=timestamp)
