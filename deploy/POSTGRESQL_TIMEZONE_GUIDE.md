# PostgreSQL 時區設定完整指南

## 問題說明
PostgreSQL 預設使用 UTC 時間，這導致儲存的時間與台北時間相差 8 小時。

## 解決方案

### 方案 1：修改資料庫時區設定（推薦用於自己管理的資料庫）

```sql
-- 1. 設定當前會話的時區
SET timezone = 'Asia/Taipei';

-- 2. 設定整個資料庫的時區
ALTER DATABASE bet_game SET timezone TO 'Asia/Taipei';

-- 3. 驗證設定
SHOW timezone;
SELECT NOW();
```

**注意**：在 Render 等雲端服務上，可能沒有權限修改資料庫層級的時區設定。

### 方案 2：使用 TIMESTAMP WITH TIME ZONE（最佳實踐）

```sql
-- 修改表格欄位類型
ALTER TABLE result_history 
ALTER COLUMN created_at TYPE TIMESTAMP WITH TIME ZONE,
ALTER COLUMN draw_time TYPE TIMESTAMP WITH TIME ZONE;

-- 設定預設值
ALTER TABLE result_history 
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN draw_time SET DEFAULT CURRENT_TIMESTAMP;
```

### 方案 3：在應用程式層處理（最靈活）

這是我們已經實施的方案，在 Node.js 中：

```javascript
// 儲存時使用 JavaScript Date
const drawTime = new Date().toISOString();

// 或者使用 moment.js 處理時區
import moment from 'moment-timezone';
const drawTime = moment().tz('Asia/Taipei').format();
```

### 方案 4：使用 PostgreSQL 函數

```sql
-- 創建取得台北時間的函數
CREATE OR REPLACE FUNCTION get_taipei_time() 
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    RETURN CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Taipei';
END;
$$ LANGUAGE plpgsql;

-- 在插入時使用
INSERT INTO result_history (period, draw_time) 
VALUES ('20250725100', get_taipei_time());
```

## Render PostgreSQL 特別注意事項

在 Render 的 PostgreSQL 上，您可能遇到以下限制：

1. **無法修改系統時區**：Render 的資料庫時區固定為 UTC
2. **無法使用 ALTER SYSTEM**：沒有超級用戶權限
3. **建議方案**：
   - 使用 `TIMESTAMP WITH TIME ZONE` 類型
   - 在應用程式層處理時區轉換
   - 插入時明確指定時區

## 最佳實踐建議

1. **始終使用 TIMESTAMP WITH TIME ZONE**
   ```sql
   CREATE TABLE example (
       id SERIAL PRIMARY KEY,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   ```

2. **在查詢時轉換時區**
   ```sql
   SELECT 
       period,
       created_at AT TIME ZONE 'Asia/Taipei' as taipei_time
   FROM result_history;
   ```

3. **在應用程式中統一處理**
   - 儲存：始終儲存 UTC 時間
   - 顯示：在前端轉換為使用者的本地時區

## 檢查和診斷指令

```sql
-- 檢查當前設定
SHOW timezone;
SHOW log_timezone;

-- 檢查可用時區
SELECT * FROM pg_timezone_names WHERE name LIKE '%Taipei%';

-- 測試時區轉換
SELECT 
    NOW() as "UTC時間",
    NOW() AT TIME ZONE 'Asia/Taipei' as "台北時間",
    NOW() AT TIME ZONE 'America/New_York' as "紐約時間";
```

## 結論

對於 Render PostgreSQL，最實用的方案是：
1. 保持資料庫時區為 UTC（因為無法更改）
2. 使用 `TIMESTAMP WITH TIME ZONE` 類型
3. 在應用程式層（Node.js）處理時區轉換
4. 前端顯示時使用 `toLocaleString` 轉換為正確時區

這就是為什麼我們修改了 `fixed-draw-system.js` 中的程式碼，使用 `new Date().toISOString()` 來確保儲存正確的時間戳記。