# Render PostgreSQL 部署指南

## 資料庫連接資訊

您提供的Render PostgreSQL連接資訊：
```
postgresql://bet_game_user:Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy@dpg-d0e2imc9c44c73che3kg-a/bet_game
```

### 連接參數分解
- **主機**: `dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com`
- **端口**: `5432`
- **資料庫**: `bet_game`
- **用戶**: `bet_game_user`
- **密碼**: `Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy`
- **SSL**: 必須啟用

## 🔧 Render 環境變數設置

在Render控制台中設置以下環境變數：

### 基本應用設置
```bash
NODE_ENV=production
PORT=3002
AGENT_PORT=3003
```

### 資料庫設置
```bash
DATABASE_URL=postgresql://bet_game_user:Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy@dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com/bet_game
DB_HOST=dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com
DB_PORT=5432
DB_USER=bet_game_user
DB_PASSWORD=Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy
DB_NAME=bet_game
```

### 安全設置
```bash
JWT_SECRET=生成一個強密鑰
ENCRYPTION_KEY=生成32字符加密密鑰
SESSION_SECRET=生成會話密鑰
BCRYPT_ROUNDS=12
```

### CORS 設置
```bash
CORS_ORIGIN=https://your-app-name.onrender.com
ALLOWED_ORIGINS=https://your-game-app.onrender.com,https://your-agent-app.onrender.com
```

## 🗄️ 資料庫表結構檢查

執行以下腳本檢查資料庫：
```bash
node database-security-check.js
```

### 核心業務表
- ✅ `users` - 用戶基本資料
- ✅ `agents` - 代理商資料
- ✅ `members` - 會員資料
- ✅ `bet_history` - 投注歷史
- ✅ `result_history` - 開獎結果
- ✅ `game_state` - 遊戲狀態
- ✅ `transfer_records` - 轉帳記錄
- ✅ `transaction_records` - 交易記錄
- ✅ `draw_records` - 開獎記錄
- ✅ `announcements` - 公告資料

### 安全相關表
- 🔒 `security_logs` - 安全日誌
- 🔒 `login_attempts` - 登入嘗試記錄
- 🔒 `user_sessions` - 會話管理
- 🔒 `audit_logs` - 審計日誌
- 🔒 `ip_blacklist` - IP黑名單
- 🔒 `permissions` - 權限管理

## 📊 資料安全性保證

### 1. 連接安全
- ✅ SSL/TLS 加密連接
- ✅ 連接池管理 (最大30連接)
- ✅ 連接超時保護 (15秒)
- ✅ 查詢超時保護 (15秒)

### 2. 資料加密
- ✅ 密碼使用 bcrypt 加密
- ✅ 敏感資料欄位加密
- ✅ JWT Token 安全簽名
- ✅ 會話資料加密

### 3. 存取控制
- ✅ 用戶角色權限管理
- ✅ API 端點存取控制
- ✅ 資料庫層級權限控制
- ✅ IP 白名單/黑名單

### 4. 審計追蹤
- ✅ 所有操作日誌記錄
- ✅ 登入嘗試追蹤
- ✅ 資料變更審計
- ✅ 安全事件警報

## 🚀 部署步驟

### 1. 準備工作
```bash
# 1. 確保所有必要文件存在
ls -la package.json backend.js agentBackend.js

# 2. 檢查資料庫連接
node database-security-check.js

# 3. 測試本地環境
npm start
```

### 2. Render 部署設置
1. 連接GitHub repository
2. 設置環境變數（見上方清單）
3. 設置建置命令：`npm install`
4. 設置啟動命令：`npm start`

### 3. 資料庫初始化
部署後第一次執行：
```bash
# 自動執行資料庫初始化
# 已在 backend.js 和 agentBackend.js 中包含
```

## 🔍 監控和維護

### 日常檢查
- 監控資料庫連接數
- 檢查錯誤日誌
- 驗證備份狀態
- 檢查安全警報

### 定期任務
- 每日：檢查安全日誌
- 每週：資料庫效能檢查
- 每月：密鑰輪換
- 每季：安全審計

## 🛡️ 安全最佳實踐

### 1. 密鑰管理
- 使用強隨機密鑰
- 定期輪換密鑰
- 不在代碼中硬編碼敏感資訊
- 使用環境變數存儲秘密

### 2. 資料庫安全
- 啟用SSL連接
- 限制連接來源IP
- 定期備份資料
- 監控異常查詢

### 3. 應用安全
- 啟用HTTPS
- 設置CORS政策
- 實施速率限制
- 使用安全標頭

### 4. 監控告警
- 設置資料庫連接告警
- 監控磁盤使用率
- 追蹤異常登入
- 檢測可疑活動

## 📞 緊急聯絡

如果遇到資料庫問題：
1. 檢查Render控制台狀態
2. 驗證環境變數設置
3. 查看應用日誌
4. 聯絡Render支援

## ✅ 檢查清單

部署前確認：
- [ ] 所有環境變數已設置
- [ ] 資料庫連接測試通過
- [ ] SSL證書已配置
- [ ] 安全功能已啟用
- [ ] 監控告警已設置
- [ ] 備份策略已實施 