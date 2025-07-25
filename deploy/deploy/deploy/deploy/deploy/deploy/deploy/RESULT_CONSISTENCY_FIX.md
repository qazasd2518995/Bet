# 開獎結果一致性問題修復報告

## 問題描述

期號 20250718493 出現開獎結果顯示與結算不一致的問題：
- 結算時使用的結果：第1名是2號（正確）
- 資料庫顯示的結果：第1名是7號（錯誤）

## 根本原因

`result_history` 表有兩種儲存開獎結果的方式：
1. `result` 欄位 - JSON 格式的陣列
2. `position_1` 到 `position_10` 欄位 - 個別儲存每個位置的號碼

問題發生在 `db/models/game.js` 中的某些 INSERT/UPDATE 語句只更新了 `result` 欄位，沒有同時更新 `position_*` 欄位，導致兩者不一致。

## 修復方案

### 1. 修復歷史資料
- 執行 `fix-result-json-consistency.js` 修復了所有不一致的記錄
- 以 `position_*` 欄位為準，更新 `result` JSON 欄位

### 2. 修正程式碼
修改 `db/models/game.js` 中的三處 SQL 語句：

#### a) INSERT 語句（第122-129行）
```javascript
// 修改前：只插入 period 和 result
INSERT INTO result_history (period, result) VALUES ($1, $2)

// 修改後：同時插入所有 position_* 欄位
INSERT INTO result_history (
  period, result,
  position_1, position_2, position_3, position_4, position_5,
  position_6, position_7, position_8, position_9, position_10
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
```

#### b) INSERT ON CONFLICT 語句（第107-122行）
```javascript
// 修改後：確保 ON CONFLICT 時也更新所有 position_* 欄位
ON CONFLICT (period) DO UPDATE SET
  result = EXCLUDED.result,
  position_1 = EXCLUDED.position_1, position_2 = EXCLUDED.position_2,
  ...
```

#### c) UPDATE 語句（第83-91行、第152-160行）
```javascript
// 修改後：UPDATE 時同時更新所有欄位
UPDATE result_history 
SET result = $1,
    position_1 = $3, position_2 = $4, ..., position_10 = $12,
    created_at = CURRENT_TIMESTAMP 
WHERE period = $2
```

### 3. 新增輔助函數
創建 `ensure-result-consistency.js` 提供：
- `ensureResultConsistency(period)` - 驗證並修復單個期號的一致性
- `getDrawResult(period)` - 統一使用 position_* 欄位獲取結果
- `getDrawResults(limit)` - 批量獲取結果

## 預防措施

1. **統一數據源**：前端應該統一使用 `position_*` 欄位，而不是 `result` JSON
2. **保存時驗證**：每次保存後立即驗證兩種格式是否一致
3. **使用輔助函數**：使用 `getDrawResult()` 函數確保獲取正確的數據

## 影響範圍

- 修復了共 29 筆歷史記錄的不一致問題
- 期號 20250718493 現在正確顯示第1名是2號
- 未來的開獎結果將自動保持一致性

## 後續建議

1. 考慮移除 `result` JSON 欄位，只使用 `position_*` 欄位
2. 或者建立資料庫觸發器，確保兩者始終同步
3. 監控系統日誌，確保不再出現類似問題