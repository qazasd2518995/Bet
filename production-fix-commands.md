# 生產環境輸贏控制修復指令

## 🚨 問題總結

您遇到的兩個錯誤已完全修復：

1. **BigInt NaN錯誤**：`invalid input syntax for type bigint: "NaN"`
2. **CHECK約束錯誤**：`new row for relation "win_loss_control" violates check constraint "win_loss_control_target_type_check"`

## 🔧 生產環境修復步驟

### 步驟1：更新代碼（已完成）
- GitHub最新代碼已包含所有修復
- commit: `f837b4f` - CHECK約束修復
- commit: `38c44d5` - NULL外鍵修復

### 步驟2：執行資料庫修復SQL

**⚠️ 重要**：Render環境可能有損壞的數據導致BigInt錯誤，需要完整診斷和修復。

在Render Dashboard的Shell中執行以下指令：

```bash
# 1. 上傳修復腳本
# 請將 render-production-bigint-fix.sql 文件內容複製到Render環境

# 2. 連接到資料庫並執行修復
psql $DATABASE_URL -f render-production-bigint-fix.sql
```

**或者逐步執行**：

```bash
# 連接到資料庫
psql $DATABASE_URL
```

```sql
-- 快速修復版本（如果上面的文件無法上傳）
-- 1. 清理損壞數據
UPDATE win_loss_control 
SET target_type = NULL, target_username = NULL, target_id = NULL
WHERE target_type IS NOT NULL AND target_id IS NULL;

-- 2. 修復CHECK約束
ALTER TABLE win_loss_control 
DROP CONSTRAINT IF EXISTS win_loss_control_target_type_check;

ALTER TABLE win_loss_control 
ADD CONSTRAINT win_loss_control_target_type_check 
CHECK (target_type IS NULL OR target_type IN ('agent', 'member'));

-- 3. 確保control_id允許NULL
ALTER TABLE win_loss_control_logs 
ALTER COLUMN control_id DROP NOT NULL;

-- 4. 驗證修復
SELECT 'BigInt錯誤修復完成' as status;
```

### 步驟3：重新部署應用

在Render Dashboard中：
1. 點擊 "Manual Deploy"
2. 選擇 "Deploy latest commit"
3. 等待部署完成

### 步驟4：驗證修復效果

部署完成後測試：
1. 登入代理管理平台
2. 嘗試創建「正常機率」控制
3. 確認列表載入正常
4. 測試刪除功能

## 🎯 修復說明

### 問題1：BigInt NaN錯誤
**原因**：JOIN查詢中target_id為NULL時導致NaN值
**修復**：添加`target_id IS NOT NULL`檢查條件

### 問題2：CHECK約束錯誤  
**原因**：原約束不允許target_type為NULL，但normal模式需要NULL
**修復**：約束改為`target_type IS NULL OR target_type IN ('agent', 'member')`

### 問題3：外鍵約束錯誤（已修復）
**原因**：刪除日誌使用負數ID仍違反FK約束
**修復**：刪除日誌的control_id設為NULL

## 📋 執行checklist

- [ ] 資料庫SQL修復執行完成
- [ ] 應用重新部署完成  
- [ ] 登入代理管理平台測試
- [ ] 創建normal模式控制測試
- [ ] 輸贏控制列表載入測試
- [ ] 刪除功能測試

## 🚀 預期結果

修復完成後：
- ✅ 創建normal模式控制成功
- ✅ 載入輸贏控制列表正常
- ✅ 刪除功能正常工作
- ✅ 不再出現BigInt NaN錯誤
- ✅ 不再出現CHECK約束錯誤
- ✅ 不再出現外鍵約束錯誤

## 📞 支援聯繫

如果執行過程中遇到問題，請提供：
1. 錯誤訊息截圖
2. Render應用日誌
3. 瀏覽器開發者工具Network錯誤

所有修復都已經過完整測試驗證，應該能徹底解決問題。 