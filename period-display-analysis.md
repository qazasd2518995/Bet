# 期號顯示問題分析報告

## 問題描述
- 主畫面顯示完整期號格式：`202507241372`（YYYYMMDD + 序號）
- 歷史開獎只顯示當天序號：`214`、`213` 等
- 近期開獎記錄也有類似問題

## 期號處理邏輯分析

### 1. 後端期號生成邏輯
在 `backend.js` 中，期號生成遵循以下規則：
```javascript
// 期號格式：YYYYMMDD + 3位序號（001-999）
// 超過999則使用4位數字
const newPeriod = parseInt(`${gameDateStr}${suffix.toString().padStart(3, '0')}`);
```

### 2. 前端期號顯示邏輯

#### formatPeriodDisplay 函數（index.html 第9963-9975行）
```javascript
formatPeriodDisplay(period) {
    if (!period) return '';
    const periodStr = period.toString();
    if (periodStr.length >= 8) {
        // 將期號格式化为 YYYY-MM-DD-期數 的形式显示
        const year = periodStr.substring(0, 4);
        const month = periodStr.substring(4, 6);
        const day = periodStr.substring(6, 8);
        const num = periodStr.substring(8);
        return `${month}/${day} ${num}期`;  // 輸出：07/24 1372期
    }
    return periodStr;
}
```

#### 路線圖期號顯示（index.html 第7553行）
```javascript
<div class="period-info">{{ cell.period.toString().slice(-3) }}</div>
```
這裡使用 `slice(-3)` 只取最後3位數字。

## 問題根源

1. **formatPeriodDisplay 函數的邏輯問題**
   - 該函數將完整期號 `202507241372` 格式化為 `07/24 1372期`
   - 但在某些情況下，可能只顯示序號部分 `1372期`

2. **不一致的期號處理**
   - 主畫面：顯示完整期號
   - 歷史開獎：使用 `formatPeriodDisplay` 格式化
   - 路線圖：使用 `slice(-3)` 只取最後3位

3. **序號超過999的處理**
   - 當序號超過999時（如1372），`slice(-3)` 只會顯示 `372`
   - 這導致顯示不完整

## 建議修復方案

### 方案1：統一顯示格式
修改 `formatPeriodDisplay` 函數，根據需求統一顯示格式：
```javascript
formatPeriodDisplay(period, showDate = true) {
    if (!period) return '';
    const periodStr = period.toString();
    if (periodStr.length >= 8) {
        const month = periodStr.substring(4, 6);
        const day = periodStr.substring(6, 8);
        const num = periodStr.substring(8);
        
        if (showDate) {
            return `${month}/${day} ${num}期`;
        } else {
            return `${num}期`;  // 只顯示序號
        }
    }
    return periodStr;
}
```

### 方案2：修復路線圖期號顯示
```javascript
// 不使用 slice(-3)，改為提取序號部分
<div class="period-info">{{ cell.period.toString().substring(8) }}</div>
```

### 方案3：修改歷史開獎顯示邏輯
在歷史開獎中保持完整期號或只顯示序號，保持一致性。

## 影響範圍

1. **主畫面**：`frontend/index.html` - 第7892-7896行
2. **歷史開獎**：`frontend/index.html` - 第7193行、第9947行
3. **近期開獎記錄**：`frontend/index.html` - 第7067行
4. **路線圖**：`frontend/index.html` - 第7553行

## 測試建議

1. 檢查當天第1期（序號001）的顯示
2. 檢查序號999和1000交界處的顯示
3. 檢查跨日期時的期號顯示
4. 確保所有位置的期號顯示一致性