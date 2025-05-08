# 極速賽車遊戲與代理管理系統

這是一個包含遊戲前後端和管理前後端的極速賽車遊戲系統。

## 專案結構

- `backend.js`: 遊戲主後端
- `agentBackend.js`: 代理管理系統後端
- `deploy/frontend/`: 遊戲前端文件
- `agent/frontend/`: 代理管理系統前端文件
- `db/`: 數據庫模型和配置

## 數據庫

系統使用PostgreSQL數據庫來保存數據，確保即使服務重啟也能保持數據持久化：

- 用戶數據（會員資料、餘額）
- 下注記錄
- 遊戲結果歷史
- 代理信息

## 在本地運行

安裝依賴：

```bash
npm install
```

運行遊戲後端：

```bash
npm run dev
```

運行代理後端：

```bash
npm run dev:agent
```

同時運行兩個後端：

```bash
npm run dev:all
```

## 在Render部署

### 前置準備

1. 註冊 [Render](https://render.com/) 帳號
2. 將本專案推送到您的GitHub倉庫
3. 在Render中連接GitHub帳號

### 使用Blueprint自動部署

Render Blueprint是一種通過`render.yaml`文件一次部署多個服務的方式。

1. 登入 [Render](https://render.com/)
2. 點擊頂部導航的 "New"，選擇 "Blueprint"
3. 選擇包含本專案的GitHub倉庫
4. Render將自動掃描`render.yaml`文件並顯示將要創建的服務
5. 點擊 "Apply" 完成部署，Render會自動：
   - 創建PostgreSQL數據庫
   - 部署遊戲後端服務
   - 部署代理後端服務

### 手動部署各個服務

如果Blueprint選項不可用，可以分別部署各個服務：

#### 1. 創建PostgreSQL數據庫

1. 在Render控制台點擊 "New" > "PostgreSQL"
2. 填寫以下信息：
   - **Name**: `bet-db`
   - **Database**: `bet_game`
   - **User**: 自動生成
   - **Region**: 選擇最近的地區
   - **Plan**: Free
3. 點擊 "Create Database"
4. 保存顯示的數據庫連接信息

#### 2. 部署遊戲後端

1. 在Render控制台點擊 "New" > "Web Service"
2. 連接此GitHub倉庫
3. 填寫以下信息：
   - **Name**: `bet-game`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
4. 添加環境變量：
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: 之前創建的PostgreSQL數據庫URL
5. 點擊 "Create Web Service"

#### 3. 部署代理後端

1. 在Render控制台點擊 "New" > "Web Service"
2. 連接此GitHub倉庫
3. 填寫以下信息：
   - **Name**: `bet-agent`
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:agent`
   - **Plan**: Free
4. 添加環境變量：
   - `NODE_ENV`: `production`
   - `DATABASE_URL`: 之前創建的PostgreSQL數據庫URL
5. 點擊 "Create Web Service"

## 數據持久化

- 系統使用PostgreSQL保存所有重要數據
- 即使Render服務休眠或重啟，數據也會保持完整
- Render的免費PostgreSQL提供1GB存儲空間，足夠一般使用場景

## 默認帳號

### 代理系統
- 帳號: `admin`
- 密碼: `adminpwd`

### 玩家帳號
- 帳號: `aaa`
- 密碼: `aaapwd`

## 代理後端部署

如需單獨部署代理後端，可以創建另一個Web Service，使用`npm run start:agent`作為啟動命令。

## 環境變量

可以在Render的環境變量設置中添加以下變量：

- `PORT`: 應用端口（Render會自動指定）
- `NODE_ENV`: production（部署環境）

## 注意事項

- Render免費方案有使用限制，較長時間不活動會休眠服務
- 資料僅保存在內存中，服務重啟後會重置 