# 極速賽車遊戲與代理管理系統

這是一個包含遊戲前後端和管理前後端的極速賽車遊戲系統。

## 專案結構

- `backend.js`: 遊戲主後端
- `agentBackend.js`: 代理管理系統後端
- `deploy/frontend/`: 遊戲前端文件
- `agent/frontend/`: 代理管理系統前端文件

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

### 方法一：直接部署GitHub倉庫

1. 登入 [Render](https://render.com/)
2. 點擊 "New" > "Web Service"
3. 連接此GitHub倉庫
4. 使用以下設置：
   - **Name**: bet-app（或自定義名稱）
   - **Environment**: Node
   - **Build Command**: npm install
   - **Start Command**: npm start
   - **Plan**: Free
5. 點擊 "Create Web Service"

### 方法二：使用render.yaml（已配置）

1. 登入 [Render](https://render.com/)
2. 點擊 "New" > "Blueprint"
3. 連接此GitHub倉庫
4. Render會自動使用倉庫中的`render.yaml`文件來配置服務
5. 點擊 "Apply" 完成部署

## 代理後端部署

如需單獨部署代理後端，可以創建另一個Web Service，使用`npm run start:agent`作為啟動命令。

## 環境變量

可以在Render的環境變量設置中添加以下變量：

- `PORT`: 應用端口（Render會自動指定）
- `NODE_ENV`: production（部署環境）

## 注意事項

- Render免費方案有使用限制，較長時間不活動會休眠服務
- 資料僅保存在內存中，服務重啟後會重置 