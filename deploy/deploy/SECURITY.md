# 🔒 安全部署與維護指南

## 📋 目錄

1. [緊急安全修復步驟](#緊急安全修復步驟)
2. [安全配置檢查清單](#安全配置檢查清單)
3. [部署前準備](#部署前準備)
4. [安全功能說明](#安全功能說明)
5. [日常維護](#日常維護)
6. [事件應對](#事件應對)
7. [安全最佳實踐](#安全最佳實踐)

## 🚨 緊急安全修復步驟

### 1. 立即執行的命令

```bash
# 安裝安全套件
npm install

# 執行資料庫安全升級
psql -U your_db_user -d your_db_name -f security/database-schema.sql

# 生成安全密鑰
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('INTERNAL_API_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

### 2. 更新環境變數

複製 `env.example` 到 `.env` 並設置所有必要的安全變數：

```bash
cp env.example .env
# 編輯 .env 文件，設置所有安全相關的環境變數
```

### 3. 更新現有密碼

```sql
-- 緊急：將所有現有明文密碼轉換為雜湊密碼
-- 注意：這需要在應用程式中實現密碼遷移邏輯
UPDATE agents SET password = 'NEED_RESET' WHERE length(password) < 60;
UPDATE members SET password = 'NEED_RESET' WHERE length(password) < 60;
```

## ✅ 安全配置檢查清單

### 環境變數檢查

- [ ] `JWT_SECRET` - 至少 64 個字符的隨機字符串
- [ ] `JWT_REFRESH_SECRET` - 不同於 JWT_SECRET 的隨機字符串
- [ ] `SESSION_SECRET` - 至少 64 個字符的隨機字符串
- [ ] `INTERNAL_API_KEY` - 內部服務通信密鑰
- [ ] `DATABASE_URL` - 使用 SSL 連接（生產環境）
- [ ] `ENCRYPTION_KEY` - 32 字符的加密密鑰
- [ ] `BCRYPT_ROUNDS` - 設置為 12 或更高
- [ ] `NODE_ENV` - 生產環境設置為 'production'

### 安全功能啟用

- [ ] `ENABLE_HELMET=true` - 安全頭部
- [ ] `ENABLE_RATE_LIMIT=true` - 速率限制
- [ ] `ENABLE_XSS_PROTECTION=true` - XSS 防護
- [ ] `ENABLE_SQL_INJECTION_PROTECTION=true` - SQL 注入防護
- [ ] `ENABLE_CSRF_PROTECTION=true` - CSRF 防護
- [ ] `ENABLE_SECURITY_LOGS=true` - 安全日誌
- [ ] `ENABLE_2FA=true` - 兩步驗證（建議）

### 網路安全設置

- [ ] HTTPS 證書已配置
- [ ] 防火牆規則已設置
- [ ] DDoS 防護已啟用
- [ ] IP 白名單/黑名單已配置
- [ ] 地理位置限制已設置

## 🚀 部署前準備

### 1. 資料庫準備

```sql
-- 執行所有安全相關的資料庫更新
\i security/database-schema.sql

-- 檢查安全表是否創建成功
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%security%' OR table_name LIKE '%audit%';
```

### 2. 密碼策略實施

所有新密碼必須符合以下要求：
- 最少 8 個字符
- 包含大小寫字母
- 包含數字
- 包含特殊字符
- 不能與用戶名相同
- 不能包含常見密碼

### 3. API 密鑰生成

```javascript
// 生成 API 密鑰的範例代碼
const crypto = require('crypto');

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// 為每個外部整合生成獨立的 API 密鑰
console.log('Payment Gateway API Key:', generateApiKey());
console.log('Analytics API Key:', generateApiKey());
console.log('Notification Service API Key:', generateApiKey());
```

## 🛡️ 安全功能說明

### 1. 密碼加密
- 使用 bcrypt 加密所有密碼
- 鹽值輪次：12 輪（可調整）
- 自動密碼強度驗證

### 2. JWT 認證
- Access Token 有效期：24 小時
- Refresh Token 有效期：7 天
- 支援 Token 黑名單機制

### 3. 速率限制
- 通用 API：15 分鐘內最多 100 次請求
- 登入嘗試：15 分鐘內最多 5 次
- 註冊：每小時最多 3 次
- 密碼重設：每小時最多 3 次

### 4. 安全日誌
- 所有登入嘗試記錄
- 敏感操作審計
- 異常活動警報
- IP 地址追蹤

### 5. SQL 注入防護
- 參數化查詢
- 輸入驗證
- 特殊字符轉義
- 查詢超時保護

### 6. XSS 防護
- 輸入過濾
- 輸出編碼
- Content Security Policy
- HttpOnly Cookies

## 📅 日常維護

### 每日檢查
1. 檢查安全日誌異常
2. 監控失敗登入次數
3. 檢查系統資源使用率
4. 驗證備份完整性

### 每週任務
1. 更新 IP 黑名單
2. 審查用戶權限
3. 檢查過期的 API 密鑰
4. 分析安全警報趨勢

### 每月任務
1. 密碼策略審查
2. 安全補丁更新
3. 滲透測試
4. 員工安全培訓

### 每季任務
1. 完整安全審計
2. 災難恢復演練
3. 密鑰輪換
4. 合規性檢查

## 🚨 事件應對

### 可疑活動處理

1. **立即響應**
   ```bash
   # 封鎖可疑 IP
   psql -c "INSERT INTO ip_blacklist (ip_address, reason) VALUES ('suspicious_ip', 'Suspicious activity detected')"
   
   # 檢查相關日誌
   grep "suspicious_ip" logs/security.log
   ```

2. **調查步驟**
   - 檢查安全日誌
   - 分析訪問模式
   - 識別受影響帳戶
   - 評估數據洩露風險

3. **緩解措施**
   - 強制受影響用戶重設密碼
   - 撤銷相關 API 密鑰
   - 增強監控
   - 通知相關方

### 數據洩露應對

1. **隔離**：立即隔離受影響系統
2. **評估**：確定洩露範圍和影響
3. **通知**：按法規要求通知用戶和監管機構
4. **修復**：修補漏洞並加強安全措施
5. **審查**：進行事後審查並更新應對計劃

## 🏆 安全最佳實踐

### 開發階段
1. 代碼審查包含安全檢查
2. 使用靜態代碼分析工具
3. 依賴項定期更新
4. 避免硬編碼敏感信息
5. 實施最小權限原則

### 部署階段
1. 使用安全的 CI/CD 管道
2. 環境隔離（開發/測試/生產）
3. 自動化安全測試
4. 配置管理和版本控制
5. 零信任網路架構

### 運營階段
1. 24/7 安全監控
2. 定期安全審計
3. 事件響應計劃
4. 業務連續性計劃
5. 持續安全培訓

## 📞 緊急聯絡

- 安全團隊郵箱：security@example.com
- 24/7 緊急熱線：+886-xxx-xxx-xxx
- 事件響應團隊：incident-response@example.com

## 🔗 相關資源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js 安全最佳實踐](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL 安全文檔](https://www.postgresql.org/docs/current/security.html)
- [Express.js 安全最佳實踐](https://expressjs.com/en/advanced/best-practice-security.html)

---

**重要提醒**：安全是一個持續的過程，而不是一次性的任務。定期審查和更新安全措施，保持對最新威脅的警覺。 