# Render 部署指南

## 前置準備

1. 確保您已經有一個 Render 帳號
2. 確保您的 PostgreSQL 資料庫已經在 Render 上設置完成

## 資料庫資訊

本專案使用以下 PostgreSQL 資料庫：
- **Host**: `dpg-d0e2imc9c44c73che3kg-a`
- **Port**: `5432`
- **Database**: `bet_game`
- **Username**: `bet_game_user`
- **Password**: `Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy`
- **Internal URL**: `postgresql://bet_game_user:Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy@dpg-d0e2imc9c44c73che3kg-a/bet_game`

## 部署步驟

### 1. 推送代碼到 GitHub

確保您的代碼已經推送到 GitHub 儲存庫。

### 2. 在 Render 中部署

#### 方法一：使用 render.yaml（推薦）

1. 在 Render Dashboard 中點擊 "New +"
2. 選擇 "Blueprint"
3. 連接您的 GitHub 儲存庫
4. Render 會自動讀取 `render.yaml` 檔案並創建兩個服務：
   - `bet-game` (主遊戲服務)
   - `bet-agent` (代理管理服務)

#### 方法二：手動創建服務

**創建主遊戲服務 (bet-game)：**
1. 選擇 "Web Service"
2. 連接您的 GitHub 儲存庫
3. 設置以下參數：
   - **Name**: `bet-game`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

**創建代理服務 (bet-agent)：**
1. 選擇 "Web Service"
2. 連接您的 GitHub 儲存庫
3. 設置以下參數：
   - **Name**: `bet-agent`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:agent`
   - **Plan**: `Free`

### 3. 環境變數設置

對於每個服務，請設置以下環境變數：

```
NODE_ENV=production
DATABASE_URL=postgresql://bet_game_user:Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy@dpg-d0e2imc9c44c73che3kg-a/bet_game
DB_HOST=dpg-d0e2imc9c44c73che3kg-a
DB_PORT=5432
DB_NAME=bet_game
DB_USER=bet_game_user
DB_PASSWORD=Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy
```

**bet-game 服務額外設置：**
```
PORT=3002
```

**bet-agent 服務額外設置：**
```
PORT=3003
```

### 4. 初始化資料庫

部署完成後，訪問以下 URL 來初始化資料庫：
- **主遊戲服務**: `https://bet-game.onrender.com/api/init-db`
- **代理服務**: `https://bet-agent.onrender.com/api/init-db`

### 5. 健康檢查

您可以通過以下 URL 檢查服務狀態：
- **主遊戲服務**: `https://bet-game.onrender.com/api/health`
- **代理服務**: `https://bet-agent.onrender.com/api/health`

## 服務 URL

部署完成後，您的應用將可通過以下 URL 訪問：
- **主遊戲**: `https://bet-game.onrender.com`
- **代理管理**: `https://bet-agent.onrender.com`

## 重要注意事項

1. **免費方案限制**: Render 的免費方案有一些限制，包括：
   - 服務在無活動 15 分鐘後會休眠
   - 每月有 750 小時的使用時間限制
   - 冷啟動時間較長

2. **資料庫連接**: 所有資料庫配置已經在代碼中設置完成，會自動使用提供的 PostgreSQL 資料庫

3. **SSL 設置**: 代碼已經配置為接受 Render PostgreSQL 的 SSL 連接

4. **跨域設置**: 已經配置為允許 Render 上的服務互相通信

## 故障排除

如果遇到問題，請檢查：

1. **環境變數**: 確保所有必要的環境變數都已設置
2. **資料庫連接**: 檢查 Render logs 中的資料庫連接狀態
3. **依賴項**: 確保 `package.json` 中的所有依賴項都能正常安裝
4. **端口設置**: 確保每個服務使用正確的端口

### 常見錯誤解決方案

#### 客服操作錯誤 (Multiple rows were not expected)
如果遇到客服操作出現 "Multiple rows were not expected" 錯誤：

```bash
# 1. 運行修復腳本
npm run fix-db

# 2. 測試資料庫查詢
npm run test-db

# 3. 重新部署應用
```

#### 資料庫連接問題
- 確認 PostgreSQL 服務正在運行
- 檢查 DATABASE_URL 環境變數是否正確
- 驗證資料庫表格是否已創建

#### API 500 錯誤
- 檢查 Render logs 中的詳細錯誤信息
- 確認所有必要的表格都存在
- 運行資料庫初始化: `/api/init-db`

## 重新部署

如果需要重新部署：
1. 推送新代碼到 GitHub
2. Render 會自動觸發重新部署（如果啟用了 auto-deploy）
3. 或者在 Render Dashboard 中手動觸發部署 