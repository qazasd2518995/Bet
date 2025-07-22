# FS金彩賽車遊戲與代理管理系統

這是一個包含遊戲前後端和管理前後端的FS金彩賽車遊戲系統。

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

# FS金彩賽車遊戲系統修復總結

## 已修復的問題
1. **startUpdateTimers函數已添加** - 解決了`TypeError: this.startUpdateTimers is not a function`錯誤，現在系統可以正常更新遊戲數據、倒計時和餘額。

2. **音效播放問題已修復** - 解決了音效資源404錯誤和NotAllowedError問題：
   - 修正了音效文件路徑
   - 添加了更好的錯誤處理與提示
   - 使用Promise處理自動播放策略限制

3. **getOdds函數已實現** - 修復了下注API 500內部伺服器錯誤，現在可以正確取得賠率。

4. **餘額顯示問題已修復** - 確保了數字類型轉換正確：
   - 使用`parseFloat`處理API返回的餘額值 
   - 防止字符串與數字混合計算導致的不一致

5. **今日盈虧計算邏輯已修正** - 優化了計算方式，確保金額數據類型正確。

6. **下注API 500錯誤已修復** - 解決了下注操作後伺服器返回500內部錯誤的問題：
   - 添加了缺失的`updateMemberBalance`函數
   - 修正了`createBet`函數的錯誤處理，使用`BetModel.create`代替直接查詢
   - 優化了下注API的錯誤處理和日誌記錄

## 仍需關注的部分
1. **開獎動畫相關代碼** - 雖然修復了部分問題，但在遊戲界面中仍未看到完整的開獎動畫實現。

2. **資源加載優化** - 應考慮以下改進：
   - 使用preload預加載關鍵音效資源
   - 實現資源加載失敗後的重試機制

3. **錯誤處理優化** - 應添加更全面的錯誤處理機制：
   - API請求失敗的友好提示
   - 網絡中斷時的自動重連
   - 系統狀態異常時的恢復策略

4. **性能優化建議**:
   - 考慮使用WebSocket替代輪詢，減少服務器負擔
   - 實現更高效的狀態管理
   - 添加數據緩存機制，減少API請求次數

5. **測試覆蓋** - 建議添加自動化測試以確保系統穩定性：
   - 主要功能的單元測試
   - 關鍵流程的集成測試
   - 負載測試，特別是高並發下注場景

## 未來優化方向
1. 重構前端代碼為更現代的組件結構，提高可維護性
2. 添加更詳細的系統監控和日誌記錄
3. 優化數據庫結構和查詢性能
4. 增強安全性，包括輸入驗證和防止SQL注入
5. 優化移動端體驗
6. 實現更豐富的投注統計和分析功能 